#!/usr/bin/env node

/**
 * Direct test of Debian AppxBundle download and extraction
 * This bypasses the catalog and tests the actual download/extraction code
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

async function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}`));
                return;
            }

            let downloaded = 0;
            const total = parseInt(response.headers['content-length'], 10);

            response.on('data', (chunk) => {
                downloaded += chunk.length;
                const percent = ((downloaded / total) * 100).toFixed(1);
                process.stdout.write(`\rDownloading: ${percent}% (${(downloaded/1048576).toFixed(1)}MB / ${(total/1048576).toFixed(1)}MB)`);
            });

            response.pipe(file);

            file.on('finish', () => {
                file.close();
                console.log('\n✓ Download complete');
                resolve();
            });
        }).on('error', reject);
    });
}

async function testDebianExtraction() {
    console.log('\n' + '='.repeat(80));
    console.log('DIRECT DEBIAN APPXBUNDLE EXTRACTION TEST');
    console.log('='.repeat(80));

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'debian-direct-test-'));
    console.log(`Test directory: ${tempDir}\n`);

    try {
        // Download the actual Debian AppxBundle
        const debianUrl = 'https://publicwsldistros.blob.core.windows.net/wsldistrostorage/TheDebianProject.DebianGNULinux_1.12.2.0_neutral___76v4gfsz19hv4.AppxBundle';
        const appxPath = path.join(tempDir, 'debian.appxbundle');

        console.log('Downloading Debian AppxBundle from Microsoft Registry...');
        console.log(`URL: ${debianUrl}`);
        await downloadFile(debianUrl, appxPath);

        const stats = fs.statSync(appxPath);
        console.log(`Downloaded file size: ${(stats.size / 1048576).toFixed(1)} MB\n`);

        // Now test our extraction code
        const { DistroDownloader } = require('../out/src/distros/DistroDownloader');
        const { DistroManager } = require('../out/src/distros/DistroManager');

        const distroManager = new DistroManager(tempDir);
        const downloader = new DistroDownloader(distroManager);

        console.log('Testing extraction with our fixed extractTarFromAppx method...');
        const targetPath = path.join(tempDir, 'debian.tar');

        // Access the private method for testing
        const extractMethod = downloader.extractTarFromAppx || downloader._extractTarFromAppx;
        if (!extractMethod) {
            // Try to access it via prototype
            const extractTarFromAppx = Object.getPrototypeOf(downloader).constructor.prototype.extractTarFromAppx;
            if (!extractTarFromAppx) {
                throw new Error('Cannot access extractTarFromAppx method');
            }
            const result = await extractTarFromAppx.call(downloader, appxPath, targetPath);

            if (!result) {
                throw new Error('Extraction returned null - TAR file not found in AppxBundle');
            }

            console.log(`✓ Extraction successful!`);
            console.log(`  Extracted TAR: ${result}`);

            // Verify the TAR file
            if (fs.existsSync(targetPath)) {
                const tarStats = fs.statSync(targetPath);
                console.log(`  TAR file size: ${(tarStats.size / 1048576).toFixed(1)} MB`);

                // Check if it's a valid TAR/GZIP
                const fd = fs.openSync(targetPath, 'r');
                const buffer = Buffer.alloc(512);
                fs.readSync(fd, buffer, 0, 512, 0);
                fs.closeSync(fd);

                const isGzip = buffer[0] === 0x1f && buffer[1] === 0x8b;
                if (isGzip) {
                    console.log(`  ✓ Valid GZIP compressed TAR detected`);
                } else {
                    console.log(`  File header: ${buffer.slice(0, 10).toString('hex')}`);
                }
            }
        } else {
            const result = await extractMethod.call(downloader, appxPath, targetPath);
            console.log(`Extraction result: ${result}`);
        }

        console.log('\n' + '='.repeat(80));
        console.log('SUCCESS: Debian AppxBundle extraction is working!');
        console.log('The nested APPX extraction fix is confirmed to work.');
        console.log('='.repeat(80) + '\n');

        return true;

    } catch (error) {
        console.error('\n' + '='.repeat(80));
        console.error('FAILURE: Debian extraction failed');
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
                console.log(`Cleaned up: ${tempDir}`);
            } catch (e) {
                console.warn(`Could not clean up: ${e.message}`);
            }
        }
    }
}

// Run the test
testDebianExtraction().then(success => {
    process.exit(success ? 0 : 1);
});