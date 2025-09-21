import type { Options } from '@wdio/types';
import * as path from 'path';
import * as fs from 'fs';
import {
    ensureWindowsPath,
    findCodeExe,
    findChromeDriverWin
} from '../helpers/paths';

// Ensure we're on a Windows mount
const repoRoot = process.cwd();
const repoRootWin = ensureWindowsPath(repoRoot);

// Create test workspace if needed
const testWorkspacePath = path.join(repoRoot, '.test-workspace');
if (!fs.existsSync(testWorkspacePath)) {
    fs.mkdirSync(testWorkspacePath, { recursive: true });
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
}

// Try to find VS Code executable
let vscodeExecutablePath: string;
try {
    vscodeExecutablePath = findCodeExe();
} catch (error) {
    console.error('Warning: Could not find VS Code executable');
    console.error('Will attempt to use wdio-vscode-service default');
    vscodeExecutablePath = ''; // Let wdio-vscode-service handle it
}

// Try to find ChromeDriver
let chromedriverPath: string | undefined;
try {
    chromedriverPath = findChromeDriverWin(repoRootWin);
    console.log('Found ChromeDriver at:', chromedriverPath);
} catch (error) {
    console.warn('ChromeDriver not found, will let wdio handle it');
}

export const config: Options.Testrunner = {
    runner: 'local',
    
    autoCompileOpts: {
        autoCompile: true,
        tsNodeOpts: {
            transpileOnly: true,
            project: './test/e2e/tsconfig.json'
        }
    },
    
    specs: [
        './test/e2e/**/*.test.ts',
        './test/e2e/**/*.spec.ts'
    ],
    
    exclude: [
        './test/e2e/simple-test.ts' // Exclude test helper files
    ],
    
    maxInstances: 1, // UI tests should run serially
    
    capabilities: [{
        browserName: 'vscode',
        browserVersion: 'stable', // or 'insiders'
        'wdio:vscodeOptions': {
            // Extension path in Windows format
            extensionPath: repoRootWin,
            
            // VS Code executable path (if found)
            ...(vscodeExecutablePath && { vscodeExecutablePath }),
            
            // Use existing VS Code installation if available
            useExistingInstallation: !!vscodeExecutablePath,
            
            // VS Code launch arguments
            vscodeArgs: [
                '--no-sandbox',
                '--disable-gpu',
                '--disable-updates',
                '--disable-workspace-trust',
                '--force-device-scale-factor=1', // Consistent screenshots
                '--disable-telemetry',
                '--skip-release-notes',
                '--skip-welcome',
                '--locale=en' // Force English for consistent UI
            ],
            
            // User settings for test environment
            userSettings: {
                'update.mode': 'none',
                'telemetry.telemetryLevel': 'off',
                'workbench.startupEditor': 'none',
                'workbench.tips.enabled': false,
                'workbench.reduceMotion': 'on', // Disable animations
                'workbench.colorTheme': 'Default Dark+',
                'window.zoomLevel': 0,
                'editor.minimap.enabled': false,
                'window.openFoldersInNewWindow': 'off',
                'extensions.autoUpdate': false,
                'extensions.ignoreRecommendations': true,
                'security.workspace.trust.enabled': false,
                'git.enabled': false,
                'git.autorefresh': false,
                // WSL Manager specific settings
                'wsl-manager.logging.level': 'debug',
                'wsl-manager.autoRegisterProfiles': true
            },
            
            // Open test workspace
            workspacePath: ensureWindowsPath(testWorkspacePath)
        }
    }],
    
    logLevel: 'info',
    bail: 0,
    waitforTimeout: 10000,
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3,
    specFileRetries: 1, // Retry flaky specs once
    
    services: [
        ['vscode', {
            ...(chromedriverPath && { chromedriverCustomPath: chromedriverPath })
        }],
        ['visual', {
            baselineFolder: path.join(repoRoot, 'test', 'visual', 'baseline'),
            screenshotPath: path.join(repoRoot, 'test', 'visual', 'screenshots'),
            formatImageName: '{tag}-{width}x{height}',
            savePerInstance: true,
            autoSaveBaseline: true,
            viewportChangePause: 200,
            hideScrollBars: true,
            blockOutStatusBar: true,
            blockOutSideBar: false
        }],
        'devtools'
    ],
    
    framework: 'mocha',
    
    reporters: [
        'spec'
    ],
    
    mochaOpts: {
        ui: 'bdd',
        timeout: 60000
    },
    
    // ===========
    // Hooks
    // ===========
    
    /**
     * Gets executed once before all workers get launched.
     */
    onPrepare: function (config, capabilities) {
        console.log('🚀 Starting WebdriverIO VS Code UI Tests from WSL');
        console.log('📁 Repo root (WSL):', repoRoot);
        console.log('📁 Repo root (Windows):', repoRootWin);
        if (vscodeExecutablePath) {
            console.log('🖥️ VS Code:', vscodeExecutablePath);
        }
        
        // Create directories for screenshots and visual tests
        const dirs = [
            'test/screenshots',
            'test/visual/baseline',
            'test/visual/screenshots'
        ];
        
        dirs.forEach(dir => {
            const fullPath = path.join(repoRoot, dir);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
            }
        });
    },
    
    /**
     * Gets executed before test execution begins
     */
    before: async function (capabilities, specs) {
        console.log('VS Code instance ready, beginning tests');
        console.log('Test specs:', specs);
    },
    
    /**
     * Hook that gets executed before the suite starts
     */
    beforeSuite: function (suite) {
        console.log(`Starting suite: ${suite.title}`);
    },
    
    /**
     * Function to be executed after a test
     */
    afterTest: async function(test, context, { error, result, duration, passed, retries }) {
        if (!passed) {
            // Take screenshot on failure
            const screenshot = await browser.takeScreenshot();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `failure-${test.title}-${timestamp}.png`;
            const filepath = path.join(repoRoot, 'test', 'screenshots', filename);
            
            fs.mkdirSync(path.dirname(filepath), { recursive: true });
            fs.writeFileSync(filepath, screenshot, 'base64');
            console.log(`📸 Screenshot saved: ${filename}`);
        }
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
    after: async function (result, capabilities, specs) {
        console.log('✨ Tests completed:', result === 0 ? 'PASSED' : 'FAILED');
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
        
        // Cleanup: Kill any lingering Code processes on Windows
        try {
            const { execSync } = require('child_process');
            // Try to kill VS Code processes on Windows
            execSync('taskkill /F /IM Code.exe /T 2>nul', { 
                shell: 'cmd.exe',
                stdio: 'ignore' 
            });
        } catch {
            // Ignore errors - process might not exist
        }
    }
};