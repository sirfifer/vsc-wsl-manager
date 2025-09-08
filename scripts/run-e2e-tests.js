#!/usr/bin/env node

/**
 * Run E2E Tests Script
 * Validates and runs WebdriverIO E2E tests
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Running WebdriverIO E2E Tests\n');
console.log('=' . repeat(50));

// Check if VS Code binary is available
const vscodeBinary = path.join(
    __dirname,
    '..',
    '.wdio-vscode-service',
    'vscode-linux-x64-1.103.2',
    'code'
);

if (!fs.existsSync(vscodeBinary)) {
    console.log('⚠️  VS Code binary not found. It will be downloaded on first run.');
} else {
    console.log('✅ VS Code binary found');
}

// Check if extension is compiled
const extensionMain = path.join(__dirname, '..', 'out', 'src', 'extension.js');
if (!fs.existsSync(extensionMain)) {
    console.log('❌ Extension not compiled. Running npm run compile...');
    const compile = spawn('npm', ['run', 'compile'], { 
        stdio: 'inherit',
        shell: true 
    });
    
    compile.on('close', (code) => {
        if (code !== 0) {
            console.log('❌ Compilation failed');
            process.exit(1);
        }
        runTests();
    });
} else {
    console.log('✅ Extension compiled');
    runTests();
}

function runTests() {
    console.log('\n📋 E2E Test Files:');
    const testDir = path.join(__dirname, '..', 'test', 'e2e');
    const testFiles = fs.readdirSync(testDir)
        .filter(f => f.endsWith('.test.ts'))
        .sort();
    
    testFiles.forEach(file => {
        console.log(`  • ${file}`);
    });
    
    console.log('\n🚀 Starting WebdriverIO...\n');
    console.log('Note: VS Code will launch in headless mode');
    console.log('Tests will run automatically\n');
    
    // Run WebdriverIO with simplified config
    const wdio = spawn('npx', ['wdio', 'run', 'wdio.conf.ts'], {
        stdio: 'inherit',
        shell: true,
        env: {
            ...process.env,
            // Disable GPU for headless mode
            DISPLAY: ':99',
            // Set test mode
            NODE_ENV: 'test',
            // Use E2E tsconfig
            TS_NODE_PROJECT: 'test/e2e/tsconfig.json'
        }
    });
    
    wdio.on('close', (code) => {
        console.log('\n' + '=' . repeat(50));
        
        if (code === 0) {
            console.log('✅ E2E tests completed successfully!');
            console.log('\n🎉 All tests passed!');
        } else {
            console.log(`❌ E2E tests failed with code ${code}`);
            console.log('\n💡 Troubleshooting tips:');
            console.log('1. Check if you have Xvfb installed (for headless mode)');
            console.log('2. Try running with debug: npm run test:e2e:debug');
            console.log('3. Check test/e2e/*.test.ts files for syntax errors');
            console.log('4. Ensure all dependencies are installed');
        }
        
        process.exit(code);
    });
    
    // Handle interruption
    process.on('SIGINT', () => {
        console.log('\n\n⚠️  Test run interrupted by user');
        wdio.kill('SIGTERM');
        process.exit(1);
    });
}