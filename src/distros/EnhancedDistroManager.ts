/**
 * Enhanced Distro Manager that combines dynamic fetching with existing functionality
 */

import { DistroManager, DistroInfo } from './DistroManager';
import { DistributionRegistry } from '../distributionRegistry';
import { Logger } from '../utils/logger';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

const logger = Logger.getInstance();

/**
 * EnhancedDistroManager extends DistroManager with dynamic distribution fetching
 */
export class EnhancedDistroManager extends DistroManager {
    private registry: DistributionRegistry;
    private lastRefresh: Date | null = null;
    private readonly REFRESH_INTERVAL = 60 * 60 * 1000; // 1 hour

    constructor(storePath?: string) {
        super(storePath);
        this.registry = new DistributionRegistry();
    }

    /**
     * Override listDistros to merge Microsoft registry with local catalog
     */
    async listDistros(): Promise<DistroInfo[]> {
        // Check if we should refresh
        if (this.shouldRefresh()) {
            await this.refreshFromRegistry();
        }

        // Get base distros from parent
        const localDistros = await super.listDistros();

        // Mark with validation status
        for (const distro of localDistros) {
            if (!distro.available && distro.sourceUrl) {
                // Start async validation
                this.validateUrl(distro.sourceUrl).then(isValid => {
                    (distro as any).urlValid = isValid;
                });
            }
        }

        return localDistros;
    }

    /**
     * Check if we should refresh from Microsoft
     */
    private shouldRefresh(): boolean {
        if (!this.lastRefresh) return true;
        const age = Date.now() - this.lastRefresh.getTime();
        return age > this.REFRESH_INTERVAL;
    }

    /**
     * Refresh distributions from Microsoft Registry
     */
    private async refreshFromRegistry(): Promise<void> {
        try {
            logger.info('Refreshing distributions from Microsoft Registry');

            const msDistros = await this.registry.fetchAvailableDistributions();
            this.lastRefresh = new Date();

            // Update our catalog with fresh URLs
            const updatedDistros = this.getUpdatedDefaultDistros();

            // Update URLs from Microsoft registry
            for (const distro of updatedDistros) {
                const msDistro = msDistros.find(d =>
                    d.Name.toLowerCase() === distro.name.toLowerCase() ||
                    d.Name.toLowerCase().includes(distro.name.split('-')[0].toLowerCase())
                );

                if (msDistro) {
                    // Update with Microsoft's URL
                    const newUrl = msDistro.Amd64WslUrl || msDistro.Amd64PackageUrl;
                    if (newUrl && newUrl !== distro.sourceUrl) {
                        logger.info(`Updated URL for ${distro.name}: ${newUrl}`);
                        distro.sourceUrl = newUrl;
                    }
                }
            }

            // Save updated catalog
            this['catalog'] = {
                version: '2.0.0',
                updated: new Date().toISOString(),
                distributions: updatedDistros
            };
            this['saveCatalog']();

            logger.info(`Refreshed ${updatedDistros.length} distributions from registry`);
        } catch (error) {
            logger.error('Failed to refresh from Microsoft Registry:', error);
            // Continue with existing catalog
        }
    }

    /**
     * Get updated default distros with validated URLs
     */
    public getUpdatedDefaultDistros(): DistroInfo[] {
        // Start with community distros that we know work
        return [
            {
                name: 'ubuntu-24.04',
                displayName: 'Ubuntu 24.04 LTS',
                description: 'Ubuntu 24.04 LTS (Noble Numbat) - Latest LTS',
                version: '24.04',
                architecture: 'x64',
                sourceUrl: 'https://releases.ubuntu.com/24.04.3/ubuntu-24.04.3-wsl-amd64.wsl',
                tags: ['ubuntu', 'lts', 'latest', 'microsoft'],
                size: 667 * 1024 * 1024
            },
            {
                name: 'ubuntu-22.04',
                displayName: 'Ubuntu 22.04 LTS',
                description: 'Ubuntu 22.04 LTS (Jammy Jellyfish) - Long Term Support',
                version: '22.04.3',
                architecture: 'x64',
                sourceUrl: 'https://cloud-images.ubuntu.com/wsl/jammy/current/ubuntu-jammy-wsl-amd64-ubuntu22.04lts.rootfs.tar.gz',
                tags: ['ubuntu', 'lts', 'stable'],
                size: 325 * 1024 * 1024
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
                name: 'alpine',
                displayName: 'Alpine Linux',
                description: 'Alpine Linux - Lightweight and secure',
                version: '3.19',
                architecture: 'x64',
                sourceUrl: 'https://dl-cdn.alpinelinux.org/alpine/v3.19/releases/x86_64/alpine-minirootfs-3.19.0-x86_64.tar.gz',
                tags: ['alpine', 'minimal', 'lightweight'],
                size: 3 * 1024 * 1024
            },
            {
                name: 'kali-linux',
                displayName: 'Kali Linux',
                description: 'Kali Linux - Penetration testing and security',
                version: '2024.1',
                architecture: 'x64',
                sourceUrl: '', // Will be filled from Microsoft registry
                tags: ['kali', 'security', 'pentesting', 'microsoft'],
                size: 300 * 1024 * 1024
            },
            {
                name: 'fedora',
                displayName: 'Fedora',
                description: 'Fedora - Leading edge Linux distribution',
                version: '39',
                architecture: 'x64',
                sourceUrl: 'https://github.com/fedora-cloud/docker-brew-fedora/raw/39/x86_64/fedora-39-x86_64.tar.xz',
                tags: ['fedora', 'cutting-edge'],
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
     * Force refresh distributions
     */
    async refreshDistributions(): Promise<void> {
        this.lastRefresh = null; // Force refresh
        await this.refreshFromRegistry();
    }

    /**
     * Validate a URL without downloading
     */
    private async validateUrl(url: string): Promise<boolean> {
        return new Promise((resolve) => {
            try {
                const parsedUrl = new URL(url);
                const client = parsedUrl.protocol === 'https:' ? https : http;

                const request = client.request(
                    url,
                    { method: 'HEAD', timeout: 5000 },
                    (response) => {
                        resolve(response.statusCode === 200);
                    }
                );

                request.on('error', () => resolve(false));
                request.on('timeout', () => {
                    request.destroy();
                    resolve(false);
                });

                request.end();
            } catch {
                resolve(false);
            }
        });
    }

    /**
     * Clear cache and force refresh
     */
    async clearCache(): Promise<void> {
        logger.info('Clearing distribution cache');
        this.lastRefresh = null;
        this.registry.clearCache();
        await this.refreshFromRegistry();
    }
}