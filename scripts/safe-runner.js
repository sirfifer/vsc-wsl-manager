#!/usr/bin/env node

/**
 * Safe Command Runner for VSC WSL Manager
 * This script only allows pre-approved npm commands to run
 * Used for autonomous iteration during development
 */

const { spawn } = require('child_process');
const path = require('path');

// Define allowed npm commands
const ALLOWED_COMMANDS = [
    'compile',
    'quick-test',
    'automate',
    'test',
    'test:unit',
    'test:integration',
    'test:vscode',
    'lint',
    'lint:fix',
    'watch',
    'dev',
    'diagnostics',
    'clean',
    'clean:logs'
];

// Define allowed direct node scripts
const ALLOWED_SCRIPTS = [
    'out/scripts/automate-testing.js',
    'out/scripts/quick-test.js',
    'scripts/diagnostics.js',
    'scripts/stream-logs.js'
];

function printUsage() {
    console.log('Usage: node safe-runner.js <command> [args...]');
    console.log('\nAllowed npm commands:');
    ALLOWED_COMMANDS.forEach(cmd => console.log(`  - npm run ${cmd}`));
    console.log('\nAllowed scripts:');
    ALLOWED_SCRIPTS.forEach(script => console.log(`  - node ${script}`));
}

function runCommand(command, args = []) {
    return new Promise((resolve, reject) => {
        console.log(`✅ Running: ${command} ${args.join(' ')}`);
        
        const child = spawn(command, args, {
            stdio: 'inherit',
            shell: true,
            cwd: path.resolve(__dirname, '..')
        });
        
        child.on('close', (code) => {
            if (code === 0) {
                console.log('✅ Command completed successfully');
                resolve(code);
            } else {
                console.log(`❌ Command failed with exit code: ${code}`);
                reject(code);
            }
        });
        
        child.on('error', (err) => {
            console.error('❌ Command error:', err);
            reject(err);
        });
    });
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        printUsage();
        process.exit(1);
    }
    
    const command = args[0];
    const commandArgs = args.slice(1);
    
    try {
        // Check if it's an npm command
        if (command === 'npm' && args[1] === 'run') {
            const npmCommand = args[2];
            if (ALLOWED_COMMANDS.includes(npmCommand)) {
                await runCommand('npm', ['run', npmCommand, ...commandArgs.slice(2)]);
                process.exit(0);
            } else {
                console.error(`❌ npm command not allowed: ${npmCommand}`);
                printUsage();
                process.exit(1);
            }
        }
        
        // Check if it's a direct npm run command
        if (ALLOWED_COMMANDS.includes(command)) {
            await runCommand('npm', ['run', command, ...commandArgs]);
            process.exit(0);
        }
        
        // Check if it's a node script
        if (command === 'node' && args[1]) {
            const script = args[1];
            if (ALLOWED_SCRIPTS.some(allowed => script.endsWith(allowed))) {
                await runCommand('node', [script, ...commandArgs.slice(1)]);
                process.exit(0);
            } else {
                console.error(`❌ Script not allowed: ${script}`);
                printUsage();
                process.exit(1);
            }
        }
        
        // Command not recognized or not allowed
        console.error(`❌ Command not allowed: ${command}`);
        printUsage();
        process.exit(1);
        
    } catch (error) {
        console.error('❌ Execution failed:', error);
        process.exit(1);
    }
}

// Run the main function
main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});