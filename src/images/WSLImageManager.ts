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
        
        this.loadMetadata();
    }
    
    /**
     * Load image metadata from disk
     */
    private loadMetadata(): void {
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
    private saveMetadata(): void {
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
            // Import the distro as a new WSL distribution
            logger.debug(`Importing ${distroName} to ${imageName} at ${installPath}`);
            await CommandBuilder.executeWSL([
                '--import',
                imageName,
                installPath,
                distro.filePath,
                '--version',
                String(options.wslVersion || 2)
            ], { timeout: 300000 } as CommandOptions); // 5 minutes
            
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
            await this.manifestManager.writeManifest(imageName, manifest);
            
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
                installPath
            };
            
            this.imageMetadata.set(imageName, metadata);
            this.saveMetadata();
            
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
                
                await this.manifestManager.writeManifest(newImageName, clonedManifest);
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
                installPath
            };
            
            this.imageMetadata.set(newImageName, metadata);
            this.saveMetadata();
            
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
            const lines = result.stdout.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);
            
            return lines;
        } catch (error) {
            logger.error('Failed to list WSL distributions:', error as Error);
            return [];
        }
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
                metadata.hasManifest = await this.manifestManager.hasManifest(name);
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
        this.saveMetadata();
        
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
        this.saveMetadata();
        
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
        this.saveMetadata();
        
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
}