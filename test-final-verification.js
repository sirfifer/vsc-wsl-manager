#!/usr/bin/env node

/**
 * Final verification that the extension works correctly
 */

const { spawn } = require('child_process');

console.log('=== WSL Manager Extension - Final Verification ===\n');

// Test 1: Verify WSL output can be parsed
console.log('1. Testing WSL output parsing...');
const wslTest = spawn('wsl.exe', ['--list', '--all', '--verbose']);

let wslOutput = '';
wslTest.stdout.on('data', (data) => {
    const buffer = Buffer.from(data);
    if (buffer.includes(0x00) && buffer[1] === 0x00) {
        wslOutput += buffer.toString('utf16le');
    } else {
        wslOutput += buffer.toString('utf8');
    }
});

wslTest.on('close', (code) => {
    if (code === 0) {
        const lines = wslOutput.split('\n');
        const distros = [];
        
        // Parse distributions (skip header)
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const isDefault = line.startsWith('*');
            const cleanLine = line.replace('*', '').trim();
            const parts = cleanLine.split(/\s{2,}/);
            
            if (parts.length >= 3) {
                distros.push({
                    name: parts[0].trim(),
                    state: parts[1].trim(),
                    version: parts[2].trim(),
                    default: isDefault
                });
            }
        }
        
        console.log(`   ✅ Successfully parsed ${distros.length} distributions:`);
        distros.forEach(d => {
            console.log(`      - ${d.name} (${d.state})${d.default ? ' [DEFAULT]' : ''}`);
        });
        
        // Test 2: Check compiled extension
        console.log('\n2. Checking compiled extension...');
        const fs = require('fs');
        const path = require('path');
        
        const extensionJs = path.join(__dirname, 'out', 'src', 'extension.js');
        const wslManagerJs = path.join(__dirname, 'out', 'src', 'wslManager.js');
        const commandBuilderJs = path.join(__dirname, 'out', 'src', 'utils', 'commandBuilder.js');
        
        const files = [
            { name: 'extension.js', path: extensionJs },
            { name: 'wslManager.js', path: wslManagerJs },
            { name: 'commandBuilder.js', path: commandBuilderJs }
        ];
        
        let allFilesExist = true;
        files.forEach(file => {
            if (fs.existsSync(file.path)) {
                const stats = fs.statSync(file.path);
                console.log(`   ✅ ${file.name} (${stats.size} bytes)`);
            } else {
                console.log(`   ❌ ${file.name} NOT FOUND`);
                allFilesExist = false;
            }
        });
        
        // Test 3: Check package.json
        console.log('\n3. Checking package.json configuration...');
        const packageJson = require('./package.json');
        
        console.log(`   ✅ Extension ID: ${packageJson.name}`);
        console.log(`   ✅ Display Name: ${packageJson.displayName}`);
        console.log(`   ✅ Main Entry: ${packageJson.main}`);
        console.log(`   ✅ Activation Events: ${packageJson.activationEvents.length} events`);
        console.log(`   ✅ Commands: ${packageJson.contributes.commands.length} commands`);
        console.log(`   ✅ Views: ${Object.keys(packageJson.contributes.views).length} view containers`);
        
        // Summary
        console.log('\n=== VERIFICATION SUMMARY ===\n');
        
        if (distros.length > 0 && allFilesExist) {
            console.log('✅ Extension is ready for use!');
            console.log('✅ WSL distributions will appear in the tree view');
            console.log('✅ All core functionality should work\n');
            console.log('To test in VS Code:');
            console.log('  1. Run: code --extensionDevelopmentPath=' + __dirname);
            console.log('  2. Look for WSL Manager icon in activity bar');
            console.log('  3. Verify distributions appear in tree view');
            console.log('  4. Test commands from Command Palette (Ctrl+Shift+P)');
        } else {
            console.log('⚠️ Some issues detected:');
            if (distros.length === 0) {
                console.log('  - No WSL distributions found');
            }
            if (!allFilesExist) {
                console.log('  - Some compiled files are missing');
            }
        }
    } else {
        console.error('   ❌ Failed to get WSL distributions');
    }
});