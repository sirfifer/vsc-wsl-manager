/**
 * Distro Manager for Pristine Templates
 * 
 * Manages pristine distribution tar files that serve as clean templates
 * for creating new WSL images. These distros are stored outside of WSL
 * and never registered directly.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Logger } from '../utils/logger';

const logger = Logger.getInstance();

/**
 * Information about a pristine distribution
 */
export interface DistroInfo {
    /** Unique name identifier */
    name: string;
    
    /** Display name */
    displayName: string;
    
    /** Description */
    description: string;
    
    /** Version */
    version: string;
    
    /** Architecture */
    architecture: 'x64' | 'arm64' | 'both';
    
    /** File size in bytes */
    size?: number;
    
    /** SHA256 hash for verification */
    sha256?: string;
    
    /** Source URL if downloaded */
    sourceUrl?: string;
    
    /** Local file path */
    filePath?: string;
    
    /** When this distro was added */
    added?: string;
    
    /** Tags for categorization */
    tags?: string[];
    
    /** Whether this distro is available locally */
    available?: boolean;
}

/**
 * Catalog of available distributions
 */
export interface DistroCatalog {
    /** Version of the catalog format */
    version: string;
    
    /** Last updated timestamp */
    updated: string;
    
    /** Available distributions */
    distributions: DistroInfo[];
}

/**
 * DistroManager handles pristine distribution templates
 */
export class DistroManager {
    private readonly distroStorePath: string;
    private readonly catalogPath: string;
    private catalog: DistroCatalog | null = null;
    
    constructor(storePath?: string) {
        // Use %USERPROFILE%/.vscode-wsl-manager/distros
        const baseDir = storePath || path.join(
            process.env.USERPROFILE || process.env.HOME || '',
            '.vscode-wsl-manager'
        );
        
        this.distroStorePath = path.join(baseDir, 'distros');
        this.catalogPath = path.join(this.distroStorePath, 'catalog.json');
        
        this.ensureStorageExists();
        this.loadCatalog();
    }
    
    /**
     * Ensure storage directories exist
     */
    private ensureStorageExists(): void {
        if (!fs.existsSync(this.distroStorePath)) {
            fs.mkdirSync(this.distroStorePath, { recursive: true });
            logger.info(`Created distro storage directory: ${this.distroStorePath}`);
        }
    }
    
    /**
     * Load the distro catalog
     */
    private loadCatalog(): void {
        try {
            if (fs.existsSync(this.catalogPath)) {
                const content = fs.readFileSync(this.catalogPath, 'utf8');
                this.catalog = JSON.parse(content);
                logger.debug(`Loaded distro catalog with ${this.catalog?.distributions.length} entries`);
            } else {
                // Create initial catalog
                this.catalog = {
                    version: '1.0.0',
                    updated: new Date().toISOString(),
                    distributions: this.getDefaultDistros()
                };
                this.saveCatalog();
            }
        } catch (error) {
            logger.error('Failed to load distro catalog:', error);
            // Use default catalog
            this.catalog = {
                version: '1.0.0',
                updated: new Date().toISOString(),
                distributions: this.getDefaultDistros()
            };
        }
    }
    
    /**
     * Save the catalog to disk
     */
    private saveCatalog(): void {
        try {
            const content = JSON.stringify(this.catalog, null, 2);
            fs.writeFileSync(this.catalogPath, content, 'utf8');
            logger.debug('Saved distro catalog');
        } catch (error) {
            logger.error('Failed to save distro catalog:', error);
        }
    }
    
    /**
     * Get default distribution definitions
     */
    private getDefaultDistros(): DistroInfo[] {
        return [
            {
                name: 'ubuntu-22.04',
                displayName: 'Ubuntu 22.04 LTS',
                description: 'Ubuntu 22.04 LTS (Jammy Jellyfish) - Long Term Support',
                version: '22.04.3',
                architecture: 'x64',
                sourceUrl: 'https://cloud-images.ubuntu.com/wsl/jammy/current/ubuntu-jammy-wsl-amd64-wsl.rootfs.tar.gz',
                tags: ['ubuntu', 'lts', 'stable'],
                size: 650 * 1024 * 1024 // Approximate
            },
            {
                name: 'ubuntu-24.04',
                displayName: 'Ubuntu 24.04 LTS',
                description: 'Ubuntu 24.04 LTS (Noble Numbat) - Latest LTS',
                version: '24.04',
                architecture: 'x64',
                sourceUrl: 'https://cloud-images.ubuntu.com/wsl/noble/current/ubuntu-noble-wsl-amd64-wsl.rootfs.tar.gz',
                tags: ['ubuntu', 'lts', 'latest'],
                size: 700 * 1024 * 1024
            },
            {
                name: 'debian-12',
                displayName: 'Debian 12',
                description: 'Debian 12 (Bookworm) - Stable and reliable',
                version: '12',
                architecture: 'x64',
                sourceUrl: 'https://github.com/debuerreotype/docker-debian-artifacts/raw/dist-amd64/bookworm/rootfs.tar.xz',
                tags: ['debian', 'stable'],
                size: 50 * 1024 * 1024
            },
            {
                name: 'alpine-3.19',
                displayName: 'Alpine Linux 3.19',
                description: 'Alpine Linux - Lightweight and secure',
                version: '3.19.0',
                architecture: 'x64',
                sourceUrl: 'https://dl-cdn.alpinelinux.org/alpine/v3.19/releases/x86_64/alpine-minirootfs-3.19.0-x86_64.tar.gz',
                tags: ['alpine', 'minimal', 'lightweight'],
                size: 3 * 1024 * 1024
            },
            {
                name: 'fedora-39',
                displayName: 'Fedora 39',
                description: 'Fedora 39 - Leading edge Linux distribution',
                version: '39',
                architecture: 'x64',
                sourceUrl: 'https://github.com/fedora-cloud/docker-brew-fedora/raw/39/x86_64/fedora-39-x86_64.tar.xz',
                tags: ['fedora', 'bleeding-edge'],
                size: 70 * 1024 * 1024
            },
            {
                name: 'archlinux',
                displayName: 'Arch Linux',
                description: 'Arch Linux - Rolling release for advanced users',
                version: 'latest',
                architecture: 'x64',
                sourceUrl: 'https://mirror.rackspace.com/archlinux/iso/latest/archlinux-bootstrap-x86_64.tar.gz',
                tags: ['arch', 'rolling', 'advanced'],
                size: 150 * 1024 * 1024
            }
        ];
    }
    
    /**
     * List all available distros
     */
    async listDistros(): Promise<DistroInfo[]> {
        if (!this.catalog) {
            this.loadCatalog();
        }
        
        // Update availability status
        const distros = this.catalog!.distributions.map(distro => {
            const filePath = this.getDistroPath(distro.name);
            return {
                ...distro,
                filePath,
                available: fs.existsSync(filePath)
            };
        });
        
        return distros;
    }
    
    /**
     * Get a specific distro by name
     */
    async getDistro(name: string): Promise<DistroInfo | null> {
        const distros = await this.listDistros();
        return distros.find(d => d.name === name) || null;
    }
    
    /**
     * Get the local file path for a distro
     */
    getDistroPath(name: string): string {
        return path.join(this.distroStorePath, `${name}.tar`);
    }
    
    /**
     * Check if a distro is available locally
     */
    async isDistroAvailable(name: string): Promise<boolean> {
        const distroPath = this.getDistroPath(name);
        return fs.existsSync(distroPath);
    }
    
    /**
     * Add a custom distro to the catalog
     */
    async addDistro(distro: DistroInfo, tarPath: string): Promise<void> {
        logger.info(`Adding distro: ${distro.name}`);
        
        // Validate tar file exists
        if (!fs.existsSync(tarPath)) {
            throw new Error(`Tar file not found: ${tarPath}`);
        }
        
        // Get file info
        const stats = fs.statSync(tarPath);
        distro.size = stats.size;
        distro.added = new Date().toISOString();
        
        // Calculate SHA256 hash
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(tarPath);
        
        return new Promise((resolve, reject) => {
            stream.on('data', data => hash.update(data));
            stream.on('end', () => {
                distro.sha256 = hash.digest('hex');
                
                // Copy tar to storage
                const destPath = this.getDistroPath(distro.name);
                fs.copyFileSync(tarPath, destPath);
                distro.filePath = destPath;
                distro.available = true;
                
                // Update catalog
                if (!this.catalog) {
                    this.loadCatalog();
                }
                
                // Remove existing entry if present
                this.catalog!.distributions = this.catalog!.distributions.filter(
                    d => d.name !== distro.name
                );
                
                // Add new entry
                this.catalog!.distributions.push(distro);
                this.catalog!.updated = new Date().toISOString();
                
                this.saveCatalog();
                logger.info(`Added distro ${distro.name} to catalog`);
                resolve();
            });
            stream.on('error', reject);
        });
    }
    
    /**
     * Remove a distro from storage
     */
    async removeDistro(name: string): Promise<void> {
        logger.info(`Removing distro: ${name}`);
        
        // Remove file if exists
        const filePath = this.getDistroPath(name);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            logger.debug(`Deleted distro file: ${filePath}`);
        }
        
        // Update catalog
        if (!this.catalog) {
            this.loadCatalog();
        }
        
        this.catalog!.distributions = this.catalog!.distributions.filter(
            d => d.name !== name
        );
        this.catalog!.updated = new Date().toISOString();
        
        this.saveCatalog();
        logger.info(`Removed distro ${name} from catalog`);
    }
    
    /**
     * Verify integrity of a distro file
     */
    async verifyDistro(name: string): Promise<boolean> {
        const distro = await this.getDistro(name);
        if (!distro || !distro.sha256) {
            return false;
        }
        
        const filePath = this.getDistroPath(name);
        if (!fs.existsSync(filePath)) {
            return false;
        }
        
        // Calculate current hash
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        
        return new Promise((resolve) => {
            stream.on('data', data => hash.update(data));
            stream.on('end', () => {
                const currentHash = hash.digest('hex');
                resolve(currentHash === distro.sha256);
            });
            stream.on('error', () => resolve(false));
        });
    }
    
    /**
     * Get storage statistics
     */
    async getStorageStats(): Promise<{
        totalDistros: number;
        availableDistros: number;
        totalSize: number;
        storageUsed: number;
    }> {
        const distros = await this.listDistros();
        
        let storageUsed = 0;
        const availableDistros = distros.filter(d => {
            if (d.available && d.filePath && fs.existsSync(d.filePath)) {
                const stats = fs.statSync(d.filePath);
                storageUsed += stats.size;
                return true;
            }
            return false;
        }).length;
        
        return {
            totalDistros: distros.length,
            availableDistros,
            totalSize: distros.reduce((sum, d) => sum + (d.size || 0), 0),
            storageUsed
        };
    }
    
    /**
     * Import a distro from an external tar file
     */
    async importDistro(
        tarPath: string,
        name: string,
        displayName: string,
        description?: string
    ): Promise<void> {
        const stats = fs.statSync(tarPath);
        
        const distro: DistroInfo = {
            name,
            displayName,
            description: description || `Custom distribution imported from ${path.basename(tarPath)}`,
            version: 'custom',
            architecture: 'x64',
            size: stats.size,
            tags: ['custom', 'imported'],
            added: new Date().toISOString()
        };
        
        await this.addDistro(distro, tarPath);
    }
}