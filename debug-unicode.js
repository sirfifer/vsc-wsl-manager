#!/usr/bin/env node

// Debug script to test Unicode parsing of WSL output
const { execSync } = require('child_process');

console.log('Testing WSL output parsing...\n');

// Get raw WSL output
const rawOutput = execSync('wsl.exe --list --all --verbose', { encoding: 'utf8' });
console.log('Raw output from WSL:');
console.log('-------------------');
console.log(rawOutput);
console.log('-------------------\n');

// Check character codes
const firstLine = rawOutput.split('\n')[2]; // Get first distribution line
if (firstLine) {
    console.log('First distribution line character codes:');
    for (let i = 0; i < Math.min(50, firstLine.length); i++) {
        const char = firstLine[i];
        const code = firstLine.charCodeAt(i);
        console.log(`[${i}]: '${char}' = ${code} (0x${code.toString(16)})`);
    }
    console.log('\n');
}

// Test the parsing logic
function parseDistributions(output) {
    const lines = output.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    const distributions = [];
    
    // Skip header line
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        
        console.log(`Processing line ${i}: "${line}"`);
        
        // Parse WSL output format
        const isDefault = line.startsWith('*');
        let cleanLine = line.replace('*', '').trim();
        
        console.log(`  - Is default: ${isDefault}`);
        console.log(`  - Clean line: "${cleanLine}"`);
        
        // Handle Unicode spacing issue
        if (cleanLine.includes(' ') && cleanLine.match(/^(\w\s)+/)) {
            console.log('  - Unicode spacing detected, fixing...');
            cleanLine = cleanLine.replace(/(\S)\s(?=\S)/g, '$1');
            console.log(`  - Fixed line: "${cleanLine}"`);
        }
        
        const parts = cleanLine.split(/\s+/);
        console.log(`  - Parts: ${JSON.stringify(parts)}`);
        
        if (parts.length >= 3) {
            const distro = {
                name: parts[0],
                state: parts[1],
                version: parts[2],
                default: isDefault
            };
            distributions.push(distro);
            console.log(`  - Parsed distribution: ${JSON.stringify(distro)}`);
        }
        console.log('');
    }
    
    return distributions;
}

console.log('Parsing distributions...\n');
const distributions = parseDistributions(rawOutput);

console.log('\nFinal parsed distributions:');
console.log('==========================');
distributions.forEach((d, i) => {
    console.log(`${i + 1}. ${d.name} (${d.state}, WSL${d.version})${d.default ? ' [DEFAULT]' : ''}`);
});