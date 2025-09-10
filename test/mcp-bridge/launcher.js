/**
 * MCP VS Code Launcher
 * Launches VS Code with proper configuration for MCP testing
 * CRITICAL: Does NOT use --disable-extensions flag
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { isPortAvailable, findAvailablePort, killProcessOnPort } = require('./port-utils');

// Try to import existing debug logger if available
let DebugLogger;
try {
    const debugModule = require('../e2e-debug/debug-logger');
    DebugLogger = debugModule.DebugLogger;
} catch (e) {
    // Create a simple logger if debug logger not available
    DebugLogger = class SimpleLogger {
        constructor(prefix) {
            this.prefix = prefix;
        }
        info(...args) { console.log(`[${this.prefix}]`, ...args); }
        debug(...args) { console.log(`[${this.prefix}:DEBUG]`, ...args); }
        warn(...args) { console.warn(`[${this.prefix}:WARN]`, ...args); }
        error(...args) { console.error(`[${this.prefix}:ERROR]`, ...args); }
    };
}

class MCPVSCodeLauncher {
    constructor(options = {}) {
        this.logger = new DebugLogger('mcp-launcher');
        this.extensionPath = options.extensionPath || process.cwd();
        this.debugPort = options.debugPort || 9222;
        this.userDataDir = path.join(process.cwd(), '.vscode-mcp-profile');
        this.workspacePath = options.workspacePath || path.join(process.cwd(), '.test-workspace');
        this.vscodePath = null;
        this.process = null;
        this.mcpConfig = {
            ready: false,
            port: this.debugPort,
            pid: null,
            startTime: null,
            vscodePath: null,
            extensionPath: this.extensionPath
        };
    }

    /**
     * Find VS Code installation with comprehensive detection
     * Checks standard locations, Insiders, environment variables, and PATH
     */
    findVSCode() {
        const candidates = [];
        
        // Windows standard installations
        if (process.platform === 'win32') {
            candidates.push(
                'C:\\Program Files\\Microsoft VS Code\\Code.exe',
                'C:\\Program Files (x86)\\Microsoft VS Code\\Code.exe',
                `C:\\Users\\${process.env.USERNAME}\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe`,
                // Insiders versions
                'C:\\Program Files\\Microsoft VS Code - Insiders\\Code - Insiders.exe',
                `C:\\Users\\${process.env.USERNAME}\\AppData\\Local\\Programs\\Microsoft VS Code - Insiders\\Code - Insiders.exe`,
                // Portable installations
                'C:\\tools\\vscode\\Code.exe',
                'D:\\tools\\vscode\\Code.exe'
            );
        } else {
            // Linux/Mac installations
            candidates.push(
                '/usr/bin/code',
                '/usr/local/bin/code',
                '/snap/bin/code',
                '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code',
                '/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app/bin/code'
            );
        }
        
        // Check environment variable
        if (process.env.VSCODE_PATH) {
            candidates.unshift(process.env.VSCODE_PATH);
        }
        
        // For WSL, we need to find Windows executables
        // Convert WSL paths to Windows paths
        if (process.platform === 'linux' && fs.existsSync('/mnt/c')) {
            // We're in WSL, look for Windows VS Code
            candidates.push(
                '/mnt/c/Program Files/Microsoft VS Code/Code.exe',
                '/mnt/c/Program Files (x86)/Microsoft VS Code/Code.exe',
                `/mnt/c/Users/${process.env.USER}/AppData/Local/Programs/Microsoft VS Code/Code.exe`
            );
            
            // Try to get Windows username
            try {
                const winUser = execSync('cmd.exe /c "echo %USERNAME%"', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
                if (winUser) {
                    candidates.push(`/mnt/c/Users/${winUser}/AppData/Local/Programs/Microsoft VS Code/Code.exe`);
                }
            } catch (e) {
                // Couldn't get Windows username
            }
        }
        
        // Check PATH command (Windows)
        if (process.platform === 'win32') {
            try {
                const result = execSync('where code', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
                const paths = result.split('\n').filter(p => p.trim());
                // Filter to only .exe files, not .cmd or shell scripts
                candidates.push(...paths.filter(p => p.endsWith('.exe')));
            } catch (e) {
                // code not in PATH
            }
        }
        
        // Check each candidate
        for (const candidate of candidates) {
            if (candidate && fs.existsSync(candidate)) {
                this.logger.info(`Found VS Code at: ${candidate}`);
                this.vscodePath = candidate;
                return candidate;
            }
        }
        
        // If not found, provide helpful error message
        const errorMsg = `VS Code not found. Searched locations:\n${candidates.filter(c => c).join('\n')}`;
        this.logger.error(errorMsg);
        throw new Error(errorMsg);
    }

    /**
     * Launch VS Code with proper configuration for MCP
     * CRITICAL: No --disable-extensions flag!
     */
    async launch() {
        this.logger.info('='.repeat(60));
        this.logger.info('MCP VS Code Launcher Starting');
        this.logger.info('='.repeat(60));
        
        // Find VS Code
        this.findVSCode();
        this.mcpConfig.vscodePath = this.vscodePath;
        
        // Check port availability
        this.logger.info(`Checking port ${this.debugPort} availability...`);
        if (!await isPortAvailable(this.debugPort)) {
            this.logger.warn(`Port ${this.debugPort} is in use, attempting to free it...`);
            killProcessOnPort(this.debugPort);
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            if (!await isPortAvailable(this.debugPort)) {
                this.logger.warn(`Port ${this.debugPort} still in use, finding alternative...`);
                this.debugPort = await findAvailablePort(this.debugPort + 1);
                this.mcpConfig.port = this.debugPort;
                this.logger.info(`Using alternative port: ${this.debugPort}`);
            }
        }
        
        // Clean and create profile directory
        this.logger.info('Preparing profile directory...');
        if (fs.existsSync(this.userDataDir)) {
            fs.rmSync(this.userDataDir, { recursive: true, force: true });
        }
        fs.mkdirSync(this.userDataDir, { recursive: true });
        
        // Create test workspace if needed
        if (!fs.existsSync(this.workspacePath)) {
            fs.mkdirSync(this.workspacePath, { recursive: true });
            // Create a simple file to open
            fs.writeFileSync(path.join(this.workspacePath, 'test.md'), '# MCP Test Workspace\n\nReady for testing!');
        }
        
        // CRITICAL: Launch arguments WITHOUT --disable-extensions
        const args = [
            `--extensionDevelopmentPath=${this.extensionPath}`,  // CRITICAL: Load our extension
            `--remote-debugging-port=${this.debugPort}`,         // CRITICAL: Enable Chrome DevTools
            `--user-data-dir=${this.userDataDir}`,              // Clean profile
            this.workspacePath,                                  // Open workspace
            '--skip-release-notes',
            '--skip-welcome',
            '--disable-telemetry',
            '--disable-updates',
            '--disable-workspace-trust',
            '--no-sandbox'
            // CRITICAL: NO --disable-extensions flag here!
        ];
        
        this.logger.info('Launch configuration:');
        this.logger.info(`  VS Code: ${this.vscodePath}`);
        this.logger.info(`  Extension: ${this.extensionPath}`);
        this.logger.info(`  Debug Port: ${this.debugPort}`);
        this.logger.info(`  Profile: ${this.userDataDir}`);
        this.logger.info(`  Workspace: ${this.workspacePath}`);
        this.logger.info('Launch arguments:');
        args.forEach(arg => this.logger.debug(`    ${arg}`));
        
        // Launch VS Code
        this.logger.info('Launching VS Code...');
        this.process = spawn(this.vscodePath, args, {
            detached: false,
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: false,
            windowsHide: false  // Show window on Windows
        });
        
        this.mcpConfig.pid = this.process.pid;
        this.mcpConfig.startTime = new Date().toISOString();
        
        // Log output
        this.process.stdout.on('data', (data) => {
            const output = data.toString();
            if (output.includes('Extension host') || output.includes('WSL Manager')) {
                this.logger.info(`VS Code: ${output.trim()}`);
            } else {
                this.logger.debug(`VS Code stdout: ${output.trim()}`);
            }
        });
        
        this.process.stderr.on('data', (data) => {
            const output = data.toString();
            if (!output.includes('DevTools listening')) {  // This is expected
                this.logger.debug(`VS Code stderr: ${output.trim()}`);
            }
        });
        
        this.process.on('error', (error) => {
            this.logger.error('VS Code process error:', error);
        });
        
        this.process.on('exit', (code, signal) => {
            this.logger.info(`VS Code exited with code ${code}, signal ${signal}`);
            this.mcpConfig.ready = false;
        });
        
        // Wait for debugging port to be ready
        this.logger.info('Waiting for Chrome DevTools to be ready...');
        await this.waitForDebugPort();
        
        // Write MCP configuration
        this.writeMCPConfig();
        
        this.logger.info('='.repeat(60));
        this.logger.info('✅ VS Code is ready for MCP!');
        this.logger.info('='.repeat(60));
        this.logger.info('Configuration:');
        this.logger.info(`  Debug Port: ${this.mcpConfig.port}`);
        this.logger.info(`  Process ID: ${this.mcpConfig.pid}`);
        this.logger.info(`  WebSocket URL: ${this.mcpConfig.webSocketUrl || 'pending...'}`);
        this.logger.info('');
        this.logger.info('Claude can now connect using:');
        this.logger.info(`  start_browser({ "debuggerAddress": "127.0.0.1:${this.debugPort}" })`);
        this.logger.info('='.repeat(60));
        
        return this.mcpConfig;
    }

    /**
     * Wait for Chrome DevTools debugging port to be ready
     */
    async waitForDebugPort(timeout = 30000) {
        const startTime = Date.now();
        let lastError = null;
        
        while (Date.now() - startTime < timeout) {
            try {
                const response = await this.httpGet(`http://127.0.0.1:${this.debugPort}/json/version`);
                const data = JSON.parse(response);
                
                this.mcpConfig.ready = true;
                this.mcpConfig.browser = data.Browser;
                this.mcpConfig.protocolVersion = data['Protocol-Version'];
                this.mcpConfig.webSocketUrl = data.webSocketDebuggerUrl;
                
                this.logger.info('Chrome DevTools is ready!');
                this.logger.debug('DevTools info:', data);
                return true;
            } catch (e) {
                lastError = e;
                await this.sleep(500);
            }
        }
        
        this.logger.error('Timeout waiting for Chrome DevTools');
        if (lastError) {
            this.logger.error('Last error:', lastError.message);
        }
        throw new Error(`Timeout waiting for VS Code debug port ${this.debugPort}`);
    }

    /**
     * Make HTTP GET request
     */
    httpGet(url) {
        return new Promise((resolve, reject) => {
            http.get(url, { timeout: 2000 }, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', reject).on('timeout', () => reject(new Error('Request timeout')));
        });
    }

    /**
     * Write MCP configuration file
     */
    writeMCPConfig() {
        const configPath = path.join(process.cwd(), '.mcp-test-config.json');
        const config = {
            ...this.mcpConfig,
            instructions: {
                connect: `start_browser({ "debuggerAddress": "127.0.0.1:${this.debugPort}" })`,
                navigate: 'navigate({ "url": "about:blank" })',
                screenshot: 'take_screenshot()',
                findElement: 'find_element({ "selector": ".activitybar" })',
                click: 'click({ "selector": ".codicon-vm" })'
            }
        };
        
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        this.logger.info(`MCP config written to: ${configPath}`);
    }

    /**
     * Sleep helper
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Stop VS Code
     */
    async stop() {
        if (this.process && !this.process.killed) {
            this.logger.info('Stopping VS Code...');
            
            // Try graceful shutdown first
            if (process.platform === 'win32') {
                try {
                    execSync(`taskkill /PID ${this.process.pid}`, { stdio: 'ignore' });
                } catch (e) {
                    this.process.kill('SIGTERM');
                }
            } else {
                this.process.kill('SIGTERM');
            }
            
            // Wait a bit
            await this.sleep(2000);
            
            // Force kill if still running
            if (!this.process.killed) {
                this.process.kill('SIGKILL');
            }
        }
        
        // Clean up profile directory
        if (fs.existsSync(this.userDataDir)) {
            try {
                fs.rmSync(this.userDataDir, { recursive: true, force: true });
                this.logger.info('Cleaned up profile directory');
            } catch (e) {
                this.logger.warn('Failed to clean profile directory:', e.message);
            }
        }
    }
}

module.exports = MCPVSCodeLauncher;