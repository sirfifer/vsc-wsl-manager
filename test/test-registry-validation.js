#!/usr/bin/env node

/**
 * Direct test of DistributionRegistry validation without VS Code
 */

console.log('================================');
console.log('  Testing Registry Validation');
console.log('================================\n');

// Mock the Logger to avoid VS Code dependency
const mockLogger = {
    info: (msg) => console.log(`[INFO] ${msg}`),
    debug: (msg) => console.log(`[DEBUG] ${msg}`),
    warn: (msg) => console.log(`[WARN] ${msg}`),
    error: (msg, err) => console.log(`[ERROR] ${msg}`, err || ''),
    getInstance: function() { return this; }
};

// Mock VS Code
const vscode = {
    window: {
        showInformationMessage: (msg) => console.log(`[VS Code Info] ${msg}`),
        showWarningMessage: (msg) => console.log(`[VS Code Warn] ${msg}`),
        showErrorMessage: (msg) => console.log(`[VS Code Error] ${msg}`)
    }
};

// Override require for logger
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id) {
    if (id === './utils/logger' || id.endsWith('/logger')) {
        return { Logger: mockLogger };
    }
    if (id === 'vscode') {
        return vscode;
    }
    return originalRequire.apply(this, arguments);
};

async function testRegistry() {
    try {
        console.log('1. Loading DistributionRegistry...');
        const { DistributionRegistry } = require('../out/src/distributionRegistry');
        const registry = new DistributionRegistry();
        console.log('   ✓ Registry loaded successfully\n');

        console.log('2. Testing fetchAvailableDistributions...');
        const distros = await registry.fetchAvailableDistributions();
        console.log(`   ✓ Fetched ${distros.length} distributions`);

        if (distros.length > 0) {
            console.log(`   Sample: ${distros[0].Name} - ${distros[0].FriendlyName}\n`);
        }

        console.log('3. Testing validateDistributionUrl...');
        if (typeof registry.validateDistributionUrl === 'function') {
            console.log('   ✓ validateDistributionUrl method exists');

            // Test with a known distribution
            if (distros.length > 0) {
                const testDistro = distros[0].Name;
                console.log(`   Testing URL validation for: ${testDistro}`);

                const isValid = await registry.validateDistributionUrl(testDistro);
                if (isValid) {
                    console.log(`   ✓ URL validation successful for ${testDistro}\n`);
                } else {
                    console.log(`   ⚠ URL validation failed for ${testDistro} (may be network issue)\n`);
                }
            }
        } else {
            console.log('   ✗ validateDistributionUrl method not found\n');
        }

        console.log('4. Testing fetchFromWSLCommand...');
        if (typeof registry.fetchFromWSLCommand === 'function') {
            console.log('   ✓ fetchFromWSLCommand method exists');

            try {
                const wslDistros = await registry.fetchFromWSLCommand();
                console.log(`   ✓ WSL command method works (found ${wslDistros.length} distributions)\n`);
            } catch (err) {
                console.log('   ⚠ WSL command failed (expected if WSL not available):', err.message, '\n');
            }
        } else {
            console.log('   ✗ fetchFromWSLCommand method not found\n');
        }

        console.log('5. Testing cache functionality...');
        registry.clearCache();
        console.log('   ✓ Cache cleared successfully');

        // Fetch again to test caching
        const distros2 = await registry.fetchAvailableDistributions();
        console.log(`   ✓ Re-fetched ${distros2.length} distributions after cache clear\n`);

        console.log('✅ All registry validation tests completed!');

    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

// Run the test
testRegistry().catch(console.error);