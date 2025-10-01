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
        // Don't refresh if a catalog operation is already in progress (prevents race conditions)
        if (this.isCatalogOperationInProgress()) {
            logger.debug('Skipping refresh - catalog operation in progress');
            return;
        }

        // Don't refresh if a download is in progress (prevents corrupting download state)
        if (this.isDownloadInProgress()) {
            logger.debug('Skipping refresh - download operation in progress');
            return;
        }

        // Set refresh lock to prevent downloads from starting during refresh
        this.setRefreshLock(true);

        try {
            logger.info('Refreshing distributions from Microsoft Registry');

            const msDistros = await this.registry.fetchAvailableDistributions();
            this.lastRefresh = new Date();

            // Load existing catalog to preserve download state
            if (!this['catalog']) {
                this['loadCatalog']();
            }

            const existingCatalog = this['catalog'] || { distributions: [] };

            // Convert Microsoft registry distros to our DistroInfo format
            const catalogDistros: DistroInfo[] = msDistros.map(msDistro => {
                // Try to find existing entry to preserve download state
                const existing = existingCatalog.distributions.find(d =>
                    d.name.toLowerCase() === msDistro.Name.toLowerCase() ||
                    d.displayName?.toLowerCase() === msDistro.FriendlyName?.toLowerCase()
                );

                return {
                    name: msDistro.Name.toLowerCase().replace(/\s+/g, '-'),
                    displayName: msDistro.FriendlyName || msDistro.Name,
                    description: msDistro.FriendlyName || msDistro.Name,
                    version: 'latest',
                    architecture: 'x64',
                    sourceUrl: msDistro.Amd64WslUrl || msDistro.Amd64PackageUrl || '',
                    tags: ['microsoft'],
                    // Preserve download state from existing entry
                    available: existing?.available ?? false,
                    filePath: existing?.filePath,
                    size: existing?.size,
                    sha256: existing?.sha256,
                    added: existing?.added
                };
            });

            // Also preserve any locally downloaded distros not in Microsoft registry
            const msNames = new Set(catalogDistros.map(d => d.name));
            const localOnly = existingCatalog.distributions
                .filter(d => !msNames.has(d.name) && d.available)
                .map(d => ({
                    ...d,
                    available: d.available ?? false
                }));
            catalogDistros.push(...localOnly);

            // Re-scan file system to update availability
            const fs = require('fs');
            for (const distro of catalogDistros) {
                const filePath = this['getDistroPath'](distro.name);
                if (fs.existsSync(filePath)) {
                    distro.available = true;
                    distro.filePath = filePath;
                    if (!distro.size) {
                        const stats = fs.statSync(filePath);
                        distro.size = stats.size;
                    }
                } else if (distro.available) {
                    distro.available = false;
                    distro.filePath = undefined;
                }
            }

            // Save updated catalog
            this['catalog'] = {
                version: '2.0.0',
                updated: new Date().toISOString(),
                distributions: catalogDistros
            };
            this['saveCatalog']();

            const downloadedCount = catalogDistros.filter(d => d.available).length;
            logger.info(`Refreshed ${catalogDistros.length} distributions from registry (${downloadedCount} downloaded locally)`);
        } catch (error) {
            logger.error('Failed to refresh from Microsoft Registry:', error);
            // Continue with existing catalog
        } finally {
            // Always clear refresh lock when done
            this.setRefreshLock(false);
        }
    }

    /**
     * Get updated default distros with validated URLs
     */
    public getUpdatedDefaultDistros(): DistroInfo[] {
        // Microsoft Registry is our single source of truth
        // No hardcoded distros - all come from Microsoft's official registry
        // This ensures simplicity and reliability
        return [];
    }

    /**
     * Force refresh distributions
     */
    async refreshDistributions(): Promise<void> {
        // Don't refresh if download is in progress
        if (this.isDownloadInProgress()) {
            logger.debug('Skipping manual refresh - download operation in progress');
            return;
        }

        // Set refresh lock to prevent downloads during refresh
        this.setRefreshLock(true);
        try {
            this.lastRefresh = null; // Force refresh
            await this.refreshFromRegistry();
        } finally {
            this.setRefreshLock(false);
        }
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