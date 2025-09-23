#!/usr/bin/env node
/**
 * Create test APPX files for testing
 * APPX files are essentially ZIP archives containing various files including TAR archives
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execSync } = require('child_process');

const fixturesDir = __dirname;

// Create a simple TAR file content (uncompressed for simplicity)
function createSimpleTar(filename, content) {
    // TAR header structure (512 bytes)
    const header = Buffer.alloc(512);

    // File name (100 bytes max)
    header.write(filename, 0, 100);

    // File mode (8 bytes) - 0644 in octal
    header.write('0000644', 100, 8);

    // UID (8 bytes)
    header.write('0000000', 108, 8);

    // GID (8 bytes)
    header.write('0000000', 116, 8);

    // File size in octal (12 bytes)
    const sizeOctal = content.length.toString(8).padStart(11, '0');
    header.write(sizeOctal, 124, 12);

    // Modification time (12 bytes)
    const mtime = Math.floor(Date.now() / 1000).toString(8).padStart(11, '0');
    header.write(mtime, 136, 12);

    // Type flag (1 byte) - '0' for regular file
    header.write('0', 156, 1);

    // Calculate checksum
    let checksum = 0;
    // Fill checksum field with spaces first
    header.fill(' ', 148, 156);

    for (let i = 0; i < 512; i++) {
        checksum += header[i];
    }

    // Write checksum in octal
    const checksumOctal = checksum.toString(8).padStart(6, '0');
    header.write(checksumOctal, 148, 6);
    header.write('\0 ', 154, 2); // null and space after checksum

    // Create file content padded to 512 byte blocks
    const contentBuffer = Buffer.from(content);
    const paddingSize = (512 - (contentBuffer.length % 512)) % 512;
    const padding = Buffer.alloc(paddingSize);

    // TAR files end with two 512-byte blocks of zeros
    const ending = Buffer.alloc(1024);

    return Buffer.concat([header, contentBuffer, padding, ending]);
}

// Create test APPX files
async function createTestAppxFiles() {
    console.log('Creating test APPX fixtures...');

    // Test 1: Valid APPX with install.tar.gz
    const testContent = 'Test WSL distribution content';
    const simpleTar = createSimpleTar('rootfs', testContent);

    // Create install.tar.gz using gzip
    const installTarGz = zlib.gzipSync(simpleTar);
    fs.writeFileSync(path.join(fixturesDir, 'install.tar.gz'), installTarGz);

    // Create APPX structure (simplified)
    const tempDir = path.join(fixturesDir, 'temp_appx');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    // Add install.tar.gz to temp directory
    fs.writeFileSync(path.join(tempDir, 'install.tar.gz'), installTarGz);

    // Add a manifest file (simplified)
    const manifest = `<?xml version="1.0" encoding="utf-8"?>
<Package xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10">
  <Identity Name="TestDistro" Version="1.0.0.0" />
</Package>`;
    fs.writeFileSync(path.join(tempDir, 'AppxManifest.xml'), manifest);

    // Create ZIP (APPX) using native tools
    try {
        // Check which tool is available
        let createZipCmd;
        if (process.platform === 'win32') {
            // Use PowerShell on Windows
            const files = fs.readdirSync(tempDir).map(f => `"${path.join(tempDir, f)}"`).join(',');
            createZipCmd = `powershell -Command "Compress-Archive -Path @(${files}) -DestinationPath '${path.join(fixturesDir, 'valid-distro.zip')}' -Force"`;
            execSync(createZipCmd);
            // Rename to .appx
            fs.renameSync(
                path.join(fixturesDir, 'valid-distro.zip'),
                path.join(fixturesDir, 'valid-distro.appx')
            );
        } else {
            // Use zip command on Linux/WSL
            createZipCmd = `cd "${tempDir}" && zip -q "${path.join(fixturesDir, 'valid-distro.appx')}" *`;
            try {
                execSync(createZipCmd);
            } catch (e) {
                // Fallback: create a simple ZIP-like structure manually
                console.log('zip command not found, creating manual ZIP structure...');
                // This is a simplified ZIP structure - may not work for all cases
                const files = fs.readdirSync(tempDir);
                const zipParts = [];

                // For each file, add to ZIP (simplified - doesn't create a real ZIP)
                // Instead, we'll just copy the tar.gz as a fake APPX for testing
                fs.copyFileSync(
                    path.join(tempDir, 'install.tar.gz'),
                    path.join(fixturesDir, 'valid-distro.appx')
                );
            }
        }
    } catch (error) {
        console.error('Error creating ZIP:', error.message);
        // Fallback: just copy the tar.gz file
        fs.copyFileSync(
            path.join(tempDir, 'install.tar.gz'),
            path.join(fixturesDir, 'valid-distro.appx')
        );
    }

    // Test 2: APPX with differently named TAR
    fs.writeFileSync(path.join(tempDir, 'distro.tar'), simpleTar);
    try {
        if (process.platform === 'win32') {
            execSync(`powershell -Command "Compress-Archive -Path '${path.join(tempDir, 'distro.tar')}','${path.join(tempDir, 'AppxManifest.xml')}' -DestinationPath '${path.join(fixturesDir, 'custom-tar.zip')}' -Force"`);
            fs.renameSync(
                path.join(fixturesDir, 'custom-tar.zip'),
                path.join(fixturesDir, 'custom-tar.appx')
            );
        } else {
            execSync(`cd "${tempDir}" && zip -q "${path.join(fixturesDir, 'custom-tar.appx')}" distro.tar AppxManifest.xml`);
        }
    } catch (error) {
        fs.copyFileSync(
            path.join(tempDir, 'distro.tar'),
            path.join(fixturesDir, 'custom-tar.appx')
        );
    }

    // Test 3: Invalid APPX (no TAR inside)
    fs.writeFileSync(path.join(tempDir, 'readme.txt'), 'This APPX has no TAR file');
    try {
        if (process.platform === 'win32') {
            execSync(`powershell -Command "Compress-Archive -Path '${path.join(tempDir, 'readme.txt')}','${path.join(tempDir, 'AppxManifest.xml')}' -DestinationPath '${path.join(fixturesDir, 'no-tar.zip')}' -Force"`);
            fs.renameSync(
                path.join(fixturesDir, 'no-tar.zip'),
                path.join(fixturesDir, 'no-tar.appx')
            );
        } else {
            execSync(`cd "${tempDir}" && zip -q "${path.join(fixturesDir, 'no-tar.appx')}" readme.txt AppxManifest.xml`);
        }
    } catch (error) {
        fs.writeFileSync(path.join(fixturesDir, 'no-tar.appx'), 'Invalid APPX content');
    }

    // Test 4: AppxBundle (contains multiple APPX files)
    // For simplicity, create it the same as a regular APPX
    if (fs.existsSync(path.join(fixturesDir, 'valid-distro.appx'))) {
        fs.copyFileSync(
            path.join(fixturesDir, 'valid-distro.appx'),
            path.join(fixturesDir, 'test-bundle.appxbundle')
        );
    }

    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });

    // Clean up temporary tar.gz
    if (fs.existsSync(path.join(fixturesDir, 'install.tar.gz'))) {
        fs.unlinkSync(path.join(fixturesDir, 'install.tar.gz'));
    }

    console.log('Test APPX fixtures created:');
    console.log('- valid-distro.appx (contains install.tar.gz)');
    console.log('- custom-tar.appx (contains distro.tar)');
    console.log('- no-tar.appx (no TAR file inside)');
    console.log('- test-bundle.appxbundle (AppxBundle format)');
}

// Run if executed directly
if (require.main === module) {
    createTestAppxFiles().catch(console.error);
}

module.exports = { createSimpleTar, createTestAppxFiles };