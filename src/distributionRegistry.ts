/**
 * Distribution Registry
 * Fetches and manages available WSL distributions from Microsoft's official registry
 * Uses the same source as wsl --list --online
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Logger } from './utils/logger';

// Use global fetch (Node 18+) or polyfill for older versions
declare const fetch: any;

const logger = Logger.getInstance();

/**
 * Distribution information from Microsoft's registry
 */
export interface DistributionInfo {
    Name: string;
    FriendlyName: string;
    StoreAppId?: string;
    Amd64PackageUrl?: string;
    Arm64PackageUrl?: string;
    PackageFamilyName?: string;
    // New .wsl format support
    Amd64WslUrl?: string;
    Arm64WslUrl?: string;
}

/**
 * Registry data structure from Microsoft
 */
interface RegistryData {
    Default: string;
    Distributions: DistributionInfo[];
}

/**
 * Local cache structure
 */
interface CacheData {
    timestamp: string;
    distributions: DistributionInfo[];
    defaultDistribution: string;
}

/**
 * Registry for available WSL distributions
 * Fetches from Microsoft's official source with caching and fallback
 */
export class DistributionRegistry {
    private static readonly MICROSOFT_REGISTRY_URL = 
        'https://raw.githubusercontent.com/microsoft/WSL/master/distributions/DistributionInfo.json';
    
    private cache: DistributionInfo[] | null = null;
    private cacheExpiry: Date | null = null;
    private defaultDistribution: string = 'Ubuntu';
    private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
    
    /**
     * Fetch available distributions from Microsoft's official registry
     * This is the same source that wsl --list --online uses
     */
    async fetchAvailableDistributions(): Promise<DistributionInfo[]> {
        logger.info('Fetching available distributions');
        
        // Check cache first
        if (this.cache && this.cacheExpiry && this.cacheExpiry > new Date()) {
            logger.debug('Using cached distribution list');
            return this.cache;
        }
        
        try {
            // Fetch from Microsoft's official source
            logger.debug('Fetching from Microsoft registry');
            const response = await fetch(DistributionRegistry.MICROSOFT_REGISTRY_URL);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch distributions: ${response.statusText}`);
            }
            
            const data = await response.json() as RegistryData;
            
            // Parse and validate the structure
            this.cache = this.parseDistributionInfo(data);
            this.cacheExpiry = new Date(Date.now() + this.CACHE_DURATION);
            
            // Save to local file as backup
            await this.saveLocalCache(this.cache);
            
            logger.info(`Fetched ${this.cache.length} distributions`);
            return this.cache;
            
        } catch (error) {
            logger.error('Failed to fetch from Microsoft registry', error);
            
            // Fall back to local cache if network fails
            return await this.loadLocalCache();
        }
    }
    
    /**
     * Parse distribution info from Microsoft's JSON format
     */
    private parseDistributionInfo(data: RegistryData): DistributionInfo[] {
        if (!data || !data.Distributions || !Array.isArray(data.Distributions)) {
            logger.warn('Invalid distribution data structure');
            return [];
        }
        
        // Store default distribution
        if (data.Default) {
            this.defaultDistribution = data.Default;
        }
        
        return data.Distributions;
    }
    
    /**
     * Get download URL for a specific distribution
     * Supports both .wsl and .appx formats
     */
    getDownloadUrl(distroName: string, arch: 'x64' | 'arm64' = 'x64'): string | null {
        if (!this.cache) {
            logger.warn('Distribution cache not initialized');
            return null;
        }
        
        // Find distribution (case-insensitive)
        const distro = this.cache.find(d => 
            d.Name.toLowerCase() === distroName.toLowerCase()
        );
        
        if (!distro) {
            logger.warn(`Distribution not found: ${distroName}`);
            return null;
        }
        
        // Prefer .wsl format if available
        if (arch === 'arm64') {
            return distro.Arm64WslUrl || distro.Arm64PackageUrl || distro.Amd64PackageUrl || null;
        } else {
            return distro.Amd64WslUrl || distro.Amd64PackageUrl || null;
        }
    }
    
    /**
     * Get full distribution information
     */
    getDistributionInfo(distroName: string): DistributionInfo | null {
        if (!this.cache) {
            return null;
        }
        
        return this.cache.find(d => 
            d.Name.toLowerCase() === distroName.toLowerCase()
        ) || null;
    }
    
    /**
     * Get the default distribution name
     */
    getDefaultDistribution(): string {
        return this.defaultDistribution;
    }
    
    /**
     * Get cache directory path
     */
    private getCacheDirectory(): string {
        return path.join(os.homedir(), '.wsl-manager', 'cache');
    }
    
    /**
     * Save distributions to local cache file
     */
    private async saveLocalCache(distributions: DistributionInfo[]): Promise<void> {
        try {
            const cacheDir = this.getCacheDirectory();
            await fs.promises.mkdir(cacheDir, { recursive: true });
            
            const cacheData: CacheData = {
                timestamp: new Date().toISOString(),
                distributions,
                defaultDistribution: this.defaultDistribution
            };
            
            const cacheFile = path.join(cacheDir, 'distributions.json');
            await fs.promises.writeFile(
                cacheFile,
                JSON.stringify(cacheData, null, 2),
                'utf8'
            );
            
            logger.debug('Saved distribution cache');
        } catch (error) {
            logger.error('Failed to save local cache', error);
        }
    }
    
    /**
     * Load distributions from local cache file
     */
    private async loadLocalCache(): Promise<DistributionInfo[]> {
        try {
            const cacheFile = path.join(this.getCacheDirectory(), 'distributions.json');
            
            if (!fs.existsSync(cacheFile)) {
                logger.warn('No local cache found');
                return [];
            }
            
            const content = await fs.promises.readFile(cacheFile, 'utf8');
            const cacheData = JSON.parse(content) as CacheData;
            
            // Use cached data
            this.defaultDistribution = cacheData.defaultDistribution || 'Ubuntu';
            this.cache = cacheData.distributions || [];
            
            // Set expiry to allow refresh attempt next time
            this.cacheExpiry = new Date(Date.now() + 60 * 1000); // 1 minute
            
            logger.info(`Loaded ${this.cache.length} distributions from cache`);
            return this.cache;
            
        } catch (error) {
            logger.error('Failed to load local cache', error);
            return [];
        }
    }
    
    /**
     * Clear cache to force refresh
     */
    clearCache(): void {
        this.cache = null;
        this.cacheExpiry = null;
        logger.debug('Cache cleared');
    }
}