/**
 * Live Extension Test Script
 * Tests the extension in a real VS Code environment
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🧪 Testing VSC WSL Manager Extension in VS Code...\n');

// Path to extension directory
const extensionPath = path.resolve(__dirname, '..');

// Check if compiled
if (!fs.existsSync(path.join(extensionPath, 'out', 'extension.js'))) {
    console.error('❌ Extension not compiled. Run "npm run compile" first.');
    process.exit(1);
}

console.log('📦 Extension path:', extensionPath);
console.log('✅ Extension is compiled\n');

// Create a test workspace
const testWorkspacePath = path.join(extensionPath, '.test-workspace');
if (!fs.existsSync(testWorkspacePath)) {
    fs.mkdirSync(testWorkspacePath);
}

// Create a test file to open
const testFilePath = path.join(testWorkspacePath, 'test.md');
fs.writeFileSync(testFilePath, '# WSL Manager Extension Test\n\nThis workspace is for testing the extension.');

console.log('📁 Test workspace:', testWorkspacePath);
console.log('📝 Test file:', testFilePath);
console.log('\n🚀 Launching VS Code with extension...\n');

// Launch VS Code with the extension
const args = [
    '--new-window',
    '--disable-extensions',  // Disable other extensions
    '--extensionDevelopmentPath=' + extensionPath,
    testFilePath
];

console.log('Command: code', args.join(' '));
console.log('\n' + '='.repeat(50));
console.log('MANUAL TESTING CHECKLIST:');
console.log('='.repeat(50));
console.log('1. ✓ Check console (Ctrl+Shift+`) for errors');
console.log('2. ✓ Look for "WSL Manager extension is now active!"');
console.log('3. ✗ Check for any permission errors');
console.log('4. ✓ Open terminal dropdown (Terminal > New Terminal)');
console.log('5. ✓ Check if WSL profiles appear in dropdown');
console.log('6. ✓ Try creating a terminal from a WSL profile');
console.log('7. ✓ Check the WSL Manager view in activity bar');
console.log('8. ✓ Run command: "WSL: Refresh Distributions"');
console.log('='.repeat(50));
console.log('\nStarting VS Code...');

const vscode = spawn('code', args, {
    stdio: 'inherit',
    shell: true
});

vscode.on('error', (err) => {
    console.error('❌ Failed to start VS Code:', err);
    process.exit(1);
});

vscode.on('close', (code) => {
    if (code === 0) {
        console.log('\n✅ VS Code closed normally');
    } else {
        console.log(`\n⚠️ VS Code exited with code ${code}`);
    }
});

// Also output what to look for
setTimeout(() => {
    console.log('\n📋 What to check in VS Code:');
    console.log('1. Open Developer Tools: Help > Toggle Developer Tools');
    console.log('2. Check Console tab for any errors');
    console.log('3. Look for permission errors specifically');
    console.log('4. Terminal > New Terminal > Click dropdown arrow');
    console.log('5. Look for "WSL: <distribution>" profiles');
    console.log('\nIf you see permission errors, the fix didn\'t work.');
    console.log('If WSL profiles appear, the fix is working!');
}, 3000);