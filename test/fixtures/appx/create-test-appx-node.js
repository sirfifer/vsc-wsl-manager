#!/usr/bin/env node
/**
 * Create test APPX files using pure Node.js
 * Creates minimal ZIP-format files that can be used for testing
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const fixturesDir = __dirname;

// Create a minimal ZIP file structure
function createMinimalZip(entries) {
    const buffers = [];
    const centralDirectory = [];
    let offset = 0;

    // Local file headers and data
    for (const entry of entries) {
        const filename = Buffer.from(entry.name);
        const data = Buffer.from(entry.data);

        // Local file header signature
        const header = Buffer.alloc(30);
        header.writeUInt32LE(0x04034b50, 0); // Signature
        header.writeUInt16LE(0x0014, 4); // Version needed
        header.writeUInt16LE(0x0000, 6); // Flags
        header.writeUInt16LE(0x0000, 8); // Compression (none)
        header.writeUInt16LE(0x0000, 10); // Time
        header.writeUInt16LE(0x0000, 12); // Date
        header.writeUInt32LE(crc32(data), 14); // CRC-32
        header.writeUInt32LE(data.length, 18); // Compressed size
        header.writeUInt32LE(data.length, 22); // Uncompressed size
        header.writeUInt16LE(filename.length, 26); // Filename length
        header.writeUInt16LE(0, 28); // Extra field length

        buffers.push(header);
        buffers.push(filename);
        buffers.push(data);

        // Central directory entry
        const cdEntry = {
            offset: offset,
            filename: filename,
            size: data.length,
            crc: crc32(data)
        };
        centralDirectory.push(cdEntry);

        offset += header.length + filename.length + data.length;
    }

    // Central directory
    const cdStart = offset;
    for (const entry of centralDirectory) {
        const cdHeader = Buffer.alloc(46);
        cdHeader.writeUInt32LE(0x02014b50, 0); // Signature
        cdHeader.writeUInt16LE(0x0014, 4); // Version made by
        cdHeader.writeUInt16LE(0x0014, 6); // Version needed
        cdHeader.writeUInt16LE(0x0000, 8); // Flags
        cdHeader.writeUInt16LE(0x0000, 10); // Compression
        cdHeader.writeUInt16LE(0x0000, 12); // Time
        cdHeader.writeUInt16LE(0x0000, 14); // Date
        cdHeader.writeUInt32LE(entry.crc, 16); // CRC-32
        cdHeader.writeUInt32LE(entry.size, 20); // Compressed size
        cdHeader.writeUInt32LE(entry.size, 24); // Uncompressed size
        cdHeader.writeUInt16LE(entry.filename.length, 28); // Filename length
        cdHeader.writeUInt16LE(0, 30); // Extra field length
        cdHeader.writeUInt16LE(0, 32); // Comment length
        cdHeader.writeUInt16LE(0, 34); // Disk number
        cdHeader.writeUInt16LE(0, 36); // Internal attributes
        cdHeader.writeUInt32LE(0, 38); // External attributes
        cdHeader.writeUInt32LE(entry.offset, 42); // Relative offset

        buffers.push(cdHeader);
        buffers.push(entry.filename);
        offset += cdHeader.length + entry.filename.length;
    }

    // End of central directory
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0); // Signature
    eocd.writeUInt16LE(0, 4); // Disk number
    eocd.writeUInt16LE(0, 6); // Disk with CD
    eocd.writeUInt16LE(centralDirectory.length, 8); // CD entries on disk
    eocd.writeUInt16LE(centralDirectory.length, 10); // Total CD entries
    eocd.writeUInt32LE(offset - cdStart, 12); // CD size
    eocd.writeUInt32LE(cdStart, 16); // CD offset
    eocd.writeUInt16LE(0, 20); // Comment length

    buffers.push(eocd);

    return Buffer.concat(buffers);
}

// Simple CRC32 implementation
function crc32(data) {
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
        crc ^= data[i];
        for (let j = 0; j < 8; j++) {
            crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
        }
    }
    return ~crc >>> 0;
}

// Create a simple TAR file
function createSimpleTar(filename, content) {
    const header = Buffer.alloc(512);
    const contentBuf = Buffer.from(content);

    // Filename
    header.write(filename, 0, 100);

    // File mode (0644)
    header.write('0000644', 100, 8);

    // UID/GID
    header.write('0000000', 108, 8);
    header.write('0000000', 116, 8);

    // Size in octal
    const size = contentBuf.length.toString(8).padStart(11, '0');
    header.write(size, 124, 12);

    // Modification time
    const mtime = Math.floor(Date.now() / 1000).toString(8).padStart(11, '0');
    header.write(mtime, 136, 12);

    // Type flag (regular file)
    header.write('0', 156, 1);

    // Calculate checksum
    header.fill(' ', 148, 156);
    let checksum = 0;
    for (let i = 0; i < 512; i++) {
        checksum += header[i];
    }
    header.write(checksum.toString(8).padStart(6, '0'), 148, 6);
    header.write('\0 ', 154, 2);

    // Pad content to 512-byte blocks
    const padding = Buffer.alloc((512 - (contentBuf.length % 512)) % 512);
    const ending = Buffer.alloc(1024); // Two empty blocks

    return Buffer.concat([header, contentBuf, padding, ending]);
}

// Create test files
function createTestAppxFiles() {
    console.log('Creating test APPX fixtures with pure Node.js...');

    // Test content
    const testContent = 'Test WSL distribution rootfs content';
    const tar = createSimpleTar('rootfs', testContent);
    const tarGz = zlib.gzipSync(tar);

    // AppxManifest.xml
    const manifest = `<?xml version="1.0" encoding="utf-8"?>
<Package xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10">
  <Identity Name="TestDistro" Version="1.0.0.0" />
</Package>`;

    // Test 1: Valid APPX with install.tar.gz
    const validAppx = createMinimalZip([
        { name: 'install.tar.gz', data: tarGz },
        { name: 'AppxManifest.xml', data: manifest }
    ]);
    fs.writeFileSync(path.join(fixturesDir, 'valid-distro.appx'), validAppx);

    // Test 2: APPX with custom named TAR
    const customAppx = createMinimalZip([
        { name: 'distro.tar', data: tar },
        { name: 'AppxManifest.xml', data: manifest }
    ]);
    fs.writeFileSync(path.join(fixturesDir, 'custom-tar.appx'), customAppx);

    // Test 3: APPX with no TAR file
    const noTarAppx = createMinimalZip([
        { name: 'readme.txt', data: 'This APPX contains no TAR file' },
        { name: 'AppxManifest.xml', data: manifest }
    ]);
    fs.writeFileSync(path.join(fixturesDir, 'no-tar.appx'), noTarAppx);

    // Test 4: AppxBundle (same structure for testing)
    fs.writeFileSync(path.join(fixturesDir, 'test-bundle.appxbundle'), validAppx);

    // Test 5: Corrupted APPX
    fs.writeFileSync(path.join(fixturesDir, 'corrupted.appx'), Buffer.from('This is not a valid ZIP/APPX file'));

    console.log('Test APPX fixtures created successfully:');
    console.log('- valid-distro.appx (contains install.tar.gz)');
    console.log('- custom-tar.appx (contains distro.tar)');
    console.log('- no-tar.appx (no TAR file)');
    console.log('- test-bundle.appxbundle (AppxBundle format)');
    console.log('- corrupted.appx (invalid format)');

    // Verify files
    const files = fs.readdirSync(fixturesDir).filter(f => f.endsWith('.appx') || f.endsWith('.appxbundle'));
    console.log('\nCreated files:');
    files.forEach(file => {
        const stats = fs.statSync(path.join(fixturesDir, file));
        console.log(`  ${file}: ${stats.size} bytes`);
    });
}

// Run if executed directly
if (require.main === module) {
    createTestAppxFiles();
}

module.exports = { createSimpleTar, createMinimalZip, createTestAppxFiles };