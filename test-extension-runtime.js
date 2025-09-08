#!/usr/bin/env node

// Test script to verify the extension works at runtime
const path = require('path');

console.log('Testing WSL Manager Extension Runtime...\n');

// Load the compiled extension
const extensionPath = path.join(__dirname, 'out', 'src', 'extension.js');
const wslManagerPath = path.join(__dirname, 'out', 'src', 'wslManager.js');
const commandBuilderPath = path.join(__dirname, 'out', 'src', 'utils', 'commandBuilder.js');

try {
    console.log('Loading modules...');
    const { WSLManager } = require(wslManagerPath);
    const { CommandBuilder } = require(commandBuilderPath);
    
    console.log('✅ Modules loaded successfully\n');
    
    // Test WSL Manager
    const wslManager = new WSLManager();
    
    console.log('Testing listDistributions()...');
    wslManager.listDistributions()
        .then(distributions => {
            console.log(`✅ Found ${distributions.length} distributions:\n`);
            distributions.forEach((d, i) => {
                console.log(`  ${i + 1}. ${d.name}`);
                console.log(`     State: ${d.state}`);
                console.log(`     Version: WSL${d.version}`);
                console.log(`     Default: ${d.default ? 'Yes' : 'No'}\n`);
            });
            
            if (distributions.length === 0) {
                console.log('⚠️  No distributions found - this might be an issue!');
            } else {
                console.log('✅ Extension should display these distributions in the tree view!');
            }
        })
        .catch(err => {
            console.error('❌ Error listing distributions:', err.message);
            console.error('Stack:', err.stack);
            process.exit(1);
        });
        
} catch (err) {
    console.error('❌ Failed to load extension modules:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
}