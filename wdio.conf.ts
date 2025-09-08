/**
 * WebdriverIO Configuration for VS Code Extension E2E Testing
 * Uses wdio-vscode-service to test the extension in a real VS Code instance
 */

import type { Options } from '@wdio/types';
import * as path from 'path';

export const config: Options.Testrunner = {
    //
    // ====================
    // Runner Configuration
    // ====================
    runner: 'local',
    
    //
    // ==================
    // Specify Test Files
    // ==================
    specs: [
        './test/e2e/**/*.test.ts'
    ],
    
    // Patterns to exclude
    exclude: [],
    
    //
    // ============
    // Capabilities
    // ============
    maxInstances: 1,
    
    capabilities: [{
        browserName: 'vscode',
        browserVersion: 'stable', // Can be 'stable' or 'insiders'
        'wdio:vscodeOptions': {
            // Path to the extension directory
            extensionPath: path.resolve(__dirname),
            
            // Custom VS Code settings for testing
            userSettings: {
                "terminal.integrated.defaultProfile.windows": "PowerShell",
                "wsl-manager.logging.level": "debug",
                "wsl-manager.autoRegisterProfiles": true
            },
            
            // Open specific workspace for testing
            workspacePath: path.resolve(__dirname, '.test-workspace'),
            
            // VS Code launch args
            vscodeArgs: [
                // Note: Do NOT use --disable-extensions as it prevents our extension from loading!
                // The extensionPath above ensures our extension is loaded in development mode
                '--disable-workspace-trust'
            ]
        }
    }],
    
    //
    // ===================
    // Test Configurations
    // ===================
    
    // Level of logging verbosity
    logLevel: 'info',
    
    // Set specific log levels per logger
    logLevels: {
        webdriver: 'info',
        '@wdio/vscode-service': 'debug'
    },
    
    // Bail after first test failure
    bail: 0,
    
    // Base URL for testing
    baseUrl: 'http://localhost',
    
    // Default timeout for all waitFor* commands
    waitforTimeout: 10000,
    
    // Default timeout for all tests
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3,
    
    //
    // Services
    //
    services: [
        ['vscode', {
            // Additional service options
            cachePath: '.wdio-vscode-service',
            maxInstances: 1
        }]
    ],
    
    //
    // Framework
    //
    framework: 'mocha',
    
    // Mocha options
    mochaOpts: {
        ui: 'bdd',
        timeout: 60000, // 1 minute timeout for tests
        require: ['ts-node/register']
    },
    
    //
    // Reporters
    //
    reporters: [
        'spec'
    ],
    
    //
    // =====
    // Hooks
    // =====
    
    /**
     * Gets executed once before all workers get launched.
     */
    onPrepare: function (config, capabilities) {
        console.log('🚀 Starting E2E tests for VSC WSL Manager Extension');
        
        // Create test workspace if it doesn't exist
        const fs = require('fs');
        const testWorkspace = path.resolve(__dirname, '.test-workspace');
        if (!fs.existsSync(testWorkspace)) {
            fs.mkdirSync(testWorkspace, { recursive: true });
        }
    },
    
    /**
     * Gets executed before a worker process is spawned
     */
    onWorkerStart: function (cid, caps, specs, args, execArgv) {
        console.log(`Worker ${cid} starting with specs:`, specs);
    },
    
    /**
     * Gets executed just before initialising the webdriver session
     */
    beforeSession: function (config, capabilities, specs) {
        console.log('Starting VS Code instance for testing...');
    },
    
    /**
     * Gets executed before test execution begins
     */
    before: function (capabilities, specs) {
        console.log('VS Code instance ready, beginning tests');
    },
    
    /**
     * Hook that gets executed before the suite starts
     */
    beforeSuite: function (suite) {
        console.log(`Starting suite: ${suite.title}`);
    },
    
    /**
     * Hook that gets executed after the suite has ended
     */
    afterSuite: function (suite) {
        console.log(`Finished suite: ${suite.title}`);
    },
    
    /**
     * Gets executed after all tests are done
     */
    after: function (result, capabilities, specs) {
        console.log('All tests completed');
    },
    
    /**
     * Gets executed after all workers got shut down and the process is about to exit
     */
    onComplete: function(exitCode, config, capabilities, results) {
        console.log('🏁 E2E test run complete');
        console.log(`Exit code: ${exitCode}`);
        
        // Generate summary
        let passed = 0;
        let failed = 0;
        
        if (results) {
            Object.values(results).forEach((result: any) => {
                if (result.tests) {
                    result.tests.forEach((test: any) => {
                        if (test.state === 'passed') passed++;
                        else if (test.state === 'failed') failed++;
                    });
                }
            });
        }
        
        console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed\n`);
    }
};