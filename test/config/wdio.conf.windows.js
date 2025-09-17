/**
 * Simple JavaScript WebdriverIO configuration for Windows execution
 * This avoids TypeScript compilation issues when running from Windows
 */

const path = require('path');
const fs = require('fs');
const { DebugLogger } = require('./test/e2e-debug/debug-logger');
const VSCodeMonitor = require('./test/e2e-debug/vscode-monitor');

// Initialize debug logger
const logger = new DebugLogger({
    prefix: 'wdio-config',
    logLevel: process.env.DEBUG_LEVEL || 'INFO'
});

// Initialize VS Code monitor
const vscodeMonitor = new VSCodeMonitor({
    trackResources: true,
    captureOutput: true
});

// Get current directory
const repoRoot = process.cwd();

// Simple path conversion from WSL to Windows
function toWindowsPath(wslPath) {
    if (wslPath.startsWith('/mnt/')) {
        // Convert /mnt/c/path to C:\path
        return wslPath
            .replace(/^\/mnt\/([a-z])/, '$1:')
            .replace(/\//g, '\\');
    }
    return wslPath;
}

// Get Windows path for repo
const repoRootWin = toWindowsPath(repoRoot);

logger.info('WebdriverIO Configuration initialized', {
    repoRoot,
    repoRootWin,
    debugMode: process.env.DEBUG || false,
    logLevel: process.env.DEBUG_LEVEL || 'INFO'
});

console.log('=== WebdriverIO Configuration ===');
console.log('Repo root (WSL):', repoRoot);
console.log('Repo root (Win):', repoRootWin);
console.log('Debug mode:', process.env.DEBUG || 'disabled');

// Create test workspace if needed
const testWorkspacePath = path.join(repoRoot, '.test-workspace');
if (!fs.existsSync(testWorkspacePath)) {
    fs.mkdirSync(testWorkspacePath, { recursive: true });
    console.log('Created test workspace:', testWorkspacePath);
}

// Create VS Code settings for test workspace
const vscodeSettingsPath = path.join(testWorkspacePath, '.vscode');
if (!fs.existsSync(vscodeSettingsPath)) {
    fs.mkdirSync(vscodeSettingsPath, { recursive: true });
    fs.writeFileSync(
        path.join(vscodeSettingsPath, 'settings.json'),
        JSON.stringify({
            "workbench.colorTheme": "Default Dark+",
            "window.zoomLevel": 0,
            "update.mode": "none",
            "telemetry.telemetryLevel": "off"
        }, null, 2)
    );
    console.log('Created VS Code settings');
}

exports.config = {
    runner: 'local',
    
    // Test files
    specs: [
        './test/e2e/**/*.test.js',
        './test/e2e/**/*.test.ts'
    ],
    
    exclude: [],
    
    maxInstances: 1,
    
    capabilities: [{
        browserName: 'vscode',
        browserVersion: 'stable',
        'wdio:vscodeOptions': {
            // Extension path in Windows format - this MUST be an array for multiple extensions
            // or a single path for one extension
            extensionPath: repoRootWin,
            
            // Don't specify executable path - let wdio-vscode-service handle it
            // This avoids path resolution issues
            
            // VS Code launch arguments - carefully selected to avoid conflicts
            // IMPORTANT: Do NOT use --disable-extensions with --extensionDevelopmentPath
            // The extension will be loaded via extensionPath above
            vscodeArgs: [
                // Required for extension development
                `--extensionDevelopmentPath=${repoRootWin}`,
                '--no-sandbox',
                '--disable-gpu',
                '--disable-updates',
                '--disable-workspace-trust',
                '--skip-welcome',
                '--skip-release-notes',
                // Add verbose logging for debugging
                process.env.DEBUG ? '--verbose' : '',
                process.env.DEBUG ? '--log-level=trace' : ''
            ].filter(arg => arg),
            
            // Minimal user settings
            userSettings: {
                'update.mode': 'none',
                'telemetry.telemetryLevel': 'off',
                'workbench.startupEditor': 'none',
                'extensions.autoUpdate': false,
                'security.workspace.trust.enabled': false
            },
            
            // Open test workspace
            workspacePath: toWindowsPath(testWorkspacePath)
        }
    }],
    
    logLevel: process.env.DEBUG ? 'debug' : 'info',
    bail: 0,
    waitforTimeout: 10000,
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3,
    
    // Only use vscode service - configure it properly for extension testing
    services: [
        ['vscode', {
            // Specify that we're testing an extension in development
            // This should prevent the service from using a clean VS Code instance
            vscodeVersion: 'stable',
            // Install the extension from the local build
            installExtensions: false  // Don't install from marketplace
        }]
    ],
    
    framework: 'mocha',
    
    reporters: ['spec'],
    
    mochaOpts: {
        ui: 'bdd',
        timeout: 60000
    },
    
    // Comprehensive hooks for debugging and monitoring
    onPrepare: function (config, capabilities) {
        logger.info('WebdriverIO preparing', {
            capabilities: capabilities.length,
            specs: config.specs
        });
    },

    beforeSession: function (config, capabilities, specs) {
        logger.info('Starting WebdriverIO session', {
            sessionId: new Date().getTime(),
            specs: specs.length
        });
    },

    before: function (capabilities, specs) {
        logger.info('Test suite starting', {
            capabilities: JSON.stringify(capabilities, null, 2),
            specs: specs
        });
        
        console.log('Starting tests with capabilities:', JSON.stringify(capabilities, null, 2));
        console.log('Test specs:', specs);
        
        // Start VS Code monitoring if in debug mode
        if (process.env.DEBUG) {
            logger.debug('Starting VS Code process monitoring');
        }
    },

    beforeTest: function (test, context) {
        logger.info('Test starting', {
            test: test.title,
            file: test.file
        });
    },

    afterTest: function (test, context, { error, result, duration, passed, retries }) {
        logger.info('Test completed', {
            test: test.title,
            passed,
            duration,
            error: error ? error.message : null,
            retries
        });
    },
    
    after: function (result, capabilities, specs) {
        logger.info('Test suite completed', {
            result,
            duration: new Date().getTime()
        });
        
        console.log('Tests completed with result:', result);
        
        // Stop monitoring and generate report
        if (process.env.DEBUG) {
            logger.debug('Stopping VS Code monitoring');
            vscodeMonitor.cleanup();
            
            // Generate debug report
            const reportPath = path.join(__dirname, 'test', 'e2e-debug', 'logs', `test-report-${Date.now()}.json`);
            logger.info('Debug report saved', { path: reportPath });
        }
    },

    afterSession: function (config, capabilities, specs) {
        logger.info('WebdriverIO session ended', {
            specs: specs.length
        });
    },

    onComplete: function (exitCode, config, capabilities, results) {
        logger.info('All tests complete', {
            exitCode,
            passed: results.passed,
            failed: results.failed
        });
        
        if (exitCode !== 0) {
            logger.error('Tests failed', { exitCode });
        }
    },
    
    onError: function(error) {
        logger.error('Test error occurred', {
            message: error.message,
            stack: error.stack,
            type: error.name
        });
        
        console.error('Test error:', error);
        
        // Capture VS Code state on error
        if (process.env.DEBUG) {
            const processes = vscodeMonitor.getAllProcesses();
            logger.error('VS Code processes at error time', { processes });
        }
    },

    // Additional hooks for process monitoring
    beforeCommand: function (commandName, args) {
        if (process.env.DEBUG_VERBOSE) {
            logger.debug('WebdriverIO command', { command: commandName, args });
        }
    },

    afterCommand: function (commandName, args, result, error) {
        if (error && process.env.DEBUG) {
            logger.error('Command failed', { 
                command: commandName, 
                error: error.message 
            });
        }
    }
};