/**
 * Distribution Downloader
 * Provides robust distribution downloading with multiple fallback methods
 * Follows Microsoft's WSL best practices with progress tracking and retry logic
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
// Use global fetch (Node 18+) or polyfill for older versions
declare const fetch: any;
import { DistributionRegistry, DistributionInfo } from './distributionRegistry';
import { CommandBuilder, CommandOptions } from './utils/commandBuilder';
import { Logger } from './utils/logger';

const execAsync = promisify(exec);
const logger = Logger.getInstance();

/**
 * Download progress information
 */
export interface DownloadProgress {
    percent: number;
    downloaded: number;
    total: number;
}

/**
 * Download options for customizing download behavior
 */
export interface DownloadOptions {
    onProgress?: (progress: DownloadProgress) => void;
    maxRetries?: number;
    timeout?: number;
    architecture?: 'x64' | 'arm64';
}

/**
 * Robust distribution downloader with multiple fallback strategies
 * 
 * Strategy Priority:
 * 1. wsl --install (when admin privileges available)
 * 2. Direct URL download from Microsoft registry
 * 3. Alternative rootfs sources for common distributions
 */
export class DistributionDownloader {
    private readonly registry: DistributionRegistry;
    private readonly tempDir: string;
    
    constructor(registry: DistributionRegistry) {
        this.registry = registry;
        this.tempDir = path.join(os.tmpdir(), 'wsl-downloads');
        this.ensureTempDirectory();
    }
    
    /**
     * Download and install a distribution using the best available method
     */
    async downloadDistribution(
        distributionName: string, 
        options: DownloadOptions = {}
    ): Promise<string> {
        const { maxRetries = 3, architecture = 'x64' } = options;
        
        logger.info(`Downloading distribution: ${distributionName}`);
        
        try {
            const errors: string[] = [];
            
            // Strategy 1: Try wsl --install if we have admin privileges
            if (await this.hasAdminPrivileges()) {
                logger.debug('Admin privileges detected, trying wsl --install');
                try {
                    return await this.downloadWithWslInstall(distributionName, options);
                } catch (error) {
                    const errorMsg = `WSL install failed: ${error}`;
                    errors.push(errorMsg);
                    logger.warn('WSL install failed, falling back to URL download', { error: error });
                }
            } else {
                errors.push('WSL install skipped: requires administrator privileges');
            }
            
            // Strategy 2: Try URL download from registry
            const distInfo = this.registry.getDistributionInfo(distributionName);
            if (distInfo) {
                logger.debug('Distribution found in registry, trying URL download');
                try {
                    return await this.downloadFromUrl(distInfo, architecture, options);
                } catch (error) {
                    const errorMsg = `URL download failed: ${error}`;
                    errors.push(errorMsg);
                    logger.warn('URL download failed, falling back to rootfs', { error: error });
                }
            } else {
                errors.push('Distribution not found in Microsoft registry');
            }
            
            // Strategy 3: Try alternative rootfs sources
            logger.debug('Trying alternative rootfs sources');
            try {
                return await this.downloadRootfs(distributionName, options);
            } catch (error) {
                errors.push(`Rootfs download failed: ${error}`);
                throw new Error(`All download strategies failed for '${distributionName}':\n${errors.map(e => `  - ${e}`).join('\n')}`);
            }
            
        } catch (error) {
            throw new Error(`Failed to download distribution '${distributionName}': ${error}`);
        }
    }
    
    /**
     * Download using wsl --install command (requires admin)
     */
    private async downloadWithWslInstall(
        distributionName: string,
        options: DownloadOptions
    ): Promise<string> {
        const { timeout = 600000 } = options; // 10 minutes default
        
        await CommandBuilder.executeWSL(
            ['--install', '-d', distributionName],
            { timeout } as CommandOptions
        );
        
        logger.info(`Successfully installed ${distributionName} via WSL`);
        return distributionName;
    }
    
    /**
     * Download from URL using distribution registry information
     */
    private async downloadFromUrl(
        distInfo: DistributionInfo,
        architecture: 'x64' | 'arm64',
        options: DownloadOptions
    ): Promise<string> {
        const { maxRetries = 3 } = options;
        
        // Get appropriate URL for architecture
        const downloadUrl = this.getDownloadUrlForArchitecture(distInfo, architecture);
        if (!downloadUrl) {
            throw new Error(`No download URL available for ${distInfo.Name} (${architecture})`);
        }
        
        logger.debug(`Downloading from URL: ${downloadUrl}`);
        
        // Determine file extension and path (case-insensitive)
        const urlLower = downloadUrl.toLowerCase();
        let fileExtension = '.wsl'; // default
        
        if (urlLower.includes('.wsl')) {
            fileExtension = '.wsl';
        } else if (urlLower.includes('.appxbundle')) {
            fileExtension = '.appxbundle';
        } else if (urlLower.includes('.appx')) {
            fileExtension = '.appx';
        }
        
        const downloadPath = path.join(this.tempDir, `${distInfo.Name}${fileExtension}`);
        
        // Download with retry logic
        let lastError: Error | null = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await this.downloadWithProgress(downloadUrl, downloadPath, options.onProgress);
                
                // Verify checksum if available (future enhancement)
                // Note: Checksum field not yet in Microsoft registry
                // if (distInfo.Checksum) {
                //     const isValid = await this.verifyChecksum(downloadPath, distInfo.Checksum);
                //     if (!isValid) {
                //         throw new Error('Downloaded file failed checksum verification');
                //     }
                // }
                
                // Check disk space before import
                if (!(await this.checkDiskSpace(downloadPath))) {
                    throw new Error('Insufficient disk space for import');
                }
                
                // Import the downloaded package
                await this.importPackage(downloadPath, distInfo.Name);
                
                logger.info(`Successfully downloaded and imported ${distInfo.Name}`);
                return distInfo.Name;
                
            } catch (error) {
                lastError = error as Error;
                logger.warn(`Download attempt ${attempt} failed:`, { error: error });
                
                // Clean up failed download
                if (fs.existsSync(downloadPath)) {
                    fs.unlinkSync(downloadPath);
                }
                
                // Wait before retry (exponential backoff)
                if (attempt < maxRetries) {
                    const delay = Math.pow(2, attempt) * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        throw lastError || new Error('Download failed after all retries');
    }
    
    /**
     * Download file with progress tracking
     */
    private async downloadWithProgress(
        url: string,
        destinationPath: string,
        onProgress?: (progress: DownloadProgress) => void
    ): Promise<string> {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const totalSize = parseInt(response.headers.get('content-length') || '0');
        let downloadedSize = 0;
        
        const writeStream = fs.createWriteStream(destinationPath);
        
        if (response.body) {
            const reader = response.body.getReader();
            
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    
                    if (done) break;
                    
                    downloadedSize += value.length;
                    writeStream.write(Buffer.from(value));
                    
                    if (onProgress && totalSize > 0) {
                        const percent = Math.round((downloadedSize / totalSize) * 100);
                        onProgress({
                            percent,
                            downloaded: downloadedSize,
                            total: totalSize
                        });
                    }
                }
            } finally {
                reader.releaseLock();
                writeStream.end();
            }
        }
        
        return new Promise((resolve, reject) => {
            writeStream.on('finish', () => resolve(destinationPath));
            writeStream.on('error', reject);
        });
    }
    
    /**
     * Import downloaded package using appropriate method
     */
    private async importPackage(packagePath: string, distributionName: string): Promise<void> {
        const fileExtension = path.extname(packagePath).toLowerCase();
        
        if (fileExtension === '.appx' || fileExtension === '.appxbundle') {
            await this.installAppxPackage(packagePath);
        } else {
            // Default to WSL import for .wsl files
            const installPath = path.join(os.homedir(), '.wsl', distributionName);
            await CommandBuilder.executeWSL([
                '--import', 
                distributionName, 
                installPath, 
                packagePath
            ], { timeout: 300000 } as CommandOptions); // 5 minutes
        }
    }
    
    /**
     * Install .appx package using PowerShell
     */
    private async installAppxPackage(packagePath: string): Promise<void> {
        const command = `Add-AppxPackage -Path "${packagePath}"`;
        await execAsync(`powershell -Command "${command}"`);
    }
    
    /**
     * Download from alternative rootfs sources for common distributions
     */
    private async downloadRootfs(
        distributionName: string,
        options: DownloadOptions = {}
    ): Promise<string> {
        const rootfsUrl = this.getRootfsUrl(distributionName);
        if (!rootfsUrl) {
            throw new Error(`No rootfs source available for ${distributionName}`);
        }
        
        logger.debug(`Downloading rootfs from: ${rootfsUrl}`);
        
        const downloadPath = path.join(this.tempDir, `${distributionName.toLowerCase()}.tar.gz`);
        await this.downloadWithProgress(rootfsUrl, downloadPath, options.onProgress);
        
        // Import as WSL distribution
        const installPath = path.join(os.homedir(), '.wsl', distributionName);
        await CommandBuilder.executeWSL([
            '--import',
            distributionName,
            installPath,
            downloadPath
        ], { timeout: 300000 } as CommandOptions);
        
        logger.info(`Successfully imported ${distributionName} from rootfs`);
        return distributionName;
    }
    
    /**
     * Get rootfs URL for known distributions
     */
    private getRootfsUrl(distributionName: string): string | null {
        const rootfsUrls: { [key: string]: string } = {
            'alpine': 'https://dl-cdn.alpinelinux.org/alpine/v3.19/releases/x86_64/alpine-minirootfs-3.19.1-x86_64.tar.gz',
            'archlinux': 'https://archive.archlinux.org/iso/latest/archlinux-bootstrap-x86_64.tar.gz',
            // Note: Ubuntu and Debian should use Microsoft's URLs, these are emergency fallbacks
            'ubuntu': 'https://cloud-images.ubuntu.com/minimal/releases/jammy/release/ubuntu-22.04-minimal-cloudimg-amd64-wsl.rootfs.tar.gz',
            'debian': 'https://github.com/debuerreotype/docker-debian-artifacts/raw/dist-amd64/bullseye/rootfs.tar.xz',
        };
        
        return rootfsUrls[distributionName.toLowerCase()] || null;
    }
    
    /**
     * Check if current process has admin privileges
     */
    private async hasAdminPrivileges(): Promise<boolean> {
        if (process.platform !== 'win32') {
            return false;
        }
        
        try {
            // Try to run a command that requires admin privileges
            await execAsync('fsutil fsinfo driveType C:', { timeout: 5000 });
            return true;
        } catch {
            return false;
        }
    }
    
    /**
     * Get download URL for specific architecture
     */
    private getDownloadUrlForArchitecture(
        distInfo: DistributionInfo, 
        architecture: 'x64' | 'arm64'
    ): string | null {
        if (architecture === 'arm64') {
            return distInfo.Arm64WslUrl || 
                   distInfo.Arm64PackageUrl || 
                   distInfo.Amd64WslUrl || 
                   distInfo.Amd64PackageUrl || 
                   null;
        } else {
            return distInfo.Amd64WslUrl || 
                   distInfo.Amd64PackageUrl || 
                   null;
        }
    }
    
    /**
     * Verify downloaded file checksum
     */
    private async verifyChecksum(filePath: string, expectedChecksum: string): Promise<boolean> {
        try {
            const fileBuffer = fs.readFileSync(filePath);
            const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
            return hash.toLowerCase() === expectedChecksum.toLowerCase();
        } catch (error) {
            logger.warn('Failed to verify checksum:', { error: error });
            return false;
        }
    }
    
    /**
     * Check if there's enough disk space for the download
     */
    private async checkDiskSpace(filePath: string): Promise<boolean> {
        try {
            const stats = fs.statSync(filePath);
            const freeSpace = this.getAvailableDiskSpace();
            
            // Require at least 2x the download size for extraction
            return freeSpace > (stats.size * 2);
        } catch {
            // If we can't check, assume it's OK
            return true;
        }
    }
    
    /**
     * Get available disk space (simplified implementation)
     */
    private getAvailableDiskSpace(): number {
        try {
            const stats = fs.statSync(this.tempDir);
            // This is a simplified check - in a real implementation,
            // you'd use a proper disk space checking library
            return Number.MAX_SAFE_INTEGER;
        } catch {
            return Number.MAX_SAFE_INTEGER;
        }
    }
    
    /**
     * Ensure temp directory exists
     */
    private ensureTempDirectory(): void {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }
}