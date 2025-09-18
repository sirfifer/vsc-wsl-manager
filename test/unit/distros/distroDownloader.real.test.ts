/**
 * REAL Unit tests for DistroDownloader
 * Tests actual HTTPS downloads, progress tracking, and checksum verification
 * NO MOCKS - Uses real network calls and real file downloads
 *
 * @author Marcus Johnson, QA Manager
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import * as https from 'https';
import { DistroDownloader, DownloadProgress, DownloadOptions } from '../../../src/distros/DistroDownloader';
import { DistroManager } from '../../../src/distros/DistroManager';

describe('DistroDownloader - Real Network Tests', () => {
    let tempDir: string;
    let distroManager: DistroManager;
    let downloader: DistroDownloader;

    beforeEach(() => {
        // Create real temporary directory
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'download-test-'));
        distroManager = new DistroManager(tempDir);
        downloader = new DistroDownloader(distroManager);
    });

    afterEach(() => {
        // Clean up downloads and temp files
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe('Real HTTPS Downloads', () => {
        it('should download a small test file from the internet', async () => {
            // Use a small, reliable test file (1KB from httpbin.org)
            const testUrl = 'https://httpbin.org/bytes/1024';
            const destPath = path.join(tempDir, 'test-download.bin');

            await downloader.downloadFile(testUrl, destPath);

            // Verify file was downloaded
            expect(fs.existsSync(destPath)).toBe(true);

            // Verify file size
            const stats = fs.statSync(destPath);
            expect(stats.size).toBe(1024);
        }, 30000); // 30 second timeout for network operations

        it('should download with progress tracking', async () => {
            // Download a slightly larger file to see progress
            const testUrl = 'https://httpbin.org/bytes/10240'; // 10KB
            const destPath = path.join(tempDir, 'progress-test.bin');

            const progressUpdates: DownloadProgress[] = [];

            await downloader.downloadFile(testUrl, destPath, {
                onProgress: (progress) => {
                    progressUpdates.push({ ...progress });
                }
            });

            // Should have received progress updates
            expect(progressUpdates.length).toBeGreaterThan(0);

            // Final progress should be 100%
            const lastProgress = progressUpdates[progressUpdates.length - 1];
            expect(lastProgress.percent).toBe(100);
            expect(lastProgress.downloaded).toBe(10240);
        }, 30000);

        it('should verify SHA256 checksum of downloaded file', async () => {
            // Download a file with known content
            const testUrl = 'https://httpbin.org/base64/SGVsbG8gV29ybGQh'; // "Hello World!" base64
            const destPath = path.join(tempDir, 'checksum-test.txt');

            await downloader.downloadFile(testUrl, destPath);

            // Calculate actual checksum
            const fileContent = fs.readFileSync(destPath);
            const actualChecksum = crypto.createHash('sha256')
                .update(fileContent)
                .digest('hex');

            // Verify against expected checksum of "Hello World!"
            const expectedContent = 'Hello World!';
            const expectedChecksum = crypto.createHash('sha256')
                .update(expectedContent)
                .digest('hex');

            expect(actualChecksum).toBe(expectedChecksum);
        }, 30000);

        it('should handle download interruption and resume', async () => {
            // Start a download and interrupt it
            const testUrl = 'https://httpbin.org/bytes/5120'; // 5KB
            const destPath = path.join(tempDir, 'resume-test.bin');

            // Start download with abort capability
            const controller = new AbortController();

            const downloadPromise = downloader.downloadFile(testUrl, destPath, {
                signal: controller.signal
            }).catch(() => {
                // Expected to fail due to abort
            });

            // Abort after a short delay
            setTimeout(() => controller.abort(), 100);

            await downloadPromise;

            // Partial file may exist
            if (fs.existsSync(destPath)) {
                const partialSize = fs.statSync(destPath).size;
                expect(partialSize).toBeLessThan(5120);
            }

            // Resume download
            await downloader.resumeDownload(testUrl, destPath);

            // Verify complete file
            expect(fs.existsSync(destPath)).toBe(true);
            const finalSize = fs.statSync(destPath).size;
            expect(finalSize).toBe(5120);
        }, 30000);

        it('should handle HTTPS redirects', async () => {
            // httpbin.org redirect endpoint
            const redirectUrl = 'https://httpbin.org/redirect-to?url=https://httpbin.org/bytes/512';
            const destPath = path.join(tempDir, 'redirect-test.bin');

            await downloader.downloadFile(redirectUrl, destPath, {
                followRedirects: true
            });

            expect(fs.existsSync(destPath)).toBe(true);
            expect(fs.statSync(destPath).size).toBe(512);
        }, 30000);

        it('should timeout on slow downloads', async () => {
            // Use httpbin's delay endpoint
            const slowUrl = 'https://httpbin.org/delay/10'; // 10 second delay
            const destPath = path.join(tempDir, 'timeout-test.json');

            await expect(
                downloader.downloadFile(slowUrl, destPath, {
                    timeout: 2000 // 2 second timeout
                })
            ).rejects.toThrow(/timeout/i);

            // File should not exist or be incomplete
            if (fs.existsSync(destPath)) {
                fs.unlinkSync(destPath);
            }
        }, 10000);
    });

    describe('Real Distribution Downloads', () => {
        it('should download a real Alpine Linux mini root filesystem', async function() {
            // Skip in CI to avoid large downloads
            if (process.env.CI) {
                this.skip();
                return;
            }

            // Download Alpine mini root (about 3MB)
            const alpineUrl = 'https://dl-cdn.alpinelinux.org/alpine/v3.18/releases/x86_64/alpine-minirootfs-3.18.0-x86_64.tar.gz';
            const destPath = path.join(tempDir, 'alpine.tar.gz');

            const progressUpdates: DownloadProgress[] = [];

            await downloader.downloadFile(alpineUrl, destPath, {
                onProgress: (progress) => {
                    progressUpdates.push({ ...progress });

                    // Log every 10% progress
                    if (progress.percent % 10 === 0) {
                        console.log(`Download progress: ${progress.percent}% (${progress.downloaded}/${progress.total} bytes)`);
                    }
                }
            });

            // Verify download completed
            expect(fs.existsSync(destPath)).toBe(true);

            const stats = fs.statSync(destPath);
            expect(stats.size).toBeGreaterThan(2 * 1024 * 1024); // > 2MB
            expect(stats.size).toBeLessThan(5 * 1024 * 1024); // < 5MB

            // Verify it's a valid tar.gz file (starts with gzip magic numbers)
            const fd = fs.openSync(destPath, 'r');
            const buffer = Buffer.alloc(2);
            fs.readSync(fd, buffer, 0, 2, 0);
            fs.closeSync(fd);

            // Gzip magic numbers: 0x1f 0x8b
            expect(buffer[0]).toBe(0x1f);
            expect(buffer[1]).toBe(0x8b);

            // Clean up large file
            fs.unlinkSync(destPath);
        }, 60000); // 60 second timeout for real download
    });

    describe('Parallel Downloads', () => {
        it('should handle multiple simultaneous downloads', async () => {
            const downloads = [
                { url: 'https://httpbin.org/bytes/1024', dest: 'file1.bin', size: 1024 },
                { url: 'https://httpbin.org/bytes/2048', dest: 'file2.bin', size: 2048 },
                { url: 'https://httpbin.org/bytes/512', dest: 'file3.bin', size: 512 }
            ];

            // Start all downloads in parallel
            const promises = downloads.map(d =>
                downloader.downloadFile(
                    d.url,
                    path.join(tempDir, d.dest)
                )
            );

            // Wait for all to complete
            await Promise.all(promises);

            // Verify all files downloaded correctly
            downloads.forEach(d => {
                const filePath = path.join(tempDir, d.dest);
                expect(fs.existsSync(filePath)).toBe(true);
                expect(fs.statSync(filePath).size).toBe(d.size);
            });
        }, 30000);

        it('should cancel specific downloads without affecting others', async () => {
            const controller1 = new AbortController();
            const controller2 = new AbortController();

            // Start two downloads
            const download1 = downloader.downloadFile(
                'https://httpbin.org/bytes/2048',
                path.join(tempDir, 'keep.bin'),
                { signal: controller1.signal }
            );

            const download2 = downloader.downloadFile(
                'https://httpbin.org/delay/5', // Slow download to cancel
                path.join(tempDir, 'cancel.bin'),
                { signal: controller2.signal }
            ).catch(() => {
                // Expected to fail
            });

            // Cancel second download
            setTimeout(() => controller2.abort(), 500);

            // Wait for both
            await download1;
            await download2;

            // First should complete, second should not
            expect(fs.existsSync(path.join(tempDir, 'keep.bin'))).toBe(true);
            expect(fs.statSync(path.join(tempDir, 'keep.bin')).size).toBe(2048);
        }, 30000);
    });

    describe('Error Handling', () => {
        it('should handle 404 errors gracefully', async () => {
            const notFoundUrl = 'https://httpbin.org/status/404';
            const destPath = path.join(tempDir, '404-test.bin');

            await expect(
                downloader.downloadFile(notFoundUrl, destPath)
            ).rejects.toThrow(/404/);

            expect(fs.existsSync(destPath)).toBe(false);
        });

        it('should handle DNS resolution failures', async () => {
            const invalidUrl = 'https://this-domain-definitely-does-not-exist-12345.com/file.tar';
            const destPath = path.join(tempDir, 'dns-fail.tar');

            await expect(
                downloader.downloadFile(invalidUrl, destPath)
            ).rejects.toThrow();
        });

        it('should handle invalid URLs', async () => {
            const invalidUrl = 'not-a-valid-url';
            const destPath = path.join(tempDir, 'invalid.tar');

            await expect(
                downloader.downloadFile(invalidUrl, destPath)
            ).rejects.toThrow();
        });

        it('should handle disk full scenarios', async () => {
            // This is hard to test reliably, so we'll test write permission denied instead
            const restrictedPath = '/invalid/path/that/cannot/exist/file.tar';

            await expect(
                downloader.downloadFile('https://httpbin.org/bytes/100', restrictedPath)
            ).rejects.toThrow();
        });
    });

    describe('Checksum Verification', () => {
        it('should calculate SHA256 during download', async () => {
            const testUrl = 'https://httpbin.org/bytes/1024';
            const destPath = path.join(tempDir, 'sha256-test.bin');

            const checksum = await downloader.downloadWithChecksum(testUrl, destPath);

            expect(checksum).toBeDefined();
            expect(checksum).toHaveLength(64); // SHA256 hex string length

            // Verify checksum matches file content
            const fileContent = fs.readFileSync(destPath);
            const expectedChecksum = crypto.createHash('sha256')
                .update(fileContent)
                .digest('hex');

            expect(checksum).toBe(expectedChecksum);
        }, 30000);

        it('should reject downloads with incorrect checksum', async () => {
            const testUrl = 'https://httpbin.org/bytes/512';
            const destPath = path.join(tempDir, 'checksum-fail.bin');
            const wrongChecksum = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

            await expect(
                downloader.downloadFile(testUrl, destPath, {
                    verifyChecksum: true,
                    expectedChecksum: wrongChecksum
                })
            ).rejects.toThrow(/checksum/i);

            // File should be deleted on checksum failure
            expect(fs.existsSync(destPath)).toBe(false);
        }, 30000);
    });

    describe('Download Caching', () => {
        it('should skip download if file exists with correct checksum', async () => {
            const testUrl = 'https://httpbin.org/bytes/256';
            const destPath = path.join(tempDir, 'cached.bin');

            // First download
            const checksum1 = await downloader.downloadWithChecksum(testUrl, destPath);
            const mtime1 = fs.statSync(destPath).mtime;

            // Wait a bit
            await new Promise(resolve => setTimeout(resolve, 100));

            // Second download with same checksum should skip
            const checksum2 = await downloader.downloadWithChecksum(testUrl, destPath, {
                expectedChecksum: checksum1,
                skipIfExists: true
            });

            const mtime2 = fs.statSync(destPath).mtime;

            // File should not have been re-downloaded
            expect(mtime2.getTime()).toBe(mtime1.getTime());
            expect(checksum2).toBe(checksum1);
        }, 30000);
    });
});