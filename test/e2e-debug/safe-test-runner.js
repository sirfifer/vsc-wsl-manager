/**
 * Safe test runner with crash detection and recovery
 * Provides isolated test execution with automatic retry and detailed error capture
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { DebugLogger } = require('./debug-logger');

class SafeTestRunner {
    constructor(options = {}) {
        this.options = {
            maxRetries: options.maxRetries || 3,
            retryDelay: options.retryDelay || 5000,
            timeout: options.timeout || 120000,
            cleanupOnFail: options.cleanupOnFail !== false,
            monitorInterval: options.monitorInterval || 1000,
            ...options
        };

        this.logger = new DebugLogger({
            prefix: 'safe-runner',
            logLevel: process.env.DEBUG_LEVEL || 'INFO'
        });

        this.processes = new Map();
        this.crashes = [];
        this.currentTest = null;
    }

    async runTest(testCommand, testName = 'unnamed') {
        this.currentTest = testName;
        this.logger.info(`Starting test: ${testName}`, { command: testCommand });

        let attempt = 0;
        let lastError = null;
        let success = false;

        while (attempt < this.options.maxRetries && !success) {
            attempt++;
            this.logger.info(`Test attempt ${attempt}/${this.options.maxRetries}`, { test: testName });

            try {
                const result = await this.executeTest(testCommand, attempt);
                
                if (result.success) {
                    success = true;
                    this.logger.info(`Test passed on attempt ${attempt}`, { 
                        test: testName,
                        duration: result.duration 
                    });
                    return result;
                } else {
                    lastError = result.error;
                    this.logger.warn(`Test failed on attempt ${attempt}`, {
                        test: testName,
                        error: result.error,
                        exitCode: result.exitCode,
                        crashed: result.crashed
                    });

                    if (result.crashed) {
                        this.crashes.push({
                            test: testName,
                            attempt,
                            error: result.error,
                            timestamp: new Date().toISOString()
                        });
                    }

                    if (attempt < this.options.maxRetries) {
                        this.logger.info(`Retrying in ${this.options.retryDelay}ms...`);
                        await this.cleanup();
                        await this.delay(this.options.retryDelay);
                    }
                }
            } catch (error) {
                lastError = error;
                this.logger.error(`Unexpected error in test execution`, {
                    test: testName,
                    attempt,
                    error: error.message,
                    stack: error.stack
                });

                if (attempt < this.options.maxRetries) {
                    await this.cleanup();
                    await this.delay(this.options.retryDelay);
                }
            }
        }

        // All attempts failed
        this.logger.error(`Test failed after ${attempt} attempts`, {
            test: testName,
            lastError: lastError?.message || lastError
        });

        return {
            success: false,
            error: lastError,
            attempts: attempt,
            crashes: this.crashes.filter(c => c.test === testName)
        };
    }

    async executeTest(command, attempt) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            let processExited = false;
            let timeoutHandle = null;
            let monitorHandle = null;
            let outputBuffer = [];
            let errorBuffer = [];

            // Parse command to get executable and args
            const [cmd, ...args] = this.parseCommand(command);
            
            this.logger.debug(`Spawning process`, { 
                command: cmd, 
                args,
                attempt 
            });

            // Spawn the test process
            const testProcess = spawn(cmd, args, {
                shell: true,
                env: {
                    ...process.env,
                    DEBUG: process.env.DEBUG || '',
                    DEBUG_LEVEL: process.env.DEBUG_LEVEL || 'INFO',
                    TEST_ATTEMPT: attempt.toString(),
                    SAFE_MODE: 'true'
                }
            });

            const pid = testProcess.pid;
            this.processes.set(pid, {
                command,
                startTime,
                name: this.currentTest
            });

            this.logger.startProcessMonitoring(pid, this.currentTest);

            // Capture stdout
            testProcess.stdout.on('data', (data) => {
                const text = data.toString();
                outputBuffer.push(text);
                
                // Log important events
                if (text.includes('FATAL') || text.includes('crash')) {
                    this.logger.error('Crash indicator in output', { 
                        pid, 
                        output: text.substring(0, 200) 
                    });
                }

                // Echo to console if verbose
                if (process.env.DEBUG) {
                    process.stdout.write(data);
                }
            });

            // Capture stderr
            testProcess.stderr.on('data', (data) => {
                const text = data.toString();
                errorBuffer.push(text);
                
                this.logger.warn('Error output from test', { 
                    pid, 
                    error: text.substring(0, 200) 
                });

                // Echo to console
                if (process.env.DEBUG) {
                    process.stderr.write(data);
                }
            });

            // Set up timeout
            timeoutHandle = setTimeout(() => {
                if (!processExited) {
                    this.logger.error('Test timeout exceeded', { 
                        pid, 
                        timeout: this.options.timeout 
                    });
                    testProcess.kill('SIGTERM');
                    
                    setTimeout(() => {
                        if (!processExited) {
                            testProcess.kill('SIGKILL');
                        }
                    }, 5000);
                }
            }, this.options.timeout);

            // Set up process monitoring
            monitorHandle = setInterval(() => {
                if (!processExited) {
                    this.monitorProcess(pid);
                }
            }, this.options.monitorInterval);

            // Handle process exit
            testProcess.on('exit', (code, signal) => {
                processExited = true;
                const duration = Date.now() - startTime;

                clearTimeout(timeoutHandle);
                clearInterval(monitorHandle);

                this.processes.delete(pid);
                this.logger.endProcessMonitoring(pid, code);

                const output = outputBuffer.join('');
                const errors = errorBuffer.join('');

                // Determine if it was a crash
                const crashed = this.detectCrash(code, signal, output, errors);

                if (crashed) {
                    this.saveCrashInfo(this.currentTest, attempt, {
                        code,
                        signal,
                        output: output.substring(0, 5000),
                        errors: errors.substring(0, 5000),
                        duration
                    });
                }

                resolve({
                    success: code === 0 && !crashed,
                    exitCode: code,
                    signal,
                    duration,
                    crashed,
                    output,
                    errors,
                    error: crashed ? 'Process crashed' : (code !== 0 ? `Exit code ${code}` : null)
                });
            });

            // Handle process errors
            testProcess.on('error', (error) => {
                this.logger.error('Failed to spawn test process', {
                    error: error.message,
                    command
                });

                clearTimeout(timeoutHandle);
                clearInterval(monitorHandle);

                resolve({
                    success: false,
                    error: error.message,
                    crashed: true
                });
            });
        });
    }

    detectCrash(exitCode, signal, output, errors) {
        // Check for crash indicators
        const crashIndicators = [
            exitCode === null && signal !== null,
            signal === 'SIGSEGV',
            signal === 'SIGABRT',
            signal === 'SIGILL',
            exitCode > 128,
            output.includes('Segmentation fault'),
            output.includes('Assertion failed'),
            errors.includes('FATAL ERROR'),
            errors.includes('UNCAUGHT EXCEPTION')
        ];

        const crashed = crashIndicators.some(indicator => indicator);

        if (crashed) {
            this.logger.error('Crash detected', {
                exitCode,
                signal,
                indicators: crashIndicators.map((v, i) => ({ 
                    index: i, 
                    triggered: v 
                })).filter(i => i.triggered)
            });
        }

        return crashed;
    }

    saveCrashInfo(testName, attempt, info) {
        const crashDir = path.join(__dirname, 'crash-dumps');
        if (!fs.existsSync(crashDir)) {
            fs.mkdirSync(crashDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const crashFile = path.join(crashDir, `crash-${testName}-attempt${attempt}-${timestamp}.json`);

        const crashData = {
            test: testName,
            attempt,
            timestamp: new Date().toISOString(),
            ...info,
            environment: {
                platform: process.platform,
                nodeVersion: process.version,
                cwd: process.cwd()
            }
        };

        try {
            fs.writeFileSync(crashFile, JSON.stringify(crashData, null, 2));
            this.logger.info(`Crash info saved to ${crashFile}`);
        } catch (err) {
            this.logger.error('Failed to save crash info', { error: err.message });
        }
    }

    monitorProcess(pid) {
        try {
            // Check if process is still running (platform-specific)
            if (process.platform === 'win32') {
                const { execSync } = require('child_process');
                try {
                    execSync(`tasklist /FI "PID eq ${pid}" 2>nul | find "${pid}" >nul`, { 
                        windowsHide: true 
                    });
                    // Process is running
                    this.logger.updateProcessStatus(pid, { alive: true });
                } catch {
                    // Process not found
                    this.logger.updateProcessStatus(pid, { alive: false });
                }
            } else {
                // Unix-like systems
                try {
                    process.kill(pid, 0);
                    this.logger.updateProcessStatus(pid, { alive: true });
                } catch {
                    this.logger.updateProcessStatus(pid, { alive: false });
                }
            }
        } catch (error) {
            this.logger.debug('Error monitoring process', { pid, error: error.message });
        }
    }

    async cleanup() {
        this.logger.info('Performing cleanup...');

        // Kill any remaining test processes
        for (const [pid, info] of this.processes.entries()) {
            try {
                this.logger.info(`Killing process ${pid}`, info);
                process.kill(pid, 'SIGTERM');
                
                // Give it time to exit gracefully
                await this.delay(1000);
                
                // Force kill if still running
                try {
                    process.kill(pid, 'SIGKILL');
                } catch {
                    // Process already dead
                }
            } catch (error) {
                this.logger.debug(`Process ${pid} already terminated`);
            }
        }

        this.processes.clear();

        // Clean up VS Code processes
        if (this.options.cleanupOnFail) {
            await this.cleanupVSCode();
        }
    }

    async cleanupVSCode() {
        this.logger.info('Cleaning up VS Code processes...');
        
        const command = process.platform === 'win32' 
            ? 'taskkill /F /IM Code.exe /T 2>nul'
            : 'pkill -f "Code" || true';

        return new Promise((resolve) => {
            const cleanup = spawn(command, [], { shell: true });
            
            cleanup.on('exit', () => {
                this.logger.info('VS Code cleanup completed');
                resolve();
            });

            cleanup.on('error', (error) => {
                this.logger.warn('VS Code cleanup error', { error: error.message });
                resolve();
            });

            // Timeout cleanup
            setTimeout(resolve, 3000);
        });
    }

    parseCommand(command) {
        // Simple command parsing - can be enhanced for complex commands
        return command.split(' ').filter(arg => arg.length > 0);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            crashes: this.crashes,
            totalCrashes: this.crashes.length,
            logFile: this.logger.getLogFile(),
            summary: {
                crashedTests: [...new Set(this.crashes.map(c => c.test))],
                crashRate: this.crashes.length > 0 ? 
                    `${this.crashes.length} crashes detected` : 
                    'No crashes detected'
            }
        };

        const reportPath = path.join(__dirname, 'logs', `test-report-${Date.now()}.json`);
        
        try {
            fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
            this.logger.info(`Test report saved to ${reportPath}`);
        } catch (err) {
            this.logger.error('Failed to save test report', { error: err.message });
        }

        return report;
    }
}

// Main execution if run directly
if (require.main === module) {
    const runner = new SafeTestRunner({
        maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
        timeout: parseInt(process.env.TEST_TIMEOUT) || 120000
    });

    const testCommand = process.argv.slice(2).join(' ') || 'npm run test:e2e:windows';
    
    console.log('🛡️ Safe Test Runner');
    console.log('='.repeat(50));
    console.log(`Command: ${testCommand}`);
    console.log(`Max retries: ${runner.options.maxRetries}`);
    console.log(`Timeout: ${runner.options.timeout}ms`);
    console.log('='.repeat(50));

    runner.runTest(testCommand, 'e2e-test')
        .then(result => {
            const report = runner.generateReport();
            
            if (result.success) {
                console.log('\n✅ Test completed successfully!');
                process.exit(0);
            } else {
                console.log('\n❌ Test failed');
                console.log(`Attempts: ${result.attempts}`);
                console.log(`Error: ${result.error}`);
                console.log(`Report: ${report.logFile}`);
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('\n💥 Unexpected error:', error);
            process.exit(2);
        });
}

module.exports = SafeTestRunner;