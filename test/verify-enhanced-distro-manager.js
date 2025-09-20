#!/usr/bin/env node

/**
 * Real test verification for EnhancedDistroManager
 * NO MOCKS - Tests with real network calls and file operations
 *
 * @author Marcus Johnson, QA Manager
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

console.log('\n================================');
console.log('  EnhancedDistroManager Real Tests');
console.log('================================\n');

let passed = 0;
let failed = 0;
let tempDir = null;

// Create temp directory for tests
function setup() {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'enhanced-test-'));
    console.log(`✓ Created temp directory: ${tempDir}`);
}

// Clean up temp directory
function teardown() {
    if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log('✓ Cleaned up temp directory\n');
    }
}

// Test helper
async function runTest(name, testFn) {
    console.log(`\nTesting: ${name}`);
    try {
        await testFn();
        console.log(`  ✅ PASSED`);
        passed++;
    } catch (error) {
        console.log(`  ❌ FAILED: ${error.message}`);
        failed++;
    }
}

// Assertion helper
function expect(actual, message) {
    return {
        toBe(expected) {
            if (actual !== expected) {
                throw new Error(message || `Expected ${expected}, got ${actual}`);
            }
        },
        toBeDefined() {
            if (actual === undefined) {
                throw new Error(message || 'Expected value to be defined');
            }
        },
        toContain(substring) {
            if (!actual || !actual.includes(substring)) {
                throw new Error(message || `Expected to contain "${substring}"`);
            }
        },
        notToContain(substring) {
            if (actual && actual.includes(substring)) {
                throw new Error(message || `Expected NOT to contain "${substring}"`);
            }
        },
        toBeGreaterThan(value) {
            if (!(actual > value)) {
                throw new Error(message || `Expected ${actual} to be greater than ${value}`);
            }
        }
    };
}

// REAL TESTS START HERE

async function testEnhancedDistroManager() {
    const { EnhancedDistroManager } = require('../out/src/distros/EnhancedDistroManager');
    const manager = new EnhancedDistroManager(tempDir);

    // Test 1: Real Microsoft Registry fetch
    await runTest('should fetch real distributions from Microsoft Registry', async () => {
        const distros = await manager.listDistros();

        expect(distros).toBeDefined();
        expect(Array.isArray(distros)).toBe(true);
        expect(distros.length, 'Should have distributions').toBeGreaterThan(0);
    });

    // Test 2: Ubuntu-24.04 URL is correct
    await runTest('should have correct Ubuntu-24.04 URL', async () => {
        const distros = await manager.listDistros();
        const ubuntu = distros.find(d => d.name === 'ubuntu-24.04');

        expect(ubuntu).toBeDefined();
        expect(ubuntu.sourceUrl).toBe('https://releases.ubuntu.com/24.04.3/ubuntu-24.04.3-wsl-amd64.wsl');
        expect(ubuntu.sourceUrl).notToContain('cloud-images.ubuntu.com/wsl/noble');
    });

    // Test 3: Real URL validation with HEAD request
    await runTest('should validate real Ubuntu-24.04 URL', async () => {
        const url = 'https://releases.ubuntu.com/24.04.3/ubuntu-24.04.3-wsl-amd64.wsl';

        const isValid = await new Promise((resolve) => {
            https.request(url, { method: 'HEAD', timeout: 10000 }, (res) => {
                resolve(res.statusCode === 200);
            }).on('error', () => resolve(false)).end();
        });

        expect(isValid).toBe(true);
    });

    // Test 4: Detect invalid URL
    await runTest('should detect invalid URL (old Ubuntu-24.04)', async () => {
        const invalidUrl = 'https://cloud-images.ubuntu.com/wsl/noble/current/ubuntu-noble-wsl-amd64-wsl.rootfs.tar.gz';

        const isValid = await new Promise((resolve) => {
            https.request(invalidUrl, { method: 'HEAD', timeout: 10000 }, (res) => {
                resolve(res.statusCode === 200);
            }).on('error', () => resolve(false)).end();
        });

        expect(isValid).toBe(false);
    });

    // Test 5: Real catalog persistence
    await runTest('should save real catalog to disk', async () => {
        await manager.refreshDistributions();

        const catalogPath = path.join(tempDir, 'distros', 'catalog.json');
        expect(fs.existsSync(catalogPath)).toBe(true);

        const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
        expect(catalog.version).toBe('2.0.0');
        expect(catalog.distributions.length).toBeGreaterThan(0);
    });

    // Test 6: Cache behavior
    await runTest('should use cache for repeated calls', async () => {
        const start1 = Date.now();
        await manager.listDistros();
        const duration1 = Date.now() - start1;

        const start2 = Date.now();
        await manager.listDistros();
        const duration2 = Date.now() - start2;

        // Second call should be much faster (cached)
        expect(duration2 < duration1 / 2).toBe(true);
    });

    // Test 7: Security - Path traversal protection
    await runTest('should sanitize malicious file paths', async () => {
        const maliciousPath = '../../../etc/passwd';
        const safePath = manager.getDistroPath(maliciousPath);

        expect(safePath).toContain('distros');
        expect(safePath).notToContain('..');
    });

    // Test 8: Handle corrupted catalog
    await runTest('should handle corrupted catalog gracefully', async () => {
        const catalogPath = path.join(tempDir, 'distros', 'catalog.json');
        fs.mkdirSync(path.dirname(catalogPath), { recursive: true });
        fs.writeFileSync(catalogPath, 'not-valid-json{{{');

        const newManager = new EnhancedDistroManager(tempDir);
        const distros = await newManager.listDistros();

        expect(distros).toBeDefined();
        expect(distros.length).toBeGreaterThan(0);
    });
}

// Run all tests
async function main() {
    setup();

    try {
        await testEnhancedDistroManager();
    } catch (error) {
        console.error('Unexpected error:', error);
        failed++;
    }

    teardown();

    // Summary
    console.log('================================');
    console.log('        Test Summary');
    console.log('================================');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total:  ${passed + failed}`);

    if (failed === 0) {
        console.log('\n🎉 All tests passed with REAL implementations!');
        console.log('✓ Real network calls to Microsoft Registry');
        console.log('✓ Real HTTP HEAD requests for URL validation');
        console.log('✓ Real file system operations');
        console.log('✓ Ubuntu-24.04 URL is correct!');
    } else {
        console.log('\n⚠️ Some tests failed. Check the output above.');
        process.exit(1);
    }
}

// Run with error handling
main().catch(error => {
    console.error('Fatal error:', error);
    teardown();
    process.exit(1);
});