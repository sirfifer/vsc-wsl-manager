/**
 * VS Code Process Monitor
 * Tracks VS Code process lifecycle, resource usage, and detects crashes
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { DebugLogger } = require('./debug-logger');

class VSCodeMonitor {
    constructor(options = {}) {
        this.options = {
            checkInterval: options.checkInterval || 500,
            captureOutput: options.captureOutput !== false,
            trackResources: options.trackResources !== false,
            autoRestart: options.autoRestart || false,
            maxRestarts: options.maxRestarts || 3,
            ...options
        };

        this.logger = new DebugLogger({
            prefix: 'vscode-monitor',
            logLevel: process.env.DEBUG_LEVEL || 'DEBUG'
        });

        this.processes = new Map();
        this.metrics = new Map();
        this.restartCount = 0;
        this.monitoring = false;
    }

    async launchVSCode(args = [], options = {}) {
        const launchId = Date.now();
        
        this.logger.info('Launching VS Code', { 
            launchId, 
            args,
            options 
        });

        // Find VS Code executable
        const vscodePath = await this.findVSCodeExecutable();
        if (!vscodePath) {
            throw new Error('VS Code executable not found');
        }

        // Prepare launch arguments
        const launchArgs = this.prepareLaunchArgs(args, options);
        
        this.logger.debug('VS Code launch configuration', {
            executable: vscodePath,
            args: launchArgs,
            cwd: process.cwd()
        });

        // Create output capture streams
        const outputPath = path.join(__dirname, 'process-logs', `vscode-${launchId}.log`);
        this.ensureDirectory(path.dirname(outputPath));
        const outputStream = fs.createWriteStream(outputPath);

        // Launch VS Code
        const vscodeProcess = spawn(vscodePath, launchArgs, {
            detached: false,
            stdio: this.options.captureOutput ? ['ignore', 'pipe', 'pipe'] : 'inherit',
            env: {
                ...process.env,
                ELECTRON_ENABLE_LOGGING: '1',
                ELECTRON_LOG_LEVEL: 'verbose',
                NODE_OPTIONS: '--max-old-space-size=4096'
            }
        });

        const pid = vscodeProcess.pid;
        
        if (!pid) {
            throw new Error('Failed to get VS Code process PID');
        }

        // Store process info
        const processInfo = {
            pid,
            launchId,
            startTime: Date.now(),
            args: launchArgs,
            outputPath,
            process: vscodeProcess,
            alive: true,
            exitCode: null,
            signal: null,
            crashes: []
        };

        this.processes.set(pid, processInfo);
        this.metrics.set(pid, {
            cpu: [],
            memory: [],
            events: []
        });

        // Capture output
        if (this.options.captureOutput && vscodeProcess.stdout) {
            vscodeProcess.stdout.on('data', (data) => {
                const text = data.toString();
                outputStream.write(`[STDOUT] ${text}`);
                
                // Check for important events
                this.detectVSCodeEvents(pid, text);
            });

            vscodeProcess.stderr.on('data', (data) => {
                const text = data.toString();
                outputStream.write(`[STDERR] ${text}`);
                
                // Check for errors
                this.detectVSCodeErrors(pid, text);
            });
        }

        // Handle process exit
        vscodeProcess.on('exit', (code, signal) => {
            processInfo.alive = false;
            processInfo.exitCode = code;
            processInfo.signal = signal;
            processInfo.endTime = Date.now();
            processInfo.duration = processInfo.endTime - processInfo.startTime;

            outputStream.end();

            this.logger.info('VS Code process exited', {
                pid,
                exitCode: code,
                signal,
                duration: processInfo.duration,
                crashed: this.isVSCodeCrash(code, signal)
            });

            if (this.isVSCodeCrash(code, signal)) {
                this.handleVSCodeCrash(pid, code, signal);
            }
        });

        // Handle process errors
        vscodeProcess.on('error', (error) => {
            this.logger.error('VS Code process error', {
                pid,
                error: error.message,
                stack: error.stack
            });

            processInfo.crashes.push({
                timestamp: Date.now(),
                error: error.message
            });
        });

        // Start monitoring
        if (!this.monitoring) {
            this.startMonitoring();
        }

        // Wait for VS Code to be ready
        await this.waitForVSCodeReady(pid);

        return {
            pid,
            launchId,
            process: vscodeProcess
        };
    }

    prepareLaunchArgs(args, options) {
        const baseArgs = [
            '--no-sandbox',
            '--disable-gpu-sandbox',
            '--disable-setuid-sandbox'
        ];

        // Add extension development path if provided
        if (options.extensionPath) {
            baseArgs.push('--extensionDevelopmentPath', options.extensionPath);
        }

        // Add workspace if provided
        if (options.workspace) {
            baseArgs.push(options.workspace);
        }

        // Use isolated profile for testing
        if (options.useTestProfile !== false) {
            const profileDir = path.join(__dirname, '..', '.vscode-test-profile');
            baseArgs.push('--user-data-dir', profileDir);
            
            const extensionsDir = path.join(__dirname, '..', '.vscode-test-extensions');
            baseArgs.push('--extensions-dir', extensionsDir);
        }

        // Add user-provided args
        return [...baseArgs, ...args];
    }

    async findVSCodeExecutable() {
        // If we're in WSL, we need to use the Windows VS Code
        const isWSL = process.platform === 'linux' && fs.existsSync('/proc/sys/fs/binfmt_misc/WSLInterop');
        
        if (isWSL) {
            // In WSL, use the code command which launches Windows VS Code
            return 'code';
        }
        
        const platform = process.platform;
        
        const possiblePaths = {
            win32: [
                'C:\\Program Files\\Microsoft VS Code\\Code.exe',
                'C:\\Program Files (x86)\\Microsoft VS Code\\Code.exe',
                path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code', 'Code.exe')
            ],
            darwin: [
                '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code'
            ],
            linux: [
                '/usr/bin/code',
                '/usr/local/bin/code',
                '/snap/bin/code'
            ]
        };

        const paths = possiblePaths[platform] || [];
        
        // Check each path
        for (const vscodePath of paths) {
            if (fs.existsSync(vscodePath)) {
                return vscodePath;
            }
        }

        // Try to find in PATH
        return await this.findInPath('code');
    }

    async findInPath(executable) {
        return new Promise((resolve) => {
            const command = process.platform === 'win32' 
                ? `where ${executable}` 
                : `which ${executable}`;

            exec(command, (error, stdout) => {
                if (!error && stdout) {
                    resolve(stdout.trim().split('\n')[0]);
                } else {
                    resolve(null);
                }
            });
        });
    }

    startMonitoring() {
        if (this.monitoring) return;
        
        this.monitoring = true;
        this.logger.info('Started VS Code process monitoring');

        this.monitorInterval = setInterval(() => {
            for (const [pid, info] of this.processes.entries()) {
                if (info.alive) {
                    this.checkProcess(pid);
                    
                    if (this.options.trackResources) {
                        this.trackResources(pid);
                    }
                }
            }
        }, this.options.checkInterval);
    }

    stopMonitoring() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
            this.monitoring = false;
            this.logger.info('Stopped VS Code process monitoring');
        }
    }

    checkProcess(pid) {
        const alive = this.isProcessAlive(pid);
        const info = this.processes.get(pid);
        
        if (info && info.alive !== alive) {
            info.alive = alive;
            
            if (!alive) {
                this.logger.warn('VS Code process died unexpectedly', { pid });
                this.handleUnexpectedExit(pid);
            }
        }
    }

    isProcessAlive(pid) {
        try {
            if (process.platform === 'win32') {
                const { execSync } = require('child_process');
                execSync(`tasklist /FI "PID eq ${pid}" 2>nul | find "${pid}" >nul`, {
                    windowsHide: true
                });
                return true;
            } else {
                process.kill(pid, 0);
                return true;
            }
        } catch {
            return false;
        }
    }

    async trackResources(pid) {
        try {
            const usage = await this.getProcessUsage(pid);
            
            if (usage) {
                const metrics = this.metrics.get(pid);
                if (metrics) {
                    metrics.cpu.push(usage.cpu);
                    metrics.memory.push(usage.memory);
                    
                    // Keep only last 100 samples
                    if (metrics.cpu.length > 100) {
                        metrics.cpu.shift();
                        metrics.memory.shift();
                    }
                    
                    // Log high resource usage
                    if (usage.cpu > 80) {
                        this.logger.warn('High CPU usage detected', { pid, cpu: usage.cpu });
                    }
                    
                    if (usage.memory > 1000) { // MB
                        this.logger.warn('High memory usage detected', { pid, memory: usage.memory });
                    }
                }
            }
        } catch (error) {
            this.logger.debug('Failed to get process usage', { pid, error: error.message });
        }
    }

    async getProcessUsage(pid) {
        return new Promise((resolve) => {
            if (process.platform === 'win32') {
                exec(`wmic process where ProcessId=${pid} get WorkingSetSize,PageFileUsage,UserModeTime /format:list`, 
                    (error, stdout) => {
                        if (error) {
                            resolve(null);
                            return;
                        }
                        
                        const lines = stdout.split('\n');
                        const usage = {};
                        
                        lines.forEach(line => {
                            const [key, value] = line.split('=');
                            if (key && value) {
                                if (key.includes('WorkingSetSize')) {
                                    usage.memory = parseInt(value) / 1024 / 1024; // Convert to MB
                                }
                            }
                        });
                        
                        resolve(usage.memory ? usage : null);
                    }
                );
            } else {
                exec(`ps -o pid,pcpu,rss -p ${pid}`, (error, stdout) => {
                    if (error) {
                        resolve(null);
                        return;
                    }
                    
                    const lines = stdout.split('\n');
                    if (lines.length > 1) {
                        const parts = lines[1].trim().split(/\s+/);
                        resolve({
                            cpu: parseFloat(parts[1]),
                            memory: parseInt(parts[2]) / 1024 // Convert KB to MB
                        });
                    } else {
                        resolve(null);
                    }
                });
            }
        });
    }

    detectVSCodeEvents(pid, output) {
        const events = [
            { pattern: /Extension host started/i, event: 'extension-host-started' },
            { pattern: /Extension .* activated/i, event: 'extension-activated' },
            { pattern: /Starting VS Code/i, event: 'vscode-starting' },
            { pattern: /Window opened/i, event: 'window-opened' },
            { pattern: /Workspace opened/i, event: 'workspace-opened' }
        ];

        events.forEach(({ pattern, event }) => {
            if (pattern.test(output)) {
                this.logger.logVSCodeEvent(event, { pid, match: output.match(pattern)[0] });
                
                const metrics = this.metrics.get(pid);
                if (metrics) {
                    metrics.events.push({
                        timestamp: Date.now(),
                        event,
                        output: output.substring(0, 200)
                    });
                }
            }
        });
    }

    detectVSCodeErrors(pid, output) {
        const errorPatterns = [
            { pattern: /FATAL ERROR/i, severity: 'fatal' },
            { pattern: /Uncaught Exception/i, severity: 'fatal' },
            { pattern: /Extension host terminated/i, severity: 'error' },
            { pattern: /Failed to load extension/i, severity: 'error' },
            { pattern: /ENOENT/i, severity: 'warn' },
            { pattern: /EPERM/i, severity: 'warn' }
        ];

        errorPatterns.forEach(({ pattern, severity }) => {
            if (pattern.test(output)) {
                this.logger.log(severity.toUpperCase(), `VS Code error detected`, {
                    pid,
                    pattern: pattern.toString(),
                    output: output.substring(0, 500)
                });

                const info = this.processes.get(pid);
                if (info) {
                    info.crashes.push({
                        timestamp: Date.now(),
                        severity,
                        output: output.substring(0, 500)
                    });
                }
            }
        });
    }

    isVSCodeCrash(exitCode, signal) {
        return (
            exitCode !== 0 && exitCode !== null ||
            signal === 'SIGSEGV' ||
            signal === 'SIGABRT' ||
            signal === 'SIGILL' ||
            signal === 'SIGBUS'
        );
    }

    handleVSCodeCrash(pid, exitCode, signal) {
        const info = this.processes.get(pid);
        
        if (!info) return;

        this.logger.error('VS Code crashed', {
            pid,
            exitCode,
            signal,
            duration: Date.now() - info.startTime,
            args: info.args
        });

        // Save crash information
        this.saveCrashReport(pid, exitCode, signal);

        // Auto-restart if configured
        if (this.options.autoRestart && this.restartCount < this.options.maxRestarts) {
            this.restartCount++;
            this.logger.info(`Auto-restarting VS Code (attempt ${this.restartCount}/${this.options.maxRestarts})`);
            
            setTimeout(() => {
                this.launchVSCode(info.args, { extensionPath: info.extensionPath });
            }, 5000);
        }
    }

    handleUnexpectedExit(pid) {
        const info = this.processes.get(pid);
        
        if (!info) return;

        this.logger.error('VS Code exited unexpectedly', {
            pid,
            duration: Date.now() - info.startTime
        });

        this.saveCrashReport(pid, 'unexpected', null);
    }

    saveCrashReport(pid, exitCode, signal) {
        const info = this.processes.get(pid);
        const metrics = this.metrics.get(pid);
        
        if (!info) return;

        const crashDir = path.join(__dirname, 'crash-dumps');
        this.ensureDirectory(crashDir);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportFile = path.join(crashDir, `vscode-crash-${pid}-${timestamp}.json`);

        const report = {
            pid,
            timestamp: new Date().toISOString(),
            exitCode,
            signal,
            duration: Date.now() - info.startTime,
            args: info.args,
            crashes: info.crashes,
            metrics: metrics ? {
                avgCpu: metrics.cpu.length ? 
                    metrics.cpu.reduce((a, b) => a + b, 0) / metrics.cpu.length : 0,
                maxCpu: metrics.cpu.length ? Math.max(...metrics.cpu) : 0,
                avgMemory: metrics.memory.length ?
                    metrics.memory.reduce((a, b) => a + b, 0) / metrics.memory.length : 0,
                maxMemory: metrics.memory.length ? Math.max(...metrics.memory) : 0,
                events: metrics.events
            } : null,
            outputLog: info.outputPath
        };

        try {
            fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
            this.logger.info(`Crash report saved to ${reportFile}`);
        } catch (error) {
            this.logger.error('Failed to save crash report', { error: error.message });
        }
    }

    async waitForVSCodeReady(pid, timeout = 30000) {
        const startTime = Date.now();
        
        this.logger.info('Waiting for VS Code to be ready', { pid, timeout });

        while (Date.now() - startTime < timeout) {
            const info = this.processes.get(pid);
            
            if (!info || !info.alive) {
                throw new Error('VS Code process died while waiting');
            }

            const metrics = this.metrics.get(pid);
            if (metrics && metrics.events.some(e => 
                e.event === 'window-opened' || 
                e.event === 'extension-host-started'
            )) {
                this.logger.info('VS Code is ready', { pid });
                return true;
            }

            await this.delay(500);
        }

        throw new Error('Timeout waiting for VS Code to be ready');
    }

    killAllVSCodeProcesses() {
        this.logger.info('Killing all VS Code processes');

        for (const [pid, info] of this.processes.entries()) {
            if (info.alive) {
                try {
                    process.kill(pid, 'SIGTERM');
                    this.logger.info(`Sent SIGTERM to VS Code process ${pid}`);
                } catch (error) {
                    this.logger.debug(`Failed to kill process ${pid}`, { error: error.message });
                }
            }
        }

        // Force kill after delay
        setTimeout(() => {
            for (const [pid, info] of this.processes.entries()) {
                if (info.alive && this.isProcessAlive(pid)) {
                    try {
                        process.kill(pid, 'SIGKILL');
                        this.logger.info(`Sent SIGKILL to VS Code process ${pid}`);
                    } catch {
                        // Process already dead
                    }
                }
            }
        }, 3000);
    }

    ensureDirectory(dir) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getProcessInfo(pid) {
        return this.processes.get(pid);
    }

    getMetrics(pid) {
        return this.metrics.get(pid);
    }

    getAllProcesses() {
        return Array.from(this.processes.values());
    }

    cleanup() {
        this.stopMonitoring();
        this.killAllVSCodeProcesses();
        this.processes.clear();
        this.metrics.clear();
    }
}

module.exports = VSCodeMonitor;