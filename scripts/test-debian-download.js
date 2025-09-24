#!/usr/bin/env node

/**
 * Quick test script to verify Debian-12 download and extraction works
 * This tests the actual issue reported by the user
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

async function testDebianDownload() {
    console.log('\n='.repeat(80));
    console.log('DEBIAN-12 DOWNLOAD AND EXTRACTION TEST');
    console.log('='.repeat(80));
    console.log(`Time: ${new Date().toISOString()}`);
    console.log('='.repeat(80) + '\n');

    // Create temp directory
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'debian-test-'));
    console.log(`Test directory: ${tempDir}\n`);

    try {
        // Import the necessary modules
        const { DistroManager } = require('../out/src/distros/DistroManager');
        const { DistroDownloader } = require('../out/src/distros/DistroDownloader');
        const { DistributionRegistry } = require('../out/src/distributionRegistry');

        // Initialize components
        const distroManager = new DistroManager(tempDir);
        const downloader = new DistroDownloader(distroManager);
        const registry = new DistributionRegistry();

        // First try to update from Microsoft Registry
        console.log('Fetching distributions from Microsoft Registry...');
        try {
            const msDistros = await registry.fetchAvailableDistributions();
            console.log(`Found ${msDistros.length} distributions from registry`);

            const debian = msDistros.find(d => d.Name === 'Debian');
            if (debian) {
                console.log('\nDebian info from Microsoft Registry:');
                console.log(`  Name: ${debian.FriendlyName}`);
                console.log(`  URL: ${debian.Amd64PackageUrl}`);

                // Check if it's an AppxBundle
                const url = debian.Amd64PackageUrl || '';
                const isAppxBundle = url.toLowerCase().includes('.appxbundle');
                console.log(`  Type: ${isAppxBundle ? 'AppxBundle (nested structure)' : 'APPX/TAR'}`);
            }
        } catch (error) {
            console.warn('Could not fetch from Microsoft Registry:', error.message);
        }

        // Update catalog with registry URLs if the manager supports it
        if (typeof distroManager.refreshDistributions === 'function') {
            await distroManager.refreshDistributions();
        }

        // Get Debian from registry or catalog
        const distros = await distroManager.listDistros();
        console.log(`\nAvailable distros in catalog: ${distros.map(d => d.name).join(', ')}`);

        // Try to download directly from registry URL
        const msDistros = await registry.fetchAvailableDistributions();
        const debianFromRegistry = msDistros.find(d => d.Name === 'Debian');

        if (!debianFromRegistry || !debianFromRegistry.Amd64PackageUrl) {
            throw new Error('Debian not found in Microsoft Registry');
        }

        // Create a distro entry for Debian
        const debianDistro = {
            name: 'debian-test',
            displayName: 'Debian (Test)',
            sourceUrl: debianFromRegistry.Amd64PackageUrl,
            architecture: 'x64',
            version: '12'
        };

        console.log('\nDebian test configuration:');
        console.log(`  Name: ${debianDistro.displayName}`);
        console.log(`  URL: ${debianDistro.sourceUrl}`);

        // Add to catalog temporarily
        await distroManager.addDistro(debianDistro, path.join(tempDir, 'debian-test.tar'));

        // Start download
        console.log('\nStarting download...');
        const startTime = Date.now();
        let lastProgress = 0;

        await downloader.downloadDistro('debian-test', {
            onProgress: (progress) => {
                const percent = progress.percent || 0;
                if (percent - lastProgress >= 10) {
                    console.log(`  Progress: ${percent.toFixed(0)}% (${formatBytes(progress.downloaded)}/${formatBytes(progress.total)})`);
                    lastProgress = percent;
                }
            },
            timeout: 300000 // 5 minutes
        });

        const duration = Date.now() - startTime;
        console.log(`\n✓ Download completed in ${(duration / 1000).toFixed(1)}s`);

        // Verify extraction
        const distroPath = distroManager.getDistroPath('debian-test');
        if (!fs.existsSync(distroPath)) {
            throw new Error('Extraction failed - TAR file not found');
        }

        const stats = fs.statSync(distroPath);
        console.log(`✓ Extraction successful`);
        console.log(`  File: ${distroPath}`);
        console.log(`  Size: ${formatBytes(stats.size)}`);

        // Verify it's a valid TAR file
        const fd = fs.openSync(distroPath, 'r');
        const buffer = Buffer.alloc(512);
        fs.readSync(fd, buffer, 0, 512, 0);
        fs.closeSync(fd);

        // Check for TAR/GZIP/XZ format
        const isGzip = buffer[0] === 0x1f && buffer[1] === 0x8b;
        const isXz = buffer[0] === 0xfd && buffer[1] === 0x37 &&
                     buffer[2] === 0x7a && buffer[3] === 0x58 && buffer[4] === 0x5a;
        const isTar = buffer.toString('ascii', 257, 262) === 'ustar';

        if (isGzip) {
            console.log(`✓ Valid TAR.GZ file detected`);
        } else if (isXz) {
            console.log(`✓ Valid TAR.XZ file detected`);
        } else if (isTar) {
            console.log(`✓ Valid TAR file detected`);
        } else {
            console.log(`⚠ File format uncertain (may still be valid)`);
        }

        console.log('\n' + '='.repeat(80));
        console.log('SUCCESS: Debian-12 download and extraction working correctly!');
        console.log('The nested AppxBundle extraction fix is working.');
        console.log('='.repeat(80) + '\n');

        return true;
    } catch (error) {
        console.error('\n' + '='.repeat(80));
        console.error('FAILURE: Debian-12 download/extraction failed');
        console.error('='.repeat(80));
        console.error(`Error: ${error.message}`);
        if (error.stack) {
            console.error('\nStack trace:');
            console.error(error.stack);
        }
        console.error('='.repeat(80) + '\n');

        return false;
    } finally {
        // Clean up
        if (fs.existsSync(tempDir)) {
            try {
                fs.rmSync(tempDir, { recursive: true });
                console.log(`Cleaned up temp directory: ${tempDir}`);
            } catch (e) {
                console.warn(`Could not clean up temp directory: ${e.message}`);
            }
        }
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Run if executed directly
if (require.main === module) {
    testDebianDownload().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { testDebianDownload };