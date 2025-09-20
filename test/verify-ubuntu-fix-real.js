#!/usr/bin/env node

/**
 * Real test to verify Ubuntu-24.04 fix
 * Tests with REAL network calls - NO MOCKS
 *
 * @author Marcus Johnson, QA Manager
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

console.log('\n================================');
console.log('  Ubuntu-24.04 Fix Verification');
console.log('  REAL Network Tests - NO MOCKS');
console.log('================================\n');

let passed = 0;
let failed = 0;

async function testUrl(url, shouldWork) {
    const urlDisplay = url.length > 80 ? url.substring(0, 77) + '...' : url;
    console.log(`\nTesting: ${urlDisplay}`);
    console.log(`Expected: ${shouldWork ? 'VALID' : 'INVALID'}`);

    try {
        const isValid = await new Promise((resolve, reject) => {
            const request = https.request(url, {
                method: 'HEAD',
                timeout: 15000
            }, (res) => {
                console.log(`  Response: HTTP ${res.statusCode}`);
                resolve(res.statusCode === 200);
            });

            request.on('error', (err) => {
                console.log(`  Error: ${err.message}`);
                resolve(false);
            });

            request.on('timeout', () => {
                console.log(`  Error: Request timed out`);
                request.destroy();
                resolve(false);
            });

            request.end();
        });

        if (isValid === shouldWork) {
            console.log(`  ✅ PASSED - URL is ${isValid ? 'valid' : 'invalid'} as expected`);
            passed++;
        } else {
            console.log(`  ❌ FAILED - URL is ${isValid ? 'valid' : 'invalid'}, expected ${shouldWork ? 'valid' : 'invalid'}`);
            failed++;
        }

        return isValid;
    } catch (error) {
        console.log(`  ❌ ERROR: ${error.message}`);
        failed++;
        return false;
    }
}

async function checkCompiledCode() {
    console.log('\n📝 Checking compiled code for correct URLs...\n');

    // Check EnhancedDistroManager has correct URL
    const enhancedPath = path.join(__dirname, '..', 'out', 'src', 'distros', 'EnhancedDistroManager.js');
    if (fs.existsSync(enhancedPath)) {
        const content = fs.readFileSync(enhancedPath, 'utf8');

        if (content.includes('https://releases.ubuntu.com/24.04.3/ubuntu-24.04.3-wsl-amd64.wsl')) {
            console.log('  ✅ EnhancedDistroManager has CORRECT Ubuntu-24.04 URL');
            passed++;
        } else {
            console.log('  ❌ EnhancedDistroManager missing correct URL');
            failed++;
        }

        if (content.includes('cloud-images.ubuntu.com/wsl/noble')) {
            console.log('  ❌ EnhancedDistroManager still has OLD broken URL!');
            failed++;
        } else {
            console.log('  ✅ EnhancedDistroManager does NOT have old broken URL');
            passed++;
        }
    } else {
        console.log('  ⚠️ EnhancedDistroManager.js not found - need to compile?');
    }

    // Check DistroManager as well
    const distroPath = path.join(__dirname, '..', 'out', 'src', 'distros', 'DistroManager.js');
    if (fs.existsSync(distroPath)) {
        const content = fs.readFileSync(distroPath, 'utf8');

        if (content.includes('cloud-images.ubuntu.com/wsl/noble')) {
            console.log('  ⚠️ DistroManager.js still has old URL (but EnhancedDistroManager overrides it)');
        }
    }
}

async function checkMicrosoftRegistry() {
    console.log('\n🌐 Testing Microsoft Registry Access...\n');

    const registryUrl = 'https://raw.githubusercontent.com/microsoft/WSL/master/distributions/DistributionInfo.json';

    try {
        const data = await new Promise((resolve, reject) => {
            https.get(registryUrl, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve(JSON.parse(body));
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}`));
                    }
                });
            }).on('error', reject);
        });

        console.log(`  ✅ Microsoft Registry accessible`);
        console.log(`  📊 Found ${data.Distributions.length} distributions`);

        // Check for Ubuntu-24.04
        const ubuntu2404 = data.Distributions.find(d => d.Name === 'Ubuntu-24.04');
        if (ubuntu2404) {
            console.log(`  ✅ Ubuntu-24.04 found in registry`);
            if (ubuntu2404.Amd64WslUrl) {
                console.log(`  📎 Official URL: ${ubuntu2404.Amd64WslUrl}`);
            }
        } else {
            console.log(`  ⚠️ Ubuntu-24.04 not in Microsoft registry`);
        }

        passed++;
    } catch (error) {
        console.log(`  ❌ Failed to access Microsoft Registry: ${error.message}`);
        failed++;
    }
}

async function main() {
    console.log('🔍 Running REAL network tests - this will make actual HTTP requests!\n');
    console.log('⏱️  This may take 30-60 seconds depending on network speed...\n');

    // Check compiled code first
    await checkCompiledCode();

    // Test Microsoft Registry
    await checkMicrosoftRegistry();

    // Test the CORRECT Ubuntu-24.04 URL (should work)
    console.log('\n✅ Testing CORRECT Ubuntu-24.04 URL:');
    await testUrl('https://releases.ubuntu.com/24.04.3/ubuntu-24.04.3-wsl-amd64.wsl', true);

    // Test the OLD BROKEN URL (should NOT work)
    console.log('\n❌ Testing OLD BROKEN Ubuntu-24.04 URL:');
    await testUrl('https://cloud-images.ubuntu.com/wsl/noble/current/ubuntu-noble-wsl-amd64-wsl.rootfs.tar.gz', false);

    // Test Ubuntu-22.04 URL (should work)
    console.log('\n✅ Testing Ubuntu-22.04 URL:');
    await testUrl('https://cloud-images.ubuntu.com/wsl/jammy/current/ubuntu-jammy-wsl-amd64-ubuntu22.04lts.rootfs.tar.gz', true);

    // Summary
    console.log('\n================================');
    console.log('        Test Summary');
    console.log('================================');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total:  ${passed + failed}`);

    if (failed === 0) {
        console.log('\n🎉 SUCCESS! Ubuntu-24.04 fix is verified!');
        console.log('✓ Correct URL works');
        console.log('✓ Old broken URL fails (as expected)');
        console.log('✓ Real network validation works');
        console.log('✓ Microsoft Registry is accessible');
    } else {
        console.log('\n⚠️ Some tests failed. The fix may not be complete.');
        process.exit(1);
    }
}

// Run tests
main().catch(error => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
});