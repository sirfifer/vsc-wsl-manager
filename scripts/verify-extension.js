/**
 * Automated Extension Verification Script
 * Verifies the extension works without permission errors
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Verifying WSL Manager Extension...\n');

// 1. Check compilation
console.log('1. Checking compilation...');
const outPath = path.join(__dirname, '..', 'out', 'extension.js');
if (!fs.existsSync(outPath)) {
    console.error('   ❌ Extension not compiled');
    process.exit(1);
}
console.log('   ✅ Extension compiled\n');

// 2. Check for old broken implementation
console.log('2. Checking for old broken implementation...');
const oldFile = path.join(__dirname, '..', 'src', 'terminalProfileManager.ts');
if (fs.existsSync(oldFile)) {
    console.error('   ❌ Old terminalProfileManager.ts still exists!');
    process.exit(1);
}
console.log('   ✅ Old implementation removed\n');

// 3. Check new implementation exists
console.log('3. Checking new terminal profile provider...');
const newFile = path.join(__dirname, '..', 'src', 'terminal', 'wslTerminalProfileProvider.ts');
if (!fs.existsSync(newFile)) {
    console.error('   ❌ New wslTerminalProfileProvider.ts not found!');
    process.exit(1);
}

// Read the file and check for correct API usage
const content = fs.readFileSync(newFile, 'utf8');
if (!content.includes('registerTerminalProfileProvider')) {
    console.error('   ❌ Not using registerTerminalProfileProvider API!');
    process.exit(1);
}
if (content.includes('config.update') && content.includes('terminal.integrated')) {
    console.error('   ❌ Still trying to modify terminal.integrated settings!');
    process.exit(1);
}
console.log('   ✅ Using correct Terminal Profile Provider API\n');

// 4. Check extension.ts is updated
console.log('4. Checking extension.ts updates...');
const extensionFile = path.join(__dirname, '..', 'src', 'extension.ts');
const extensionContent = fs.readFileSync(extensionFile, 'utf8');
if (extensionContent.includes('TerminalProfileManager') && !extensionContent.includes('WSLTerminalProfileManager')) {
    console.error('   ❌ Still using old TerminalProfileManager!');
    process.exit(1);
}
if (!extensionContent.includes('WSLTerminalProfileManager')) {
    console.error('   ❌ Not using new WSLTerminalProfileManager!');
    process.exit(1);
}
console.log('   ✅ Extension.ts updated correctly\n');

// 5. Run tests for the new implementation
console.log('5. Running terminal profile provider tests...');
try {
    execSync('npx jest test/unit/terminalProfileProvider.test.ts --no-coverage --silent', {
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe'
    });
    console.log('   ✅ All terminal profile provider tests pass\n');
} catch (error) {
    console.error('   ❌ Terminal profile provider tests failed!');
    console.error(error.stdout?.toString());
    process.exit(1);
}

// 6. Check package.json for proper configuration
console.log('6. Checking package.json configuration...');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
if (!packageJson.activationEvents || packageJson.activationEvents.length === 0) {
    console.error('   ❌ No activation events defined!');
    process.exit(1);
}
if (packageJson.activationEvents.includes('*')) {
    console.error('   ❌ Using "*" activation event (bad for performance)!');
    process.exit(1);
}
console.log('   ✅ Proper activation events configured\n');

// 7. Check for permission error patterns in code
console.log('7. Checking for permission error patterns...');
const srcDir = path.join(__dirname, '..', 'src');
const checkForBadPatterns = (dir) => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory() && !file.startsWith('.')) {
            checkForBadPatterns(filePath);
        } else if (file.endsWith('.ts')) {
            const content = fs.readFileSync(filePath, 'utf8');
            // Remove comments before checking
            let codeWithoutComments = content
                // Remove block comments
                .replace(/\/\*[\s\S]*?\*\//g, '')
                // Remove line comments
                .split('\n')
                .map(line => {
                    const commentIndex = line.indexOf('//');
                    return commentIndex >= 0 ? line.substring(0, commentIndex) : line;
                })
                .join('\n');
            
            // Check for attempts to modify terminal.integrated.profiles
            if (codeWithoutComments.includes('terminal.integrated.profiles') && 
                codeWithoutComments.includes('update') && 
                !filePath.includes('test')) {
                console.error(`   ❌ ${file} tries to modify terminal.integrated.profiles!`);
                process.exit(1);
            }
        }
    }
};
checkForBadPatterns(srcDir);
console.log('   ✅ No permission error patterns found\n');

// Summary
console.log('=' .repeat(50));
console.log('✅ VERIFICATION COMPLETE - Extension should work!');
console.log('=' .repeat(50));
console.log('\nThe extension now:');
console.log('  • Uses registerTerminalProfileProvider API');
console.log('  • Does NOT modify terminal.integrated.profiles');
console.log('  • Should NOT cause permission errors');
console.log('  • Follows VS Code best practices');
console.log('\nTerminal profiles will appear in the dropdown');
console.log('when WSL distributions are detected.\n');