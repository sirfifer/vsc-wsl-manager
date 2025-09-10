/**
 * Comprehensive debug logging system for E2E tests
 * Provides persistent file logging with rotation, structured JSON format,
 * and automatic crash detection.
 */

const fs = require('fs');
const path = require('path');
const util = require('util');

class DebugLogger {
    constructor(options = {}) {
        this.options = {
            logDir: options.logDir || path.join(__dirname, 'logs'),
            maxFiles: options.maxFiles || 10,
            logToConsole: options.logToConsole !== false,
            logLevel: options.logLevel || process.env.DEBUG_LEVEL || 'INFO',
            prefix: options.prefix || 'debug',
            ...options
        };

        this.levels = {
            DEBUG: 0,
            INFO: 1,
            WARN: 2,
            ERROR: 3,
            FATAL: 4
        };

        this.currentLevel = this.levels[this.options.logLevel] || 1;
        this.sessionId = Date.now();
        this.logFile = null;
        this.crashDetected = false;
        this.processInfo = {};

        this.initialize();
    }

    initialize() {
        // Create log directory if it doesn't exist
        if (!fs.existsSync(this.options.logDir)) {
            fs.mkdirSync(this.options.logDir, { recursive: true });
        }

        // Set up log file
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const logFileName = `${this.options.prefix}-${timestamp}.log`;
        this.logFile = path.join(this.options.logDir, logFileName);

        // Write initial session info
        this.writeHeader();

        // Set up crash handlers
        this.setupCrashHandlers();

        // Rotate old logs
        this.rotateLogs();
    }

    writeHeader() {
        const header = {
            session: {
                id: this.sessionId,
                startTime: new Date().toISOString(),
                logLevel: this.options.logLevel,
                platform: process.platform,
                nodeVersion: process.version,
                cwd: process.cwd(),
                env: {
                    DEBUG: process.env.DEBUG,
                    NODE_ENV: process.env.NODE_ENV,
                    CI: process.env.CI
                }
            }
        };

        this.writeToFile('HEADER', header);
    }

    setupCrashHandlers() {
        // Capture uncaught exceptions
        process.on('uncaughtException', (error) => {
            this.crashDetected = true;
            this.log('FATAL', 'Uncaught Exception', {
                error: {
                    message: error.message,
                    stack: error.stack,
                    name: error.name
                }
            });
            this.writeCrashDump(error);
        });

        // Capture unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            this.log('ERROR', 'Unhandled Promise Rejection', {
                reason: util.inspect(reason),
                promise: util.inspect(promise)
            });
        });

        // Capture process exit
        process.on('exit', (code) => {
            this.log('INFO', 'Process Exit', {
                exitCode: code,
                crashDetected: this.crashDetected,
                duration: Date.now() - this.sessionId
            });
        });

        // Capture signals
        ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
            process.on(signal, () => {
                this.log('WARN', `Process received ${signal}`, {
                    signal,
                    timestamp: new Date().toISOString()
                });
                process.exit(1);
            });
        });
    }

    log(level, message, data = {}) {
        const levelNum = this.levels[level] || 1;
        if (levelNum < this.currentLevel) {
            return;
        }

        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            data,
            sessionId: this.sessionId,
            elapsed: Date.now() - this.sessionId
        };

        // Add caller info for debugging
        const err = new Error();
        const stack = err.stack.split('\n')[3];
        if (stack) {
            const match = stack.match(/at\s+(.+)\s+\((.+):(\d+):(\d+)\)/);
            if (match) {
                logEntry.caller = {
                    function: match[1],
                    file: path.basename(match[2]),
                    line: match[3]
                };
            }
        }

        this.writeToFile(level, logEntry);

        if (this.options.logToConsole) {
            this.logToConsole(level, message, data);
        }
    }

    debug(message, data) {
        this.log('DEBUG', message, data);
    }

    info(message, data) {
        this.log('INFO', message, data);
    }

    warn(message, data) {
        this.log('WARN', message, data);
    }

    error(message, data) {
        this.log('ERROR', message, data);
    }

    fatal(message, data) {
        this.log('FATAL', message, data);
    }

    writeToFile(level, data) {
        try {
            const line = JSON.stringify(data) + '\n';
            fs.appendFileSync(this.logFile, line);
        } catch (err) {
            console.error('Failed to write to log file:', err);
        }
    }

    logToConsole(level, message, data) {
        const colors = {
            DEBUG: '\x1b[36m', // Cyan
            INFO: '\x1b[32m',  // Green
            WARN: '\x1b[33m',  // Yellow
            ERROR: '\x1b[31m', // Red
            FATAL: '\x1b[35m'  // Magenta
        };

        const color = colors[level] || '\x1b[0m';
        const reset = '\x1b[0m';
        const timestamp = new Date().toISOString().substr(11, 12);

        console.log(`${color}[${timestamp}] [${level}]${reset} ${message}`);
        
        if (Object.keys(data).length > 0) {
            console.log(util.inspect(data, { depth: 3, colors: true }));
        }
    }

    writeCrashDump(error) {
        const crashDir = path.join(this.options.logDir, '..', 'crash-dumps');
        if (!fs.existsSync(crashDir)) {
            fs.mkdirSync(crashDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const crashFile = path.join(crashDir, `crash-${timestamp}.json`);

        const crashData = {
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            },
            process: {
                version: process.version,
                platform: process.platform,
                arch: process.arch,
                memoryUsage: process.memoryUsage(),
                uptime: process.uptime(),
                cwd: process.cwd(),
                argv: process.argv,
                env: process.env
            }
        };

        try {
            fs.writeFileSync(crashFile, JSON.stringify(crashData, null, 2));
            this.log('INFO', `Crash dump written to ${crashFile}`);
        } catch (err) {
            console.error('Failed to write crash dump:', err);
        }
    }

    rotateLogs() {
        try {
            const files = fs.readdirSync(this.options.logDir)
                .filter(f => f.startsWith(this.options.prefix) && f.endsWith('.log'))
                .map(f => ({
                    name: f,
                    path: path.join(this.options.logDir, f),
                    time: fs.statSync(path.join(this.options.logDir, f)).mtime
                }))
                .sort((a, b) => b.time - a.time);

            // Keep only the most recent files
            if (files.length > this.options.maxFiles) {
                const toDelete = files.slice(this.options.maxFiles);
                toDelete.forEach(file => {
                    fs.unlinkSync(file.path);
                    this.log('DEBUG', `Rotated old log file: ${file.name}`);
                });
            }
        } catch (err) {
            this.log('WARN', 'Failed to rotate logs', { error: err.message });
        }
    }

    // Process monitoring helpers
    startProcessMonitoring(pid, name = 'unknown') {
        this.processInfo[pid] = {
            name,
            startTime: Date.now(),
            alive: true
        };

        this.log('INFO', `Started monitoring process ${name}`, { pid });
    }

    updateProcessStatus(pid, status) {
        if (this.processInfo[pid]) {
            this.processInfo[pid] = { ...this.processInfo[pid], ...status };
            this.log('DEBUG', `Process status update`, { pid, status });
        }
    }

    endProcessMonitoring(pid, exitCode) {
        if (this.processInfo[pid]) {
            const duration = Date.now() - this.processInfo[pid].startTime;
            this.log('INFO', `Process ${this.processInfo[pid].name} ended`, {
                pid,
                exitCode,
                duration,
                crashed: exitCode !== 0
            });
            this.processInfo[pid].alive = false;
        }
    }

    // Helper to log VS Code specific events
    logVSCodeEvent(event, data = {}) {
        this.log('INFO', `VS Code Event: ${event}`, {
            vscode: true,
            event,
            ...data
        });
    }

    // Helper to log WebdriverIO specific events
    logWdioEvent(event, data = {}) {
        this.log('DEBUG', `WebdriverIO Event: ${event}`, {
            wdio: true,
            event,
            ...data
        });
    }

    // Get current log file path
    getLogFile() {
        return this.logFile;
    }

    // Get all log files
    getAllLogs() {
        try {
            return fs.readdirSync(this.options.logDir)
                .filter(f => f.startsWith(this.options.prefix) && f.endsWith('.log'))
                .map(f => path.join(this.options.logDir, f));
        } catch (err) {
            return [];
        }
    }
}

// Singleton instance for global access
let globalLogger = null;

function getLogger(options) {
    if (!globalLogger) {
        globalLogger = new DebugLogger(options);
    }
    return globalLogger;
}

module.exports = {
    DebugLogger,
    getLogger
};