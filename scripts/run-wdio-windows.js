#!/usr/bin/env node

/**
 * Run WebdriverIO tests with VS Code on Windows from WSL
 * This script ensures proper environment setup for cross-platform testing
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Validate environment
const cwd = process.cwd();
if (!cwd.startsWith('/mnt/')) {
    console.error('❌ ERROR: Project must be located under /mnt/c/... or similar');
    console.error(`Current location: ${cwd}`);
    console.error('Please move your project to a Windows-mounted filesystem.');
    console.error('Example: mv ~/projects/vsc-wsl-manager /mnt/c/projects/');
    process.exit(1);
}

console.log('🧪 WebdriverIO VS Code UI Tests (Windows Mode)');
console.log('=' .repeat(50));
console.log('📁 Project location:', cwd);
console.log('🖥️ VS Code will run on Windows');
console.log('🧪 Tests will run from WSL\n');

// Create necessary directories
const dirs = [
    '.test-workspace/.vscode',
    'test/screenshots',
    'test/visual/baseline',
    'test/visual/screenshots',
    'test/e2e/screenshots'
];

dirs.forEach(dir => {
    const fullPath = path.join(cwd, dir);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
    }
});

// Check if extension is compiled
const extensionMain = path.join(cwd, 'out', 'src', 'extension.js');
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
        console.log('✅ Extension compiled successfully\n');
        runTests();
    });
} else {
    console.log('✅ Extension already compiled');
    runTests();
}

function runTests() {
    // Check for VS Code on Windows
    console.log('\n🔍 Checking for VS Code on Windows...');
    
    const checkVSCode = spawn('cmd.exe', ['/c', 'where', 'Code.exe'], {
        stdio: 'pipe'
    });
    
    let vscodeFound = false;
    checkVSCode.stdout.on('data', (data) => {
        const output = data.toString().trim();
        if (output.includes('Code.exe')) {
            console.log('✅ VS Code found:', output.split('\n')[0]);
            vscodeFound = true;
        }
    });
    
    checkVSCode.on('close', (code) => {
        if (!vscodeFound) {
            console.log('⚠️ VS Code not found in Windows PATH');
            console.log('Will attempt to use wdio-vscode-service to download it');
        }
        
        startWebdriverIO();
    });
}

function startWebdriverIO() {
    console.log('\n🚀 Starting WebdriverIO with Windows configuration...\n');
    
    // Set environment variables
    const env = {
        ...process.env,
        NODE_ENV: 'test',
        FORCE_COLOR: '1',
        TS_NODE_PROJECT: 'test/e2e/tsconfig.json'
    };
    
    // Determine which specs to run
    const args = process.argv.slice(2);
    let wdioArgs = ['wdio', 'run', 'test/config/wdio.conf.windows.ts'];
    
    // Add any additional arguments (like --spec)
    if (args.length > 0) {
        wdioArgs = wdioArgs.concat(args);
    }
    
    console.log('Running:', 'npx', wdioArgs.join(' '));
    console.log('');
    
    // Run WebdriverIO
    const wdio = spawn('npx', wdioArgs, {
        stdio: 'inherit',
        env
    });
    
    wdio.on('close', (code) => {
        console.log('\n' + '=' .repeat(50));
        
        if (code === 0) {
            console.log('✅ All tests passed!');
            
            // Show screenshot location if any exist
            const screenshotDir = path.join(cwd, 'test', 'screenshots');
            if (fs.existsSync(screenshotDir)) {
                const screenshots = fs.readdirSync(screenshotDir);
                if (screenshots.length > 0) {
                    console.log(`\n📸 Screenshots saved in: ${screenshotDir}`);
                }
            }
        } else {
            console.log(`❌ Tests failed with code ${code}`);
            console.log('\n💡 Troubleshooting tips:');
            console.log('1. Ensure VS Code is installed on Windows');
            console.log('2. Check test/screenshots/ for failure screenshots');
            console.log('3. Run with --spec to test individual files');
            console.log('4. Check that the extension compiles without errors');
        }
        
        // Cleanup Windows processes
        cleanupWindowsProcesses();
        
        process.exit(code || 0);
    });
    
    wdio.on('error', (err) => {
        console.error('Failed to start WebdriverIO:', err);
        process.exit(1);
    });
    
    // Handle interrupts
    process.on('SIGINT', () => {
        console.log('\nInterrupted, cleaning up...');
        wdio.kill('SIGTERM');
        cleanupWindowsProcesses();
    });
}

function cleanupWindowsProcesses() {
    // Try to kill any lingering VS Code processes on Windows
    try {
        console.log('🧹 Cleaning up Windows processes...');
        require('child_process').execSync(
            'taskkill /F /IM Code.exe /T 2>nul',
            { shell: 'cmd.exe', stdio: 'ignore' }
        );
    } catch {
        // Ignore - processes might not exist
    }
}

// Show usage if --help is passed
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
Usage: node scripts/run-wdio-windows.js [options]

Options:
  --spec <path>    Run specific test file(s)
  --help, -h       Show this help message

Examples:
  node scripts/run-wdio-windows.js
  node scripts/run-wdio-windows.js --spec test/e2e/extension-activation.test.ts
  npm run test:e2e:windows
    `);
    process.exit(0);
}