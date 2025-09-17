import type { Options } from '@wdio/types';
import * as path from 'path';

/**
 * WebdriverIO Configuration for VSC WSL Manager E2E Tests
 * Optimized for testing VS Code extensions with AI-friendly structure
 */
export const config: Options.Testrunner = {
    //
    // Test runner configuration
    //
    runner: 'local',
    autoCompileOpts: {
        autoCompile: true,
        tsNodeOpts: {
            transpileOnly: true,
            project: './e2e/tsconfig.json'
        }
    },

    //
    // Test specifications
    //
    specs: [
        './e2e/specs/**/*.e2e.ts'
    ],
    
    // Patterns to exclude
    exclude: [
        './e2e/specs/**/*.skip.ts'
    ],
    
    //
    // Test execution settings
    //
    maxInstances: 1, // VS Code testing should be sequential
    
    //
    // VS Code capabilities configuration
    //
    capabilities: [{
        browserName: 'vscode',
        browserVersion: process.env.VSCODE_VERSION || 'stable',
        'wdio:vscodeOptions': {
            // Path to the extension
            extensionPath: path.resolve(__dirname, '..'),
            
            // VS Code binary path (optional, will find automatically)
            // vscodeExecutablePath: '/path/to/code',
            
            // User settings for test environment
            userSettings: {
                'window.zoomLevel': 0,
                'workbench.colorTheme': 'Default Light+',
                'editor.fontSize': 14,
                'terminal.integrated.fontSize': 14,
                // Disable notifications during tests
                'window.enableMenuBarMnemonics': false,
                'workbench.tips.enabled': false,
                'update.mode': 'none'
            },
            
            // Workspace settings
            workspaceSettings: {
                'vsc-wsl-manager.autoRefresh': false,
                'vsc-wsl-manager.refreshInterval': 1000
            },
            
            // Extensions to disable during testing
            disableExtensions: [
                'ms-vscode.cpptools',
                'ms-python.python'
            ],
            
            // Launch arguments
            launchArgs: [
                '--disable-gpu',
                '--no-sandbox'
            ]
        }
    }],
    
    //
    // Logging and reporting
    //
    logLevel: 'info', // trace | debug | info | warn | error | silent
    coloredLogs: true,
    deprecationWarnings: true,
    bail: 0, // Don't bail, run all tests
    
    //
    // Timeouts
    //
    waitforTimeout: 10000,
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3,
    
    //
    // Services
    //
    services: [
        ['vscode', {
            cachePath: '.vscode-test',
            download: {
                version: process.env.VSCODE_VERSION || 'stable',
                platform: process.env.TEST_PLATFORM || 'linux-x64'
            }
        }]
    ],
    
    //
    // Test framework
    //
    framework: 'mocha',
    mochaOpts: {
        ui: 'bdd',
        timeout: 60000,
        require: ['ts-node/register'],
        retries: process.env.CI ? 2 : 0
    },
    
    //
    // Reporters
    //
    reporters: [
        'spec',
        ['allure', {
            outputDir: 'e2e/allure-results',
            disableWebdriverStepsReporting: true,
            disableWebdriverScreenshotsReporting: false,
            useCucumberStepReporter: false
        }],
        ['junit', {
            outputDir: './e2e/junit-results',
            outputFileFormat: function(options) {
                return `results-${options.cid}.xml`;
            }
        }]
    ],
    
    //
    // Hooks for test lifecycle
    //
    
    /**
     * Gets executed once before all workers get launched.
     */
    onPrepare: function (config, capabilities) {
        console.log('🚀 Starting E2E tests for VSC WSL Manager');
    },
    
    /**
     * Gets executed before a worker process is spawned
     */
    onWorkerStart: function (cid, caps, specs, args, execArgv) {
        console.log(`🔧 Worker ${cid} started`);
    },
    
    /**
     * Gets executed just before initialising the webdriver session
     */
    beforeSession: function (config, capabilities, specs) {
        // Set up TypeScript support
        require('ts-node').register({
            transpileOnly: true,
            project: './e2e/tsconfig.json'
        });
    },
    
    /**
     * Gets executed before test execution begins
     */
    before: async function (capabilities, specs) {
        // Wait for VS Code to be ready
        await browser.executeWorkbench(async (vscode) => {
            // Clear any previous state
            await vscode.commands.executeCommand('workbench.action.closeAllEditors');
            await vscode.commands.executeCommand('workbench.action.terminal.killAll');
            
            // Ensure extension is activated
            const ext = vscode.extensions.getExtension('vsc-wsl-manager');
            if (ext && !ext.isActive) {
                await ext.activate();
            }
        });
        
        // Set up global test utilities
        global.testHelpers = {
            async waitForTreeItem(label: string, timeout = 5000) {
                await browser.waitUntil(
                    async () => {
                        const items = await $$(`[aria-label*="${label}"]`);
                        return items.length > 0;
                    },
                    { timeout, timeoutMsg: `Tree item "${label}" not found` }
                );
            },
            
            async openCommandPalette() {
                await browser.keys(['F1']);
                await browser.pause(500);
            }
        };
    },
    
    /**
     * Hook that gets executed before each test
     */
    beforeTest: async function (test, context) {
        console.log(`📝 Running: ${test.title}`);
        
        // Clear notifications before each test
        await browser.executeWorkbench(async (vscode) => {
            await vscode.commands.executeCommand('notifications.clearAll');
        });
    },
    
    /**
     * Hook that gets executed after each test
     */
    afterTest: async function(test, context, { error, result, duration, passed, retries }) {
        if (!passed) {
            // Take screenshot on failure
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `${test.title.replace(/\s+/g, '_')}_${timestamp}.png`;
            await browser.saveScreenshot(`./e2e/screenshots/${filename}`);
            
            console.log(`❌ Test failed: ${test.title}`);
            console.log(`   Screenshot: ${filename}`);
        } else {
            console.log(`✅ Test passed: ${test.title} (${duration}ms)`);
        }
    },
    
    /**
     * Hook that gets executed after all tests are done
     */
    after: async function (result, capabilities, specs) {
        // Clean up test workspace
        await browser.executeWorkbench(async (vscode) => {
            await vscode.commands.executeCommand('workbench.action.closeAllEditors');
            await vscode.commands.executeCommand('workbench.action.terminal.killAll');
        });
    },
    
    /**
     * Gets executed after all workers have shut down
     */
    onComplete: function(exitCode, config, capabilities, results) {
        console.log('✨ E2E tests completed');
        
        // Generate summary
        const passed = results.passed || 0;
        const failed = results.failed || 0;
        const skipped = results.skipped || 0;
        
        console.log(`📊 Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
    }
};

// Export additional configurations for different environments
export const ciConfig: Options.Testrunner = {
    ...config,
    maxInstances: 1,
    bail: 1, // Stop on first failure in CI
    mochaOpts: {
        ...config.mochaOpts,
        retries: 2 // Retry failed tests in CI
    }
};

export const debugConfig: Options.Testrunner = {
    ...config,
    logLevel: 'debug',
    mochaOpts: {
        ...config.mochaOpts,
        timeout: 300000 // 5 minutes for debugging
    }
};
