#!/usr/bin/env node

/**
 * Creates realistic nested AppxBundle test fixtures
 * Mimics the structure of real Microsoft Store AppxBundle files
 * like Debian which contain multiple APPX files for different architectures
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Create a test TAR.GZ file
function createTestTarGz() {
    // TAR header for a simple file
    const tarHeader = Buffer.alloc(512);
    const fileName = 'rootfs';
    const fileContent = 'Test WSL distribution content';

    // Write filename
    tarHeader.write(fileName, 0, 100, 'utf8');
    // File mode (0644)
    tarHeader.write('0000644', 100, 8, 'utf8');
    // Owner ID
    tarHeader.write('0000000', 108, 8, 'utf8');
    // Group ID
    tarHeader.write('0000000', 116, 8, 'utf8');
    // File size in octal
    const sizeOctal = fileContent.length.toString(8).padStart(11, '0');
    tarHeader.write(sizeOctal, 124, 12, 'utf8');
    // Modification time
    tarHeader.write('00000000000', 136, 12, 'utf8');
    // Checksum placeholder
    tarHeader.write('        ', 148, 8, 'utf8');
    // File type (regular file)
    tarHeader.write('0', 156, 1, 'utf8');

    // Calculate checksum
    let checksum = 0;
    for (let i = 0; i < 512; i++) {
        checksum += tarHeader[i];
    }
    tarHeader.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'utf8');

    // Create TAR content
    const contentBuffer = Buffer.from(fileContent);
    const padding = Buffer.alloc(512 - (contentBuffer.length % 512));
    const tarContent = Buffer.concat([tarHeader, contentBuffer, padding, Buffer.alloc(1024)]);

    // Compress with gzip
    return zlib.gzipSync(tarContent);
}

// Simple ZIP file creation (minimal implementation for testing)
function createSimpleZip(files) {
    const buffers = [];
    const centralDir = [];
    let offset = 0;

    for (const file of files) {
        // Local file header
        const header = Buffer.alloc(30);
        header.writeUInt32LE(0x04034b50, 0); // Signature
        header.writeUInt16LE(0x0014, 4); // Version
        header.writeUInt16LE(0, 6); // Flags
        header.writeUInt16LE(0, 8); // Compression (none)
        header.writeUInt16LE(0, 10); // Time
        header.writeUInt16LE(0, 12); // Date
        header.writeUInt32LE(0, 14); // CRC (0 for uncompressed)
        header.writeUInt32LE(file.content.length, 18); // Compressed size
        header.writeUInt32LE(file.content.length, 22); // Uncompressed size
        header.writeUInt16LE(file.name.length, 26); // Filename length
        header.writeUInt16LE(0, 28); // Extra field length

        const nameBuffer = Buffer.from(file.name);
        buffers.push(header, nameBuffer, file.content);

        // Central directory entry
        const cdEntry = Buffer.alloc(46);
        cdEntry.writeUInt32LE(0x02014b50, 0); // Signature
        cdEntry.writeUInt16LE(0x0314, 4); // Version made by
        cdEntry.writeUInt16LE(0x0014, 6); // Version needed
        cdEntry.writeUInt16LE(0, 8); // Flags
        cdEntry.writeUInt16LE(0, 10); // Compression
        cdEntry.writeUInt16LE(0, 12); // Time
        cdEntry.writeUInt16LE(0, 14); // Date
        cdEntry.writeUInt32LE(0, 16); // CRC
        cdEntry.writeUInt32LE(file.content.length, 20); // Compressed size
        cdEntry.writeUInt32LE(file.content.length, 24); // Uncompressed size
        cdEntry.writeUInt16LE(file.name.length, 28); // Filename length
        cdEntry.writeUInt16LE(0, 30); // Extra field length
        cdEntry.writeUInt16LE(0, 32); // File comment length
        cdEntry.writeUInt16LE(0, 34); // Disk number
        cdEntry.writeUInt16LE(0, 36); // Internal attributes
        cdEntry.writeUInt32LE(0, 38); // External attributes
        cdEntry.writeUInt32LE(offset, 42); // Relative offset

        centralDir.push(cdEntry, nameBuffer);
        offset += header.length + nameBuffer.length + file.content.length;
    }

    // End of central directory
    const cdSize = centralDir.reduce((sum, buf) => sum + buf.length, 0);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0); // Signature
    eocd.writeUInt16LE(0, 4); // Disk number
    eocd.writeUInt16LE(0, 6); // CD start disk
    eocd.writeUInt16LE(files.length, 8); // CD entries on this disk
    eocd.writeUInt16LE(files.length, 10); // Total CD entries
    eocd.writeUInt32LE(cdSize, 12); // CD size
    eocd.writeUInt32LE(offset, 16); // CD offset
    eocd.writeUInt16LE(0, 20); // Comment length

    return Buffer.concat([...buffers, ...centralDir, eocd]);
}

// Create test fixtures
function createTestFixtures() {
    const fixturesDir = __dirname;

    // Create install.tar.gz
    const tarGzContent = createTestTarGz();

    // Create AppxManifest.xml
    const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10">
    <Identity Name="TestDistro" Version="1.0.0.0" ProcessorArchitecture="x64"/>
</Package>`;

    // 1. Create x64.appx (contains install.tar.gz)
    const x64Appx = createSimpleZip([
        { name: 'install.tar.gz', content: tarGzContent },
        { name: 'AppxManifest.xml', content: Buffer.from(manifest) }
    ]);

    // 2. Create ARM64.appx (also contains install.tar.gz)
    const arm64Manifest = manifest.replace('x64', 'arm64');
    const arm64Appx = createSimpleZip([
        { name: 'install.tar.gz', content: tarGzContent },
        { name: 'AppxManifest.xml', content: Buffer.from(arm64Manifest) }
    ]);

    // 3. Create bundle manifest
    const bundleManifest = `<?xml version="1.0" encoding="UTF-8"?>
<Bundle xmlns="http://schemas.microsoft.com/appx/manifest/bundle/windows10">
    <Identity Name="TestDistro.Bundle" Version="1.0.0.0"/>
    <Packages>
        <Package Type="application" Architecture="x64" FileName="x64.appx"/>
        <Package Type="application" Architecture="arm64" FileName="ARM64.appx"/>
    </Packages>
</Bundle>`;

    // 4. Create nested AppxBundle (contains x64.appx and ARM64.appx)
    const nestedBundle = createSimpleZip([
        { name: 'x64.appx', content: x64Appx },
        { name: 'ARM64.appx', content: arm64Appx },
        { name: 'AppxBundleManifest.xml', content: Buffer.from(bundleManifest) }
    ]);

    // Write the nested bundle
    const nestedBundlePath = path.join(fixturesDir, 'nested-bundle.appxbundle');
    fs.writeFileSync(nestedBundlePath, nestedBundle);

    // Also create a simple APPX for comparison
    const simpleAppx = createSimpleZip([
        { name: 'install.tar.gz', content: tarGzContent },
        { name: 'AppxManifest.xml', content: Buffer.from(manifest) }
    ]);

    const simpleAppxPath = path.join(fixturesDir, 'simple.appx');
    fs.writeFileSync(simpleAppxPath, simpleAppx);

    console.log('Created test fixtures:');
    console.log(`- ${nestedBundlePath} (nested AppxBundle with x64.appx and ARM64.appx)`);
    console.log(`- ${simpleAppxPath} (simple APPX with install.tar.gz)`);

    // Verify files
    const bundleStats = fs.statSync(nestedBundlePath);
    const simpleStats = fs.statSync(simpleAppxPath);
    console.log(`\nFile sizes:`);
    console.log(`- nested-bundle.appxbundle: ${bundleStats.size} bytes`);
    console.log(`- simple.appx: ${simpleStats.size} bytes`);

    return {
        nestedBundlePath,
        simpleAppxPath
    };
}

// Run if executed directly
if (require.main === module) {
    createTestFixtures();
}

module.exports = { createTestFixtures, createTestTarGz, createSimpleZip };