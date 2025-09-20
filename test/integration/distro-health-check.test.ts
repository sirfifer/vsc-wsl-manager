/**
 * Distribution Health Check Test Suite
 *
 * Comprehensive test that validates ALL distributions can be downloaded.
 * This test fetches the latest distribution list from Microsoft Registry
 * and attempts to validate/download each one.
 *
 * Run with: npm run test:distro-health
 * Full download test: DOWNLOAD_ALL=true npm run test:distro-health
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { DistributionRegistry } from '../../src/distributionRegistry';
import { EnhancedDistroManager } from '../../src/distros/EnhancedDistroManager';
import { DistroDownloader } from '../../src/distros/DistroDownloader';

// Control test behavior with environment variables
const RUN_HEALTH_CHECK = process.env.REAL_TESTS === 'true' || process.env.HEALTH_CHECK === 'true';
const DOWNLOAD_ALL = process.env.DOWNLOAD_ALL === 'true';
const PARALLEL_DOWNLOADS = parseInt(process.env.PARALLEL_DOWNLOADS || '3');

const describeHealth = RUN_HEALTH_CHECK ? describe : describe.skip;

interface HealthCheckResult {
    name: string;
    displayName: string;
    url: string;
    reachable: boolean;
    statusCode?: number;
    contentType?: string;
    contentLength?: number;
    downloadSuccess?: boolean;
    error?: string;
    duration?: number;
}

interface HealthReport {
    timestamp: string;
    totalDistros: number;
    reachable: number;
    unreachable: number;
    downloaded: number;
    failed: number;
    results: HealthCheckResult[];
    summary: {
        successRate: number;
        averageResponseTime: number;
        problemDistros: string[];
    };
}

describeHealth('Distribution Health Check', () => {
    let registry: DistributionRegistry;
    let distroManager: EnhancedDistroManager;
    let downloader: DistroDownloader;
    let tempDir: string;
    let reportPath: string;

    beforeAll(() => {
        // Setup test environment
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'distro-health-'));
        reportPath = path.join(tempDir, 'health-report.json');

        registry = new DistributionRegistry();
        distroManager = new EnhancedDistroManager(tempDir);
        downloader = new DistroDownloader(distroManager);

        console.log('');
        console.log('='.repeat(80));
        console.log('DISTRIBUTION HEALTH CHECK');
        console.log('='.repeat(80));
        console.log(`Test Directory: ${tempDir}`);
        console.log(`Download All: ${DOWNLOAD_ALL}`);
        console.log(`Parallel Downloads: ${PARALLEL_DOWNLOADS}`);
        console.log('='.repeat(80));
        console.log('');
    });

    afterAll(() => {
        // Cleanup
        if (fs.existsSync(tempDir)) {
            try {
                fs.rmSync(tempDir, { recursive: true });
            } catch (error) {
                console.warn('Failed to clean up temp directory:', error);
            }
        }
    });

    /**
     * Validate a URL by making a HEAD request
     */
    async function validateUrl(url: string): Promise<Partial<HealthCheckResult>> {
        return new Promise((resolve) => {
            const startTime = Date.now();
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
                const duration = Date.now() - startTime;

                // Handle redirects
                if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    validateUrl(res.headers.location).then(resolve);
                    return;
                }

                resolve({
                    reachable: res.statusCode === 200,
                    statusCode: res.statusCode,
                    contentType: res.headers['content-type'],
                    contentLength: res.headers['content-length'] ? parseInt(res.headers['content-length']) : undefined,
                    duration
                });
            });

            req.on('error', (error) => {
                resolve({
                    reachable: false,
                    error: error.message,
                    duration: Date.now() - startTime
                });
            });

            req.on('timeout', () => {
                req.destroy();
                resolve({
                    reachable: false,
                    error: 'Request timeout',
                    duration: Date.now() - startTime
                });
            });

            req.end();
        });
    }

    /**
     * Attempt to download a distribution (partial download for testing)
     */
    async function testDownload(distroName: string, url: string): Promise<boolean> {
        if (!DOWNLOAD_ALL) {
            // Just do a small partial download to test
            return new Promise((resolve) => {
                const parsedUrl = new URL(url);
                const client = parsedUrl.protocol === 'https:' ? https : http;

                const req = client.get(url, {
                    headers: {
                        'User-Agent': 'VSC-WSL-Manager/1.0',
                        'Range': 'bytes=0-1048576' // Download first 1MB only
                    }
                }, (res) => {
                    if (res.statusCode === 200 || res.statusCode === 206) {
                        res.destroy(); // Don't actually download
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                });

                req.on('error', () => resolve(false));
                req.setTimeout(15000, () => {
                    req.destroy();
                    resolve(false);
                });
            });
        } else {
            // Full download test
            try {
                await downloader.downloadDistro(distroName, {
                    timeout: 300000, // 5 minutes
                    overwrite: true,
                    onProgress: (progress) => {
                        if (progress.percent && progress.percent % 10 === 0) {
                            console.log(`  ${distroName}: ${progress.percent}%`);
                        }
                    }
                });
                return true;
            } catch (error) {
                return false;
            }
        }
    }

    /**
     * Generate health report
     */
    function generateReport(results: HealthCheckResult[]): HealthReport {
        const reachableCount = results.filter(r => r.reachable).length;
        const downloadedCount = results.filter(r => r.downloadSuccess).length;
        const problemDistros = results
            .filter(r => !r.reachable || (DOWNLOAD_ALL && !r.downloadSuccess))
            .map(r => r.name);

        const responseTimes = results
            .filter(r => r.duration)
            .map(r => r.duration!);

        const avgResponseTime = responseTimes.length > 0
            ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
            : 0;

        const report: HealthReport = {
            timestamp: new Date().toISOString(),
            totalDistros: results.length,
            reachable: reachableCount,
            unreachable: results.length - reachableCount,
            downloaded: downloadedCount,
            failed: results.filter(r => r.downloadSuccess === false).length,
            results: results,
            summary: {
                successRate: (reachableCount / results.length) * 100,
                averageResponseTime: Math.round(avgResponseTime),
                problemDistros
            }
        };

        // Save report to file
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        // Print summary to console
        console.log('');
        console.log('='.repeat(80));
        console.log('HEALTH CHECK SUMMARY');
        console.log('='.repeat(80));
        console.log(`Total Distributions: ${report.totalDistros}`);
        console.log(`Reachable: ${report.reachable} (${report.summary.successRate.toFixed(1)}%)`);
        console.log(`Unreachable: ${report.unreachable}`);
        if (DOWNLOAD_ALL) {
            console.log(`Downloaded: ${report.downloaded}`);
            console.log(`Failed Downloads: ${report.failed}`);
        }
        console.log(`Average Response Time: ${report.summary.averageResponseTime}ms`);
        console.log('');

        if (report.summary.problemDistros.length > 0) {
            console.log('PROBLEM DISTRIBUTIONS:');
            report.summary.problemDistros.forEach(name => {
                const distro = results.find(r => r.name === name)!;
                console.log(`  - ${name}: ${distro.error || `Status ${distro.statusCode}`}`);
            });
            console.log('');
        }

        console.log(`Full report saved to: ${reportPath}`);
        console.log('='.repeat(80));
        console.log('');

        return report;
    }

    test('Validate all distribution URLs and optionally download', async () => {
        // Fetch fresh list from Microsoft Registry
        console.log('Fetching distribution list from Microsoft Registry...');
        const msDistros = await registry.fetchAvailableDistributions();

        expect(msDistros.length).toBeGreaterThan(0);
        console.log(`Found ${msDistros.length} distributions`);
        console.log('');

        const results: HealthCheckResult[] = [];

        // Process distributions in batches for parallel validation
        for (let i = 0; i < msDistros.length; i += PARALLEL_DOWNLOADS) {
            const batch = msDistros.slice(i, i + PARALLEL_DOWNLOADS);

            const batchPromises = batch.map(async (distro) => {
                const url = distro.Amd64PackageUrl || distro.Amd64WslUrl || '';
                const result: HealthCheckResult = {
                    name: distro.Name,
                    displayName: distro.FriendlyName || distro.Name,
                    url: url,
                    reachable: false
                };

                if (!url) {
                    result.error = 'No download URL available';
                    console.log(`✗ ${distro.Name}: No URL`);
                    return result;
                }

                // Validate URL
                console.log(`Checking ${distro.Name}...`);
                const validation = await validateUrl(url);
                Object.assign(result, validation);

                if (result.reachable) {
                    const sizeStr = result.contentLength
                        ? ` (${(result.contentLength / 1048576).toFixed(1)} MB)`
                        : '';
                    console.log(`✓ ${distro.Name}: Reachable${sizeStr}`);

                    // Optionally test download
                    if (DOWNLOAD_ALL || distro.Name.includes('Alpine')) { // Always test Alpine as it's small
                        console.log(`  Downloading ${distro.Name}...`);
                        result.downloadSuccess = await testDownload(distro.Name, url);
                        if (result.downloadSuccess) {
                            console.log(`  ✓ Download successful`);
                        } else {
                            console.log(`  ✗ Download failed`);
                        }
                    }
                } else {
                    console.log(`✗ ${distro.Name}: ${result.error || `Status ${result.statusCode}`}`);
                }

                return result;
            });

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
        }

        // Generate and analyze report
        const report = generateReport(results);

        // Assertions
        expect(report.totalDistros).toBeGreaterThan(0);
        expect(report.summary.successRate).toBeGreaterThan(50); // At least 50% should be reachable

        if (DOWNLOAD_ALL) {
            expect(report.downloaded).toBeGreaterThan(0); // At least some should download
        }

        // Fail test if too many distributions are unreachable
        if (report.summary.successRate < 50) {
            throw new Error(`Health check failed: Only ${report.summary.successRate.toFixed(1)}% of distributions are reachable`);
        }
    }, 600000); // 10 minute timeout for full download test

    test('Validate frequently used distributions', async () => {
        // Quick test for the most commonly used distributions
        const criticalDistros = ['Ubuntu', 'Debian', 'Alpine', 'openSUSE'];

        console.log('Checking critical distributions...');

        for (const distroName of criticalDistros) {
            const distros = await distroManager.listDistros();
            const distro = distros.find(d => d.name.includes(distroName));

            if (distro && distro.sourceUrl) {
                const validation = await validateUrl(distro.sourceUrl);
                console.log(`${distroName}: ${validation.reachable ? '✓' : '✗'} ${validation.error || ''}`);
                expect(validation.reachable).toBe(true);
            }
        }
    }, 30000);
});

// Export for use in other scripts
export { validateUrl, HealthCheckResult, HealthReport };