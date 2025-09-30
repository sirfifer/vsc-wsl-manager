// Quick test to verify download state preservation
const { EnhancedDistroManager } = require('./out/src/distros/EnhancedDistroManager');
const path = require('path');
const os = require('os');

async function test() {
    console.log('Testing download state preservation after refresh...\n');
    
    const storageDir = path.join(os.homedir(), '.vscode-wsl-manager');
    const distroManager = new EnhancedDistroManager(storageDir);
    
    // Get distros before refresh
    console.log('1. Getting distros before refresh...');
    const distrosBefore = await distroManager.listDistros();
    const availableBefore = distrosBefore.filter(d => d.available);
    console.log(`   Found ${availableBefore.length} available distros:`);
    availableBefore.forEach(d => console.log(`   - ${d.displayName} (${d.name})`));
    
    // Force refresh (simulating what used to wipe the catalog)
    console.log('\n2. Calling refreshDistributions()...');
    await distroManager.refreshDistributions();
    
    // Get distros after refresh
    console.log('\n3. Getting distros after refresh...');
    const distrosAfter = await distroManager.listDistros();
    const availableAfter = distrosAfter.filter(d => d.available);
    console.log(`   Found ${availableAfter.length} available distros:`);
    availableAfter.forEach(d => console.log(`   - ${d.displayName} (${d.name})`));
    
    // Verify preservation
    console.log('\n4. Result:');
    if (availableBefore.length === availableAfter.length) {
        console.log(`   ✅ SUCCESS: Download state preserved (${availableAfter.length} distros)`);
        return 0;
    } else {
        console.log(`   ❌ FAILED: Lost ${availableBefore.length - availableAfter.length} distros`);
        return 1;
    }
}

test().then(code => process.exit(code)).catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
