#!/usr/bin/env node
/**
 * MCP Setup Script
 * Launches VS Code with proper configuration for MCP testing
 */

const MCPVSCodeLauncher = require('./launcher');
const fs = require('fs');
const path = require('path');

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

async function setup() {
    console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.cyan}${colors.bright}    MCP VS Code Test Environment Setup${colors.reset}`);
    console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
    
    console.log(`${colors.blue}🚀 Starting VS Code for MCP testing...${colors.reset}\n`);
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    const options = {
        extensionPath: process.cwd(),
        debugPort: 9222
    };
    
    // Check for custom port
    const portIndex = args.indexOf('--port');
    if (portIndex !== -1 && args[portIndex + 1]) {
        options.debugPort = parseInt(args[portIndex + 1], 10);
    }
    
    // Check for custom workspace
    const workspaceIndex = args.indexOf('--workspace');
    if (workspaceIndex !== -1 && args[workspaceIndex + 1]) {
        options.workspacePath = args[workspaceIndex + 1];
    }
    
    // Create launcher
    const launcher = new MCPVSCodeLauncher(options);
    
    try {
        // Launch VS Code
        const config = await launcher.launch();
        
        console.log(`\n${colors.green}${'='.repeat(60)}${colors.reset}`);
        console.log(`${colors.green}${colors.bright}✅ VS Code is ready for MCP!${colors.reset}`);
        console.log(`${colors.green}${'='.repeat(60)}${colors.reset}\n`);
        
        console.log(`${colors.bright}Configuration:${colors.reset}`);
        console.log(`  ${colors.yellow}Debug Port:${colors.reset} ${config.port}`);
        console.log(`  ${colors.yellow}Process ID:${colors.reset} ${config.pid}`);
        console.log(`  ${colors.yellow}VS Code Path:${colors.reset} ${config.vscodePath}`);
        console.log(`  ${colors.yellow}Extension Path:${colors.reset} ${config.extensionPath}`);
        
        if (config.webSocketUrl) {
            console.log(`  ${colors.yellow}WebSocket URL:${colors.reset} ${config.webSocketUrl}`);
        }
        
        console.log(`\n${colors.cyan}${colors.bright}📋 Claude MCP Connection Instructions:${colors.reset}`);
        console.log(`${colors.cyan}${'─'.repeat(40)}${colors.reset}`);
        console.log(`${colors.bright}1. Ensure MCP is configured in Claude Desktop:${colors.reset}`);
        console.log(`   Location: %APPDATA%\\Claude\\claude_desktop_config.json`);
        console.log(`   Add: ${colors.yellow}{ "mcpServers": { "webdriverio-mcp": { "command": "npx", "args": ["-y", "webdriverio-mcp"] } } }${colors.reset}`);
        console.log(`\n${colors.bright}2. Connect using this command in Claude:${colors.reset}`);
        console.log(`   ${colors.green}start_browser({ "debuggerAddress": "127.0.0.1:${config.port}" })${colors.reset}`);
        console.log(`\n${colors.bright}3. Navigate to test workspace:${colors.reset}`);
        console.log(`   ${colors.green}navigate({ "url": "about:blank" })${colors.reset}`);
        console.log(`\n${colors.bright}4. Take a screenshot:${colors.reset}`);
        console.log(`   ${colors.green}take_screenshot()${colors.reset}`);
        console.log(`${colors.cyan}${'─'.repeat(40)}${colors.reset}\n`);
        
        console.log(`${colors.yellow}⚠️  Press Ctrl+C to stop VS Code and clean up${colors.reset}\n`);
        
        // Keep process alive and handle shutdown
        process.stdin.resume();
        
        const shutdown = async () => {
            console.log(`\n${colors.yellow}👋 Shutting down...${colors.reset}`);
            await launcher.stop();
            
            // Clean up config file
            const configPath = path.join(process.cwd(), '.mcp-test-config.json');
            if (fs.existsSync(configPath)) {
                fs.unlinkSync(configPath);
                console.log(`${colors.green}✓ Cleaned up config file${colors.reset}`);
            }
            
            console.log(`${colors.green}✓ Shutdown complete${colors.reset}`);
            process.exit(0);
        };
        
        // Handle various shutdown signals
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
        process.on('SIGHUP', shutdown);
        
        // Handle uncaught errors
        process.on('uncaughtException', async (error) => {
            console.error(`${colors.red}❌ Uncaught exception:${colors.reset}`, error);
            await shutdown();
        });
        
    } catch (error) {
        console.error(`${colors.red}❌ Failed to launch VS Code:${colors.reset}`, error.message);
        
        if (error.message.includes('not found')) {
            console.log(`\n${colors.yellow}💡 Tips:${colors.reset}`);
            console.log('  1. Make sure VS Code is installed');
            console.log('  2. Try adding VS Code to your PATH');
            console.log('  3. Set VSCODE_PATH environment variable to VS Code executable');
            console.log(`     Example: ${colors.cyan}set VSCODE_PATH=C:\\Program Files\\Microsoft VS Code\\Code.exe${colors.reset}`);
        }
        
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    setup();
}

module.exports = setup;