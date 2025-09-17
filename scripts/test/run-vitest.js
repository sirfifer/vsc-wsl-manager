#!/usr/bin/env node

/**
 * Direct Vitest runner to bypass npm/Jest conflicts
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('Running Vitest tests...');

// Try to run Vitest directly
const vitestPath = path.join(__dirname, 'node_modules', '.bin', 'vitest');
const args = process.argv.slice(2);

// Check if Vitest exists
const fs = require('fs');
if (!fs.existsSync(vitestPath)) {
    console.error('Vitest not found. Please install it manually:');
    console.error('npm install -D vitest@latest @vitest/ui c8');
    process.exit(1);
}

// Run Vitest
const vitest = spawn(vitestPath, args, {
    stdio: 'inherit',
    shell: true
});

vitest.on('close', (code) => {
    process.exit(code);
});

vitest.on('error', (err) => {
    console.error('Failed to start Vitest:', err);
    process.exit(1);
});