/**
 * Distribution Downloader
 * Provides robust distribution downloading with multiple fallback methods
 * Follows Microsoft's WSL best practices with progress tracking and retry logic
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { DistributionRegistry, DistributionInfo } from './distributionRegistry';
import { CommandBuilder, CommandOptions } from './utils/commandBuilder';
import { Logger } from './utils/logger';
const logger = Logger.getInstance();

/**
 * Download progress information
 */
export interface DownloadProgress {
    percent: number;
    downloaded: number;
    total: number;
    message?: string;
    speed?: string;
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
    private readonly userDistroPath: string;
    private readonly downloadsDir: string;
    private readonly instancesDir: string;
    
    constructor(registry: DistributionRegistry) {
        this.registry = registry;
        // Store everything in user's home directory - NO ADMIN REQUIRED
        this.userDistroPath = path.join(os.homedir(), 'WSL-Distros');
        this.downloadsDir = path.join(this.userDistroPath, 'downloads');
        this.instancesDir = path.join(this.userDistroPath, 'instances');
        this.ensureDirectories();
    }
    
    /**
     * Download and install a distribution - NO ADMIN REQUIRED
     * Uses TAR files and wsl --import which work in user space
     */
    async downloadDistribution(
        distributionName: string, 
        options: DownloadOptions = {}
    ): Promise<string> {
        const { maxRetries = 3 } = options;
        
        logger.info(`Downloading distribution: ${distributionName}`);
        
        try {
            // PRIMARY METHOD: Download TAR file and import (NO ADMIN REQUIRED)
            logger.debug('Using TAR download method (no admin required)');
            
            // Try to download rootfs TAR file
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const result = await this.downloadRootfs(distributionName, options);
                    logger.info(`Successfully downloaded and imported ${distributionName}`);
                    return result;
                } catch (error) {
                    logger.warn(`Attempt ${attempt} failed:`, { error });
                    if (attempt === maxRetries) {
                        throw error;
                    }
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
                }
            }
            
            throw new Error(`Failed to download ${distributionName} after ${maxRetries} attempts`);
            
        } catch (error) {
            throw new Error(`Failed to download distribution '${distributionName}': ${error}`);
        }
    }
    
    
    /**
     * DEPRECATED - Keeping for reference only
     * Download from URL using distribution registry information
     */
    private async downloadFromUrl_DEPRECATED(
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
        
        const downloadPath = path.join(this.downloadsDir, `${distInfo.Name}${fileExtension}`);
        
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
                
                // Import the downloaded package (deprecated method)
                await this.importPackage_DEPRECATED(downloadPath, distInfo.Name);
                
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
     * Note: This uses http/https modules for Node 16 compatibility
     */
    private async downloadWithProgress(
        url: string,
        destinationPath: string,
        onProgress?: (progress: DownloadProgress) => void
    ): Promise<string> {
        const https = require('https');
        const http = require('http');
        const { URL } = require('url');

        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(url);
            const client = parsedUrl.protocol === 'https:' ? https : http;

            const writeStream = fs.createWriteStream(destinationPath);
            let downloadedSize = 0;
            let totalSize = 0;

            const request = client.get(url, (response: any) => {
                // Handle redirects
                if (response.statusCode === 301 || response.statusCode === 302) {
                    const redirectUrl = response.headers.location;
                    if (redirectUrl) {
                        writeStream.close();
                        this.downloadWithProgress(redirectUrl, destinationPath, onProgress)
                            .then(resolve)
                            .catch(reject);
                        return;
                    }
                }

                // Check status
                if (response.statusCode !== 200) {
                    writeStream.close();
                    fs.unlinkSync(destinationPath);
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                    return;
                }

                totalSize = parseInt(response.headers['content-length'] || '0', 10);

                response.on('data', (chunk: Buffer) => {
                    downloadedSize += chunk.length;
                    writeStream.write(chunk);

                    if (onProgress && totalSize > 0) {
                        const percent = Math.round((downloadedSize / totalSize) * 100);
                        onProgress({
                            percent,
                            downloaded: downloadedSize,
                            total: totalSize
                        });
                    }
                });

                response.on('end', () => {
                    writeStream.end();
                });
            });

            request.on('error', (error: any) => {
                writeStream.close();
                fs.unlinkSync(destinationPath);
                reject(error);
            });

            writeStream.on('finish', () => {
                resolve(destinationPath);
            });

            writeStream.on('error', reject);
        });
    }
    
    /**
     * DEPRECATED - We now use TAR files only
     * Import downloaded package using appropriate method
     */
    private async importPackage_DEPRECATED(packagePath: string, distributionName: string): Promise<void> {
        const fileExtension = path.extname(packagePath).toLowerCase();
        
        logger.info(`Importing package: ${packagePath} (${fileExtension}) as ${distributionName}`);
        
        if (fileExtension === '.appx' || fileExtension === '.appxbundle') {
            // For APPX packages, use Add-AppxPackage to install the downloaded file
            logger.debug('Installing APPX package from downloaded file');
            await this.installAppxPackage_DEPRECATED(packagePath, distributionName);
        } else if (fileExtension === '.wsl') {
            // .wsl files are actually TAR archives, import them directly
            const installPath = path.join(os.homedir(), '.wsl', distributionName);
            await fs.promises.mkdir(installPath, { recursive: true });
            
            await CommandBuilder.executeWSL([
                '--import', 
                distributionName, 
                installPath, 
                packagePath
            ], { timeout: 300000 } as CommandOptions);
            
            // Verify installation
            await this.verifyInstallation(distributionName);
        } else {
            // For TAR/TAR.GZ files, use WSL import
            const installPath = path.join(os.homedir(), '.wsl', distributionName);
            await fs.promises.mkdir(installPath, { recursive: true });
            
            await CommandBuilder.executeWSL([
                '--import', 
                distributionName, 
                installPath, 
                packagePath
            ], { timeout: 300000 } as CommandOptions);
            
            // Verify installation
            await this.verifyInstallation(distributionName);
        }
    }
    
    /**
     * DEPRECATED - We don't use APPX anymore
     * Install .appx package using PowerShell (requires admin)
     */
    private async installAppxPackage_DEPRECATED(packagePath: string, distributionName: string): Promise<void> {
        // Check if we have admin privileges
        if (!await this.hasAdminPrivileges()) {
            throw new Error(
                `Administrator privileges required to install ${distributionName}. ` +
                `Please either:\n` +
                `1. Run VS Code as Administrator, or\n` +
                `2. Manually install the downloaded package from: ${packagePath}\n` +
                `   Run in admin PowerShell: Add-AppxPackage -Path "${packagePath}"`
            );
        }
        
        const command = `Add-AppxPackage -Path "${packagePath}"`;
        logger.debug(`Running PowerShell command: ${command}`);
        
        try {
            // Use CommandBuilder to execute PowerShell command safely
            const result = await CommandBuilder.executePowerShell(command, { timeout: 300000 } as CommandOptions);
            if (result.exitCode !== 0) {
                throw new Error(`PowerShell command failed: ${result.stderr}`);
            }
            logger.info(`Successfully installed APPX package for ${distributionName}`);
            
            // Wait a bit for Windows to register the package
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Verify installation by checking if distribution is now available
            await this.verifyInstallation(distributionName);
        } catch (error) {
            logger.error(`Failed to install APPX package: ${error}`);
            throw new Error(
                `Failed to install ${distributionName} from downloaded package. ` +
                `Error: ${error}. ` +
                `You can try manually installing from: ${packagePath}`
            );
        }
    }
    
    /**
     * Verify that a distribution was successfully installed
     */
    private async verifyInstallation(distributionName: string): Promise<void> {
        try {
            // Check if distribution appears in wsl --list
            const result = await CommandBuilder.executeWSL(['--list', '--quiet'], { timeout: 10000 } as CommandOptions);
            
            // Clean up WSL output (remove special characters and empty lines)
            const distributions = result.stdout
                .split('\n')
                .map(line => line.replace(/[^\x20-\x7E]/g, '').trim()) // Remove non-ASCII characters
                .filter(line => line.length > 0 && line !== '');
            
            logger.debug(`Checking for ${distributionName} in: ${distributions.join(', ')}`);
            
            const found = distributions.some(dist => {
                if (!dist || dist === '') return false;
                // Case-insensitive partial match
                return dist.toLowerCase().includes(distributionName.toLowerCase()) ||
                       distributionName.toLowerCase().includes(dist.toLowerCase());
            });
            
            if (!found) {
                throw new Error(
                    `Distribution ${distributionName} was not found in WSL after installation. ` +
                    `Available distributions: ${distributions.join(', ')}`
                );
            }
            
            logger.info(`Verified: ${distributionName} is now available in WSL`);
        } catch (error) {
            logger.error(`Failed to verify installation: ${error}`);
            throw error;
        }
    }
    
    /**
     * Download TAR file and import - NO ADMIN REQUIRED
     */
    private async downloadRootfs(
        distributionName: string,
        options: DownloadOptions = {}
    ): Promise<string> {
        const rootfsUrl = this.getRootfsUrl(distributionName);
        if (!rootfsUrl) {
            throw new Error(`No TAR source available for ${distributionName}`);
        }
        
        logger.debug(`Downloading TAR from: ${rootfsUrl}`);
        
        // Download to user directory (not temp)
        const downloadPath = path.join(this.downloadsDir, `${distributionName.toLowerCase()}.tar.gz`);
        
        // Check if already downloaded
        if (fs.existsSync(downloadPath) && fs.statSync(downloadPath).size > 0) {
            logger.info(`Using cached download: ${downloadPath}`);
        } else {
            await this.downloadWithProgress(rootfsUrl, downloadPath, options.onProgress);
        }
        
        // Generate unique instance name
        const instanceName = `${distributionName}-${Date.now()}`;
        
        // Import to user directory - NO ADMIN REQUIRED
        const installPath = path.join(this.instancesDir, instanceName);
        await fs.promises.mkdir(installPath, { recursive: true });
        
        logger.info(`Importing ${instanceName} to ${installPath}`);
        
        await CommandBuilder.executeWSL([
            '--import',
            instanceName,
            installPath,
            downloadPath,
            '--version', '2'
        ], { timeout: 300000 } as CommandOptions);
        
        // Verify installation
        await this.verifyInstallation(instanceName);
        
        // Set up default user (optional)
        await this.setupDefaultUser(instanceName);
        
        logger.info(`Successfully imported ${instanceName} from TAR file`);
        return instanceName;
    }
    
    /**
     * Get TAR file URL for distributions - NO ADMIN REQUIRED
     */
    private getRootfsUrl(distributionName: string): string | null {
        // Import TAR distributions
        const { getTarUrl } = require('./tarDistributions');
        
        // Try to get URL from our TAR distributions list
        const tarUrl = getTarUrl(distributionName);
        if (tarUrl) {
            return tarUrl;
        }
        
        // Fallback to legacy hardcoded URLs for backward compatibility
        const rootfsUrls: { [key: string]: string } = {
            'alpine': 'https://dl-cdn.alpinelinux.org/alpine/v3.19/releases/x86_64/alpine-minirootfs-3.19.0-x86_64.tar.gz',
            'ubuntu': 'https://cloud-images.ubuntu.com/wsl/jammy/current/ubuntu-jammy-wsl-amd64-wsl.rootfs.tar.gz',
            'ubuntu-22.04': 'https://cloud-images.ubuntu.com/wsl/jammy/current/ubuntu-jammy-wsl-amd64-wsl.rootfs.tar.gz',
            'debian': 'https://github.com/debuerreotype/docker-debian-artifacts/raw/dist-amd64/bookworm/rootfs.tar.xz',
            'archlinux': 'https://mirror.rackspace.com/archlinux/iso/latest/archlinux-bootstrap-x86_64.tar.gz',
        };
        
        return rootfsUrls[distributionName.toLowerCase()] || null;
    }
    
    /**
     * Setup default user for imported distribution - NO ADMIN REQUIRED
     */
    private async setupDefaultUser(distroName: string): Promise<void> {
        try {
            const setupScript = `
                # Create default user if it doesn't exist
                id -u wsluser &>/dev/null || useradd -m -s /bin/bash wsluser
                # Add to sudoers
                echo "wsluser ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers 2>/dev/null || true
                # Set as default user in wsl.conf
                echo "[user]" > /etc/wsl.conf
                echo "default=wsluser" >> /etc/wsl.conf
            `;
            
            // Run setup script inside the distribution
            await CommandBuilder.executeWSL([
                '-d', distroName,
                '-u', 'root',
                'bash', '-c', setupScript
            ], { timeout: 30000 } as CommandOptions);
            
            // Terminate to apply changes
            await CommandBuilder.executeWSL(['--terminate', distroName], { timeout: 5000 } as CommandOptions);
            
            logger.debug(`Set up default user for ${distroName}`);
        } catch (error) {
            logger.warn(`Could not setup default user for ${distroName}: ${error}`);
            // This is optional, so don't fail the import
        }
    }
    
    /**
     * Check if current process has admin privileges
     */
    private async hasAdminPrivileges(): Promise<boolean> {
        if (process.platform !== 'win32') {
            // In WSL, check if we can run Windows admin commands
            try {
                const result = await CommandBuilder.executePowerShell(
                    '([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)',
                    { timeout: 5000 } as CommandOptions
                );
                return result.stdout.trim().toLowerCase() === 'true';
            } catch {
                return false;
            }
        }
        
        try {
            // Try to run a command that requires admin privileges
            const result = await CommandBuilder.executeSystem('fsutil', ['fsinfo', 'driveType', 'C:'], { timeout: 5000 } as CommandOptions);
            return result.exitCode === 0;
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
            const stats = fs.statSync(this.downloadsDir);
            // This is a simplified check - in a real implementation,
            // you'd use a proper disk space checking library
            return Number.MAX_SAFE_INTEGER;
        } catch {
            return Number.MAX_SAFE_INTEGER;
        }
    }
    
    /**
     * Ensure all required directories exist in user space
     */
    private ensureDirectories(): void {
        const dirs = [
            this.userDistroPath,
            this.downloadsDir, 
            this.instancesDir,
            path.join(this.userDistroPath, 'exports')
        ];
        
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                logger.debug(`Created directory: ${dir}`);
            }
        });
    }
}