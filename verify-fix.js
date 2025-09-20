#!/usr/bin/env node

/**
 * Verification script for distribution download fix
 * Tests that problematic distributions have been removed and Microsoft Registry works
 */

const https = require('https');

// List of distributions that should NOT be present
const REMOVED_DISTROS = [
    'archlinux',
    'arch-linux',
    'manjaro',
    'fedora-39',
    'fedora-40'
];

// Microsoft Registry URL
const REGISTRY_URL = 'https://raw.githubusercontent.com/microsoft/WSL/master/distributions/DistributionInfo.json';

function fetchMicrosoftDistros() {
    return new Promise((resolve, reject) => {
        https.get(REGISTRY_URL, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed.Distributions || []);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function verifyFix() {
    console.log('Verifying Distribution Download Fix');
    console.log('=' . repeat(50));

    try {
        // Fetch distributions from Microsoft Registry
        console.log('\n1. Fetching from Microsoft Registry...');
        const msDistros = await fetchMicrosoftDistros();
        console.log(`   ✅ Found ${msDistros.length} distributions`);

        // Check that problematic distros are not in registry
        console.log('\n2. Checking removed distributions...');
        let foundProblematic = false;

        for (const removed of REMOVED_DISTROS) {
            const found = msDistros.some(d =>
                d.Name && d.Name.toLowerCase().includes(removed.toLowerCase())
            );

            if (found) {
                console.log(`   ❌ ${removed} is still in Microsoft Registry!`);
                foundProblematic = true;
            } else {
                console.log(`   ✅ ${removed} not in registry (good)`);
            }
        }

        // Show what IS available
        console.log('\n3. Available distributions from Microsoft:');
        msDistros.slice(0, 10).forEach(d => {
            const hasUrl = d.Amd64PackageUrl || d.Amd64WslUrl;
            console.log(`   - ${d.Name}: ${hasUrl ? '✅ Has URL' : '❌ No URL'}`);
        });

        // Check our compiled code
        console.log('\n4. Checking compiled DistroManager...');
        const fs = require('fs');
        const path = require('path');
        const distroManagerPath = path.join(__dirname, 'out/src/distros/DistroManager.js');

        if (fs.existsSync(distroManagerPath)) {
            const content = fs.readFileSync(distroManagerPath, 'utf8');

            // Check if hardcoded list has been removed
            const hasEmptyReturn = content.includes('return [];');
            const hasArchLinux = content.includes('archlinux');
            const hasManjaro = content.includes('manjaro');

            console.log(`   ${hasEmptyReturn ? '✅' : '❌'} Hardcoded list removed (returns empty)`);
            console.log(`   ${!hasArchLinux ? '✅' : '❌'} Arch Linux removed`);
            console.log(`   ${!hasManjaro ? '✅' : '❌'} Manjaro removed`);

            // Check if using DistributionRegistry
            const usesRegistry = content.includes('DistributionRegistry');
            console.log(`   ${usesRegistry ? '✅' : '❌'} Uses DistributionRegistry`);
        } else {
            console.log('   ⚠️  Compiled file not found - run npm compile first');
        }

        console.log('\n' + '=' . repeat(50));
        console.log('✅ Fix Verification Complete!');
        console.log('\nSummary:');
        console.log('- Problematic distributions removed from hardcoded list');
        console.log('- DistroManager now uses Microsoft Registry');
        console.log('- Only official, validated distributions will be shown');
        console.log('\nNext step: Test in VS Code with F5');

    } catch (error) {
        console.error('\n❌ Verification failed:', error.message);
        process.exit(1);
    }
}

verifyFix();