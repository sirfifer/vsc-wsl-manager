#!/usr/bin/env node
/**
 * MCP Connection Checker
 * Verifies that VS Code is running and ready for MCP connection
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { isDebugPortResponding } = require('./port-utils');

// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m',
    cyan: '\x1b[36m'
};

/**
 * Check Chrome DevTools connection
 */
async function checkDevTools(port) {
    return new Promise((resolve) => {
        const url = `http://127.0.0.1:${port}/json/version`;
        
        http.get(url, { timeout: 2000 }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const info = JSON.parse(data);
                    resolve({ success: true, info });
                } catch (e) {
                    resolve({ success: false, error: 'Invalid response' });
                }
            });
        }).on('error', (err) => {
            resolve({ success: false, error: err.message });
        }).on('timeout', () => {
            resolve({ success: false, error: 'Connection timeout' });
        });
    });
}

/**
 * Get list of available pages/targets
 */
async function getTargets(port) {
    return new Promise((resolve) => {
        const url = `http://127.0.0.1:${port}/json/list`;
        
        http.get(url, { timeout: 2000 }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const targets = JSON.parse(data);
                    resolve({ success: true, targets });
                } catch (e) {
                    resolve({ success: false, error: 'Invalid response' });
                }
            });
        }).on('error', (err) => {
            resolve({ success: false, error: err.message });
        }).on('timeout', () => {
            resolve({ success: false, error: 'Connection timeout' });
        });
    });
}

async function checkConnection() {
    console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.cyan}${colors.bright}    MCP Connection Checker${colors.reset}`);
    console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
    
    // Check for config file
    const configPath = path.join(process.cwd(), '.mcp-test-config.json');
    
    if (!fs.existsSync(configPath)) {
        console.log(`${colors.red}❌ No MCP configuration found${colors.reset}`);
        console.log(`\n${colors.yellow}Run ${colors.green}npm run test:mcp-setup${colors.reset} ${colors.yellow}first to start VS Code${colors.reset}\n`);
        process.exit(1);
    }
    
    // Read config
    let config;
    try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
        console.log(`${colors.red}❌ Failed to read configuration${colors.reset}`);
        console.log(`   ${error.message}`);
        process.exit(1);
    }
    
    console.log(`${colors.blue}Checking VS Code connection...${colors.reset}\n`);
    
    // Display config
    console.log(`${colors.bright}Configuration:${colors.reset}`);
    console.log(`  Port: ${config.port}`);
    console.log(`  PID: ${config.pid}`);
    console.log(`  Started: ${config.startTime}`);
    console.log('');
    
    // Check if port is responding
    console.log(`${colors.yellow}Checking debug port ${config.port}...${colors.reset}`);
    const portResponding = await isDebugPortResponding(config.port);
    
    if (!portResponding) {
        console.log(`${colors.red}✗ Port ${config.port} is not responding${colors.reset}`);
        console.log(`\n${colors.yellow}VS Code may have stopped. Run ${colors.green}npm run test:mcp-setup${colors.reset} ${colors.yellow}to restart${colors.reset}\n`);
        process.exit(1);
    }
    
    console.log(`${colors.green}✓ Port ${config.port} is responding${colors.reset}`);
    
    // Check Chrome DevTools
    console.log(`\n${colors.yellow}Checking Chrome DevTools...${colors.reset}`);
    const devTools = await checkDevTools(config.port);
    
    if (!devTools.success) {
        console.log(`${colors.red}✗ Chrome DevTools not accessible${colors.reset}`);
        console.log(`   Error: ${devTools.error}`);
        process.exit(1);
    }
    
    console.log(`${colors.green}✓ Chrome DevTools is accessible${colors.reset}`);
    console.log(`  Browser: ${devTools.info.Browser}`);
    console.log(`  Protocol: ${devTools.info['Protocol-Version']}`);
    
    if (devTools.info.webSocketDebuggerUrl) {
        console.log(`  WebSocket: ${devTools.info.webSocketDebuggerUrl}`);
    }
    
    // Get available targets
    console.log(`\n${colors.yellow}Getting available targets...${colors.reset}`);
    const targets = await getTargets(config.port);
    
    if (!targets.success) {
        console.log(`${colors.red}✗ Could not get targets${colors.reset}`);
        console.log(`   Error: ${targets.error}`);
    } else {
        console.log(`${colors.green}✓ Found ${targets.targets.length} target(s)${colors.reset}`);
        
        // Display first few targets
        const maxTargets = 3;
        targets.targets.slice(0, maxTargets).forEach((target, i) => {
            console.log(`\n  Target ${i + 1}:`);
            console.log(`    Title: ${target.title || 'Untitled'}`);
            console.log(`    Type: ${target.type}`);
            console.log(`    URL: ${target.url || 'about:blank'}`);
        });
        
        if (targets.targets.length > maxTargets) {
            console.log(`\n  ... and ${targets.targets.length - maxTargets} more`);
        }
    }
    
    // Success summary
    console.log(`\n${colors.green}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.green}${colors.bright}✅ VS Code is ready for MCP connection!${colors.reset}`);
    console.log(`${colors.green}${'='.repeat(60)}${colors.reset}\n`);
    
    // MCP instructions
    console.log(`${colors.cyan}${colors.bright}📋 Connect from Claude using:${colors.reset}`);
    console.log(`${colors.cyan}${'─'.repeat(40)}${colors.reset}`);
    console.log(`${colors.green}start_browser({ "debuggerAddress": "127.0.0.1:${config.port}" })${colors.reset}`);
    console.log(`${colors.cyan}${'─'.repeat(40)}${colors.reset}\n`);
    
    // Check if extension is loaded
    const hasExtension = targets.success && targets.targets.some(t => 
        t.url && (t.url.includes('extensionHost') || t.url.includes('extension'))
    );
    
    if (hasExtension) {
        console.log(`${colors.green}✓ Extension appears to be loaded${colors.reset}`);
    } else {
        console.log(`${colors.yellow}⚠️  Extension may not be loaded yet${colors.reset}`);
        console.log(`   Wait a moment for VS Code to fully initialize`);
    }
    
    console.log('');
}

// Run if called directly
if (require.main === module) {
    checkConnection().catch(error => {
        console.error(`${colors.red}Unexpected error:${colors.reset}`, error);
        process.exit(1);
    });
}

module.exports = checkConnection;