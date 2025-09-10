/**
 * Fixed VS Code Service - Extends wdio-vscode-service to fix extension loading
 * Integrates with debug logging and process monitoring
 */

// Handle ESM module - wdio-vscode-service is ESM only
let VSCodeService;
try {
    // Try CommonJS first (shouldn't work but just in case)
    VSCodeService = require('wdio-vscode-service').default;
} catch (e) {
    // Will be loaded dynamically in the async methods
    VSCodeService = null;
}
const ChromeInterceptor = require('./chrome-interceptor');
const pathUtils = require('./path-utils');
const { DebugLogger } = require('../e2e-debug/debug-logger');
const VSCodeMonitor = require('../e2e-debug/vscode-monitor');
const path = require('path');
const fs = require('fs');

class FixedVSCodeService extends VSCodeService {
    constructor(options = {}) {
        const logger = new DebugLogger({
            prefix: 'fixed-vscode-service',
            logLevel: process.env.DEBUG_LEVEL || 'DEBUG'
        });

        logger.info('Initializing Fixed VS Code Service');

        // Create chrome interceptor
        const interceptor = new ChromeInterceptor();
        
        // Get extension path in proper format
        const extensionPath = pathUtils.getProjectRoot('windows');
        
        logger.debug('Service configuration', {
            extensionPath,
            interceptorPath: interceptor.getWrapperPath(),
            options
        });

        // Prepare modified options
        const fixedOptions = {
            ...options,
            // Don't let the service add --disable-extensions
            vscodeArgs: [
                `--extensionDevelopmentPath=${extensionPath}`,
                '--user-data-dir=.vscode-test-profile',
                '--no-sandbox',
                '--disable-gpu',
                '--disable-updates',
                '--disable-workspace-trust'
            ].filter(arg => !arg.includes('disable-extensions'))
        };

        // Call parent constructor
        super(fixedOptions);
        
        this.logger = logger;
        this.interceptor = interceptor;
        this.extensionPath = extensionPath;
        this.vscodeMonitor = new VSCodeMonitor({
            trackResources: true,
            captureOutput: true
        });
        
        this.logger.info('Fixed VS Code Service initialized', {
            extensionPath: this.extensionPath
        });
    }

    async onPrepare(config, capabilities) {
        this.logger.info('onPrepare: Starting Fixed VS Code Service');
        this.logger.debug('Original capabilities', { capabilities });

        // Fix capabilities to ensure extension loads
        for (let i = 0; i < capabilities.length; i++) {
            const cap = capabilities[i];
            
            if (cap.browserName === 'vscode' || cap.browserName === 'chrome') {
                this.logger.info(`Fixing capability ${i}`, { browserName: cap.browserName });

                // Ensure wdio:vscodeOptions exists
                cap['wdio:vscodeOptions'] = cap['wdio:vscodeOptions'] || {};
                
                // Set extension path
                cap['wdio:vscodeOptions'].extensionPath = this.extensionPath;
                
                // Ensure Chrome options exist
                cap['goog:chromeOptions'] = cap['goog:chromeOptions'] || {};
                cap['goog:chromeOptions'].args = cap['goog:chromeOptions'].args || [];
                
                // Filter out disable-extensions from Chrome args
                const originalArgs = cap['goog:chromeOptions'].args;
                cap['goog:chromeOptions'].args = originalArgs.filter(arg => {
                    const shouldRemove = arg.includes('disable-extensions');
                    if (shouldRemove) {
                        this.logger.warn('Removing problematic flag from Chrome args', { flag: arg });
                    }
                    return !shouldRemove;
                });
                
                // Add extension development path if not present
                const hasExtPath = cap['goog:chromeOptions'].args.some(arg => 
                    arg.includes('extension-development-path') || 
                    arg.includes('extensionDevelopmentPath')
                );
                
                if (!hasExtPath) {
                    const extArg = `--extension-development-path=${this.extensionPath}`;
                    cap['goog:chromeOptions'].args.push(extArg);
                    this.logger.info('Added extension development path', { arg: extArg });
                }

                // Use our interceptor as the binary (if possible)
                // Note: This might not work with wdio-vscode-service's internal handling
                // The interceptor approach is a fallback
                
                this.logger.debug(`Fixed capability ${i}`, { 
                    capability: cap,
                    extensionPath: this.extensionPath
                });
            }
        }

        try {
            // Call parent onPrepare
            const result = await super.onPrepare(config, capabilities);
            
            this.logger.info('Parent onPrepare completed successfully');
            
            // Start monitoring VS Code processes
            this.logger.info('Starting VS Code process monitoring');
            
            return result;
        } catch (error) {
            this.logger.error('Error in parent onPrepare', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    async beforeSession(config, capabilities, specs) {
        this.logger.info('beforeSession: Preparing test session', { specs });
        
        // Ensure extension will be loaded
        this.logger.debug('Session capabilities', { capabilities });
        
        if (super.beforeSession) {
            return super.beforeSession(config, capabilities, specs);
        }
    }

    async before(capabilities, specs, browser) {
        this.logger.info('before: Test suite starting', { 
            specs,
            browserName: capabilities.browserName 
        });
        
        // Log VS Code launch details
        this.logger.debug('VS Code launch configuration', {
            extensionPath: this.extensionPath,
            capabilities
        });
        
        if (super.before) {
            return super.before(capabilities, specs, browser);
        }
    }

    async afterTest(test, context, results) {
        this.logger.info('afterTest: Test completed', {
            test: test.title,
            passed: results.passed,
            duration: results.duration,
            error: results.error ? results.error.message : null
        });
        
        if (super.afterTest) {
            return super.afterTest(test, context, results);
        }
    }

    async after(result, capabilities, specs) {
        this.logger.info('after: Test suite completed', {
            result,
            specs
        });
        
        // Stop VS Code monitoring
        this.vscodeMonitor.cleanup();
        
        if (super.after) {
            return super.after(result, capabilities, specs);
        }
    }

    async onComplete(exitCode, config, capabilities, results) {
        this.logger.info('onComplete: All tests finished', {
            exitCode,
            passed: results.passed,
            failed: results.failed
        });
        
        // Cleanup interceptor
        this.interceptor.cleanup();
        
        // Generate summary
        this.logger.info('Test Summary', {
            totalTests: (results.passed || 0) + (results.failed || 0),
            passed: results.passed || 0,
            failed: results.failed || 0,
            exitCode
        });
        
        if (super.onComplete) {
            return super.onComplete(exitCode, config, capabilities, results);
        }
    }
}

module.exports = FixedVSCodeService;