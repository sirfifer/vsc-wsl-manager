/**
 * Fixed WebdriverIO Configuration for VS Code Extension Testing
 * Uses custom service to fix extension loading issues
 */

const FixedVSCodeService = require('./test/e2e-fix/fixed-vscode-service');
const { DebugLogger } = require('./test/e2e-debug/debug-logger');
const pathUtils = require('./test/e2e-fix/path-utils');
const path = require('path');
const fs = require('fs');

// Initialize logger
const logger = new DebugLogger({
    prefix: 'wdio-config-fixed',
    logLevel: process.env.DEBUG_LEVEL || 'INFO'
});

// Get project root in proper format
const projectRoot = process.cwd();
const projectRootWin = pathUtils.getProjectRoot('windows');

logger.info('WebdriverIO Fixed Configuration', {
    projectRoot,
    projectRootWin,
    debugMode: process.env.DEBUG || false
});

// Create test workspace if needed
const testWorkspacePath = path.join(projectRoot, '.test-workspace');
if (!fs.existsSync(testWorkspacePath)) {
    fs.mkdirSync(testWorkspacePath, { recursive: true });
    logger.info('Created test workspace', { path: testWorkspacePath });
}

exports.config = {
    runner: 'local',
    
    // Test specs
    specs: [
        './test/e2e/wsl-manager-complete.test.js'
    ],
    
    exclude: [],
    
    maxInstances: 1,
    
    capabilities: [{
        browserName: 'vscode',
        browserVersion: 'stable',
        'wdio:vscodeOptions': {
            // Extension path must point to project root
            extensionPath: projectRootWin,
            
            // Use test profile to avoid conflicts
            userDataDir: path.join(projectRoot, '.vscode-test-profile'),
            
            // Open test workspace
            workspacePath: testWorkspacePath,
            
            // Custom user settings
            userSettings: {
                'update.mode': 'none',
                'telemetry.telemetryLevel': 'off',
                'workbench.startupEditor': 'none',
                'extensions.autoUpdate': false,
                'security.workspace.trust.enabled': false,
                'window.zoomLevel': 0
            }
        }
    }],
    
    // Logging
    logLevel: process.env.DEBUG ? 'debug' : 'info',
    bail: 0,
    waitforTimeout: 10000,
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3,
    
    // Use our fixed service
    services: [
        [FixedVSCodeService, {
            // Service options if needed
        }]
    ],
    
    framework: 'mocha',
    
    reporters: [
        'spec',
        ['junit', {
            outputDir: './test-results',
            outputFileFormat: function(options) {
                return `wsl-manager-e2e-${Date.now()}.xml`;
            }
        }]
    ],
    
    mochaOpts: {
        ui: 'bdd',
        timeout: 120000,
        require: ['chai']
    },
    
    // Hooks for debugging and monitoring
    onPrepare: function (config, capabilities) {
        logger.info('onPrepare: Test suite preparing', {
            specs: config.specs,
            capabilities: capabilities.length
        });
        
        // Clean up old screenshots
        const screenshotDir = path.join(projectRoot, 'test-screenshots');
        if (fs.existsSync(screenshotDir)) {
            const files = fs.readdirSync(screenshotDir);
            logger.info(`Cleaning ${files.length} old screenshots`);
            files.forEach(file => {
                if (file.endsWith('.png') || file.endsWith('.jpg')) {
                    fs.unlinkSync(path.join(screenshotDir, file));
                }
            });
        }
    },
    
    beforeSession: function (config, capabilities, specs) {
        logger.info('beforeSession: Starting new session', {
            specs: specs.length,
            sessionId: new Date().getTime()
        });
    },
    
    before: function (capabilities, specs) {
        logger.info('before: Test suite starting', {
            capabilities: capabilities.browserName,
            specs: specs.map(s => path.basename(s))
        });
        
        console.log('\n' + '='.repeat(60));
        console.log('WSL MANAGER E2E UI TEST SUITE');
        console.log('='.repeat(60));
        console.log('Extension Path:', pathUtils.getProjectRoot('windows'));
        console.log('Debug Mode:', process.env.DEBUG || 'disabled');
        console.log('Log Level:', process.env.DEBUG_LEVEL || 'INFO');
        console.log('='.repeat(60) + '\n');
    },
    
    beforeTest: function (test, context) {
        logger.info('beforeTest: Test starting', {
            test: test.title,
            file: path.basename(test.file)
        });
    },
    
    afterTest: function (test, context, { error, result, duration, passed, retries }) {
        logger.info('afterTest: Test completed', {
            test: test.title,
            passed,
            duration,
            error: error ? error.message : null,
            retries
        });
        
        // Take screenshot on failure
        if (!passed && error) {
            const screenshotPath = path.join(
                process.cwd(), 
                'test-screenshots',
                `FAILURE-${test.title.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.png`
            );
            
            try {
                browser.saveScreenshot(screenshotPath);
                logger.error('Test failed - screenshot saved', { path: screenshotPath });
            } catch (e) {
                logger.error('Failed to save error screenshot', { error: e.message });
            }
        }
    },
    
    after: function (result, capabilities, specs) {
        logger.info('after: Test suite completed', {
            result,
            duration: new Date().getTime()
        });
        
        console.log('\n' + '='.repeat(60));
        console.log('TEST SUITE COMPLETE');
        console.log(`Result: ${result === 0 ? 'PASSED' : 'FAILED'}`);
        console.log('Check test-screenshots/ for visual evidence');
        console.log('Check test/e2e-debug/logs/ for detailed logs');
        console.log('='.repeat(60) + '\n');
    },
    
    afterSession: function (config, capabilities, specs) {
        logger.info('afterSession: Session ended', {
            specs: specs.length
        });
    },
    
    onComplete: function (exitCode, config, capabilities, results) {
        logger.info('onComplete: All tests finished', {
            exitCode,
            passed: results.passed,
            failed: results.failed
        });
        
        if (exitCode !== 0) {
            logger.error('Tests failed', { 
                exitCode,
                failures: results.failed 
            });
        } else {
            logger.info('All tests passed!');
        }
        
        // Generate summary report
        const reportPath = path.join(process.cwd(), 'test-results', 'summary.json');
        const summary = {
            timestamp: new Date().toISOString(),
            exitCode,
            passed: results.passed || 0,
            failed: results.failed || 0,
            duration: results.duration || 0,
            specs: config.specs
        };
        
        try {
            if (!fs.existsSync(path.dirname(reportPath))) {
                fs.mkdirSync(path.dirname(reportPath), { recursive: true });
            }
            fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
            logger.info('Summary report saved', { path: reportPath });
        } catch (e) {
            logger.error('Failed to save summary report', { error: e.message });
        }
    },
    
    onError: function(error) {
        logger.error('Test error occurred', {
            message: error.message,
            stack: error.stack,
            type: error.name
        });
        
        console.error('\n❌ Test Error:', error.message);
    }
};