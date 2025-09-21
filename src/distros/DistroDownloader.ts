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
     * Validate a URL is reachable before attempting download
     */
    async validateUrl(url: string): Promise<{ valid: boolean; statusCode?: number; error?: string }> {
        return new Promise((resolve) => {
            const parsedUrl = new URL(url);
            const client = parsedUrl.protocol === 'https:' ? https : http;

            const req = client.request({
                hostname: parsedUrl.hostname,
                port: parsedUrl.port,
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'HEAD',
                timeout: 10000,
                headers: {
                    'User-Agent': 'VSC-WSL-Manager/1.0'
                }
            }, (res) => {
                // Handle redirects
                if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    this.validateUrl(res.headers.location).then(resolve);
                    return;
                }

                resolve({
                    valid: res.statusCode === 200,
                    statusCode: res.statusCode
                });
            });

            req.on('error', (error) => {
                resolve({
                    valid: false,
                    error: error.message
                });
            });

            req.on('timeout', () => {
                req.destroy();
                resolve({
                    valid: false,
                    error: 'Request timeout'
                });
            });

            req.end();
        });
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

        // Validate URL before attempting download
        logger.info(`Validating URL for ${distroName}: ${distro.sourceUrl}`);
        const validation = await this.validateUrl(distro.sourceUrl);

        if (!validation.valid) {
            const errorMsg = validation.error
                ? `URL validation failed: ${validation.error}`
                : `URL returned status ${validation.statusCode}`;

            logger.error(`${errorMsg} for ${distroName}`);

            const error: any = new Error(`Cannot reach download server for ${distroName}. ${errorMsg}`);
            error.url = distro.sourceUrl;
            error.statusCode = validation.statusCode;
            throw error;
        }

        logger.info(`URL validated successfully for ${distroName}`);

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
            
            // Check if this is an APPX/AppxBundle file that needs extraction
            // Use the URL extension, not the temp file extension
            const urlExt = path.extname(new URL(distro.sourceUrl).pathname).toLowerCase();
            if (urlExt === '.appx' || urlExt === '.appxbundle') {
                logger.info(`Extracting TAR from ${urlExt} package...`);
                const extractedPath = await this.extractTarFromAppx(tempPath, targetPath);

                // Clean up the APPX file
                if (fs.existsSync(tempPath)) {
                    fs.unlinkSync(tempPath);
                }

                // Use the extracted TAR path
                if (!extractedPath) {
                    throw new Error('Failed to extract TAR file from APPX package');
                }
            } else {
                // Not an APPX, just move to final location
                if (fs.existsSync(targetPath)) {
                    fs.unlinkSync(targetPath);
                }
                fs.renameSync(tempPath, targetPath);
            }
            
            // Update distro info
            const stats = fs.statSync(targetPath);
            distro.size = stats.size;
            distro.filePath = targetPath;
            distro.available = true;
            
            // Save to catalog
            await this.distroManager.addDistro(distro, targetPath);
            
            logger.info(`Successfully downloaded distro: ${distroName}`);
        } catch (error: any) {
            // Clean up temp file on error
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
            logger.error(`Failed to download ${distroName}: ${error.message}`);
            // Enhance error message for better user feedback
            if (error.message.includes('ENOTFOUND')) {
                throw new Error(`Cannot reach download server. Check your internet connection.`);
            } else if (error.message.includes('ETIMEDOUT')) {
                throw new Error(`Download timed out. The server may be slow or your connection may be unstable.`);
            } else if (error.message.includes('HTTP')) {
                throw error; // Already formatted
            } else {
                throw new Error(`Failed to download ${distroName}: ${error.message}`);
            }
        } finally {
            this.activeDownloads.delete(distroName);
        }
    }
    
    /**
     * Extract TAR file from APPX/AppxBundle package
     * @param appxPath Path to the APPX file
     * @param targetPath Desired path for the extracted TAR file
     * @returns Path to the extracted TAR file, or null if extraction failed
     */
    private async extractTarFromAppx(appxPath: string, targetPath: string): Promise<string | null> {
        try {
            // Use unzip command (available on most systems)
            const { execSync } = require('child_process');
            const tempDir = path.join(path.dirname(appxPath), 'appx_extract_' + Date.now());

            // Create temp directory
            fs.mkdirSync(tempDir, { recursive: true });

            // Extract using unzip or tar (APPX is basically a ZIP file)
            try {
                // Try unzip first
                execSync(`unzip -q "${appxPath}" -d "${tempDir}"`, { stdio: 'pipe' });
            } catch {
                // Try using tar as fallback
                try {
                    execSync(`tar -xf "${appxPath}" -C "${tempDir}"`, { stdio: 'pipe' });
                } catch (error) {
                    logger.error('Failed to extract APPX using unzip or tar');
                    throw error;
                }
            }

            // Find the TAR file (usually install.tar.gz or similar)
            const files = this.findFilesRecursive(tempDir);
            let tarFile = null;

            for (const file of files) {
                const basename = path.basename(file).toLowerCase();
                if (basename.endsWith('.tar.gz') || basename.endsWith('.tar')) {
                    // Prefer install.tar.gz if available
                    if (basename.includes('install')) {
                        tarFile = file;
                        break;
                    }
                    // Otherwise take the first TAR file found
                    if (!tarFile) {
                        tarFile = file;
                    }
                }
            }

            if (tarFile) {
                logger.info(`Found TAR file: ${path.basename(tarFile)}`);

                // Move to target location
                if (fs.existsSync(targetPath)) {
                    fs.unlinkSync(targetPath);
                }
                fs.renameSync(tarFile, targetPath);

                // Clean up temp directory
                fs.rmSync(tempDir, { recursive: true, force: true });

                logger.info(`Successfully extracted TAR to: ${targetPath}`);
                return targetPath;
            }

            // Clean up temp directory
            fs.rmSync(tempDir, { recursive: true, force: true });
            logger.error('No TAR file found in APPX package');
            return null;

        } catch (error: any) {
            logger.error(`Failed to extract TAR from APPX: ${error.message}`);
            return null;
        }
    }

    /**
     * Recursively find all files in a directory
     */
    private findFilesRecursive(dir: string): string[] {
        const files: string[] = [];

        const items = fs.readdirSync(dir);
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                files.push(...this.findFilesRecursive(fullPath));
            } else {
                files.push(fullPath);
            }
        }

        return files;
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
            
            // Prepare request options - extract only needed properties from URL
            const requestOptions: https.RequestOptions = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'GET',
                timeout: options.timeout || 300000, // 5 minutes default
                headers: {
                    'User-Agent': 'vscode-wsl-manager/1.0.0',
                    'Accept': '*/*'
                }
            };

            logger.debug(`Downloading from: ${url}`);
            logger.debug(`Request options: ${JSON.stringify({ hostname: requestOptions.hostname, path: requestOptions.path })}`);
            
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
                    if (fs.existsSync(destPath)) {
                        fs.unlinkSync(destPath);
                    }
                    const errorMsg = `HTTP ${response.statusCode}: ${response.statusMessage} for URL: ${url}`;
                    logger.error(errorMsg);
                    reject(new Error(errorMsg));
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
            request.on('error', (error: any) => {
                fileStream.close();
                if (fs.existsSync(destPath)) {
                    fs.unlinkSync(destPath);
                }
                logger.error(`Download request failed for ${url}: ${error.message}`);
                reject(new Error(`Download failed: ${error.message}`));
            });
            
            request.on('timeout', () => {
                request.destroy();
                fileStream.close();
                if (fs.existsSync(destPath)) {
                    fs.unlinkSync(destPath);
                }
                logger.error(`Download timeout for ${url} after ${options.timeout || 300000}ms`);
                reject(new Error(`Download timeout after ${(options.timeout || 300000) / 1000} seconds`));
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