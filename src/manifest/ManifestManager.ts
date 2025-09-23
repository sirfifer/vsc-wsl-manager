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
            
            // Construct Windows path to access WSL filesystem
            const manifestPath = `\\\\wsl$\\${imageName}${MANIFEST_PATH_IN_IMAGE}`;
            
            // Check if file exists
            if (!fs.existsSync(manifestPath)) {
                logger.debug(`No manifest found in image: ${imageName}`);
                return null;
            }
            
            // Read the manifest file
            const content = fs.readFileSync(manifestPath, 'utf8');
            const manifest = JSON.parse(content) as Manifest;
            
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
            
            // Construct Windows path
            const manifestPath = `\\\\wsl$\\${imageName}${MANIFEST_PATH_IN_IMAGE}`;
            
            // Backup existing manifest if requested
            if (options.backup && fs.existsSync(manifestPath)) {
                const backupPath = manifestPath + '.backup';
                fs.copyFileSync(manifestPath, backupPath);
                logger.debug(`Backed up existing manifest to ${backupPath}`);
            }
            
            // Ensure directory exists (create via WSL command if needed)
            const manifestDir = path.dirname(MANIFEST_PATH_IN_IMAGE);
            await CommandBuilder.executeInDistribution(imageName, `mkdir -p ${manifestDir}`);
            
            // Write the manifest
            const content = JSON.stringify(manifest, null, 2);
            fs.writeFileSync(manifestPath, content, 'utf8');
            
            // Set appropriate permissions via WSL
            await CommandBuilder.executeInDistribution(imageName, `chmod 644 ${MANIFEST_PATH_IN_IMAGE}`);
            
            logger.info(`Manifest written to image: ${imageName}`);
        } catch (error) {
            logger.error(`Failed to write manifest to ${imageName}:`, error);
            throw error;
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
                    errors.push(`Layer ${index}: missing name`);
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
        
        return {
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
            warnings: warnings.length > 0 ? warnings : undefined,
            suggestions: suggestions.length > 0 ? suggestions : undefined
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
        
        // Compare metadata (only key fields)
        if (oldManifest.metadata.parent !== newManifest.metadata.parent) {
            diff.metadata_changes!.parent = newManifest.metadata.parent;
        }
        
        if (oldManifest.metadata.description !== newManifest.metadata.description) {
            diff.metadata_changes!.description = newManifest.metadata.description;
        }
        
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
            const manifestPath = `\\\\wsl$\\${imageName}${MANIFEST_PATH_IN_IMAGE}`;
            return fs.existsSync(manifestPath);
        } catch {
            return false;
        }
    }
    
    /**
     * Create a new manifest with metadata
     * @param metadata - Metadata for the manifest
     * @returns New manifest
     */
    createManifest(metadata: Partial<ManifestMetadata> = {}): Manifest {
        const now = new Date().toISOString();
        const finalMetadata = {
            ...metadata,
            id: metadata.id || uuidv4(),
            lineage: metadata.lineage || [metadata.name || 'unnamed'],
            created: metadata.created || now,
            created_by: metadata.created_by || TOOL_ID
        };

        return {
            version: MANIFEST_VERSION,
            metadata: finalMetadata as ManifestMetadata,
            layers: [],
            created: now,
            created_by: 'vscode-wsl-manager',
            history: []
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
                ...overlay.metadata
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