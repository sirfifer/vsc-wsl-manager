/**
 * WSL Image Manager (Two-World Architecture)
 * 
 * Manages WSL working images (instances) that are created from pristine distros.
 * Integrates with the manifest system to track lineage and modifications.
 */

import * as fs from 'fs';
import * as path from 'path';
import { CommandBuilder, CommandOptions } from '../utils/commandBuilder';
import { Logger } from '../utils/logger';
import { ManifestManager } from '../manifest/ManifestManager';
import { DistroManager } from '../distros/DistroManager';
import { Manifest, LayerType } from '../manifest/ManifestTypes';
import { v4 as uuidv4 } from 'uuid';
import { CrossPlatformCommandExecutor } from '../utils/commandExecutor';
import { PLATFORM } from '../utils/platform';

const logger = Logger.getInstance();

/**
 * Image metadata for the new architecture
 */
export interface ImageMetadata {
    /** Unique identifier */
    id: string;
    
    /** Image name (also the WSL distribution name) */
    name: string;
    
    /** Display name for UI */
    displayName: string;
    
    /** Description */
    description?: string;
    
    /** Source distro or parent image */
    source: string;
    
    /** Type of source */
    sourceType: 'distro' | 'image';
    
    /** Creation timestamp */
    created: string;
    
    /** Size in bytes */
    size?: number;
    
    /** WSL version (usually 2) */
    wslVersion: number;
    
    /** Tags for categorization */
    tags?: string[];
    
    /** Author/creator */
    author?: string;
    
    /** Whether this image has a manifest */
    hasManifest: boolean;
    
    /** Whether terminal profile is enabled */
    enabled: boolean;

    /** Scope determines where the image is visible */
    scope?: {
        type: 'global' | 'workspace';
        workspacePath?: string;  // Path to workspace folder (only for workspace scope)
        workspaceName?: string;  // Display name of workspace
    };

    /** Installation path */
    installPath?: string;

    /** Current state */
    state?: 'Running' | 'Stopped';
}

/**
 * Options for creating an image from a distro
 */
export interface CreateFromDistroOptions {
    /** Display name for the image */
    displayName?: string;

    /** Description */
    description?: string;

    /** Installation path (defaults to %USERPROFILE%\.wsl\{name}) */
    installPath?: string;

    /** Tags to apply */
    tags?: string[];

    /** Author information */
    author?: string;

    /** WSL version (defaults to 2) */
    wslVersion?: number;

    /** Whether to enable terminal profile */
    enableTerminal?: boolean;

    /** Scope for image visibility */
    scope?: {
        type: 'global' | 'workspace';
        workspacePath?: string;
        workspaceName?: string;
    };
}

/**
 * Options for cloning an image
 */
export interface CloneImageOptions {
    /** Display name for the new image */
    displayName?: string;
    
    /** Description */
    description?: string;
    
    /** Installation path */
    installPath?: string;
    
    /** Additional tags */
    tags?: string[];
    
    /** Whether to enable terminal profile */
    enableTerminal?: boolean;

    /** Scope for image visibility */
    scope?: {
        type: 'global' | 'workspace';
        workspacePath?: string;
        workspaceName?: string;
    };
}

/**
 * WSL Image Manager - manages working WSL instances
 */
export class WSLImageManager {
    private readonly manifestManager: ManifestManager;
    private readonly distroManager: DistroManager;
    private readonly metadataPath: string;
    private imageMetadata: Map<string, ImageMetadata> = new Map();
    
    constructor(
        manifestManager?: ManifestManager,
        distroManager?: DistroManager
    ) {
        this.manifestManager = manifestManager || new ManifestManager();
        this.distroManager = distroManager || new DistroManager();
        
        // Store metadata in %USERPROFILE%/.vscode-wsl-manager/images.json
        const baseDir = path.join(
            process.env.USERPROFILE || process.env.HOME || '',
            '.vscode-wsl-manager'
        );
        this.metadataPath = path.join(baseDir, 'images.json');
        
        this.loadMetadataInternal();
    }
    
    /**
     * Load image metadata from disk
     */
    private loadMetadataInternal(): void {
        try {
            if (fs.existsSync(this.metadataPath)) {
                const content = fs.readFileSync(this.metadataPath, 'utf8');
                const data = JSON.parse(content);
                this.imageMetadata = new Map(Object.entries(data));
                logger.debug(`Loaded metadata for ${this.imageMetadata.size} images`);
            }
        } catch (error) {
            logger.error('Failed to load image metadata:', error as Error);
            this.imageMetadata = new Map();
        }
    }
    
    /**
     * Save image metadata to disk
     */
    private saveMetadataInternal(): void {
        try {
            const dir = path.dirname(this.metadataPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            const data = Object.fromEntries(this.imageMetadata);
            fs.writeFileSync(this.metadataPath, JSON.stringify(data, null, 2), 'utf8');
            logger.debug('Saved image metadata');
        } catch (error) {
            logger.error('Failed to save image metadata:', error as Error);
        }
    }
    
    /**
     * Create a new image from a pristine distro
     */
    async createFromDistro(
        distroName: string,
        imageName: string,
        options: CreateFromDistroOptions = {}
    ): Promise<void> {
        logger.info(`Creating image '${imageName}' from distro '${distroName}'`);
        
        // Check if distro exists and is available
        const distro = await this.distroManager.getDistro(distroName);
        if (!distro) {
            throw new Error(`Distro not found: ${distroName}`);
        }
        
        if (!distro.available || !distro.filePath) {
            throw new Error(`Distro not available locally: ${distroName}. Please download it first.`);
        }
        
        // Check if image name already exists
        const existingDistros = await this.listWSLDistributions();
        if (existingDistros.includes(imageName)) {
            throw new Error(`WSL distribution already exists: ${imageName}`);
        }
        
        // Determine installation path
        const installPath = options.installPath || path.join(
            process.env.USERPROFILE || process.env.HOME || '',
            '.wsl',
            imageName
        );
        
        // Create installation directory
        if (!fs.existsSync(installPath)) {
            fs.mkdirSync(installPath, { recursive: true });
        }
        
        try {
            // Check if the file is actually TAR or a misnamed APPX
            let importFilePath = distro.filePath;
            const isActuallyTar = await this.checkIfTarFormat(distro.filePath);

            if (!isActuallyTar) {
                logger.warn(`File ${distro.filePath} is not TAR format, attempting to extract TAR from APPX...`);
                const extractedPath = await this.extractTarFromMisnamedAppx(distro.filePath);
                if (extractedPath) {
                    importFilePath = extractedPath;
                    logger.info(`Successfully extracted TAR file for import`);
                } else {
                    throw new Error(`Failed to extract TAR from ${distro.filePath}. The file may be corrupted.`);
                }
            }

            // Import the distro as a new WSL distribution
            logger.debug(`Importing ${distroName} to ${imageName} at ${installPath}`);
            await CommandBuilder.executeWSL([
                '--import',
                imageName,
                installPath,
                importFilePath,
                '--version',
                String(options.wslVersion || 2)
            ], { timeout: 300000 } as CommandOptions); // 5 minutes

            // Clean up extracted file if we created one
            if (importFilePath !== distro.filePath && fs.existsSync(importFilePath)) {
                fs.unlinkSync(importFilePath);
            }
            
            // Create and write manifest
            const manifest = this.manifestManager.createDistroManifest(
                distroName,
                imageName,
                distro.version
            );
            
            // Add optional metadata
            if (options.description) {
                manifest.metadata.description = options.description;
            }
            if (options.author) {
                manifest.metadata.created_by = options.author;
            }
            if (options.tags) {
                manifest.tags = [...(manifest.tags || []), ...options.tags];
            }
            
            // Write manifest to the new image
            await this.manifestManager.writeManifestToImage(imageName, manifest);
            
            // Create metadata entry
            const metadata: ImageMetadata = {
                id: uuidv4(),
                name: imageName,
                displayName: options.displayName || imageName,
                description: options.description,
                source: distroName,
                sourceType: 'distro',
                created: new Date().toISOString(),
                size: distro.size,
                wslVersion: options.wslVersion || 2,
                tags: options.tags,
                author: options.author,
                hasManifest: true,
                enabled: options.enableTerminal !== false,
                scope: options.scope,
                installPath
            };
            
            this.imageMetadata.set(imageName, metadata);
            this.saveMetadataInternal();
            
            logger.info(`Successfully created image '${imageName}' from distro '${distroName}'`);
        } catch (error) {
            // Clean up on failure
            try {
                await CommandBuilder.executeWSL(['--unregister', imageName]);
            } catch {
                // Ignore cleanup errors
            }
            
            if (fs.existsSync(installPath)) {
                fs.rmSync(installPath, { recursive: true });
            }
            
            throw error;
        }
    }
    
    /**
     * Clone an existing image
     */
    async cloneImage(
        sourceImageName: string,
        newImageName: string,
        options: CloneImageOptions = {}
    ): Promise<void> {
        logger.info(`Cloning image '${sourceImageName}' to '${newImageName}'`);
        
        // Check source exists
        const existingDistros = await this.listWSLDistributions();
        if (!existingDistros.includes(sourceImageName)) {
            throw new Error(`Source image not found: ${sourceImageName}`);
        }
        
        // Check target doesn't exist
        if (existingDistros.includes(newImageName)) {
            throw new Error(`Target image already exists: ${newImageName}`);
        }
        
        // Get source metadata
        const sourceMetadata = this.imageMetadata.get(sourceImageName);
        
        // Determine installation path
        const installPath = options.installPath || path.join(
            process.env.USERPROFILE || process.env.HOME || '',
            '.wsl',
            newImageName
        );
        
        // Create installation directory
        if (!fs.existsSync(installPath)) {
            fs.mkdirSync(installPath, { recursive: true });
        }
        
        // Create temp directory for export/import
        const tempDir = path.join(
            process.env.TEMP || '/tmp',
            `wsl-clone-${Date.now()}`
        );
        fs.mkdirSync(tempDir, { recursive: true });
        
        const tempTarPath = path.join(tempDir, 'export.tar');
        
        try {
            // Export source image
            logger.debug(`Exporting ${sourceImageName} to temporary tar`);
            await CommandBuilder.executeWSL([
                '--export',
                sourceImageName,
                tempTarPath
            ], { timeout: 300000 } as CommandOptions);
            
            // Import as new image
            logger.debug(`Importing to ${newImageName} at ${installPath}`);
            await CommandBuilder.executeWSL([
                '--import',
                newImageName,
                installPath,
                tempTarPath,
                '--version',
                String(sourceMetadata?.wslVersion || 2)
            ], { timeout: 300000 } as CommandOptions);
            
            // Handle manifest
            const sourceManifest = await this.manifestManager.readManifest(sourceImageName);
            if (sourceManifest) {
                const clonedManifest = this.manifestManager.createCloneManifest(
                    sourceManifest,
                    sourceImageName,
                    newImageName
                );
                
                // Add optional metadata
                if (options.description) {
                    clonedManifest.metadata.description = options.description;
                }
                if (options.tags) {
                    clonedManifest.tags = [...(clonedManifest.tags || []), ...options.tags];
                }
                
                await this.manifestManager.writeManifestToImage(newImageName, clonedManifest);
            }
            
            // Create metadata entry
            const metadata: ImageMetadata = {
                id: uuidv4(),
                name: newImageName,
                displayName: options.displayName || newImageName,
                description: options.description || `Cloned from ${sourceImageName}`,
                source: sourceImageName,
                sourceType: 'image',
                created: new Date().toISOString(),
                size: sourceMetadata?.size,
                wslVersion: sourceMetadata?.wslVersion || 2,
                tags: options.tags,
                author: sourceMetadata?.author,
                hasManifest: sourceManifest !== null,
                enabled: options.enableTerminal !== false,
                scope: options.scope || sourceMetadata?.scope,  // Use provided scope or inherit from source
                installPath
            };
            
            this.imageMetadata.set(newImageName, metadata);
            this.saveMetadataInternal();
            
            logger.info(`Successfully cloned '${sourceImageName}' to '${newImageName}'`);
        } finally {
            // Clean up temp files
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true });
            }
        }
    }
    
    /**
     * List all WSL distributions (images)
     */
    async listWSLDistributions(): Promise<string[]> {
        try {
            const result = await CommandBuilder.executeWSL(['--list', '--quiet']);

            // Handle UTF-16LE encoding from Windows WSL (removes null bytes)
            let output = result.stdout;
            if (output.includes('\x00')) {
                // Remove null bytes from UTF-16LE encoding
                output = output.replace(/\x00/g, '');
            }

            const lines = output.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0 && !line.includes('Windows Subsystem'));

            return lines;
        } catch (error) {
            logger.error('Failed to list WSL distributions:', error as Error);
            return [];
        }
    }
    
    /**
     * Get cached images synchronously without WSL or manifest checks
     * Returns immediately with locally cached metadata, perfect for instant UI display
     * @returns Array of images from the last loaded metadata
     */
    getCachedImages(): ImageMetadata[] {
        return Array.from(this.imageMetadata.values());
    }

    /**
     * List all images with metadata
     */
    async listImages(): Promise<ImageMetadata[]> {
        const wslDistros = await this.listWSLDistributions();
        const images: ImageMetadata[] = [];
        
        // Add known images from metadata
        for (const [name, metadata] of this.imageMetadata) {
            if (wslDistros.includes(name)) {
                // Check if manifest exists
                metadata.hasManifest = await this.manifestManager.hasManifest?.(name) || false;
                images.push(metadata);
            } else {
                // Remove from metadata if no longer exists
                this.imageMetadata.delete(name);
            }
        }
        
        // Add any WSL distros not in metadata (legacy)
        for (const distroName of wslDistros) {
            if (!this.imageMetadata.has(distroName)) {
                const metadata: ImageMetadata = {
                    id: uuidv4(),
                    name: distroName,
                    displayName: distroName,
                    description: 'Legacy WSL distribution',
                    source: 'unknown',
                    sourceType: 'distro',
                    created: new Date().toISOString(),
                    wslVersion: 2,
                    hasManifest: await this.manifestManager.hasManifest(distroName),
                    enabled: true
                };
                
                this.imageMetadata.set(distroName, metadata);
                images.push(metadata);
            }
        }
        
        // Save any changes
        this.saveMetadataInternal();
        
        return images;
    }
    
    /**
     * Delete an image (unregister from WSL)
     */
    async deleteImage(imageName: string): Promise<void> {
        logger.info(`Deleting image: ${imageName}`);
        
        // Unregister from WSL
        await CommandBuilder.executeWSL(['--unregister', imageName]);
        
        // Remove from metadata
        const metadata = this.imageMetadata.get(imageName);
        if (metadata?.installPath && fs.existsSync(metadata.installPath)) {
            try {
                fs.rmSync(metadata.installPath, { recursive: true });
            } catch (error) {
                logger.warn(`Failed to remove installation directory: ${metadata.installPath}`, error as Error);
            }
        }
        
        this.imageMetadata.delete(imageName);
        this.saveMetadataInternal();
        
        logger.info(`Successfully deleted image: ${imageName}`);
    }
    
    /**
     * Update image properties
     */
    async updateImageProperties(
        imageName: string,
        updates: Partial<ImageMetadata>
    ): Promise<void> {
        const metadata = this.imageMetadata.get(imageName);
        if (!metadata) {
            throw new Error(`Image not found: ${imageName}`);
        }
        
        // Apply updates (preserve critical fields)
        const updated: ImageMetadata = {
            ...metadata,
            ...updates,
            id: metadata.id,
            name: metadata.name,
            source: metadata.source,
            sourceType: metadata.sourceType,
            created: metadata.created
        };
        
        this.imageMetadata.set(imageName, updated);
        this.saveMetadataInternal();
        
        logger.info(`Updated properties for image: ${imageName}`);
    }
    
    /**
     * Get detailed information about an image
     */
    async getImageInfo(imageName: string): Promise<ImageMetadata | null> {
        // Ensure metadata is current
        await this.listImages();
        return this.imageMetadata.get(imageName) || null;
    }
    
    /**
     * Check if an image exists
     */
    async imageExists(imageName: string): Promise<boolean> {
        const distros = await this.listWSLDistributions();
        return distros.includes(imageName);
    }

    /**
     * Create an image from a WSL export file
     */
    async createFromExport(
        exportPath: string,
        imageName: string,
        options: CreateFromDistroOptions = {}
    ): Promise<void> {
        logger.info(`Creating image '${imageName}' from export '${exportPath}'`);

        // Validate export file exists
        if (!fs.existsSync(exportPath)) {
            throw new Error(`Export file not found: ${exportPath}`);
        }

        // Check if image name already exists
        const existingDistros = await this.listWSLDistributions();
        if (existingDistros.includes(imageName)) {
            throw new Error(`WSL distribution already exists: ${imageName}`);
        }

        // Import the export as a new WSL distribution
        await this.importImage(exportPath, imageName, options);

        // Add to metadata
        const metadata: ImageMetadata = {
            id: uuidv4(),
            name: imageName,
            displayName: options.displayName || imageName,
            sourceType: 'distro',
            source: exportPath,
            created: new Date().toISOString(),
            wslVersion: options.wslVersion || 2,
            hasManifest: false,
            enabled: true,
            installPath: options.installPath || path.join(
                process.env.USERPROFILE || process.env.HOME || '',
                '.wsl',
                imageName
            )
        };

        this.imageMetadata.set(imageName, metadata);
        this.saveMetadataInternal();

        logger.info(`Successfully created image '${imageName}' from export`);
    }

    /**
     * Create an image from a TAR file
     */
    async createFromFile(
        filePath: string,
        imageName: string,
        options: CreateFromDistroOptions = {}
    ): Promise<void> {
        logger.info(`Creating image '${imageName}' from file '${filePath}'`);

        // Validate file exists
        if (!fs.existsSync(filePath)) {
            throw new Error(`TAR file not found: ${filePath}`);
        }

        // Check if image name already exists
        const existingDistros = await this.listWSLDistributions();
        if (existingDistros.includes(imageName)) {
            throw new Error(`WSL distribution already exists: ${imageName}`);
        }

        // Check if file is TAR or needs extraction
        let importPath = filePath;
        const isActuallyTar = await this.checkIfTarFormat(filePath);

        if (!isActuallyTar) {
            logger.warn(`File ${filePath} is not TAR format, attempting extraction...`);
            const extractedPath = await this.extractTarFromMisnamedAppx(filePath);
            if (!extractedPath) {
                throw new Error(`Failed to extract TAR from ${filePath}`);
            }
            importPath = extractedPath;
        }

        // Import the TAR file
        await this.importImage(importPath, imageName, options);

        // Clean up temporary file if we extracted
        if (importPath !== filePath && fs.existsSync(importPath)) {
            fs.unlinkSync(importPath);
        }

        // Add to metadata
        const metadata: ImageMetadata = {
            id: uuidv4(),
            name: imageName,
            displayName: options.displayName || imageName,
            sourceType: 'distro',
            source: filePath,
            created: new Date().toISOString(),
            wslVersion: options.wslVersion || 2,
            hasManifest: false,
            enabled: true,
            installPath: options.installPath || path.join(
                process.env.USERPROFILE || process.env.HOME || '',
                '.wsl',
                imageName
            )
        };

        this.imageMetadata.set(imageName, metadata);
        this.saveMetadataInternal();

        logger.info(`Successfully created image '${imageName}' from file`);
    }

    /**
     * Export an image to a TAR file
     */
    async exportImage(
        imageName: string,
        exportPath: string,
        options: { compress?: boolean } = {}
    ): Promise<void> {
        logger.info(`Exporting image '${imageName}' to '${exportPath}'`);

        // Check if image exists
        const distros = await this.listWSLDistributions();
        if (!distros.includes(imageName)) {
            throw new Error(`WSL distribution not found: ${imageName}`);
        }

        // Create export directory if it doesn't exist
        const exportDir = path.dirname(exportPath);
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }

        // Build export command
        const args = ['--export', imageName, exportPath];

        if (options.compress) {
            args.push('--vhd');
        }

        // Execute export
        const result = await CommandBuilder.executeWSL(args);

        if (result.exitCode !== 0) {
            throw new Error(`Failed to export image: ${result.stderr || 'Unknown error'}`);
        }

        // Verify export file was created
        if (!fs.existsSync(exportPath)) {
            throw new Error(`Export failed: file not created at ${exportPath}`);
        }

        const stats = fs.statSync(exportPath);
        logger.info(`Successfully exported image '${imageName}' (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    }

    /**
     * Import a TAR file as a new WSL distribution
     */
    async importImage(
        tarPath: string,
        imageName: string,
        options: CreateFromDistroOptions = {}
    ): Promise<void> {
        logger.info(`Importing TAR '${tarPath}' as image '${imageName}'`);

        // Validate TAR file exists
        if (!fs.existsSync(tarPath)) {
            throw new Error(`TAR file not found: ${tarPath}`);
        }

        // Check if image name already exists
        const existingDistros = await this.listWSLDistributions();
        if (existingDistros.includes(imageName)) {
            throw new Error(`WSL distribution already exists: ${imageName}`);
        }

        // Determine installation path
        const installPath = options.installPath || path.join(
            process.env.USERPROFILE || process.env.HOME || '',
            '.wsl',
            imageName
        );

        // Create installation directory
        if (!fs.existsSync(installPath)) {
            fs.mkdirSync(installPath, { recursive: true });
        }

        // Build import command
        const args = [
            '--import',
            imageName,
            installPath,
            tarPath
        ];

        // Add WSL version if specified
        if (options.wslVersion) {
            args.push('--version', options.wslVersion.toString());
        }

        // Execute import
        const result = await CommandBuilder.executeWSL(args);

        if (result.exitCode !== 0) {
            throw new Error(`Failed to import image: ${result.stderr || 'Unknown error'}`);
        }

        // WSL import completed successfully

        logger.info(`Successfully imported image '${imageName}' to ${installPath}`);
    }

    /**
     * Check if a file is actually TAR format or misnamed APPX/ZIP
     */
    private async checkIfTarFormat(filePath: string): Promise<boolean> {
        try {
            // Read first few bytes to check file signature
            const fd = fs.openSync(filePath, 'r');
            const buffer = Buffer.alloc(512);
            fs.readSync(fd, buffer, 0, 512, 0);
            fs.closeSync(fd);

            // Check for TAR magic number at offset 257
            const tarMagic = buffer.toString('ascii', 257, 263);
            if (tarMagic === 'ustar\0' || tarMagic === 'ustar ') {
                return true; // It's a TAR file
            }

            // Check for GZIP header (tar.gz files)
            if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
                return true; // It's a GZIP file (likely tar.gz)
            }

            // Check for ZIP/APPX header
            if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
                return false; // It's a ZIP/APPX file
            }

            // If we can't determine, try using tar command
            const { execSync } = require('child_process');
            try {
                execSync(`tar -tzf "${filePath}" > /dev/null 2>&1`, { stdio: 'pipe' });
                return true;
            } catch {
                return false;
            }
        } catch (error) {
            logger.warn(`Could not determine file format for ${filePath}: ${error}`);
            return true; // Assume it's TAR and let WSL fail if it's not
        }
    }

    /**
     * Extract TAR from a misnamed APPX file (cross-platform)
     */
    private async extractTarFromMisnamedAppx(appxPath: string): Promise<string | null> {
        try {
            const executor = new CrossPlatformCommandExecutor();
            const tempDir = path.join(path.dirname(appxPath), 'appx_extract_' + Date.now());
            const extractedTarPath = appxPath.replace(/\.tar$/, '.extracted.tar');

            // Create temp directory
            fs.mkdirSync(tempDir, { recursive: true });

            logger.debug(`Extracting APPX from ${appxPath} to ${tempDir}`);

            try {
                if (PLATFORM.isWindows) {
                    // Windows: Try PowerShell first for ZIP/APPX files, then tar.exe
                    logger.debug('Attempting extraction on Windows');

                    // First try PowerShell's Expand-Archive (works for ZIP/APPX)
                    try {
                        logger.debug('Using PowerShell Expand-Archive for extraction');
                        const psCommand = `Expand-Archive -Path "${appxPath}" -DestinationPath "${tempDir}" -Force`;
                        const psResult = await executor.executeCommand('powershell.exe', [
                            '-NoProfile',
                            '-NonInteractive',
                            '-Command',
                            psCommand
                        ]);

                        if (psResult.exitCode !== 0) {
                            throw new Error(`PowerShell extraction failed: ${psResult.stderr}`);
                        }
                        logger.debug('PowerShell extraction succeeded');
                    } catch (psError: any) {
                        // If PowerShell fails, try tar.exe as fallback
                        logger.debug(`PowerShell failed (${psError.message}), trying tar.exe`);
                        const result = await executor.executeCommand('tar.exe', [
                            '-xf', appxPath,
                            '-C', tempDir
                        ]);

                        if (result.exitCode !== 0) {
                            throw new Error(`tar.exe also failed: ${result.stderr}`);
                        }
                    }
                } else {
                    // Linux/WSL: try unzip first, then tar
                    if (await executor.isCommandAvailable('unzip')) {
                        logger.debug('Using unzip for extraction');
                        const result = await executor.executeCommand('unzip', [
                            '-q', appxPath,
                            '-d', tempDir
                        ]);

                        if (result.exitCode !== 0) {
                            throw new Error(`unzip failed: ${result.stderr}`);
                        }
                    } else {
                        logger.debug('Using tar for extraction');
                        const result = await executor.executeCommand('tar', [
                            '-xf', appxPath,
                            '-C', tempDir
                        ]);

                        if (result.exitCode !== 0) {
                            throw new Error(`tar failed: ${result.stderr}`);
                        }
                    }
                }
            } catch (extractError: any) {
                logger.error(`Extraction failed: ${extractError.message}`);
                // Clean up temp directory
                fs.rmSync(tempDir, { recursive: true, force: true });
                // Return null instead of throwing - let caller handle it
                return null;
            }

            // Find TAR file in extracted contents (handle nested APPX bundles)
            const findTarFile = async (dir: string, depth: number = 0): Promise<string | null> => {
                if (depth > 2) return null; // Limit recursion depth

                const items = fs.readdirSync(dir);

                // First, look for TAR files directly
                for (const item of items) {
                    const fullPath = path.join(dir, item);
                    const stat = fs.statSync(fullPath);

                    if (!stat.isDirectory()) {
                        if (item.toLowerCase().endsWith('.tar.gz') || item.toLowerCase().endsWith('.tar')) {
                            // Prefer install.tar.gz if available
                            if (item.toLowerCase().includes('install')) {
                                logger.info(`Found install TAR: ${item}`);
                                return fullPath;
                            }
                            // Return first TAR found if no install.tar.gz
                            logger.info(`Found TAR file: ${item}`);
                            return fullPath;
                        }
                    }
                }

                // Then look for nested APPX files (APPX bundles)
                for (const item of items) {
                    const fullPath = path.join(dir, item);
                    const stat = fs.statSync(fullPath);

                    if (!stat.isDirectory()) {
                        // Check for nested APPX files
                        if (item.toLowerCase().endsWith('.appx')) {
                            logger.debug(`Found nested APPX: ${item}`);

                            // Extract nested APPX
                            const nestedDir = path.join(dir, `nested_${Date.now()}`);
                            fs.mkdirSync(nestedDir, { recursive: true });

                            try {
                                logger.debug(`Extracting nested APPX: ${item}`);
                                if (PLATFORM.isWindows) {
                                    // Try PowerShell for nested APPX
                                    const psCommand = `Expand-Archive -Path "${fullPath}" -DestinationPath "${nestedDir}" -Force`;
                                    await executor.executeCommand('powershell.exe', [
                                        '-NoProfile', '-NonInteractive', '-Command', psCommand
                                    ]);
                                } else {
                                    // Use unzip for nested APPX
                                    await executor.executeCommand('unzip', ['-q', fullPath, '-d', nestedDir]);
                                }

                                // Recursively search nested APPX
                                const found = await findTarFile(nestedDir, depth + 1);
                                if (found) return found;
                            } catch (nestedError) {
                                logger.warn(`Failed to extract nested APPX: ${nestedError}`);
                            }
                        }
                    } else {
                        // Search subdirectories
                        const found = await findTarFile(fullPath, depth);
                        if (found) return found;
                    }
                }

                return null;
            };

            const tarFile = await findTarFile(tempDir);

            if (tarFile) {
                logger.info(`Found TAR file: ${path.basename(tarFile)}`);

                // Move to final location
                if (fs.existsSync(extractedTarPath)) {
                    fs.unlinkSync(extractedTarPath);
                }
                fs.renameSync(tarFile, extractedTarPath);

                // Clean up temp directory
                fs.rmSync(tempDir, { recursive: true, force: true });

                return extractedTarPath;
            }

            // Clean up temp directory
            fs.rmSync(tempDir, { recursive: true, force: true });
            logger.error('No TAR file found in APPX package');
            return null;

        } catch (error: any) {
            logger.error(`Failed to extract TAR from misnamed APPX: ${error.message}`);
            return null;
        }
    }

    // Public methods for tests
    saveMetadata(metadata: ImageMetadata, filePath?: string): void {
        if (filePath) {
            // Ensure directory exists using path.dirname
            const dir = path.dirname(filePath);
            if (dir && dir !== '.' && !fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2));
        } else {
            // Add to internal metadata
            this.imageMetadata.set(metadata.name, metadata);
            this.saveMetadataInternal();
        }
    }

    loadMetadata(filePath: string): ImageMetadata | null {
        try {
            if (!fs.existsSync(filePath)) {
                return null;
            }
            const content = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(content);
        } catch {
            return null;
        }
    }


    async isImageRunning(imageName: string): Promise<boolean> {
        try {
            const result = await new Promise<any>((resolve, reject) => {
                const { spawn } = require('child_process');
                const proc = spawn('wsl.exe', ['--list', '--running']);
                let output = '';
                proc.stdout.on('data', (data: Buffer) => {
                    output += data.toString();
                });
                proc.on('close', (code: number) => {
                    resolve({ code, output });
                });
                proc.on('error', reject);
            });

            return result.output.includes(imageName);
        } catch {
            return false;
        }
    }

    async terminateImage(imageName: string): Promise<void> {
        const command = CommandBuilder.buildTerminateCommand(imageName);
        const executor = new CrossPlatformCommandExecutor();
        await executor.executeCommand(command.command, command.args);
    }

    isValidImageName(name: string): boolean {
        // Basic validation for WSL distribution names
        if (!name || name.length === 0) return false;
        if (name.length > 255) return false;

        // Check for invalid characters (including spaces)
        const invalidChars = /[<>:"|?*\\/\s]/;
        if (invalidChars.test(name)) return false;

        // Check for reserved names
        const reserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
        if (reserved.includes(name.toUpperCase())) return false;

        return true;
    }

    /**
     * Export a distribution to a TAR file
     * @param distroName - Name of the distribution
     * @param tarPath - Path to save the TAR file
     */
    async exportToTar(distroName: string, tarPath: string): Promise<void> {
        logger.info(`Exporting ${distroName} to ${tarPath}`);

        const commandArgs = CommandBuilder.buildExportCommand(distroName, tarPath);
        const executor = new CrossPlatformCommandExecutor();
        await executor.executeCommand(commandArgs.command, commandArgs.args, { timeout: 300000 }); // 5 minutes
    }

    /**
     * Import a distribution from a TAR file
     * @param distroName - Name for the new distribution
     * @param tarPath - Path to the TAR file
     * @param installPath - Installation location
     */
    async importFromTar(distroName: string, tarPath: string, installPath: string): Promise<void> {
        logger.info(`Importing ${distroName} from ${tarPath} to ${installPath}`);

        const commandArgs = CommandBuilder.buildImportCommand(distroName, installPath, tarPath);
        const executor = new CrossPlatformCommandExecutor();
        await executor.executeCommand(commandArgs.command, commandArgs.args, { timeout: 300000 }); // 5 minutes
    }
}