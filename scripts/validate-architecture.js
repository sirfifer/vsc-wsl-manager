#!/usr/bin/env node

/**
 * Quick validation script for the Two-World Architecture
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating Two-World Architecture Implementation...\n');

const checks = [];

// Check 1: Verify new directories exist
console.log('📁 Checking directory structure...');
const requiredDirs = [
    'src/distros',
    'src/images', 
    'src/manifest',
    'src/views',
    'out/src/distros',
    'out/src/images',
    'out/src/manifest',
    'out/src/views'
];

for (const dir of requiredDirs) {
    const exists = fs.existsSync(path.join(__dirname, '..', dir));
    checks.push({ name: `Directory ${dir}`, pass: exists });
    console.log(`  ${exists ? '✅' : '❌'} ${dir}`);
}

// Check 2: Verify new managers are compiled
console.log('\n📦 Checking compiled managers...');
const requiredFiles = [
    'out/src/distros/DistroManager.js',
    'out/src/distros/DistroDownloader.js',
    'out/src/images/WSLImageManager.js',
    'out/src/manifest/ManifestManager.js',
    'out/src/manifest/ManifestTypes.js',
    'out/src/views/DistroTreeProvider.js',
    'out/src/views/ImageTreeProvider.js'
];

for (const file of requiredFiles) {
    const exists = fs.existsSync(path.join(__dirname, '..', file));
    checks.push({ name: `File ${file}`, pass: exists });
    console.log(`  ${exists ? '✅' : '❌'} ${file}`);
}

// Check 3: Verify extension.js uses new architecture
console.log('\n🔧 Checking extension integration...');
const extensionPath = path.join(__dirname, '..', 'out/src/extension.js');
if (fs.existsSync(extensionPath)) {
    const extensionContent = fs.readFileSync(extensionPath, 'utf8');
    
    const imports = [
        'DistroManager',
        'DistroDownloader', 
        'WSLImageManager',
        'ManifestManager',
        'DistroTreeProvider',
        'ImageTreeProvider'
    ];
    
    for (const imp of imports) {
        const hasImport = extensionContent.includes(imp);
        checks.push({ name: `Extension imports ${imp}`, pass: hasImport });
        console.log(`  ${hasImport ? '✅' : '❌'} Imports ${imp}`);
    }
}

// Check 4: Verify package.json main points to correct file
console.log('\n📋 Checking package.json configuration...');
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const mainCorrect = packageJson.main === './out/src/extension.js';
checks.push({ name: 'package.json main field', pass: mainCorrect });
console.log(`  ${mainCorrect ? '✅' : '❌'} Main: ${packageJson.main}`);

// Check 5: Verify views are registered
const hasDistroView = packageJson.contributes?.views?.['wsl-manager']?.some(v => v.id === 'wslDistributions');
const hasImageView = packageJson.contributes?.views?.['wsl-manager']?.some(v => v.id === 'wslImages');
checks.push({ name: 'Distro view registered', pass: hasDistroView });
checks.push({ name: 'Image view registered', pass: hasImageView });
console.log(`  ${hasDistroView ? '✅' : '❌'} wslDistributions view`);
console.log(`  ${hasImageView ? '✅' : '❌'} wslImages view`);

// Summary
console.log('\n' + '='.repeat(50));
const passed = checks.filter(c => c.pass).length;
const failed = checks.filter(c => !c.pass).length;

if (failed === 0) {
    console.log(`✅ ALL CHECKS PASSED (${passed}/${checks.length})`);
    console.log('\n🎉 Two-World Architecture successfully implemented!');
    console.log('\nNext steps:');
    console.log('1. Press F5 in VS Code to launch the extension');
    console.log('2. Check the WSL Manager views in the Activity Bar');
    console.log('3. Test downloading a distro and creating an image');
    process.exit(0);
} else {
    console.log(`❌ SOME CHECKS FAILED (${passed} passed, ${failed} failed)`);
    console.log('\nFailed checks:');
    checks.filter(c => !c.pass).forEach(c => {
        console.log(`  - ${c.name}`);
    });
    process.exit(1);
}