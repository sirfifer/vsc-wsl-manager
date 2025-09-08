#!/usr/bin/env node

/**
 * Test that the extension can be loaded without errors
 */

const path = require('path');

console.log('🧪 Testing extension activation...\n');

try {
    // Load the extension module
    const extensionPath = path.join(__dirname, '..', 'out/src/extension.js');
    const extension = require(extensionPath);
    
    // Check exports
    if (typeof extension.activate === 'function') {
        console.log('✅ Extension has activate function');
    } else {
        console.log('❌ Extension missing activate function');
        process.exit(1);
    }
    
    if (typeof extension.deactivate === 'function') {
        console.log('✅ Extension has deactivate function');
    } else {
        console.log('❌ Extension missing deactivate function');
        process.exit(1);
    }
    
    // Try to load all managers
    console.log('\n📦 Loading managers...');
    const managers = [
        '../out/src/distros/DistroManager.js',
        '../out/src/distros/DistroDownloader.js',
        '../out/src/images/WSLImageManager.js',
        '../out/src/manifest/ManifestManager.js',
        '../out/src/views/DistroTreeProvider.js',
        '../out/src/views/ImageTreeProvider.js'
    ];
    
    for (const manager of managers) {
        try {
            require(path.join(__dirname, manager));
            console.log(`✅ Loaded ${path.basename(manager)}`);
        } catch (error) {
            console.log(`❌ Failed to load ${path.basename(manager)}: ${error.message}`);
            process.exit(1);
        }
    }
    
    console.log('\n✅ Extension can be activated successfully!');
    console.log('\n🎯 Ready for VS Code testing:');
    console.log('   1. Open VS Code in this directory');
    console.log('   2. Press F5 to launch Extension Development Host');
    console.log('   3. Look for "WSL Manager" in the Activity Bar');
    console.log('   4. Check Debug Console for "WSL Manager extension is now active!"');
    
} catch (error) {
    console.log(`❌ Failed to load extension: ${error.message}`);
    console.log('\nStack trace:');
    console.log(error.stack);
    process.exit(1);
}