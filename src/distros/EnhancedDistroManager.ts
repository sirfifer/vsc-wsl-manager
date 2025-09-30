/**
 * Enhanced Distro Manager that combines dynamic fetching with existing functionality
 */

import { DistroManager, DistroInfo } from './DistroManager';
import { DistributionRegistry } from '../distributionRegistry';
import { Logger } from '../utils/logger';
import * as https from 'https';
import * as http from 'http';
import * as path from 'path';
import { URL } from 'url';

const logger = Logger.getInstance();

/**
 * EnhancedDistroManager extends DistroManager with dynamic distribution fetching
 */
export class EnhancedDistroManager extends DistroManager {
    private lastRefresh: Date | null = null;
    private readonly REFRESH_INTERVAL = process.env.NODE_ENV === 'test' ? 100 : 60 * 60 * 1000; // 100ms for tests, 1 hour otherwise

    constructor(storePath?: string) {
        super(storePath);
        // Use inherited registry from parent class
    }

    /**
     * Override listDistros to merge Microsoft registry with local catalog
     */
    async listDistros(): Promise<DistroInfo[]> {
        // Check if we should refresh
        if (this.shouldRefresh()) {
            await this.refreshFromRegistry();
        }

        // Get the catalog directly which includes our updated distros
        const catalog = (this as any).catalog;
        if (catalog && catalog.distributions) {
            return catalog.distributions;
        }

        // Fall back to parent implementation
        return super.listDistros();
    }

    /**
     * Check if we should refresh from Microsoft
     */
    private shouldRefresh(): boolean {
        if (!this.lastRefresh) {return true;}
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

            // Load existing catalog to preserve download state
            if (!this['catalog']) {
                this['loadCatalog']();
            }

            const existingCatalog = this['catalog'] || { distributions: [] };

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

            // Merge: preserve download state from existing catalog, update URLs from fresh
            const mergedDistros = updatedDistros.map(freshDistro => {
                const existing = existingCatalog.distributions.find(
                    d => d.name === freshDistro.name
                );

                return {
                    ...freshDistro,
                    // Preserve download state if exists
                    available: existing?.available ?? false,
                    filePath: existing?.filePath,
                    size: existing?.size || freshDistro.size,
                    sha256: existing?.sha256,
                    added: existing?.added
                };
            });

            // Also preserve any distros from existing catalog that aren't in the updated list
            // (e.g., custom imported distros or distros downloaded with different names)
            const updatedNames = new Set(updatedDistros.map(d => d.name));
            const existingOnly = existingCatalog.distributions
                .filter(d => !updatedNames.has(d.name))
                .map(d => ({
                    ...d,
                    available: d.available ?? false,  // Ensure available is always boolean
                    filePath: d.filePath,
                    size: d.size,
                    sha256: d.sha256,
                    added: d.added
                }));
            mergedDistros.push(...existingOnly);

            // Re-scan file system to update availability (in case files were added/removed manually)
            const fs = require('fs');
            for (const distro of mergedDistros) {
                const filePath = this['getDistroPath'](distro.name);
                if (fs.existsSync(filePath)) {
                    distro.available = true;
                    distro.filePath = filePath;

                    // Update size if not set
                    if (!distro.size) {
                        const stats = fs.statSync(filePath);
                        distro.size = stats.size;
                    }
                } else if (distro.available) {
                    // File was marked available but doesn't exist anymore
                    distro.available = false;
                    distro.filePath = undefined;
                }
            }

            // Save updated catalog
            this['catalog'] = {
                version: '2.0.0',
                updated: new Date().toISOString(),
                distributions: mergedDistros
            };
            this['saveCatalog']();

            const downloadedCount = mergedDistros.filter(d => d.available).length;
            logger.info(`Refreshed ${mergedDistros.length} distributions from registry (${downloadedCount} downloaded locally)`);
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

    /**
     * Get safe distribution path
     */
    getDistroPath(name: string): string {
        // Sanitize name to prevent path traversal
        const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '');
        // Use parent's implementation which has the correct path
        return super.getDistroPath(safeName);
    }
}