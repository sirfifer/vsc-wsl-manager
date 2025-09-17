#!/usr/bin/env node

/**
 * Test runner for REAL download integration tests
 * This runs actual downloads and WSL operations - no mocks!
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting REAL Download Integration Tests');
console.log('⚠️  This will download actual distributions and use WSL');
console.log('⏱️  This may take several minutes...\n');

// Set environment variable to enable real tests
process.env.REAL_TESTS = 'true';

// Compile TypeScript first
console.log('📦 Compiling TypeScript...');
const compile = spawn('npm', ['run', 'compile'], {
    stdio: 'inherit',
    shell: true
});

compile.on('close', (code) => {
    if (code !== 0) {
        console.error('❌ Compilation failed');
        process.exit(1);
    }

    console.log('✅ Compilation successful\n');
    console.log('🧪 Running real download tests...\n');

    // Run the real download tests with Jest
    const testFile = 'test/integration/real-download.test.ts';
    const jest = spawn('npx', ['jest', testFile, '--verbose', '--no-coverage'], {
        stdio: 'inherit',
        shell: true,
        env: {
            ...process.env,
            REAL_TESTS: 'true',
            NODE_ENV: 'test'
        }
    });

    jest.on('close', (code) => {
        if (code === 0) {
            console.log('\n✅ All real download tests passed!');
            console.log('🎉 The download functionality is working correctly!');
        } else {
            console.error('\n❌ Real download tests failed');
            console.error('Please check the errors above and fix the issues');
        }
        process.exit(code);
    });
});

// Handle interruption
process.on('SIGINT', () => {
    console.log('\n\n⚠️  Tests interrupted by user');
    console.log('Note: You may need to manually clean up test WSL distributions');
    console.log('Run: wsl --list to see distributions');
    console.log('Run: wsl --unregister <name> to remove test distributions');
    process.exit(1);
});