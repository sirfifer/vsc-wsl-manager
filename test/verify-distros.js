#!/usr/bin/env node

/**
 * Verify Distribution Registry
 * Tests that all distributions are available in the catalog
 */

const { DistroManager } = require('../out/src/distros/DistroManager');

async function verifyDistros() {
    console.log('\n📦 Verifying Distribution Registry\n');
    console.log('=' .repeat(60));
    
    const manager = new DistroManager();
    const distros = await manager.listDistros();
    
    console.log(`\nTotal distributions available: ${distros.length}\n`);
    
    // Group by category
    const categories = {
        'Ubuntu': [],
        'Debian': [],
        'Enterprise': [],
        'Fedora': [],
        'Arch': [],
        'openSUSE': [],
        'Security': [],
        'Alpine': [],
        'Developer': [],
        'Other': []
    };
    
    distros.forEach(distro => {
        let category = 'Other';
        
        if (distro.name.includes('ubuntu')) category = 'Ubuntu';
        else if (distro.name.includes('debian')) category = 'Debian';
        else if (distro.name.includes('rocky') || distro.name.includes('alma') || distro.name.includes('oracle')) category = 'Enterprise';
        else if (distro.name.includes('fedora')) category = 'Fedora';
        else if (distro.name.includes('arch') || distro.name.includes('manjaro')) category = 'Arch';
        else if (distro.name.includes('opensuse')) category = 'openSUSE';
        else if (distro.name.includes('kali') || distro.name.includes('parrot')) category = 'Security';
        else if (distro.name.includes('alpine')) category = 'Alpine';
        else if (distro.name.includes('centos') || distro.name.includes('void') || distro.name.includes('gentoo') || distro.name.includes('clear')) category = 'Developer';
        
        categories[category].push(distro);
    });
    
    // Display by category
    for (const [category, distroList] of Object.entries(categories)) {
        if (distroList.length > 0) {
            console.log(`\n📁 ${category} (${distroList.length}):`);
            console.log('-'.repeat(40));
            
            distroList.forEach(distro => {
                const status = distro.available ? '✅' : '⬇️';
                const size = Math.round((distro.size || 0) / (1024 * 1024)) + ' MB';
                console.log(`  ${status} ${distro.displayName} (${distro.version}) - ${size}`);
            });
        }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    
    const downloaded = distros.filter(d => d.available).length;
    const notDownloaded = distros.filter(d => !d.available).length;
    
    console.log(`Total Distributions: ${distros.length}`);
    console.log(`Downloaded: ${downloaded}`);
    console.log(`Not Downloaded: ${notDownloaded}`);
    
    // Check for expected distros
    const expectedDistros = [
        'ubuntu-24.04', 'ubuntu-22.04', 'ubuntu-20.04',
        'debian-12', 'debian-11',
        'archlinux', 'manjaro',
        'fedora-39', 'fedora-40',
        'alpine-3.19', 'alpine-3.20',
        'rocky-9', 'almalinux-9',
        'kali-linux',
        'opensuse-leap-15.5', 'opensuse-tumbleweed'
    ];
    
    const missing = expectedDistros.filter(name => !distros.find(d => d.name === name));
    
    if (missing.length > 0) {
        console.log(`\n⚠️  Missing expected distros: ${missing.join(', ')}`);
    } else {
        console.log('\n✅ All expected distributions are present in the catalog');
    }
    
    console.log('='.repeat(60) + '\n');
}

verifyDistros().catch(console.error);