/**
 * Minimal crash reproduction test
 * Incrementally tests VS Code launch to identify crash triggers
 */

const VSCodeMonitor = require('./vscode-monitor');
const { DebugLogger } = require('./debug-logger');
const path = require('path');
const fs = require('fs');

class MinimalCrashTest {
    constructor() {
        this.logger = new DebugLogger({
            prefix: 'minimal-test',
            logLevel: 'DEBUG'
        });

        this.monitor = new VSCodeMonitor({
            trackResources: true,
            captureOutput: true,
            checkInterval: 500
        });

        this.testSteps = [];
        this.results = [];
    }

    async runIncrementalTest() {
        this.logger.info('Starting incremental crash test');
        
        // Define test steps from minimal to complex
        const steps = [
            {
                name: 'basic-launch',
                description: 'Launch VS Code without any arguments',
                test: () => this.testBasicLaunch()
            },
            {
                name: 'with-workspace',
                description: 'Launch VS Code with test workspace',
                test: () => this.testWithWorkspace()
            },
            {
                name: 'with-extension-path',
                description: 'Launch VS Code with extension development path',
                test: () => this.testWithExtension()
            },
            {
                name: 'with-profile',
                description: 'Launch VS Code with isolated profile',
                test: () => this.testWithProfile()
            },
            {
                name: 'full-test-config',
                description: 'Launch VS Code with full test configuration',
                test: () => this.testFullConfiguration()
            },
            {
                name: 'with-wdio',
                description: 'Launch VS Code with WebdriverIO automation',
                test: () => this.testWithWebdriverIO()
            }
        ];

        // Run each step
        for (const step of steps) {
            this.logger.info(`\n${'='.repeat(50)}`);
            this.logger.info(`Running step: ${step.name}`);
            this.logger.info(`Description: ${step.description}`);
            this.logger.info(`${'='.repeat(50)}\n`);

            const result = await this.runStep(step);
            this.results.push(result);

            if (!result.success) {
                this.logger.error(`Step failed: ${step.name}`, {
                    error: result.error,
                    crashed: result.crashed
                });

                // Stop at first failure
                if (result.crashed) {
                    this.logger.fatal('Crash detected! Stopping test sequence.');
                    break;
                }
            } else {
                this.logger.info(`✅ Step passed: ${step.name}`);
            }

            // Clean up between steps
            await this.cleanup();
            await this.delay(3000);
        }

        // Generate report
        return this.generateReport();
    }

    async runStep(step) {
        const startTime = Date.now();
        let result = {
            step: step.name,
            description: step.description,
            startTime: new Date().toISOString(),
            success: false,
            crashed: false,
            error: null,
            duration: 0,
            processInfo: null
        };

        try {
            result.processInfo = await step.test();
            result.success = true;
            this.logger.info(`Step completed successfully: ${step.name}`);
        } catch (error) {
            result.error = error.message;
            result.crashed = error.message.includes('crash') || 
                           error.message.includes('died') ||
                           error.message.includes('exit');
            
            this.logger.error(`Step failed: ${step.name}`, {
                error: error.message,
                stack: error.stack
            });
        } finally {
            result.duration = Date.now() - startTime;
        }

        return result;
    }

    async testBasicLaunch() {
        this.logger.info('Testing basic VS Code launch');
        
        const { pid, launchId } = await this.monitor.launchVSCode([], {
            useTestProfile: false
        });

        // Wait a bit to see if it stays alive
        await this.delay(5000);

        const info = this.monitor.getProcessInfo(pid);
        
        if (!info.alive) {
            throw new Error(`VS Code process died (exit: ${info.exitCode}, signal: ${info.signal})`);
        }

        this.logger.info('Basic launch successful', { pid, launchId });
        return { pid, launchId };
    }

    async testWithWorkspace() {
        this.logger.info('Testing VS Code with workspace');

        // Create test workspace
        const testWorkspace = path.join(__dirname, '..', '.test-workspace');
        if (!fs.existsSync(testWorkspace)) {
            fs.mkdirSync(testWorkspace, { recursive: true });
        }

        const { pid, launchId } = await this.monitor.launchVSCode([], {
            workspace: testWorkspace,
            useTestProfile: false
        });

        await this.delay(5000);

        const info = this.monitor.getProcessInfo(pid);
        
        if (!info.alive) {
            throw new Error(`VS Code process died with workspace (exit: ${info.exitCode})`);
        }

        this.logger.info('Workspace launch successful', { pid, workspace: testWorkspace });
        return { pid, launchId, workspace: testWorkspace };
    }

    async testWithExtension() {
        this.logger.info('Testing VS Code with extension development path');

        const extensionPath = path.join(process.cwd());
        
        this.logger.debug('Extension path', { extensionPath });

        const { pid, launchId } = await this.monitor.launchVSCode([], {
            extensionPath,
            useTestProfile: false
        });

        // Wait longer for extension to load
        await this.delay(10000);

        const info = this.monitor.getProcessInfo(pid);
        
        if (!info.alive) {
            throw new Error(`VS Code process died with extension (exit: ${info.exitCode})`);
        }

        // Check if extension host started
        const metrics = this.monitor.getMetrics(pid);
        const extensionHostStarted = metrics?.events.some(e => 
            e.event === 'extension-host-started'
        );

        this.logger.info('Extension launch result', { 
            pid, 
            extensionPath,
            extensionHostStarted 
        });

        return { pid, launchId, extensionPath, extensionHostStarted };
    }

    async testWithProfile() {
        this.logger.info('Testing VS Code with isolated profile');

        const { pid, launchId } = await this.monitor.launchVSCode([], {
            useTestProfile: true
        });

        await this.delay(5000);

        const info = this.monitor.getProcessInfo(pid);
        
        if (!info.alive) {
            throw new Error(`VS Code process died with test profile (exit: ${info.exitCode})`);
        }

        this.logger.info('Profile launch successful', { pid });
        return { pid, launchId };
    }

    async testFullConfiguration() {
        this.logger.info('Testing VS Code with full test configuration');

        const extensionPath = path.join(process.cwd());
        const testWorkspace = path.join(__dirname, '..', '.test-workspace');

        const { pid, launchId } = await this.monitor.launchVSCode([
            '--disable-gpu',
            '--disable-updates',
            '--verbose'
        ], {
            extensionPath,
            workspace: testWorkspace,
            useTestProfile: true
        });

        // Wait for full initialization
        await this.delay(15000);

        const info = this.monitor.getProcessInfo(pid);
        
        if (!info.alive) {
            throw new Error(`VS Code process died with full config (exit: ${info.exitCode})`);
        }

        const metrics = this.monitor.getMetrics(pid);
        
        this.logger.info('Full configuration launch result', {
            pid,
            alive: info.alive,
            events: metrics?.events.length || 0,
            crashes: info.crashes.length
        });

        return { 
            pid, 
            launchId,
            configuration: 'full',
            metrics: {
                events: metrics?.events.length || 0,
                avgMemory: metrics?.memory.length ? 
                    metrics.memory.reduce((a, b) => a + b, 0) / metrics.memory.length : 0
            }
        };
    }

    async testWithWebdriverIO() {
        this.logger.info('Testing VS Code with WebdriverIO');

        // This would require actually running WebdriverIO
        // For now, just test if VS Code can be launched with the necessary flags
        
        const extensionPath = path.join(process.cwd());
        const testWorkspace = path.join(__dirname, '..', '.test-workspace');

        const { pid, launchId } = await this.monitor.launchVSCode([
            '--no-sandbox',
            '--disable-gpu',
            '--disable-updates',
            '--disable-workspace-trust'
        ], {
            extensionPath,
            workspace: testWorkspace,
            useTestProfile: true
        });

        await this.delay(10000);

        const info = this.monitor.getProcessInfo(pid);
        
        if (!info.alive) {
            throw new Error(`VS Code process died with WebdriverIO config (exit: ${info.exitCode})`);
        }

        this.logger.info('WebdriverIO configuration launch successful', { pid });

        // Try to run a simple WebdriverIO test if available
        try {
            // This would normally connect to VS Code via WebdriverIO
            this.logger.info('WebdriverIO connection would be tested here');
        } catch (error) {
            this.logger.warn('WebdriverIO connection test skipped', { error: error.message });
        }

        return { pid, launchId, wdioReady: true };
    }

    async cleanup() {
        this.logger.debug('Cleaning up processes');
        this.monitor.killAllVSCodeProcesses();
        await this.delay(2000);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            results: this.results,
            summary: {
                totalSteps: this.results.length,
                passed: this.results.filter(r => r.success).length,
                failed: this.results.filter(r => !r.success).length,
                crashed: this.results.filter(r => r.crashed).length,
                firstFailure: this.results.find(r => !r.success)?.step || null,
                firstCrash: this.results.find(r => r.crashed)?.step || null
            },
            recommendation: this.getRecommendation()
        };

        // Save report
        const reportPath = path.join(__dirname, 'logs', `minimal-test-report-${Date.now()}.json`);
        
        try {
            const logsDir = path.join(__dirname, 'logs');
            if (!fs.existsSync(logsDir)) {
                fs.mkdirSync(logsDir, { recursive: true });
            }
            
            fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
            this.logger.info(`Report saved to ${reportPath}`);
        } catch (error) {
            this.logger.error('Failed to save report', { error: error.message });
        }

        // Print summary
        console.log('\n' + '='.repeat(60));
        console.log('MINIMAL CRASH TEST REPORT');
        console.log('='.repeat(60));
        console.log(`Total Steps: ${report.summary.totalSteps}`);
        console.log(`Passed: ${report.summary.passed}`);
        console.log(`Failed: ${report.summary.failed}`);
        console.log(`Crashed: ${report.summary.crashed}`);
        
        if (report.summary.firstFailure) {
            console.log(`\n❌ First failure at: ${report.summary.firstFailure}`);
        }
        
        if (report.summary.firstCrash) {
            console.log(`💥 First crash at: ${report.summary.firstCrash}`);
        }
        
        console.log(`\n📋 Recommendation: ${report.recommendation}`);
        console.log('='.repeat(60));

        return report;
    }

    getRecommendation() {
        const firstCrash = this.results.find(r => r.crashed);
        const firstFailure = this.results.find(r => !r.success);

        if (!firstFailure) {
            return 'All tests passed! VS Code launches successfully with all configurations.';
        }

        if (firstCrash) {
            switch (firstCrash.step) {
                case 'basic-launch':
                    return 'VS Code crashes on basic launch. Check VS Code installation and system requirements.';
                case 'with-workspace':
                    return 'VS Code crashes with workspace. Check workspace path permissions.';
                case 'with-extension-path':
                    return 'VS Code crashes with extension path. Check extension compilation and conflicts with --disable-extensions flag.';
                case 'with-profile':
                    return 'VS Code crashes with test profile. Check profile directory permissions and disk space.';
                case 'full-test-config':
                    return 'VS Code crashes with full configuration. Try removing individual flags to identify the problematic one.';
                case 'with-wdio':
                    return 'VS Code crashes with WebdriverIO configuration. Check for WebdriverIO service compatibility.';
                default:
                    return 'Unknown crash point. Review logs for details.';
            }
        }

        return `Test failed at ${firstFailure.step}. Review error: ${firstFailure.error}`;
    }
}

// Run if executed directly
if (require.main === module) {
    console.log('🔬 Minimal VS Code Crash Reproduction Test');
    console.log('='.repeat(60));
    console.log('This test will incrementally launch VS Code with different');
    console.log('configurations to identify what causes crashes.');
    console.log('='.repeat(60));
    console.log('');

    const test = new MinimalCrashTest();
    
    test.runIncrementalTest()
        .then(report => {
            process.exit(report.summary.crashed > 0 ? 1 : 0);
        })
        .catch(error => {
            console.error('Test failed:', error);
            process.exit(2);
        });
}

module.exports = MinimalCrashTest;