/**
 * Unit tests for DistributionRegistry
 * Tests fetching distributions from Microsoft's official registry
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DistributionRegistry, DistributionInfo } from '../../src/distributionRegistry';

// Mock fetch globally
global.fetch = jest.fn();

// Sample data matching Microsoft's actual DistributionInfo.json structure
const mockDistributionData = {
    "Default": "Ubuntu",
    "Distributions": [
        {
            "Name": "Ubuntu",
            "FriendlyName": "Ubuntu",
            "Amd64PackageUrl": "https://aka.ms/wslubuntu",
            "Arm64PackageUrl": "https://aka.ms/wslubuntu-arm64",
            "StoreAppId": "9PN20MSR04DW"
        },
        {
            "Name": "Debian",
            "FriendlyName": "Debian GNU/Linux",
            "Amd64PackageUrl": "https://aka.ms/wsl-debian-gnulinux",
            "StoreAppId": "9MSVKQC78PK6"
        },
        {
            "Name": "Alpine",
            "FriendlyName": "Alpine WSL",
            "Amd64PackageUrl": "https://aka.ms/wsl-alpine",
            "StoreAppId": "9P804CRF0395"
        },
        {
            "Name": "Ubuntu-22.04",
            "FriendlyName": "Ubuntu 22.04 LTS",
            "Amd64PackageUrl": "https://aka.ms/wslubuntu2204",
            "Arm64PackageUrl": "https://aka.ms/wslubuntu2204-arm64",
            "PackageFamilyName": "CanonicalGroupLimited.Ubuntu22.04LTS_79rhkp1fndgsc"
        }
    ]
};

describe('DistributionRegistry', () => {
    let registry: DistributionRegistry;
    let tempDir: string;
    
    beforeEach(() => {
        registry = new DistributionRegistry();
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wsl-test-'));
        
        // Reset fetch mock
        (global.fetch as jest.Mock).mockReset();
    });
    
    afterEach(() => {
        // Clean up temp directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true });
        }
    });
    
    describe('fetchAvailableDistributions', () => {
        it('should fetch distributions from Microsoft registry', async () => {
            // Mock successful fetch
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockDistributionData
            });
            
            const distros = await registry.fetchAvailableDistributions();
            
            expect(global.fetch).toHaveBeenCalledWith(
                'https://raw.githubusercontent.com/microsoft/WSL/master/distributions/DistributionInfo.json'
            );
            expect(distros).toHaveLength(4);
            expect(distros[0].Name).toBe('Ubuntu');
            expect(distros[0].FriendlyName).toBe('Ubuntu');
            expect(distros[0].Amd64PackageUrl).toBe('https://aka.ms/wslubuntu');
        });
        
        it('should use cached data within 24 hours', async () => {
            // First call - fetches from network
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockDistributionData
            });
            
            const firstCall = await registry.fetchAvailableDistributions();
            expect(global.fetch).toHaveBeenCalledTimes(1);
            
            // Second call - should use cache
            const secondCall = await registry.fetchAvailableDistributions();
            expect(global.fetch).toHaveBeenCalledTimes(1); // Still only 1 call
            expect(secondCall).toEqual(firstCall);
        });
        
        it('should refresh cache after 24 hours', async () => {
            // Mock Date to control time
            const originalDate = Date;
            const mockDate = jest.fn(() => new originalDate('2024-01-01T00:00:00Z'));
            mockDate.now = jest.fn(() => new originalDate('2024-01-01T00:00:00Z').getTime());
            global.Date = mockDate as any;
            
            // First call
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockDistributionData
            });
            await registry.fetchAvailableDistributions();
            
            // Advance time by 25 hours
            mockDate.now = jest.fn(() => new originalDate('2024-01-02T01:00:00Z').getTime());
            
            // Second call should fetch again
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockDistributionData
            });
            await registry.fetchAvailableDistributions();
            
            expect(global.fetch).toHaveBeenCalledTimes(2);
            
            // Restore Date
            global.Date = originalDate;
        });
        
        it('should fall back to local cache when network fails', async () => {
            // First, populate local cache
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockDistributionData
            });
            await registry.fetchAvailableDistributions();
            
            // Clear cache to force re-fetch
            registry['cache'] = null;
            registry['cacheExpiry'] = null;
            
            // Now simulate network failure
            (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
            
            const distros = await registry.fetchAvailableDistributions();
            
            // Should still return data from local cache
            expect(distros).toHaveLength(4);
            expect(distros[0].Name).toBe('Ubuntu');
        });
        
        it('should parse Microsoft JSON structure correctly', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockDistributionData
            });
            
            const distros = await registry.fetchAvailableDistributions();
            
            // Check that all expected fields are parsed
            const ubuntu = distros.find(d => d.Name === 'Ubuntu');
            expect(ubuntu).toBeDefined();
            expect(ubuntu!.FriendlyName).toBe('Ubuntu');
            expect(ubuntu!.Amd64PackageUrl).toBe('https://aka.ms/wslubuntu');
            expect(ubuntu!.Arm64PackageUrl).toBe('https://aka.ms/wslubuntu-arm64');
            expect(ubuntu!.StoreAppId).toBe('9PN20MSR04DW');
            
            // Check Ubuntu 22.04 with PackageFamilyName
            const ubuntu2204 = distros.find(d => d.Name === 'Ubuntu-22.04');
            expect(ubuntu2204).toBeDefined();
            expect(ubuntu2204!.PackageFamilyName).toBe('CanonicalGroupLimited.Ubuntu22.04LTS_79rhkp1fndgsc');
        });
        
        it('should handle malformed JSON gracefully', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ invalid: 'structure' })
            });
            
            const distros = await registry.fetchAvailableDistributions();
            
            // Should return empty array or fall back to cache
            expect(distros).toEqual([]);
        });
    });
    
    describe('getDownloadUrl', () => {
        beforeEach(async () => {
            // Pre-populate with test data
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockDistributionData
            });
            await registry.fetchAvailableDistributions();
        });
        
        it('should return correct URL for x64 architecture', () => {
            const url = registry.getDownloadUrl('Ubuntu', 'x64');
            expect(url).toBe('https://aka.ms/wslubuntu');
        });
        
        it('should return correct URL for ARM64 architecture', () => {
            const url = registry.getDownloadUrl('Ubuntu', 'arm64');
            expect(url).toBe('https://aka.ms/wslubuntu-arm64');
        });
        
        it('should fall back to x64 URL when ARM64 not available', () => {
            const url = registry.getDownloadUrl('Debian', 'arm64');
            expect(url).toBe('https://aka.ms/wsl-debian-gnulinux');
        });
        
        it('should handle missing distribution gracefully', () => {
            const url = registry.getDownloadUrl('NonExistent', 'x64');
            expect(url).toBeNull();
        });
        
        it('should handle distribution name case-insensitively', () => {
            const url = registry.getDownloadUrl('ubuntu', 'x64');
            expect(url).toBe('https://aka.ms/wslubuntu');
        });
    });
    
    describe('getDistributionInfo', () => {
        beforeEach(async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockDistributionData
            });
            await registry.fetchAvailableDistributions();
        });
        
        it('should return full distribution info', () => {
            const info = registry.getDistributionInfo('Ubuntu');
            expect(info).toBeDefined();
            expect(info!.Name).toBe('Ubuntu');
            expect(info!.FriendlyName).toBe('Ubuntu');
            expect(info!.StoreAppId).toBe('9PN20MSR04DW');
        });
        
        it('should return null for non-existent distribution', () => {
            const info = registry.getDistributionInfo('NonExistent');
            expect(info).toBeNull();
        });
    });
    
    describe('getDefaultDistribution', () => {
        it('should return the default distribution from Microsoft data', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockDistributionData
            });
            
            await registry.fetchAvailableDistributions();
            const defaultDistro = registry.getDefaultDistribution();
            
            expect(defaultDistro).toBe('Ubuntu');
        });
    });
    
    describe('local cache management', () => {
        it('should save distributions to local cache file', async () => {
            // Mock the cache directory
            const cacheDir = path.join(tempDir, '.wsl-manager', 'cache');
            registry['getCacheDirectory'] = () => cacheDir;

            global.fetch = vi.fn(async () => ({
                ok: true,
                json: async () => mockDistributionData
            } as Response));

            await registry.fetchAvailableDistributions();
            global.fetch = originalFetch;
            
            // Check that cache file was created
            const cacheFile = path.join(cacheDir, 'distributions.json');
            expect(fs.existsSync(cacheFile)).toBe(true);
            
            // Verify cache content
            const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
            expect(cached.distributions).toHaveLength(4);
            expect(cached.distributions[0].Name).toBe('Ubuntu');
        });
        
        it('should load from local cache when network unavailable', async () => {
            // Create a cache file manually
            const cacheDir = path.join(tempDir, '.wsl-manager', 'cache');
            registry['getCacheDirectory'] = () => cacheDir;
            fs.mkdirSync(cacheDir, { recursive: true });
            
            const cacheData = {
                timestamp: new Date().toISOString(),
                distributions: mockDistributionData.Distributions,
                defaultDistribution: mockDistributionData.Default
            };
            fs.writeFileSync(
                path.join(cacheDir, 'distributions.json'),
                JSON.stringify(cacheData)
            );
            
            // Simulate network failure
            (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
            
            const distros = await registry.fetchAvailableDistributions();
            
            expect(distros).toHaveLength(4);
            expect(distros[0].Name).toBe('Ubuntu');
        });
    });
});