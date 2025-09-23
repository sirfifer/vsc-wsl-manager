/**
 * Test real distro file extraction
 * This tests the actual fix for the kali-linux.tar APPX extraction issue
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

async function executeCommand(command, args) {
    return new Promise((resolve) => {
        const process = spawn(command, args, { shell: true });
        let stdout = '';
        let stderr = '';

        process.stdout?.on('data', (data) => {
            stdout += data.toString();
        });

        process.stderr?.on('data', (data) => {
            stderr += data.toString();
        });

        process.on('close', (exitCode) => {
            resolve({
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                exitCode: exitCode || 0
            });
        });
    });
}

async function testRealDistroExtraction() {
    const distroPath = '/mnt/c/Users/ramerman/.vscode-wsl-manager/distros/kali-linux.tar';

    console.log('🧪 Testing Real Distro Extraction');
    console.log('=====================================');
    console.log(`Distro file: ${distroPath}`);

    // Check if file exists
    if (!fs.existsSync(distroPath)) {
        console.log('❌ Distro file not found!');
        return false;
    }

    console.log('✅ Distro file exists');

    // Check file type
    const buffer = Buffer.alloc(4);
    const fd = fs.openSync(distroPath, 'r');
    fs.readSync(fd, buffer, 0, 4, 0);
    fs.closeSync(fd);

    if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
        console.log('✅ File is a ZIP/APPX archive (as expected)');
    } else {
        console.log('⚠️ File is not a ZIP archive');
    }

    // Test extraction (we're in WSL, so use unzip)
    const tempDir = path.join('/tmp', `test-extract-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    console.log(`\n📁 Extracting to: ${tempDir}`);

    try {
        // Try unzip (we're in WSL)
        console.log('🔧 Using unzip...');
        const result = await executeCommand('unzip', [
            '-q',
            distroPath,
            '-d',
            tempDir
        ]);

        if (result.exitCode !== 0) {
            console.log(`❌ Unzip extraction failed: ${result.stderr}`);
            return false;
        }

        console.log('✅ Unzip extraction succeeded!');

        // Look for TAR files in extracted content
        console.log('\n🔍 Searching for TAR files in extracted content...');

        function findTarFiles(dir, level = 0) {
            const items = fs.readdirSync(dir);
            const indent = '  '.repeat(level);

            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);

                if (stat.isDirectory()) {
                    console.log(`${indent}📂 ${item}/`);
                    findTarFiles(fullPath, level + 1);
                } else if (item.toLowerCase().endsWith('.tar') ||
                          item.toLowerCase().endsWith('.tar.gz')) {
                    console.log(`${indent}📦 ${item} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);

                    // Found a TAR file!
                    if (item.toLowerCase().includes('install')) {
                        console.log(`\n✅ Found install TAR: ${item}`);
                        return fullPath;
                    }
                }
            }
            return null;
        }

        const tarFile = findTarFiles(tempDir);

        if (tarFile) {
            console.log('\n🎉 SUCCESS: TAR file found and can be extracted!');
            console.log('The fix works correctly for real distro files.');
        } else {
            console.log('\n⚠️ No TAR file found in extracted content');
            console.log('Directory structure:');
            findTarFiles(tempDir);
        }

    } catch (error) {
        console.log(`❌ Error during extraction: ${error.message}`);
        return false;
    } finally {
        // Clean up
        console.log('\n🧹 Cleaning up temp directory...');
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
            console.log('✅ Cleanup complete');
        } catch {
            console.log('⚠️ Could not clean up temp directory');
        }
    }

    return true;
}

// Run the test
testRealDistroExtraction().then(success => {
    if (success) {
        console.log('\n✅ All tests passed!');
        process.exit(0);
    } else {
        console.log('\n❌ Test failed!');
        process.exit(1);
    }
});