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
                
                // Ensure all default distros are present
                this.mergeDefaultDistros();
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
     * Merge default distros into catalog if missing
     */
    private mergeDefaultDistros(): void {
        if (!this.catalog) return;
        
        const defaultDistros = this.getDefaultDistros();
        const existingNames = new Set(this.catalog.distributions.map(d => d.name));
        let added = 0;
        
        for (const defaultDistro of defaultDistros) {
            if (!existingNames.has(defaultDistro.name)) {
                // Add missing default distro
                this.catalog.distributions.push({
                    ...defaultDistro,
                    available: false // Not downloaded yet
                });
                added++;
                logger.info(`Restored missing default distro: ${defaultDistro.name}`);
            }
        }
        
        if (added > 0) {
            this.catalog.updated = new Date().toISOString();
            this.saveCatalog();
            logger.info(`Restored ${added} missing default distributions to catalog`);
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
            // Ubuntu Family
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
                name: 'ubuntu-22.04',
                displayName: 'Ubuntu 22.04 LTS',
                description: 'Ubuntu 22.04 LTS (Jammy Jellyfish) - Long Term Support',
                version: '22.04.3',
                architecture: 'x64',
                sourceUrl: 'https://cloud-images.ubuntu.com/wsl/jammy/current/ubuntu-jammy-wsl-amd64-wsl.rootfs.tar.gz',
                tags: ['ubuntu', 'lts', 'stable'],
                size: 650 * 1024 * 1024
            },
            {
                name: 'ubuntu-20.04',
                displayName: 'Ubuntu 20.04 LTS',
                description: 'Ubuntu 20.04 LTS (Focal Fossa) - Previous LTS',
                version: '20.04.6',
                architecture: 'x64',
                sourceUrl: 'https://cloud-images.ubuntu.com/wsl/focal/current/ubuntu-focal-wsl-amd64-wsl.rootfs.tar.gz',
                tags: ['ubuntu', 'lts', 'legacy'],
                size: 500 * 1024 * 1024
            },
            {
                name: 'ubuntu-23.10',
                displayName: 'Ubuntu 23.10',
                description: 'Ubuntu 23.10 (Mantic Minotaur) - Latest non-LTS',
                version: '23.10',
                architecture: 'x64',
                sourceUrl: 'https://cloud-images.ubuntu.com/wsl/mantic/current/ubuntu-mantic-wsl-amd64-wsl.rootfs.tar.gz',
                tags: ['ubuntu', 'latest', 'non-lts'],
                size: 680 * 1024 * 1024
            },
            
            // Debian Family
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
                name: 'debian-11',
                displayName: 'Debian 11',
                description: 'Debian 11 (Bullseye) - Previous stable',
                version: '11',
                architecture: 'x64',
                sourceUrl: 'https://github.com/debuerreotype/docker-debian-artifacts/raw/dist-amd64/bullseye/rootfs.tar.xz',
                tags: ['debian', 'oldstable'],
                size: 48 * 1024 * 1024
            },
            
            // Enterprise Linux
            {
                name: 'rocky-9',
                displayName: 'Rocky Linux 9',
                description: 'Rocky Linux 9 - Enterprise Linux, RHEL compatible',
                version: '9',
                architecture: 'x64',
                sourceUrl: 'https://download.rockylinux.org/pub/rocky/9/images/x86_64/Rocky-9-Container-Base.latest.x86_64.tar.xz',
                tags: ['rocky', 'enterprise', 'rhel-compatible'],
                size: 90 * 1024 * 1024
            },
            {
                name: 'almalinux-9',
                displayName: 'AlmaLinux 9',
                description: 'AlmaLinux 9 - Enterprise Linux, RHEL compatible',
                version: '9',
                architecture: 'x64',
                sourceUrl: 'https://repo.almalinux.org/almalinux/9/cloud/x86_64/images/AlmaLinux-9-GenericCloud-latest.x86_64.tar.xz',
                tags: ['alma', 'enterprise', 'rhel-compatible'],
                size: 95 * 1024 * 1024
            },
            {
                name: 'oracle-9',
                displayName: 'Oracle Linux 9',
                description: 'Oracle Linux 9 - Enterprise Linux from Oracle',
                version: '9',
                architecture: 'x64',
                sourceUrl: 'https://yum.oracle.com/templates/OracleLinux/OL9/u0/x86_64/oraclelinux-9-amd64.tar.xz',
                tags: ['oracle', 'enterprise'],
                size: 100 * 1024 * 1024
            },
            
            // Fedora Family
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
                name: 'fedora-40',
                displayName: 'Fedora 40',
                description: 'Fedora 40 - Latest Fedora release',
                version: '40',
                architecture: 'x64',
                sourceUrl: 'https://github.com/fedora-cloud/docker-brew-fedora/raw/40/x86_64/fedora-40-x86_64.tar.xz',
                tags: ['fedora', 'latest', 'bleeding-edge'],
                size: 75 * 1024 * 1024
            },
            
            // Arch Family
            {
                name: 'archlinux',
                displayName: 'Arch Linux',
                description: 'Arch Linux - Rolling release for advanced users',
                version: 'latest',
                architecture: 'x64',
                sourceUrl: 'https://mirror.rackspace.com/archlinux/iso/latest/archlinux-bootstrap-x86_64.tar.gz',
                tags: ['arch', 'rolling', 'advanced'],
                size: 150 * 1024 * 1024
            },
            {
                name: 'manjaro',
                displayName: 'Manjaro Linux',
                description: 'Manjaro - User-friendly Arch-based distribution',
                version: 'latest',
                architecture: 'x64',
                sourceUrl: 'https://github.com/manjaro/docker/raw/master/manjaro-base.tar.xz',
                tags: ['manjaro', 'arch-based', 'user-friendly'],
                size: 200 * 1024 * 1024
            },
            
            // openSUSE Family
            {
                name: 'opensuse-leap-15.5',
                displayName: 'openSUSE Leap 15.5',
                description: 'openSUSE Leap 15.5 - Stable release',
                version: '15.5',
                architecture: 'x64',
                sourceUrl: 'https://download.opensuse.org/repositories/Cloud:/Images:/Leap_15.5/images/openSUSE-Leap-15.5.x86_64-rootfs.tar.xz',
                tags: ['opensuse', 'leap', 'stable'],
                size: 80 * 1024 * 1024
            },
            {
                name: 'opensuse-tumbleweed',
                displayName: 'openSUSE Tumbleweed',
                description: 'openSUSE Tumbleweed - Rolling release',
                version: 'latest',
                architecture: 'x64',
                sourceUrl: 'https://download.opensuse.org/tumbleweed/appliances/openSUSE-Tumbleweed-rootfs.x86_64.tar.xz',
                tags: ['opensuse', 'tumbleweed', 'rolling'],
                size: 85 * 1024 * 1024
            },
            
            // Security Distributions
            {
                name: 'kali-linux',
                displayName: 'Kali Linux',
                description: 'Kali Linux - Penetration testing and security',
                version: '2024.1',
                architecture: 'x64',
                sourceUrl: 'https://cdimage.kali.org/kali-2024.1/kali-linux-2024.1-rootfs-amd64.tar.xz',
                tags: ['kali', 'security', 'pentesting'],
                size: 300 * 1024 * 1024
            },
            {
                name: 'parrot-security',
                displayName: 'Parrot Security OS',
                description: 'Parrot Security OS - Security and privacy focused',
                version: '6.0',
                architecture: 'x64',
                sourceUrl: 'https://download.parrot.sh/parrot/iso/6.0/Parrot-rootfs-6.0_amd64.tar.xz',
                tags: ['parrot', 'security', 'privacy'],
                size: 350 * 1024 * 1024
            },
            
            // Lightweight
            {
                name: 'alpine-3.19',
                displayName: 'Alpine Linux 3.19',
                description: 'Alpine Linux 3.19 - Lightweight and secure',
                version: '3.19.0',
                architecture: 'x64',
                sourceUrl: 'https://dl-cdn.alpinelinux.org/alpine/v3.19/releases/x86_64/alpine-minirootfs-3.19.0-x86_64.tar.gz',
                tags: ['alpine', 'minimal', 'lightweight'],
                size: 3 * 1024 * 1024
            },
            {
                name: 'alpine-3.20',
                displayName: 'Alpine Linux 3.20',
                description: 'Alpine Linux 3.20 - Latest Alpine release',
                version: '3.20.0',
                architecture: 'x64',
                sourceUrl: 'https://dl-cdn.alpinelinux.org/alpine/v3.20/releases/x86_64/alpine-minirootfs-3.20.0-x86_64.tar.gz',
                tags: ['alpine', 'minimal', 'latest'],
                size: 3 * 1024 * 1024
            },
            
            // Developer Focused
            {
                name: 'centos-stream-9',
                displayName: 'CentOS Stream 9',
                description: 'CentOS Stream 9 - Upstream for RHEL',
                version: '9',
                architecture: 'x64',
                sourceUrl: 'https://cloud.centos.org/centos/9-stream/x86_64/images/CentOS-Stream-Container-Base-9.tar.xz',
                tags: ['centos', 'stream', 'development'],
                size: 85 * 1024 * 1024
            },
            {
                name: 'void-linux',
                displayName: 'Void Linux',
                description: 'Void Linux - Independent distribution with runit',
                version: 'latest',
                architecture: 'x64',
                sourceUrl: 'https://repo-default.voidlinux.org/live/current/void-x86_64-rootfs.tar.xz',
                tags: ['void', 'independent', 'runit'],
                size: 60 * 1024 * 1024
            },
            {
                name: 'gentoo',
                displayName: 'Gentoo Linux',
                description: 'Gentoo - Source-based meta-distribution',
                version: 'latest',
                architecture: 'x64',
                sourceUrl: 'https://distfiles.gentoo.org/releases/amd64/autobuilds/current-stage3-amd64/stage3-amd64.tar.xz',
                tags: ['gentoo', 'source-based', 'advanced'],
                size: 250 * 1024 * 1024
            },
            {
                name: 'clear-linux',
                displayName: 'Clear Linux',
                description: 'Clear Linux - Intel optimized distribution',
                version: 'latest',
                architecture: 'x64',
                sourceUrl: 'https://cdn.download.clearlinux.org/releases/current/clear/clear-rootfs.tar.xz',
                tags: ['clear', 'intel', 'optimized'],
                size: 120 * 1024 * 1024
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
        
        // Update catalog - mark as unavailable but keep in list
        if (!this.catalog) {
            this.loadCatalog();
        }
        
        // Find the distro and mark it as unavailable
        const distro = this.catalog!.distributions.find(d => d.name === name);
        if (distro) {
            distro.available = false;
            distro.filePath = undefined;
            logger.info(`Marked distro ${name} as unavailable in catalog`);
        }
        
        // If it's not a default distro and was custom added, remove it
        const defaultDistroNames = this.getDefaultDistros().map(d => d.name);
        if (!defaultDistroNames.includes(name)) {
            this.catalog!.distributions = this.catalog!.distributions.filter(
                d => d.name !== name
            );
            logger.info(`Removed custom distro ${name} from catalog`);
        }
        
        this.catalog!.updated = new Date().toISOString();
        this.saveCatalog();
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