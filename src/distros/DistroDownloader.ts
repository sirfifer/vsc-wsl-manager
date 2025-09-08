/**
 * Distro Downloader for Pristine Templates
 * 
 * Downloads pristine distribution tar files from official sources
 * and stores them for use as clean templates.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import * as crypto from 'crypto';
import { URL } from 'url';
import { Logger } from '../utils/logger';
import { DistroManager, DistroInfo } from './DistroManager';

const logger = Logger.getInstance();

/**
 * Download progress information
 */
export interface DownloadProgress {
    /** Bytes downloaded so far */
    downloaded: number;
    
    /** Total bytes to download */
    total: number;
    
    /** Percentage complete (0-100) */
    percent: number;
    
    /** Download speed in bytes/sec */
    speed?: number;
    
    /** Estimated time remaining in seconds */
    eta?: number;
}

/**
 * Download options
 */
export interface DownloadOptions {
    /** Progress callback */
    onProgress?: (progress: DownloadProgress) => void;
    
    /** Whether to verify checksum */
    verifyChecksum?: boolean;
    
    /** Expected SHA256 checksum */
    expectedChecksum?: string;
    
    /** Download timeout in milliseconds */
    timeout?: number;
    
    /** Whether to overwrite existing file */
    overwrite?: boolean;
}

/**
 * DistroDownloader handles downloading pristine distributions
 */
export class DistroDownloader {
    private readonly distroManager: DistroManager;
    private readonly tempDir: string;
    private activeDownloads: Map<string, AbortController> = new Map();
    
    constructor(distroManager?: DistroManager) {
        this.distroManager = distroManager || new DistroManager();
        this.tempDir = path.join(
            process.env.USERPROFILE || process.env.HOME || '',
            '.vscode-wsl-manager',
            'temp'
        );
        
        this.ensureTempDir();
    }
    
    /**
     * Ensure temp directory exists
     */
    private ensureTempDir(): void {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }
    
    /**
     * Download a distro from its source URL
     */
    async downloadDistro(
        distroName: string,
        options: DownloadOptions = {}
    ): Promise<void> {
        logger.info(`Starting download of distro: ${distroName}`);
        
        // Get distro info
        const distro = await this.distroManager.getDistro(distroName);
        if (!distro) {
            throw new Error(`Distro not found: ${distroName}`);
        }
        
        if (!distro.sourceUrl) {
            throw new Error(`No download URL for distro: ${distroName}`);
        }
        
        // Check if already downloaded
        const targetPath = this.distroManager.getDistroPath(distroName);
        if (fs.existsSync(targetPath) && !options.overwrite) {
            logger.info(`Distro already downloaded: ${distroName}`);
            
            // Verify if requested
            if (options.verifyChecksum && distro.sha256) {
                const isValid = await this.verifyFile(targetPath, distro.sha256);
                if (!isValid) {
                    throw new Error('Downloaded file checksum mismatch');
                }
            }
            
            return;
        }
        
        // Download to temp file first
        const tempPath = path.join(this.tempDir, `${distroName}.download`);
        
        try {
            // Create abort controller for cancellation
            const abortController = new AbortController();
            this.activeDownloads.set(distroName, abortController);
            
            // Download the file
            await this.downloadFile(
                distro.sourceUrl,
                tempPath,
                {
                    ...options,
                    signal: abortController.signal
                }
            );
            
            // Verify checksum if available
            if (distro.sha256) {
                logger.debug(`Verifying checksum for ${distroName}`);
                const isValid = await this.verifyFile(tempPath, distro.sha256);
                if (!isValid) {
                    throw new Error('Downloaded file checksum mismatch');
                }
            }
            
            // Move to final location
            if (fs.existsSync(targetPath)) {
                fs.unlinkSync(targetPath);
            }
            fs.renameSync(tempPath, targetPath);
            
            // Update distro info
            const stats = fs.statSync(targetPath);
            distro.size = stats.size;
            distro.filePath = targetPath;
            distro.available = true;
            
            // Save to catalog
            await this.distroManager.addDistro(distro, targetPath);
            
            logger.info(`Successfully downloaded distro: ${distroName}`);
        } catch (error) {
            // Clean up temp file on error
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
            throw error;
        } finally {
            this.activeDownloads.delete(distroName);
        }
    }
    
    /**
     * Download a file from a URL
     */
    private async downloadFile(
        url: string,
        destPath: string,
        options: DownloadOptions & { signal?: AbortSignal } = {}
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(url);
            const client = parsedUrl.protocol === 'https:' ? https : http;
            
            // Prepare request options
            const requestOptions: https.RequestOptions = {
                ...parsedUrl,
                timeout: options.timeout || 300000, // 5 minutes default
                headers: {
                    'User-Agent': 'vscode-wsl-manager/1.0.0'
                }
            };
            
            // Create write stream
            const fileStream = fs.createWriteStream(destPath);
            let downloadedBytes = 0;
            let totalBytes = 0;
            let startTime = Date.now();
            let lastProgressTime = startTime;
            
            // Make request
            const request = client.get(requestOptions, (response) => {
                // Handle redirects
                if (response.statusCode === 301 || response.statusCode === 302) {
                    const redirectUrl = response.headers.location;
                    if (redirectUrl) {
                        logger.debug(`Following redirect to: ${redirectUrl}`);
                        fileStream.close();
                        this.downloadFile(redirectUrl, destPath, options)
                            .then(resolve)
                            .catch(reject);
                        return;
                    }
                }
                
                // Check status code
                if (response.statusCode !== 200) {
                    fileStream.close();
                    fs.unlinkSync(destPath);
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                    return;
                }
                
                // Get total size
                totalBytes = parseInt(response.headers['content-length'] || '0', 10);
                
                // Pipe response to file
                response.pipe(fileStream);
                
                // Track progress
                response.on('data', (chunk: Buffer) => {
                    downloadedBytes += chunk.length;
                    
                    // Report progress
                    if (options.onProgress) {
                        const now = Date.now();
                        const timeDiff = now - lastProgressTime;
                        
                        // Throttle progress updates to every 100ms
                        if (timeDiff >= 100) {
                            const elapsedSeconds = (now - startTime) / 1000;
                            const speed = downloadedBytes / elapsedSeconds;
                            const percent = totalBytes > 0 
                                ? Math.round((downloadedBytes / totalBytes) * 100)
                                : 0;
                            const eta = totalBytes > 0 && speed > 0
                                ? (totalBytes - downloadedBytes) / speed
                                : undefined;
                            
                            options.onProgress({
                                downloaded: downloadedBytes,
                                total: totalBytes,
                                percent,
                                speed,
                                eta
                            });
                            
                            lastProgressTime = now;
                        }
                    }
                });
                
                // Handle completion
                fileStream.on('finish', () => {
                    fileStream.close();
                    
                    // Final progress update
                    if (options.onProgress && totalBytes > 0) {
                        options.onProgress({
                            downloaded: totalBytes,
                            total: totalBytes,
                            percent: 100,
                            speed: 0,
                            eta: 0
                        });
                    }
                    
                    resolve();
                });
            });
            
            // Handle errors
            request.on('error', (error) => {
                fileStream.close();
                if (fs.existsSync(destPath)) {
                    fs.unlinkSync(destPath);
                }
                reject(error);
            });
            
            request.on('timeout', () => {
                request.destroy();
                fileStream.close();
                if (fs.existsSync(destPath)) {
                    fs.unlinkSync(destPath);
                }
                reject(new Error('Download timeout'));
            });
            
            // Handle abort signal
            if (options.signal) {
                options.signal.addEventListener('abort', () => {
                    request.destroy();
                    fileStream.close();
                    if (fs.existsSync(destPath)) {
                        fs.unlinkSync(destPath);
                    }
                    reject(new Error('Download cancelled'));
                });
            }
            
            // Handle file stream errors
            fileStream.on('error', (error) => {
                request.destroy();
                reject(error);
            });
        });
    }
    
    /**
     * Verify file checksum
     */
    private async verifyFile(filePath: string, expectedHash: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha256');
            const stream = fs.createReadStream(filePath);
            
            stream.on('data', (data) => hash.update(data));
            stream.on('end', () => {
                const actualHash = hash.digest('hex');
                resolve(actualHash === expectedHash);
            });
            stream.on('error', reject);
        });
    }
    
    /**
     * Cancel an active download
     */
    cancelDownload(distroName: string): void {
        const controller = this.activeDownloads.get(distroName);
        if (controller) {
            controller.abort();
            this.activeDownloads.delete(distroName);
            logger.info(`Cancelled download of distro: ${distroName}`);
        }
    }
    
    /**
     * Check if a download is active
     */
    isDownloading(distroName: string): boolean {
        return this.activeDownloads.has(distroName);
    }
    
    /**
     * Get list of active downloads
     */
    getActiveDownloads(): string[] {
        return Array.from(this.activeDownloads.keys());
    }
    
    /**
     * Download multiple distros
     */
    async downloadMultiple(
        distroNames: string[],
        options: DownloadOptions = {}
    ): Promise<{ success: string[]; failed: string[] }> {
        const results = {
            success: [] as string[],
            failed: [] as string[]
        };
        
        for (const distroName of distroNames) {
            try {
                await this.downloadDistro(distroName, options);
                results.success.push(distroName);
            } catch (error) {
                logger.error(`Failed to download ${distroName}:`, error);
                results.failed.push(distroName);
            }
        }
        
        return results;
    }
    
    /**
     * Clean up temp directory
     */
    cleanupTempFiles(): void {
        try {
            const files = fs.readdirSync(this.tempDir);
            for (const file of files) {
                if (file.endsWith('.download')) {
                    const filePath = path.join(this.tempDir, file);
                    fs.unlinkSync(filePath);
                    logger.debug(`Cleaned up temp file: ${file}`);
                }
            }
        } catch (error) {
            logger.error('Failed to cleanup temp files:', error);
        }
    }
}