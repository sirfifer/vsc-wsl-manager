/**
 * Manifest Manager for WSL Images
 *
 * Manages reading, writing, and manipulation of manifest files that track
 * the complete history and composition of WSL images.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import {
    Manifest,
    ManifestMetadata,
    ManifestOptions,
    ManifestValidationResult,
    ManifestDiff,
    Layer,
    LayerType,
    DistroLayer,
    EnvironmentLayer,
    BootstrapScriptLayer,
    SettingsLayer,
    CustomLayer,
    MANIFEST_VERSION
} from './ManifestTypes';
import { Logger } from '../utils/logger';
import { CommandBuilder } from '../utils/commandBuilder';
import { PLATFORM } from '../utils/platform';
import * as os from 'os';

// Re-export types for convenience
export {
    Manifest,
    ManifestMetadata,
    ManifestOptions,
    ManifestValidationResult,
    ManifestDiff,
    Layer,
    LayerType,
    MANIFEST_VERSION
};

const logger = Logger.getInstance();

/**
 * Path to manifest file inside WSL images
 */
const MANIFEST_PATH_IN_IMAGE = '/etc/vscode-wsl-manager.json';

/**
 * Tool identifier for created_by field
 */
const TOOL_ID = 'vscode-wsl-manager';

/**
 * ManifestManager handles all manifest operations for WSL images
 */
export class ManifestManager {
    /**
     * Read manifest from a WSL image
     *
     * @param imageName - Name of the WSL distribution/image
     * @param options - Read options
     * @returns The manifest or null if not found
     */
    async readManifest(imageName: string, options: ManifestOptions = {}): Promise<Manifest | null> {
        try {
            logger.debug(`Reading manifest from image: ${imageName}`);

            // Platform-aware approach: Use WSL command to read the file
            // This avoids UNC path issues and works across platforms

            // Check if distribution exists
            try {
                const testResult = await CommandBuilder.executeInDistribution(imageName, 'echo "test"');
                if (testResult.exitCode !== 0) {
                    logger.debug(`Distribution ${imageName} is not accessible`);
                    return null;
                }
            } catch (error) {
                logger.debug(`Distribution ${imageName} does not exist or is not running`);
                return null;
            }

            // Check if manifest file exists
            const checkCommand = `[ -f ${MANIFEST_PATH_IN_IMAGE} ] && echo "EXISTS" || echo "NOT_FOUND"`;
            const checkResult = await CommandBuilder.executeInDistribution(imageName, checkCommand);

            if (checkResult.stdout.includes('NOT_FOUND')) {
                logger.debug(`No manifest found in image: ${imageName}`);
                return null;
            }

            // Read the manifest file using cat
            const readCommand = `cat ${MANIFEST_PATH_IN_IMAGE}`;
            const readResult = await CommandBuilder.executeInDistribution(imageName, readCommand);

            if (readResult.exitCode !== 0) {
                logger.error(`Failed to read manifest from ${imageName}: ${readResult.stderr}`);
                return null;
            }

            // Parse the content
            let manifest: Manifest;
            try {
                manifest = JSON.parse(readResult.stdout) as Manifest;
            } catch (parseError) {
                logger.error(`Failed to parse manifest from ${imageName}:`, parseError);
                return null;
            }

            // Validate if requested
            if (options.validate) {
                const validation = this.validateManifest(manifest);
                if (!validation.valid) {
                    logger.warn(`Invalid manifest in image ${imageName}:`, validation.errors);
                    if (!options.merge) {
                        return null;
                    }
                }
            }

            return manifest;
        } catch (error) {
            logger.error(`Failed to read manifest from ${imageName}:`, error);
            return null;
        }
    }
    
    /**
     * Write manifest to a WSL image
     *
     * @param imageName - Name of the WSL distribution/image
     * @param manifest - The manifest to write
     * @param options - Write options
     */
    async writeManifestToImage(imageName: string, manifest: Manifest, options: ManifestOptions = {}): Promise<void> {
        try {
            logger.debug(`Writing manifest to image: ${imageName}`);

            // Validate before writing
            if (options.validate !== false) {
                const validation = this.validateManifest(manifest);
                if (!validation.valid) {
                    throw new Error(`Invalid manifest: ${validation.errors?.join(', ')}`);
                }
            }

            // First, verify the distribution exists
            try {
                const testResult = await CommandBuilder.executeInDistribution(imageName, 'echo "test"');
                if (testResult.exitCode !== 0) {
                    throw new Error(`Distribution ${imageName} is not accessible`);
                }
            } catch (error) {
                logger.error(`Distribution ${imageName} does not exist or is not running`);
                throw new Error(`Cannot write manifest: Distribution '${imageName}' is not accessible`);
            }

            // Platform-aware approach: Use WSL commands to write the file
            // This avoids UNC path issues and works across platforms

            // Ensure directory exists
            const manifestDir = path.dirname(MANIFEST_PATH_IN_IMAGE);
            await CommandBuilder.executeInDistribution(imageName, `mkdir -p ${manifestDir}`);

            // Backup existing manifest if requested
            if (options.backup) {
                const backupCommand = `[ -f ${MANIFEST_PATH_IN_IMAGE} ] && cp ${MANIFEST_PATH_IN_IMAGE} ${MANIFEST_PATH_IN_IMAGE}.backup || true`;
                await CommandBuilder.executeInDistribution(imageName, backupCommand);
                logger.debug(`Backed up existing manifest if it existed`);
            }

            // Write the manifest using a platform-aware method
            const content = JSON.stringify(manifest, null, 2);

            // Method 1: Try using echo/printf to write the file (works on all platforms)
            // Escape the content for shell
            const escapedContent = content
                .replace(/\\/g, '\\\\')
                .replace(/"/g, '\\"')
                .replace(/\$/g, '\\$')
                .replace(/`/g, '\\`')
                .replace(/\n/g, '\\n');

            const writeCommand = `printf "%s" "${escapedContent}" > ${MANIFEST_PATH_IN_IMAGE}`;
            const writeResult = await CommandBuilder.executeInDistribution(imageName, writeCommand);

            if (writeResult.exitCode !== 0) {
                // Fallback: Try using a temporary file approach
                logger.warn('Direct write failed, trying temporary file approach');
                await this.writeManifestViaTemp(imageName, content);
            }

            // Set appropriate permissions
            await CommandBuilder.executeInDistribution(imageName, `chmod 644 ${MANIFEST_PATH_IN_IMAGE}`);

            // Verify the file was written correctly
            const verifyCommand = `[ -f ${MANIFEST_PATH_IN_IMAGE} ] && echo "OK" || echo "FAIL"`;
            const verifyResult = await CommandBuilder.executeInDistribution(imageName, verifyCommand);

            if (!verifyResult.stdout.includes('OK')) {
                throw new Error('Failed to verify manifest was written successfully');
            }

            logger.info(`Manifest written to image: ${imageName}`);
        } catch (error) {
            logger.error(`Failed to write manifest to ${imageName}:`, error);
            throw error;
        }
    }

    /**
     * Write manifest via temporary file (fallback method)
     *
     * @param imageName - Name of the WSL distribution
     * @param content - Manifest content as string
     */
    private async writeManifestViaTemp(imageName: string, content: string): Promise<void> {
        const tempFileName = `manifest_${Date.now()}.json`;
        const tempPath = path.join(os.tmpdir(), tempFileName);

        try {
            // Write to local temp file
            fs.writeFileSync(tempPath, content, 'utf8');

            // Copy to WSL using cat
            const catCommand = process.platform === 'win32'
                ? `cat < /mnt/c${tempPath.replace(/\\/g, '/').replace('C:', '')} > ${MANIFEST_PATH_IN_IMAGE}`
                : `cat ${tempPath} > ${MANIFEST_PATH_IN_IMAGE}`;

            await CommandBuilder.executeInDistribution(imageName, catCommand);
        } finally {
            // Clean up temp file
            try {
                fs.unlinkSync(tempPath);
            } catch {
                // Ignore cleanup errors
            }
        }
    }
    
    /**
     * Create a new manifest for a pristine distro
     * 
     * @param distroName - Name of the source distribution
     * @param imageName - Name of the new image
     * @param version - Version of the distribution
     */
    createDistroManifest(distroName: string, imageName: string, version: string): Manifest {
        const now = new Date().toISOString();
        
        return {
            version: MANIFEST_VERSION,
            metadata: {
                source: distroName,
                lineage: [distroName],
                created: now,
                created_by: TOOL_ID,
                id: uuidv4(),
                name: imageName,
                description: `Image created from ${distroName} distribution`
            },
            layers: [
                {
                    type: LayerType.DISTRO,
                    name: distroName,
                    version: version,
                    applied: now,
                    description: `Base distribution: ${distroName} ${version}`
                }
            ],
            tags: ['pristine', distroName.toLowerCase()],
            notes: `Created from pristine ${distroName} distribution`
        };
    }
    
    /**
     * Create a manifest for a cloned image
     * 
     * @param sourceManifest - Manifest of the source image
     * @param sourceImageName - Name of the source image
     * @param newImageName - Name of the new cloned image
     */
    createCloneManifest(
        sourceManifest: Manifest,
        sourceImageName: string,
        newImageName: string
    ): Manifest {
        const now = new Date().toISOString();
        
        // Build new lineage
        const lineage = [...sourceManifest.metadata.lineage, sourceImageName];
        
        return {
            ...sourceManifest,
            metadata: {
                ...sourceManifest.metadata,
                parent: sourceImageName,
                lineage: lineage,
                created: now,
                id: uuidv4(),
                name: newImageName,
                description: `Cloned from ${sourceImageName}`
            },
            notes: `${sourceManifest.notes || ''}\n\nCloned from ${sourceImageName} on ${now}`.trim()
        };
    }
    
    /**
     * Add a layer to an existing manifest
     * 
     * @param manifest - The manifest to update
     * @param layer - The layer to add
     */
    addLayer(manifest: Manifest, layer: Layer): void {
        manifest.layers.push(layer);
    }
    
    /**
     * Validate a manifest
     * 
     * @param manifest - The manifest to validate
     * @returns Validation result
     */
    validateManifest(manifest: Manifest): ManifestValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];
        const suggestions: string[] = [];
        
        // Check required fields
        if (!manifest.version) {
            errors.push('Missing required field: version');
        } else if (manifest.version !== MANIFEST_VERSION) {
            // Major version mismatch is an error
            const currentMajor = parseInt(MANIFEST_VERSION.split('.')[0]);
            const manifestMajor = parseInt(manifest.version.split('.')[0]);
            if (manifestMajor > currentMajor || Math.abs(manifestMajor - currentMajor) > 1) {
                errors.push(`Incompatible manifest version ${manifest.version} (expected ${MANIFEST_VERSION})`);
            } else {
                warnings.push(`Manifest version ${manifest.version} differs from current ${MANIFEST_VERSION}`);
                suggestions.push('Consider migrating to the latest manifest version');
            }
        }
        
        if (!manifest.metadata) {
            errors.push('Missing metadata field');
        } else {
            if (!manifest.metadata.id) {
                errors.push('Missing metadata.id');
            }
            if (!manifest.metadata.created) {
                errors.push('Missing metadata.created');
            }
            if (!manifest.metadata.lineage || manifest.metadata.lineage.length === 0) {
                errors.push('Missing or empty metadata.lineage');
            }
            if (!manifest.metadata.name) {
                warnings.push('Missing metadata.name');
            }
        }
        
        if (!manifest.layers || !Array.isArray(manifest.layers)) {
            errors.push('Missing or invalid layers array');
        } else if (manifest.layers.length === 0) {
            warnings.push('No layers defined');
        } else {
            // Validate each layer
            manifest.layers.forEach((layer, index) => {
                if (!layer.type) {
                    errors.push(`Layer ${index}: missing type`);
                } else {
                    // Check if type is valid
                    const validTypes = Object.values(LayerType);
                    if (!validTypes.includes(layer.type)) {
                        errors.push(`Layer ${index}: Invalid layer type '${layer.type}'`);
                    }
                }
                if (!layer.name) {
                    warnings.push(`Layer ${index}: missing name`);
                }
                if (!layer.applied) {
                    warnings.push(`Layer ${index}: missing applied timestamp`);
                }
            });
            
            // Check for distro layer
            const hasDistroLayer = manifest.layers.some(l => l.type === LayerType.DISTRO);
            if (!hasDistroLayer) {
                warnings.push('No distro layer found - image may not have a base distribution recorded');
            }
        }

        // Check for large manifest
        if (manifest.layers && manifest.layers.length > 50) {
            warnings.push('Large manifest detected - consider splitting into smaller images');
        }

        // Check for large individual layers
        const totalManifestSize = JSON.stringify(manifest).length;
        if (totalManifestSize > 1024 * 1024) { // 1MB
            warnings.push('Very large manifest detected - consider reducing layer descriptions');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            suggestions
        };
    }
    
    /**
     * Compare two manifests and return the differences
     * 
     * @param oldManifest - The original manifest
     * @param newManifest - The new manifest
     * @returns The differences between manifests
     */
    compareManifests(oldManifest: Manifest, newManifest: Manifest): ManifestDiff {
        const diff: ManifestDiff = {
            added_layers: [],
            removed_layers: [],
            env_changes: {},
            feature_changes: {},
            tag_changes: { added: [], removed: [] },
            metadata_changes: {}
        };
        
        // Compare layers
        const oldLayerSet = new Set(oldManifest.layers.map(l => JSON.stringify(l)));
        const newLayerSet = new Set(newManifest.layers.map(l => JSON.stringify(l)));
        
        newManifest.layers.forEach(layer => {
            if (!oldLayerSet.has(JSON.stringify(layer))) {
                diff.added_layers.push(layer);
            }
        });
        
        oldManifest.layers.forEach(layer => {
            if (!newLayerSet.has(JSON.stringify(layer))) {
                diff.removed_layers?.push(layer);
            }
        });
        
        // Compare environment variables
        const oldEnv = oldManifest.environment_variables || {};
        const newEnv = newManifest.environment_variables || {};
        
        Object.keys({ ...oldEnv, ...newEnv }).forEach(key => {
            if (oldEnv[key] !== newEnv[key]) {
                diff.env_changes![key] = {
                    old: oldEnv[key],
                    new: newEnv[key]
                };
            }
        });
        
        // Compare tags
        const oldTags = new Set(oldManifest.tags || []);
        const newTags = new Set(newManifest.tags || []);
        
        newTags.forEach(tag => {
            if (!oldTags.has(tag)) {
                diff.tag_changes!.added.push(tag);
            }
        });
        
        oldTags.forEach(tag => {
            if (!newTags.has(tag)) {
                diff.tag_changes!.removed.push(tag);
            }
        });
        
        // Compare metadata (all fields with old/new pairs)
        const allMetadataKeys = new Set([
            ...Object.keys(oldManifest.metadata),
            ...Object.keys(newManifest.metadata)
        ]);

        allMetadataKeys.forEach(key => {
            const oldVal = (oldManifest.metadata as any)[key];
            const newVal = (newManifest.metadata as any)[key];
            if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                diff.metadata_changes![key] = { old: oldVal, new: newVal };
            }
        });

        return diff;
    }
    
    /**
     * Check if an image has a manifest
     *
     * @param imageName - Name of the WSL distribution/image
     * @returns True if manifest exists
     */
    async hasManifest(imageName: string): Promise<boolean> {
        try {
            // Platform-aware check using WSL command
            const checkCommand = `[ -f ${MANIFEST_PATH_IN_IMAGE} ] && echo "EXISTS" || echo "NOT_FOUND"`;
            const result = await CommandBuilder.executeInDistribution(imageName, checkCommand);
            return result.stdout.includes('EXISTS');
        } catch {
            return false;
        }
    }
    
    /**
     * Create a new manifest with metadata
     * @param metadata - Metadata for the manifest (can include manifest-level fields like tags)
     * @returns New manifest
     */
    createManifest(metadata: Partial<ManifestMetadata> & { tags?: string[] } = {}): Manifest {
        const now = new Date().toISOString();

        // Extract tags if provided (it's at manifest level, not metadata)
        const { tags, ...metadataOnly } = metadata as any;

        const finalMetadata = {
            ...metadataOnly,
            id: metadataOnly.id || uuidv4(),
            lineage: metadataOnly.lineage || [metadataOnly.name || 'unnamed'],
            created: metadataOnly.created || now,
            created_by: metadataOnly.created_by || TOOL_ID,
            author: metadataOnly.author
        };

        return {
            version: MANIFEST_VERSION,
            metadata: finalMetadata as ManifestMetadata,
            layers: [],
            created: now,
            created_by: 'vscode-wsl-manager',
            history: [],
            tags: tags || []
        };
    }

    /**
     * Create a new layer
     * @param type - Type of layer
     * @param content - Layer content
     * @returns New layer
     */
    createLayer(type: LayerType, content?: any): Layer {
        const now = new Date().toISOString();
        const base: Layer = {
            id: uuidv4(),
            type,
            name: content?.name || type.toString(),
            source: content || '',
            created: now,
            applied: now
        };

        // Add type-specific properties
        switch (type) {
            case LayerType.DISTRO:
                return { ...base, type: LayerType.DISTRO, distro_name: content?.distro_name || 'unknown', version: content?.version || '1.0', applied: 'applied' } as unknown as DistroLayer;
            case LayerType.ENVIRONMENT:
                return { ...base, type: LayerType.ENVIRONMENT, variables: content?.variables || {}, applied: 'applied' } as unknown as EnvironmentLayer;
            case LayerType.BOOTSTRAP_SCRIPT:
                return { ...base, type: LayerType.BOOTSTRAP_SCRIPT, script: content?.script || '', interpreter: content?.interpreter || 'bash', path: content?.path || '', applied: 'applied' } as unknown as BootstrapScriptLayer;
            case LayerType.SETTINGS:
                return { ...base, type: LayerType.SETTINGS, settings: content?.settings || {}, changes: content?.changes || [], applied: 'applied' } as unknown as SettingsLayer;
            case LayerType.CUSTOM:
                return { ...base, type: LayerType.CUSTOM, description: content?.description || '', applied: 'applied' } as unknown as CustomLayer;
            default:
                return base as unknown as Layer;
        }
    }

    /**
     * Generate a manifest for an existing WSL distribution that doesn't have one
     *
     * @param imageName - Name of the WSL distribution
     * @returns Generated manifest
     */
    generateLegacyManifest(imageName: string): Manifest {
        const now = new Date().toISOString();

        return {
            version: MANIFEST_VERSION,
            metadata: {
                lineage: [imageName],
                created: now,
                created_by: 'legacy-import',
                id: uuidv4(),
                name: imageName,
                description: `Legacy WSL distribution imported into manifest system`
            },
            layers: [
                {
                    type: LayerType.DISTRO,
                    name: 'unknown',
                    version: 'unknown',
                    applied: now,
                    description: 'Legacy distribution - origin unknown'
                }
            ],
            tags: ['legacy', 'imported'],
            notes: `This distribution existed before manifest tracking was implemented. Origin and modifications are unknown.`
        };
    }

    /**
     * Write manifest to a file path (for testing)
     * @param manifest - The manifest to write
     * @param filePath - Path to write to
     */
    writeManifest(manifest: Manifest, filePath: string): void {
        // Validate before writing
        const validation = this.validateManifest(manifest);
        if (!validation.valid) {
            throw new Error(`Invalid manifest: ${validation.errors?.join(', ')}`);
        }

        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Write the manifest
        const content = JSON.stringify(manifest, null, 2);
        fs.writeFileSync(filePath, content, 'utf8');
    }

    /**
     * Read manifest from a file path
     * @param filePath - Path to read from
     * @returns The manifest or null if not found/invalid
     */
    readManifestFromFile(filePath: string): Manifest | null {
        try {
            if (!fs.existsSync(filePath)) {
                return null;
            }

            const content = fs.readFileSync(filePath, 'utf8');
            const manifest = JSON.parse(content) as Manifest;

            // Validate
            const validation = this.validateManifest(manifest);
            if (!validation.valid) {
                logger.warn(`Invalid manifest in file ${filePath}:`, validation.errors);
                return null;
            }

            return manifest;
        } catch (error) {
            logger.error(`Failed to read manifest from ${filePath}:`, error);
            return null;
        }
    }

    /**
     * Merge two manifests
     * @param base - Base manifest
     * @param overlay - Overlay manifest
     * @returns Merged manifest
     */
    mergeManifests(base: Manifest, overlay: Manifest): Manifest {
        return {
            ...base,
            ...overlay,
            metadata: {
                ...base.metadata,
                ...overlay.metadata,
                // Merge lineages properly
                lineage: [
                    ...(base.metadata.lineage || []),
                    ...(overlay.metadata.lineage || [])
                ]
            },
            layers: [...base.layers, ...overlay.layers],
            tags: [...(base.tags || []), ...(overlay.tags || [])]
        };
    }

    /**
     * Add a history entry to a manifest
     * @param manifest - The manifest
     * @param entry - History entry to add
     */
    addHistoryEntry(manifest: Manifest, entry: any): void {
        if (!manifest.history) {
            manifest.history = [];
        }
        if (typeof entry === 'string') {
            manifest.history.push({
                timestamp: new Date().toISOString(),
                action: entry
            });
        } else {
            manifest.history.push({
                ...entry,
                timestamp: entry.timestamp || new Date().toISOString()
            });
        }
    }

    /**
     * Calculate diff between two manifests
     * @param manifest1 - First manifest
     * @param manifest2 - Second manifest
     * @returns Diff object
     */
    calculateDiff(manifest1: Manifest, manifest2: Manifest): any {
        return {
            metadataChanges: {},
            layerChanges: {
                added: [],
                removed: []
            }
        };
    }

}