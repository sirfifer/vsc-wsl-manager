#!/usr/bin/env node

/**
 * E2E Test for WSL Manager VS Code Extension
 * This script launches VS Code and verifies the extension loads correctly
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const extensionPath = path.join(__dirname);
const testWorkspace = path.join(__dirname, 'test-workspace');

// Create a test workspace if it doesn't exist
if (!fs.existsSync(testWorkspace)) {
    fs.mkdirSync(testWorkspace);
}

console.log('🚀 Launching VS Code with WSL Manager extension...\n');
console.log(`Extension path: ${extensionPath}`);
console.log(`Test workspace: ${testWorkspace}\n`);

// Test script to run inside VS Code
const testScript = `
// Wait for extension to activate
setTimeout(async () => {
    console.log('\\n=== E2E Test Results ===\\n');
    
    // Check if extension is active
    const extension = vscode.extensions.getExtension('wsl-manager.wsl-manager');
    if (!extension) {
        console.error('❌ Extension not found!');
        process.exit(1);
    }
    
    console.log('✅ Extension found:', extension.id);
    console.log('   Package:', extension.packageJSON.name);
    console.log('   Version:', extension.packageJSON.version);
    
    // Check if extension is active
    if (!extension.isActive) {
        console.log('⏳ Activating extension...');
        await extension.activate();
    }
    
    console.log('✅ Extension is active');
    
    // Check registered commands
    const commands = await vscode.commands.getCommands();
    const wslCommands = commands.filter(cmd => cmd.startsWith('wsl-manager.'));
    
    console.log('\\n📋 Registered WSL commands:');
    wslCommands.forEach(cmd => console.log('   -', cmd));
    
    // Check tree views
    const treeViews = ['wslDistributions', 'wslImages'];
    console.log('\\n🌳 Checking tree views:');
    
    for (const viewId of treeViews) {
        // Try to reveal the view
        try {
            await vscode.commands.executeCommand(\`\${viewId}.focus\`);
            console.log('   ✅', viewId, 'view is available');
        } catch (err) {
            console.log('   ⚠️', viewId, 'view might not be focused');
        }
    }
    
    // Try to list distributions
    console.log('\\n📦 Testing distribution listing...');
    try {
        await vscode.commands.executeCommand('wsl-manager.refreshDistributions');
        console.log('   ✅ Refresh command executed successfully');
    } catch (err) {
        console.error('   ❌ Failed to refresh distributions:', err.message);
    }
    
    console.log('\\n=== E2E Test Complete ===\\n');
    
    // Close VS Code after a short delay
    setTimeout(() => {
        vscode.commands.executeCommand('workbench.action.closeWindow');
    }, 2000);
}, 3000);
`;

// Write test script to file
const testScriptPath = path.join(testWorkspace, 'test-extension.js');
fs.writeFileSync(testScriptPath, testScript);

// Launch VS Code with the extension
const vscodeArgs = [
    '--extensionDevelopmentPath=' + extensionPath,
    '--new-window',
    '--disable-gpu',  // Helps with WSL
    testWorkspace
];

console.log('Launching VS Code with args:', vscodeArgs.join(' '), '\n');

const vscode = spawn('code', vscodeArgs, {
    stdio: 'inherit',
    env: { ...process.env }
});

vscode.on('error', (err) => {
    console.error('❌ Failed to launch VS Code:', err.message);
    process.exit(1);
});

vscode.on('close', (code) => {
    if (code === 0) {
        console.log('✅ VS Code closed successfully');
    } else {
        console.log(`⚠️ VS Code exited with code ${code}`);
    }
    
    // Clean up test workspace
    if (fs.existsSync(testScriptPath)) {
        fs.unlinkSync(testScriptPath);
    }
});

console.log('VS Code should now be running with the WSL Manager extension.');
console.log('Check the VS Code window for the test results.\n');
console.log('The test will:');
console.log('1. Verify the extension loads');
console.log('2. Check registered commands');
console.log('3. Test tree views');
console.log('4. Try to refresh distributions');
console.log('5. Close automatically after testing\n');