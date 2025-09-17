/**
 * Fixed WebdriverIO Configuration for VS Code Extension Testing (ESM version)
 * This is an ES module to work with wdio-vscode-service
 */

import VSCodeService from 'wdio-vscode-service';
import { DebugLogger } from './test/e2e-debug/debug-logger.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get project root
const projectRoot = process.cwd();

// Initialize logger
const logger = new DebugLogger({
    prefix: 'wdio-ui-config',
    logLevel: process.env.DEBUG_LEVEL || 'INFO'
});

logger.info('WebdriverIO UI Configuration', {
    projectRoot,
    debugMode: process.env.DEBUG || false
});

// Create test workspace if needed
const testWorkspacePath = path.join(projectRoot, '.test-workspace');
if (!fs.existsSync(testWorkspacePath)) {
    fs.mkdirSync(testWorkspacePath, { recursive: true });
}

export const config = {
    runner: 'local',
    
    specs: [
        './test/e2e/wsl-manager-complete.test.js'
    ],
    
    exclude: [],
    
    maxInstances: 1,
    
    capabilities: [{
        browserName: 'vscode',
        browserVersion: 'stable',
        'wdio:vscodeOptions': {
            // Extension path - critical for loading our extension
            extensionPath: projectRoot,
            
            // Use test profile
            userDataDir: path.join(projectRoot, '.vscode-test-profile'),
            
            // Workspace to open
            workspacePath: testWorkspacePath,
            
            // VS Code arguments - DO NOT include --disable-extensions
            vscodeArgs: [
                '--no-sandbox',
                '--disable-gpu',
                '--disable-updates',
                '--disable-workspace-trust',
                '--skip-welcome',
                '--skip-release-notes'
            ],
            
            // User settings
            userSettings: {
                'update.mode': 'none',
                'telemetry.telemetryLevel': 'off',
                'workbench.startupEditor': 'none',
                'extensions.autoUpdate': false,
                'security.workspace.trust.enabled': false
            }
        }
    }],
    
    logLevel: process.env.DEBUG ? 'debug' : 'info',
    bail: 0,
    waitforTimeout: 10000,
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3,
    
    // Use the standard VS Code service
    services: ['vscode'],
    
    framework: 'mocha',
    
    reporters: ['spec'],
    
    mochaOpts: {
        ui: 'bdd',
        timeout: 120000
    },
    
    before: function (capabilities, specs) {
        console.log('\n' + '='.repeat(60));
        console.log('WSL MANAGER E2E UI TEST SUITE');
        console.log('='.repeat(60));
        console.log('Extension Path:', projectRoot);
        console.log('='.repeat(60) + '\n');
    },
    
    after: function (result, capabilities, specs) {
        console.log('\n' + '='.repeat(60));
        console.log('TEST SUITE COMPLETE');
        console.log(`Result: ${result === 0 ? 'PASSED' : 'FAILED'}`);
        console.log('='.repeat(60) + '\n');
    }
};