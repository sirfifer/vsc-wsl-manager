#!/usr/bin/env node

/**
 * Final test that all Ubuntu URLs are correct
 */

const https = require('https');

console.log('==========================================');
console.log('  Final Ubuntu URL Verification');
console.log('==========================================\n');

const urls = [
    {
        name: 'Ubuntu 24.04',
        url: 'https://releases.ubuntu.com/24.04.3/ubuntu-24.04.3-wsl-amd64.wsl'
    },
    {
        name: 'Ubuntu 22.04',
        url: 'https://cloud-images.ubuntu.com/wsl/jammy/current/ubuntu-jammy-wsl-amd64-ubuntu22.04lts.rootfs.tar.gz'
    },
    {
        name: 'Ubuntu 20.04',
        url: 'https://cloud-images.ubuntu.com/releases/focal/release/ubuntu-20.04.6-server-cloudimg-amd64-wsl.rootfs.tar.gz'
    }
];

let tested = 0;
let passed = 0;

function testUrl(item) {
    return new Promise((resolve) => {
        console.log(`Testing ${item.name}...`);
        https.request(item.url, { method: 'HEAD' }, (res) => {
            tested++;
            if (res.statusCode === 200) {
                console.log(`  ✅ ${item.name}: Available (HTTP ${res.statusCode})`);
                const size = res.headers['content-length'];
                if (size) {
                    const sizeMB = Math.round(parseInt(size) / 1024 / 1024);
                    console.log(`     Size: ${sizeMB} MB`);
                }
                passed++;
            } else {
                console.log(`  ❌ ${item.name}: Failed (HTTP ${res.statusCode})`);
            }
            resolve();
        }).on('error', (err) => {
            tested++;
            console.log(`  ❌ ${item.name}: Network error - ${err.message}`);
            resolve();
        }).end();
    });
}

async function runTests() {
    for (const item of urls) {
        await testUrl(item);
    }

    console.log('\n==========================================');
    console.log('              RESULTS');
    console.log('==========================================');
    console.log(`Tested: ${tested}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${tested - passed}`);

    if (passed === tested) {
        console.log('\n✅ All Ubuntu URLs are working correctly!');
        console.log('The download issue for Ubuntu-24.04 is now FIXED!');
    } else {
        console.log('\n⚠️ Some URLs are still not working.');
        console.log('Please check the failed URLs above.');
    }
}

runTests().catch(console.error);