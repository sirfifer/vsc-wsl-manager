/**
 * Comprehensive Distribution Download and Extraction Test
 *
 * This test downloads ALL distributions from the catalog and verifies:
 * 1. Download completes successfully
 * 2. TAR extraction from APPX/AppxBundle works
 * 3. The extracted file is a valid TAR archive
 *
 * Run with: DOWNLOAD_ALL_DISTROS=true npm test -- all-distros-download
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DistroManager } from '../../src/distros/DistroManager';
import { DistroDownloader } from '../../src/distros/DistroDownloader';
import { DistributionRegistry } from '../../src/distributionRegistry';
import { Logger } from '../../src/utils/logger';

// Only run when explicitly requested - this is a heavy test
const RUN_ALL_DISTROS_TEST = process.env.DOWNLOAD_ALL_DISTROS === 'true';
const describeAll = RUN_ALL_DISTROS_TEST ? describe : describe.skip;

const logger = Logger.getInstance();

interface DistroTestResult {
    name: string;
    displayName: string;
    sourceUrl: string;
    downloadSuccess: boolean;
    extractionSuccess: boolean;
    isValidTar: boolean;
    fileSize?: number;
    error?: string;
    duration: number;
}

/**
 * Check if a file is a valid TAR or TAR.GZ
 */
function isValidTarFile(filePath: string): boolean {
    if (!fs.existsSync(filePath)) return false;

    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(512);
    fs.readSync(fd, buffer, 0, 512, 0);
    fs.closeSync(fd);

    // Check for gzip magic numbers (1f 8b)
    const isGzip = buffer[0] === 0x1f && buffer[1] === 0x8b;

    // Check for TAR format (ustar signature at offset 257)
    const ustarSig = buffer.toString('ascii', 257, 262);
    const isTar = ustarSig === 'ustar' || buffer.toString('ascii', 0, 100).match(/^[\x00-\x7F]*$/);

    // Check for XZ format (FD 37 7A 58 5A)
    const isXz = buffer[0] === 0xfd && buffer[1] === 0x37 &&
                 buffer[2] === 0x7a && buffer[3] === 0x58 && buffer[4] === 0x5a;

    return isGzip || isTar || isXz;
}

describeAll('All Distributions Download and Extraction Test', () => {
    let tempDir: string;
    let distroManager: DistroManager;
    let downloader: DistroDownloader;
    let registry: DistributionRegistry;
    const testResults: DistroTestResult[] = [];

    beforeAll(async () => {
        // Create temp directory for test
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'all-distros-test-'));
        console.log(`\n${'='.repeat(80)}`);
        console.log('ALL DISTRIBUTIONS DOWNLOAD AND EXTRACTION TEST');
        console.log(`${'='.repeat(80)}`);
        console.log(`Test directory: ${tempDir}`);
        console.log(`Starting at: ${new Date().toISOString()}`);
        console.log(`${'='.repeat(80)}\n`);

        // Initialize components
        distroManager = new DistroManager(tempDir);
        downloader = new DistroDownloader(distroManager);
        registry = new DistributionRegistry();
    });

    afterAll(() => {
        // Generate report
        console.log(`\n${'='.repeat(80)}`);
        console.log('TEST RESULTS SUMMARY');
        console.log(`${'='.repeat(80)}`);

        const successful = testResults.filter(r => r.downloadSuccess && r.extractionSuccess && r.isValidTar);
        const failed = testResults.filter(r => !r.downloadSuccess || !r.extractionSuccess || !r.isValidTar);

        console.log(`Total Distributions Tested: ${testResults.length}`);
        console.log(`Successful: ${successful.length}`);
        console.log(`Failed: ${failed.length}`);
        console.log(`Success Rate: ${((successful.length / testResults.length) * 100).toFixed(1)}%`);

        if (failed.length > 0) {
            console.log('\nFAILED DISTRIBUTIONS:');
            for (const result of failed) {
                console.log(`  - ${result.name}:`);
                if (!result.downloadSuccess) console.log(`    Download failed: ${result.error}`);
                if (!result.extractionSuccess) console.log(`    Extraction failed`);
                if (!result.isValidTar) console.log(`    Invalid TAR file`);
            }
        }

        console.log('\nDETAILED RESULTS:');
        const table = testResults.map(r => ({
            Name: r.name,
            Download: r.downloadSuccess ? '✓' : '✗',
            Extraction: r.extractionSuccess ? '✓' : '✗',
            'Valid TAR': r.isValidTar ? '✓' : '✗',
            Size: r.fileSize ? `${(r.fileSize / 1048576).toFixed(1)} MB` : 'N/A',
            Duration: `${(r.duration / 1000).toFixed(1)}s`
        }));
        console.table(table);

        // Save detailed report
        const reportPath = path.join(tempDir, 'test-report.json');
        fs.writeFileSync(reportPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            results: testResults,
            summary: {
                total: testResults.length,
                successful: successful.length,
                failed: failed.length,
                successRate: (successful.length / testResults.length) * 100
            }
        }, null, 2));
        console.log(`\nDetailed report saved to: ${reportPath}`);
        console.log(`${'='.repeat(80)}\n`);

        // Clean up temp directory
        if (fs.existsSync(tempDir)) {
            try {
                fs.rmSync(tempDir, { recursive: true });
                console.log('Cleaned up temp directory');
            } catch (error) {
                console.warn('Failed to clean up temp directory:', error);
            }
        }
    });

    test('Download and extract all distributions from catalog', async () => {
        // Set a long timeout for this comprehensive test
        jest.setTimeout(1800000); // 30 minutes

        // Get all distributions from catalog
        const distros = await distroManager.listDistros();
        console.log(`Found ${distros.length} distributions in catalog\n`);

        // Also fetch from Microsoft Registry if available
        try {
            const msDistros = await registry.fetchAvailableDistributions();
            console.log(`Found ${msDistros.length} distributions from Microsoft Registry\n`);

            // Update catalog with Registry URLs if available
            await distroManager.refreshDistributions();
        } catch (error) {
            console.warn('Could not fetch from Microsoft Registry:', error);
        }

        // Test each distribution
        for (const distro of distros) {
            const startTime = Date.now();
            const result: DistroTestResult = {
                name: distro.name,
                displayName: distro.displayName,
                sourceUrl: distro.sourceUrl || '',
                downloadSuccess: false,
                extractionSuccess: false,
                isValidTar: false,
                duration: 0
            };

            console.log(`\nTesting: ${distro.displayName} (${distro.name})`);
            console.log(`  URL: ${distro.sourceUrl}`);

            try {
                // Download the distribution
                console.log('  Downloading...');
                await downloader.downloadDistro(distro.name, {
                    onProgress: (progress) => {
                        if (progress.percent && progress.percent % 25 === 0) {
                            console.log(`    ${progress.percent}%`);
                        }
                    },
                    timeout: 300000 // 5 minutes per distro
                });
                result.downloadSuccess = true;
                console.log('  ✓ Download successful');

                // Check if file exists and was extracted
                const distroPath = distroManager.getDistroPath(distro.name);
                if (fs.existsSync(distroPath)) {
                    result.extractionSuccess = true;
                    const stats = fs.statSync(distroPath);
                    result.fileSize = stats.size;
                    console.log(`  ✓ Extraction successful (${(stats.size / 1048576).toFixed(1)} MB)`);

                    // Verify it's a valid TAR file
                    result.isValidTar = isValidTarFile(distroPath);
                    if (result.isValidTar) {
                        console.log('  ✓ Valid TAR file');
                    } else {
                        console.log('  ✗ Invalid TAR file');
                    }
                } else {
                    console.log('  ✗ Extraction failed - file not found');
                }
            } catch (error: any) {
                result.error = error.message;
                console.log(`  ✗ Error: ${error.message}`);
            }

            result.duration = Date.now() - startTime;
            console.log(`  Duration: ${(result.duration / 1000).toFixed(1)}s`);
            testResults.push(result);
        }

        // Assertions
        const successCount = testResults.filter(r =>
            r.downloadSuccess && r.extractionSuccess && r.isValidTar
        ).length;

        // We expect at least 50% success rate
        const successRate = (successCount / testResults.length) * 100;
        expect(successRate).toBeGreaterThan(50);

        // Critical distributions must work
        const criticalDistros = ['alpine-3.19', 'debian-12', 'ubuntu-24.04'];
        for (const critical of criticalDistros) {
            const result = testResults.find(r => r.name === critical);
            if (result) {
                expect(result.downloadSuccess).toBe(true);
                expect(result.extractionSuccess).toBe(true);
                expect(result.isValidTar).toBe(true);
            }
        }
    });
});

// Export for reporting
export { DistroTestResult, isValidTarFile };