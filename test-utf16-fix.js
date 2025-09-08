#!/usr/bin/env node

// Test the UTF-16 fix for WSL output parsing
const { spawn } = require('child_process');

async function testWSLParsing() {
    return new Promise((resolve, reject) => {
        const child = spawn('wsl.exe', ['--list', '--all', '--verbose']);
        
        let stdout = '';
        
        child.stdout?.on('data', (data) => {
            const buffer = Buffer.from(data);
            let decoded;
            
            // Check if this looks like UTF-16 (has null bytes between characters)
            if (buffer.includes(0x00) && buffer[1] === 0x00) {
                // UTF-16LE encoding detected
                decoded = buffer.toString('utf16le');
                console.log('Detected UTF-16LE encoding');
            } else {
                decoded = buffer.toString('utf8');
                console.log('Using UTF-8 encoding');
            }
            
            stdout += decoded;
        });
        
        child.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`WSL command failed with code ${code}`));
                return;
            }
            
            console.log('\nRaw output (properly decoded):');
            console.log('================================');
            console.log(stdout);
            console.log('================================\n');
            
            // Parse the output
            const lines = stdout.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
            const distributions = [];
            
            // Skip header line
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                if (!line) continue;
                
                const isDefault = line.startsWith('*');
                const cleanLine = line.replace('*', '').trim();
                
                // Split by multiple spaces (WSL uses spacing for columns)
                const parts = cleanLine.split(/\s{2,}/);
                
                if (parts.length >= 3) {
                    const distro = {
                        name: parts[0].trim(),
                        state: parts[1].trim(),
                        version: parts[2].trim(),
                        default: isDefault
                    };
                    distributions.push(distro);
                    console.log(`Parsed: ${distro.name} (${distro.state}, WSL${distro.version})${distro.default ? ' [DEFAULT]' : ''}`);
                }
            }
            
            console.log(`\nTotal distributions found: ${distributions.length}`);
            resolve(distributions);
        });
        
        child.on('error', reject);
    });
}

testWSLParsing()
    .then(distributions => {
        console.log('\n✅ Success! Found distributions:');
        distributions.forEach((d, i) => {
            console.log(`  ${i + 1}. ${d.name}`);
        });
    })
    .catch(err => {
        console.error('❌ Error:', err.message);
        process.exit(1);
    });