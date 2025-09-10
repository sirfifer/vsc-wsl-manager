#!/usr/bin/env node
/**
 * MCP Cleanup Script
 * Cleans up VS Code processes and test artifacts
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { killProcessOnPort } = require('./port-utils');

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

function cleanup() {
    console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.cyan}${colors.bright}    MCP Test Environment Cleanup${colors.reset}`);
    console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
    
    console.log(`${colors.blue}🧹 Cleaning up MCP test environment...${colors.reset}\n`);
    
    let cleanupCount = 0;
    
    // 1. Kill VS Code processes with debug port
    console.log(`${colors.yellow}Stopping VS Code processes...${colors.reset}`);
    try {
        if (process.platform === 'win32') {
            // Windows: Kill VS Code processes with remote debugging
            try {
                // Find VS Code processes with debugging port
                const processes = execSync('wmic process where "name=\'Code.exe\'" get ProcessId,CommandLine /format:csv', { encoding: 'utf8' });
                const lines = processes.split('\n');
                
                for (const line of lines) {
                    if (line.includes('--remote-debugging-port')) {
                        const match = line.match(/(\d+)$/);
                        if (match) {
                            const pid = match[1];
                            try {
                                execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
                                console.log(`  ${colors.green}✓ Stopped VS Code process ${pid}${colors.reset}`);
                                cleanupCount++;
                            } catch (e) {
                                // Process might have already exited
                            }
                        }
                    }
                }
            } catch (e) {
                // Try alternative method
                try {
                    execSync('taskkill /F /IM Code.exe 2>nul', { stdio: 'ignore' });
                    console.log(`  ${colors.green}✓ Stopped VS Code processes${colors.reset}`);
                    cleanupCount++;
                } catch (e2) {
                    console.log(`  ${colors.yellow}No VS Code processes found${colors.reset}`);
                }
            }
        } else {
            // Linux/Mac: Kill VS Code processes with debugging port
            try {
                execSync('pkill -f "Code.*--remote-debugging-port"', { stdio: 'ignore' });
                console.log(`  ${colors.green}✓ Stopped VS Code processes${colors.reset}`);
                cleanupCount++;
            } catch (e) {
                console.log(`  ${colors.yellow}No VS Code processes found${colors.reset}`);
            }
        }
    } catch (error) {
        console.log(`  ${colors.yellow}Could not stop VS Code processes${colors.reset}`);
    }
    
    // 2. Free up debug ports
    console.log(`${colors.yellow}Freeing debug ports...${colors.reset}`);
    const debugPorts = [9222, 9223, 9224, 9225]; // Common debug ports
    for (const port of debugPorts) {
        try {
            killProcessOnPort(port);
            console.log(`  ${colors.green}✓ Freed port ${port}${colors.reset}`);
            cleanupCount++;
        } catch (e) {
            // Port might not be in use
        }
    }
    
    // 3. Clean up test profiles and directories
    console.log(`${colors.yellow}Removing test directories...${colors.reset}`);
    const dirsToClean = [
        '.vscode-mcp-profile',
        '.vscode-test-profile',
        '.test-workspace',
        'test-screenshots-mcp'
    ];
    
    for (const dir of dirsToClean) {
        const fullPath = path.join(process.cwd(), dir);
        if (fs.existsSync(fullPath)) {
            try {
                fs.rmSync(fullPath, { recursive: true, force: true });
                console.log(`  ${colors.green}✓ Removed ${dir}${colors.reset}`);
                cleanupCount++;
            } catch (error) {
                console.log(`  ${colors.red}✗ Failed to remove ${dir}: ${error.message}${colors.reset}`);
            }
        }
    }
    
    // 4. Clean up config files
    console.log(`${colors.yellow}Removing config files...${colors.reset}`);
    const filesToClean = [
        '.mcp-test-config.json',
        'test/mcp-bridge/mcp-actions.json',
        'test/mcp-bridge/test-report.html'
    ];
    
    for (const file of filesToClean) {
        const fullPath = path.join(process.cwd(), file);
        if (fs.existsSync(fullPath)) {
            try {
                fs.unlinkSync(fullPath);
                console.log(`  ${colors.green}✓ Removed ${file}${colors.reset}`);
                cleanupCount++;
            } catch (error) {
                console.log(`  ${colors.red}✗ Failed to remove ${file}: ${error.message}${colors.reset}`);
            }
        }
    }
    
    // 5. Clean up log files
    console.log(`${colors.yellow}Cleaning log files...${colors.reset}`);
    const logPatterns = [
        'test/mcp-bridge/*.log',
        'test/mcp-bridge/logs/*.log'
    ];
    
    for (const pattern of logPatterns) {
        try {
            const logDir = path.dirname(pattern);
            const logFile = path.basename(pattern);
            const fullDir = path.join(process.cwd(), logDir);
            
            if (fs.existsSync(fullDir)) {
                const files = fs.readdirSync(fullDir);
                const logFiles = files.filter(f => {
                    if (logFile === '*.log') {
                        return f.endsWith('.log');
                    }
                    return f === logFile;
                });
                
                for (const file of logFiles) {
                    const fullPath = path.join(fullDir, file);
                    fs.unlinkSync(fullPath);
                    console.log(`  ${colors.green}✓ Removed ${path.join(logDir, file)}${colors.reset}`);
                    cleanupCount++;
                }
            }
        } catch (error) {
            // Directory might not exist
        }
    }
    
    // Summary
    console.log(`\n${colors.green}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.green}${colors.bright}✅ Cleanup complete!${colors.reset}`);
    console.log(`${colors.green}${'='.repeat(60)}${colors.reset}`);
    console.log(`  ${colors.cyan}Items cleaned: ${cleanupCount}${colors.reset}`);
    
    // Tips
    if (cleanupCount === 0) {
        console.log(`\n${colors.yellow}💡 No items needed cleaning.${colors.reset}`);
        console.log(`   Environment was already clean.`);
    } else {
        console.log(`\n${colors.cyan}💡 Ready for next test run!${colors.reset}`);
        console.log(`   Run ${colors.green}npm run test:mcp-setup${colors.reset} to start again.`);
    }
    
    console.log('');
}

// Run if called directly
if (require.main === module) {
    cleanup();
    process.exit(0);
}

module.exports = cleanup;