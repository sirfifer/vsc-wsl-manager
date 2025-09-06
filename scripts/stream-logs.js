#!/usr/bin/env node

/**
 * Real-time log streaming utility for development
 * Watches log files and streams new content to console
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const LOG_DIR = path.join(process.env.APPDATA || process.env.HOME || '', 'vsc-wsl-manager', 'logs');
const COLORS = {
    DEBUG: '\x1b[36m', // Cyan
    INFO: '\x1b[32m',  // Green
    WARN: '\x1b[33m',  // Yellow
    ERROR: '\x1b[31m', // Red
    RESET: '\x1b[0m'
};

class LogStreamer {
    constructor() {
        this.watchers = new Map();
        this.tailProcesses = new Map();
    }

    start() {
        console.log('📊 Starting log stream monitor...');
        console.log(`📁 Watching directory: ${LOG_DIR}`);
        console.log('-----------------------------------\n');

        // Ensure log directory exists
        if (!fs.existsSync(LOG_DIR)) {
            fs.mkdirSync(LOG_DIR, { recursive: true });
            console.log('✅ Created log directory');
        }

        // Watch for new log files
        this.watchDirectory();

        // Start tailing existing log files
        this.tailExistingLogs();

        // Handle graceful shutdown
        process.on('SIGINT', () => this.cleanup());
        process.on('SIGTERM', () => this.cleanup());
    }

    watchDirectory() {
        fs.watch(LOG_DIR, (eventType, filename) => {
            if (eventType === 'rename' && filename && filename.endsWith('.log')) {
                const filePath = path.join(LOG_DIR, filename);
                
                if (fs.existsSync(filePath) && !this.watchers.has(filePath)) {
                    console.log(`\n🆕 New log file detected: ${filename}`);
                    this.tailLogFile(filePath);
                }
            }
        });
    }

    tailExistingLogs() {
        try {
            const files = fs.readdirSync(LOG_DIR)
                .filter(f => f.endsWith('.log') && !f.includes('rotated'))
                .map(f => path.join(LOG_DIR, f))
                .sort((a, b) => {
                    const statA = fs.statSync(a);
                    const statB = fs.statSync(b);
                    return statB.mtime - statA.mtime;
                });

            if (files.length > 0) {
                // Tail the most recent log file
                const recentFile = files[0];
                console.log(`📄 Tailing: ${path.basename(recentFile)}`);
                this.tailLogFile(recentFile);
            } else {
                console.log('⏳ No log files found. Waiting for logs...');
            }
        } catch (error) {
            console.error('❌ Error reading log directory:', error.message);
        }
    }

    tailLogFile(filePath) {
        // Use platform-specific tail command
        const isWindows = process.platform === 'win32';
        const tailCmd = isWindows ? 'powershell' : 'tail';
        const tailArgs = isWindows 
            ? ['-Command', `Get-Content "${filePath}" -Wait -Tail 0`]
            : ['-f', filePath];

        const tail = spawn(tailCmd, tailArgs);
        this.tailProcesses.set(filePath, tail);

        tail.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    this.formatAndPrint(line);
                }
            });
        });

        tail.stderr.on('data', (data) => {
            console.error(`❌ Tail error: ${data}`);
        });

        tail.on('close', (code) => {
            if (code !== 0 && code !== null) {
                console.log(`⚠️ Tail process exited with code ${code}`);
            }
            this.tailProcesses.delete(filePath);
        });
    }

    formatAndPrint(line) {
        // Parse log level from line
        let color = COLORS.RESET;
        let prefix = '';

        if (line.includes('[DEBUG]')) {
            color = COLORS.DEBUG;
            prefix = '🐛';
        } else if (line.includes('[INFO]')) {
            color = COLORS.INFO;
            prefix = 'ℹ️';
        } else if (line.includes('[WARN]')) {
            color = COLORS.WARN;
            prefix = '⚠️';
        } else if (line.includes('[ERROR]')) {
            color = COLORS.ERROR;
            prefix = '❌';
        }

        // Extract timestamp and message
        const timestampMatch = line.match(/\[([\d-T:.Z]+)\]/);
        if (timestampMatch) {
            const timestamp = new Date(timestampMatch[1]).toLocaleTimeString();
            const message = line.substring(line.indexOf(']', line.indexOf(']') + 1) + 1).trim();
            console.log(`${color}${prefix} [${timestamp}] ${message}${COLORS.RESET}`);
        } else {
            console.log(`${color}${line}${COLORS.RESET}`);
        }
    }

    cleanup() {
        console.log('\n\n🛑 Shutting down log streamer...');
        
        // Kill all tail processes
        this.tailProcesses.forEach((process, file) => {
            process.kill();
            console.log(`✅ Stopped tailing: ${path.basename(file)}`);
        });

        // Clear watchers
        this.watchers.forEach(watcher => watcher.close());
        
        process.exit(0);
    }
}

// Start the log streamer
const streamer = new LogStreamer();
streamer.start();