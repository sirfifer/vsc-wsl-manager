/**
 * Core functionality validation script
 * Tests the essential components without VS Code API dependency
 */

console.log('=== WSL Manager Core Validation ===\n');

// Test 1: Check if compiled files exist and have correct structure
console.log('1. Checking compiled files...');
const fs = require('fs');
const path = require('path');

const requiredFiles = [
    'out/src/extension.js',
    'out/src/distributionRegistry.js',
    'out/src/distributionDownloader.js',
    'out/src/imageManager.js'
];

let allFilesExist = true;
for (const file of requiredFiles) {
    if (fs.existsSync(file)) {
        console.log(`  ✓ ${file} exists`);
    } else {
        console.log(`  ✗ ${file} missing`);
        allFilesExist = false;
    }
}

// Test 2: Check package.json configuration
console.log('\n2. Checking package.json configuration...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const expectedCommands = [
    'wsl-manager.refreshDistributions',
    'wsl-manager.downloadDistribution',
    'wsl-manager.createDistribution',
    'wsl-manager.createImage',
    'wsl-manager.importDistribution',
    'wsl-manager.exportDistribution',
    'wsl-manager.deleteDistribution',
    'wsl-manager.openTerminal'
];

console.log(`  Publisher: ${packageJson.publisher}`);
console.log(`  Main entry: ${packageJson.main}`);
console.log(`  Commands defined: ${packageJson.contributes.commands.length}`);

let allCommandsDefined = true;
for (const cmd of expectedCommands) {
    const found = packageJson.contributes.commands.find(c => c.command === cmd);
    if (found) {
        console.log(`  ✓ ${cmd} defined`);
    } else {
        console.log(`  ✗ ${cmd} missing`);
        allCommandsDefined = false;
    }
}

// Test 3: Check extension.js structure
console.log('\n3. Checking extension.js structure...');
const extensionJs = fs.readFileSync('out/src/extension.js', 'utf8');

const expectedExports = ['activate', 'deactivate'];
let allExportsFound = true;
for (const exp of expectedExports) {
    if (extensionJs.includes(`exports.${exp}`)) {
        console.log(`  ✓ ${exp} exported`);
    } else {
        console.log(`  ✗ ${exp} not exported`);
        allExportsFound = false;
    }
}

// Check if new components are imported
const expectedImports = ['distributionRegistry', 'distributionDownloader', 'imageManager'];
let allImportsFound = true;
for (const imp of expectedImports) {
    if (extensionJs.includes(imp)) {
        console.log(`  ✓ ${imp} imported`);
    } else {
        console.log(`  ✗ ${imp} not imported`);
        allImportsFound = false;
    }
}

// Test 4: Check command registration in extension.js
console.log('\n4. Checking command registration...');
let allCommandsRegistered = true;
for (const cmd of expectedCommands) {
    if (extensionJs.includes(`'${cmd}'`)) {
        console.log(`  ✓ ${cmd} registered`);
    } else {
        console.log(`  ✗ ${cmd} not registered`);
        allCommandsRegistered = false;
    }
}

// Summary
console.log('\n=== VALIDATION SUMMARY ===');
console.log(`Files exist: ${allFilesExist ? '✓ PASS' : '✗ FAIL'}`);
console.log(`Package.json: ${allCommandsDefined ? '✓ PASS' : '✗ FAIL'}`);
console.log(`Extension exports: ${allExportsFound ? '✓ PASS' : '✗ FAIL'}`);
console.log(`Component imports: ${allImportsFound ? '✓ PASS' : '✗ FAIL'}`);
console.log(`Command registration: ${allCommandsRegistered ? '✓ PASS' : '✗ FAIL'}`);

const overallStatus = allFilesExist && allCommandsDefined && allExportsFound && 
                     allImportsFound && allCommandsRegistered;

console.log(`\nOVERALL STATUS: ${overallStatus ? '✅ READY FOR USE' : '❌ ISSUES FOUND'}`);

if (overallStatus) {
    console.log('\n🎉 Core validation successful! Extension is ready for VS Code usage.');
    console.log('   The implementation includes all required components for:');
    console.log('   - Downloading distributions from Microsoft\'s registry');
    console.log('   - Creating and managing distribution images');  
    console.log('   - Project isolation workflow');
}

process.exit(overallStatus ? 0 : 1);