/**
 * Distro Downloader for Pristine Templates
 * 
 * Downloads pristine distribution tar files from official sources
 * and stores them for use as clean templates.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import * as http from 'http';
import * as crypto from 'crypto';
import { URL } from 'url';
import { Logger } from '../utils/logger';
import { DistroManager, DistroInfo } from './DistroManager';
import { CrossPlatformCommandExecutor } from '../utils/commandExecutor';
import { PLATFORM } from '../utils/platform';

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

    /** Byte offset to resume from */
    resumeFrom?: number;

    /** Whether to follow redirects */
    followRedirects?: boolean;

    /** Skip if file exists with matching checksum */
    skipIfExists?: boolean;

    /** Abort signal for cancellation */
    signal?: AbortSignal;

    /** Distro info to use (if not already in manager) */
    distro?: DistroInfo;
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

        // Get distro info - use provided distro or look it up in manager
        let distro: DistroInfo | null = options.distro || null;
        if (!distro) {
            distro = await this.distroManager.getDistro(distroName);
        }

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
            await this.downloadFileOld(
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
                // Use copy+delete for cross-filesystem compatibility
                fs.copyFileSync(tempPath, targetPath);
                fs.unlinkSync(tempPath);
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
     * Extract TAR file from APPX/AppxBundle package (cross-platform)
     * Handles both simple APPX files and nested AppxBundle structures
     * @param appxPath Path to the APPX file
     * @param targetPath Desired path for the extracted TAR file
     * @returns Path to the extracted TAR file, or null if extraction failed
     */
    private async extractTarFromAppx(appxPath: string, targetPath: string): Promise<string | null> {
        try {
            const executor = new CrossPlatformCommandExecutor();
            // Use system temp directory to avoid polluting source directories
            const tempDir = path.join(os.tmpdir(), 'appx_extract_' + Date.now());

            // Create temp directory
            fs.mkdirSync(tempDir, { recursive: true });

            logger.debug(`Extracting APPX package from ${appxPath}`);

            // Extract based on platform
            try {
                // Windows: Use PowerShell Expand-Archive for ZIP/APPX files
                if (PLATFORM.isWindows && process.platform === 'win32') {
                    logger.debug('Using PowerShell Expand-Archive for APPX extraction');

                    // Check if file exists before attempting extraction
                    if (!fs.existsSync(appxPath)) {
                        throw new Error(`APPX file not found: ${appxPath}`);
                    }

                    // PowerShell Expand-Archive requires .zip extension
                    // Rename file temporarily if it doesn't have .zip extension
                    const zipPath = appxPath.endsWith('.zip') ? appxPath : appxPath + '.zip';
                    if (appxPath !== zipPath) {
                        fs.copyFileSync(appxPath, zipPath);
                    }

                    try {
                        // Use PowerShell to extract APPX (which is a ZIP file)
                        const psCommand = `Expand-Archive -Path '${zipPath}' -DestinationPath '${tempDir}' -Force`;
                        const result = await executor.executeCommand('powershell.exe', [
                            '-NoProfile',
                            '-Command',
                            psCommand
                        ]);

                        if (result.exitCode !== 0) {
                            throw new Error(`PowerShell Expand-Archive failed: ${result.stderr}`);
                        }
                    } finally {
                        // Clean up temporary .zip file if we created one
                        if (appxPath !== zipPath && fs.existsSync(zipPath)) {
                            fs.unlinkSync(zipPath);
                        }
                    }
                } else {
                    // Linux/WSL: try unzip first, then tar
                    if (await executor.isCommandAvailable('unzip')) {
                        logger.debug('Using unzip for APPX extraction');
                        const result = await executor.executeCommand('unzip', [
                            '-q', appxPath,
                            '-d', tempDir
                        ]);

                        if (result.exitCode !== 0) {
                            throw new Error(`unzip extraction failed: ${result.stderr}`);
                        }
                    } else {
                        logger.debug('Using tar for APPX extraction');
                        const result = await executor.executeCommand('tar', [
                            '-xf', appxPath,
                            '-C', tempDir
                        ]);

                        if (result.exitCode !== 0) {
                            throw new Error(`tar extraction failed: ${result.stderr}`);
                        }
                    }
                }
            } catch (extractError: any) {
                logger.error(`APPX extraction failed: ${extractError.message}`);
                // Clean up temp directory
                fs.rmSync(tempDir, { recursive: true, force: true });
                throw extractError;
            }

            // Check if this is an AppxBundle with nested APPX files
            const extractedFiles = this.findFilesRecursive(tempDir);
            const nestedAppxFiles = extractedFiles.filter(f => {
                const ext = path.extname(f).toLowerCase();
                return ext === '.appx' || ext === '.msix';
            });

            if (nestedAppxFiles.length > 0) {
                logger.info(`Found ${nestedAppxFiles.length} nested APPX files in bundle`);

                // Look for x64/AMD64 package first, then fall back to first available
                let targetAppx = nestedAppxFiles.find(f => {
                    const basename = path.basename(f).toLowerCase();
                    return basename.includes('x64') || basename.includes('amd64');
                });

                if (!targetAppx) {
                    // Fall back to first APPX file
                    targetAppx = nestedAppxFiles[0];
                }

                logger.info(`Extracting nested APPX: ${path.basename(targetAppx)}`);

                // Create a subdirectory for the nested extraction
                const nestedTempDir = path.join(tempDir, 'nested_extract');
                fs.mkdirSync(nestedTempDir, { recursive: true });

                // Extract the nested APPX
                try {
                    if (PLATFORM.isWindows && process.platform === 'win32') {
                        // Use PowerShell for nested APPX extraction
                        // PowerShell requires .zip extension
                        const zipPath = targetAppx.endsWith('.zip') ? targetAppx : targetAppx + '.zip';
                        if (targetAppx !== zipPath) {
                            fs.copyFileSync(targetAppx, zipPath);
                        }

                        try {
                            const psCommand = `Expand-Archive -Path '${zipPath}' -DestinationPath '${nestedTempDir}' -Force`;
                            const result = await executor.executeCommand('powershell.exe', [
                                '-NoProfile',
                                '-Command',
                                psCommand
                            ]);

                            if (result.exitCode !== 0) {
                                throw new Error(`Nested PowerShell Expand-Archive failed: ${result.stderr}`);
                            }
                        } finally {
                            // Clean up temporary .zip file
                            if (targetAppx !== zipPath && fs.existsSync(zipPath)) {
                                fs.unlinkSync(zipPath);
                            }
                        }
                    } else {
                        if (await executor.isCommandAvailable('unzip')) {
                            const result = await executor.executeCommand('unzip', [
                                '-q', targetAppx,
                                '-d', nestedTempDir
                            ]);

                            if (result.exitCode !== 0) {
                                throw new Error(`Nested unzip extraction failed: ${result.stderr}`);
                            }
                        } else {
                            const result = await executor.executeCommand('tar', [
                                '-xf', targetAppx,
                                '-C', nestedTempDir
                            ]);

                            if (result.exitCode !== 0) {
                                throw new Error(`Nested tar extraction failed: ${result.stderr}`);
                            }
                        }
                    }

                    // Update the search to look in the nested directory
                    const nestedFiles = this.findFilesRecursive(nestedTempDir);
                    extractedFiles.push(...nestedFiles);
                } catch (nestedError: any) {
                    logger.error(`Failed to extract nested APPX: ${nestedError.message}`);
                    // Continue to search in the original extraction
                }
            }

            // Find the TAR file (usually install.tar.gz or similar)
            let tarFile = null;

            for (const file of extractedFiles) {
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

                // Copy to target location (use copy instead of rename to handle cross-device)
                if (fs.existsSync(targetPath)) {
                    fs.unlinkSync(targetPath);
                }

                // Copy file instead of rename to handle cross-filesystem moves
                fs.copyFileSync(tarFile, targetPath);

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
    private async downloadFileOld(
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
     * Download a file from URL to destination path
     */
    async downloadFile(
        url: string,
        destPath: string,
        options: DownloadOptions = {}
    ): Promise<void> {
        logger.debug(`Downloading from: ${url}`);
        logger.debug(`Destination: ${destPath}`);

        // Create destination directory if it doesn't exist
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        // If checksum verification is requested, use downloadWithChecksum
        if (options.verifyChecksum && options.expectedChecksum) {
            await this.downloadWithChecksum(url, destPath, options);
            return;
        }

        // Use internal downloadFile method
        await this.downloadFileInternal(url, destPath, options);
    }

    /**
     * Resume a partial download
     */
    async resumeDownload(url: string, destPath: string): Promise<void> {
        // Check if partial file exists
        const tempPath = `${destPath}.download`;
        if (fs.existsSync(tempPath)) {
            const stats = fs.statSync(tempPath);
            const startByte = stats.size;

            // Resume from where we left off
            await this.downloadFile(url, destPath, {
                resumeFrom: startByte
            });
        } else {
            // Start fresh download
            await this.downloadFile(url, destPath);
        }
    }

    /**
     * Download file and calculate checksum
     */
    async downloadWithChecksum(
        url: string,
        destPath: string,
        options: DownloadOptions = {}
    ): Promise<string> {
        // Check if file already exists with correct checksum
        if (fs.existsSync(destPath) && options.expectedChecksum) {
            const existingChecksum = await new Promise<string>((resolve, reject) => {
                const hash = crypto.createHash('sha256');
                const stream = fs.createReadStream(destPath);
                stream.on('data', (data) => hash.update(data));
                stream.on('end', () => resolve(hash.digest('hex')));
                stream.on('error', reject);
            });

            if (existingChecksum === options.expectedChecksum) {
                logger.debug(`File already exists with correct checksum: ${destPath}`);
                return existingChecksum;
            }
        }

        // Download the file (use internal method to avoid recursion)
        await this.downloadFileInternal(url, destPath, options);

        // Calculate SHA256 checksum
        const checksum = await new Promise<string>((resolve, reject) => {
            const hash = crypto.createHash('sha256');
            const stream = fs.createReadStream(destPath);

            stream.on('data', (data) => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
        });

        // Validate checksum if expected
        if (options.expectedChecksum && checksum !== options.expectedChecksum) {
            // Delete the file
            fs.unlinkSync(destPath);
            throw new Error(`Checksum mismatch! Expected ${options.expectedChecksum} but got ${checksum}`);
        }

        return checksum;
    }

    /**
     * Internal download implementation (renamed from downloadFile)
     */
    private async downloadFileInternal(
        url: string,
        destPath: string,
        options: DownloadOptions = {}
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(url);
            const protocol = parsedUrl.protocol === 'https:' ? https : http;

            const requestOptions: any = {
                hostname: parsedUrl.hostname,
                path: parsedUrl.pathname + parsedUrl.search,
                headers: {}
            };

            // Add resume header if specified
            if (options.resumeFrom) {
                requestOptions.headers['Range'] = `bytes=${options.resumeFrom}-`;
            }

            const tempPath = `${destPath}.download`;
            const writeStream = fs.createWriteStream(
                tempPath,
                options.resumeFrom ? { flags: 'a' } : undefined
            );

            const request = protocol.get(requestOptions, (response) => {
                // Handle redirects
                if (response.statusCode === 301 || response.statusCode === 302) {
                    const redirectUrl = response.headers.location;
                    if (redirectUrl && options.followRedirects !== false) {
                        logger.debug(`Following redirect to: ${redirectUrl}`);
                        writeStream.close();
                        this.downloadFileInternal(redirectUrl, destPath, options)
                            .then(resolve)
                            .catch(reject);
                        return;
                    }
                }

                if (response.statusCode !== 200 && response.statusCode !== 206) {
                    reject(new Error(`Download failed: ${response.statusCode}`));
                    return;
                }

                const totalSize = parseInt(response.headers['content-length'] || '0', 10);
                let downloadedSize = options.resumeFrom || 0;

                response.on('data', (chunk) => {
                    downloadedSize += chunk.length;
                    writeStream.write(chunk);

                    if (options.onProgress) {
                        options.onProgress({
                            downloaded: downloadedSize,
                            total: totalSize,
                            percent: totalSize > 0 ? (downloadedSize / totalSize) * 100 : 0,
                            speed: 0
                        });
                    }
                });

                response.on('end', () => {
                    writeStream.end();
                    // Use copy+delete for cross-filesystem compatibility
                    try {
                        fs.copyFileSync(tempPath, destPath);
                        fs.unlinkSync(tempPath);
                    } catch (err) {
                        // If copy fails, try rename as fallback
                        fs.renameSync(tempPath, destPath);
                    }
                    resolve();
                });

                response.on('error', reject);
            });

            // Handle abort signal
            if (options.signal) {
                options.signal.addEventListener('abort', () => {
                    request.destroy();
                    writeStream.close();
                    reject(new Error('Download aborted'));
                });
            }

            // Handle timeout
            if (options.timeout) {
                request.setTimeout(options.timeout, () => {
                    request.destroy();
                    reject(new Error('Download timeout'));
                });
            }

            request.on('error', reject);
        });
    }

    /**
     * Clean up temp directory and old extraction directories
     */
    cleanupTempFiles(): void {
        try {
            // Clean up .download files in tempDir
            if (fs.existsSync(this.tempDir)) {
                const files = fs.readdirSync(this.tempDir);
                for (const file of files) {
                    if (file.endsWith('.download')) {
                        const filePath = path.join(this.tempDir, file);
                        fs.unlinkSync(filePath);
                        logger.debug(`Cleaned up temp file: ${file}`);
                    }
                }
            }

            // Clean up old APPX extraction directories in system temp
            const systemTemp = os.tmpdir();
            const tempContents = fs.readdirSync(systemTemp);
            const oneHourAgo = Date.now() - 3600000; // 1 hour in ms

            for (const item of tempContents) {
                if (item.startsWith('appx_extract_')) {
                    const itemPath = path.join(systemTemp, item);
                    try {
                        const stats = fs.statSync(itemPath);
                        // Remove if older than 1 hour
                        if (stats.mtimeMs < oneHourAgo) {
                            fs.rmSync(itemPath, { recursive: true, force: true });
                            logger.debug(`Cleaned up old extraction directory: ${item}`);
                        }
                    } catch (err) {
                        // Ignore errors for individual items
                    }
                }
            }
        } catch (error) {
            logger.error('Failed to cleanup temp files:', error);
        }
    }
}