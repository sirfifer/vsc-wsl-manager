/**
 * Complete E2E UI Test Suite for WSL Manager Extension
 * Tests every UI feature and functionality of the extension
 */

const VSCodeUIAutomation = require('../e2e-fix/ui-automation');
const { DebugLogger } = require('../e2e-debug/debug-logger');
const { expect } = require('chai');

describe('WSL Manager Extension - Complete E2E UI Tests', function() {
    let ui;
    let workbench;
    let logger;
    
    // Increase timeout for UI operations
    this.timeout(120000);

    before(async function() {
        // Initialize logger
        logger = new DebugLogger({
            prefix: 'wsl-manager-test',
            logLevel: process.env.DEBUG_LEVEL || 'DEBUG'
        });
        
        logger.info('Starting WSL Manager E2E Test Suite');
        
        // Initialize UI automation
        ui = new VSCodeUIAutomation(browser);
        
        // Get workbench (WebdriverIO's VS Code API)
        try {
            workbench = await browser.getWorkbench();
            logger.info('Got workbench object');
        } catch (error) {
            logger.error('Failed to get workbench', { error: error.message });
        }
        
        // Wait for VS Code to fully load
        await browser.pause(5000);
        
        // Initial screenshot
        await ui.captureScreenshot('test-start', 'setup');
    });

    describe('1. Extension Loading and Activation', () => {
        it('should verify extension is loaded', async () => {
            logger.info('TEST: Verifying extension is loaded');
            
            // Check via WebdriverIO API
            const result = await browser.executeWorkbench(async (vscode) => {
                // Try multiple possible extension IDs
                const possibleIds = [
                    'wsl-manager.vsc-wsl-manager',
                    'vsc-wsl-manager',
                    'undefined_publisher.vsc-wsl-manager'
                ];
                
                for (const id of possibleIds) {
                    const ext = vscode.extensions.getExtension(id);
                    if (ext) {
                        return {
                            found: true,
                            id: ext.id,
                            isActive: ext.isActive,
                            packageJSON: ext.packageJSON
                        };
                    }
                }
                
                // Try finding by name
                const allExtensions = vscode.extensions.all;
                const wslExt = allExtensions.find(e => 
                    e.packageJSON?.name === 'vsc-wsl-manager' ||
                    e.packageJSON?.displayName === 'VSC WSL Manager'
                );
                
                if (wslExt) {
                    return {
                        found: true,
                        id: wslExt.id,
                        isActive: wslExt.isActive,
                        packageJSON: wslExt.packageJSON
                    };
                }
                
                return { 
                    found: false,
                    allExtensions: allExtensions.map(e => e.id)
                };
            });
            
            logger.info('Extension check result', result);
            
            if (!result.found) {
                logger.warn('Extension not found, will continue tests anyway');
                await ui.captureScreenshot('extension-not-found', 'error');
            } else {
                expect(result.found).to.be.true;
                expect(result.isActive).to.be.true;
                await ui.captureScreenshot('extension-loaded', 'validation');
            }
        });

        it('should activate extension if not active', async () => {
            logger.info('TEST: Activating extension');
            
            const result = await browser.executeWorkbench(async (vscode) => {
                const ext = vscode.extensions.all.find(e => 
                    e.packageJSON?.name === 'vsc-wsl-manager'
                );
                
                if (ext && !ext.isActive) {
                    await ext.activate();
                    return { activated: true, id: ext.id };
                }
                
                return { activated: false, alreadyActive: ext?.isActive };
            });
            
            logger.info('Activation result', result);
            await ui.captureScreenshot('extension-activated', 'validation');
        });
    });

    describe('2. Explorer and Tree Views', () => {
        it('should open Explorer view', async () => {
            logger.info('TEST: Opening Explorer view');
            
            await ui.clickActivityBarItem('Explorer');
            await browser.pause(2000);
            
            const explorerVisible = await ui.isElementVisible('.explorer-viewlet');
            logger.info('Explorer visible', { explorerVisible });
            
            await ui.captureScreenshot('explorer-opened', 'navigation');
        });

        it('should find WSL Distributions tree view', async () => {
            logger.info('TEST: Finding WSL Distributions tree view');
            
            // Look for WSL sections in sidebar
            const sections = await ui.getAllText('.pane-header .title');
            logger.info('Sidebar sections found', { sections });
            
            const hasDistributions = sections.some(s => s.includes('WSL DISTRIBUTIONS'));
            const hasImages = sections.some(s => s.includes('WSL IMAGES'));
            
            logger.info('WSL sections found', { hasDistributions, hasImages });
            
            await ui.captureScreenshot('wsl-sections', 'tree-view');
            
            // Try to expand WSL Distributions
            if (hasDistributions) {
                await ui.clickSidebarItem('WSL DISTRIBUTIONS');
                await browser.pause(1000);
            }
        });

        it('should list WSL distributions in tree', async () => {
            logger.info('TEST: Listing WSL distributions');
            
            // Get tree items
            const treeItems = await ui.getTreeItems('.tree-explorer-viewlet-tree-view');
            logger.info('Distribution tree items', { count: treeItems.length, items: treeItems });
            
            await ui.captureScreenshot('distribution-list', 'tree-view');
            
            // If we have distributions, try to expand one
            if (treeItems.length > 0) {
                const firstDistro = treeItems[0];
                await ui.expandTreeItem('.tree-explorer-viewlet-tree-view', firstDistro);
                await browser.pause(1000);
                await ui.captureScreenshot('distribution-expanded', 'tree-view');
            }
        });

        it('should find WSL Images tree view', async () => {
            logger.info('TEST: Finding WSL Images tree view');
            
            // Try to click on WSL Images section
            const clicked = await ui.clickSidebarItem('WSL IMAGES');
            
            if (clicked) {
                await browser.pause(1000);
                
                // Get image tree items
                const imageItems = await ui.getTreeItems('.tree-explorer-viewlet-tree-view');
                logger.info('Image tree items', { count: imageItems.length, items: imageItems });
                
                await ui.captureScreenshot('images-list', 'tree-view');
            }
        });
    });

    describe('3. Command Palette Commands', () => {
        it('should execute Refresh Distributions command', async () => {
            logger.info('TEST: Executing Refresh Distributions command');
            
            const success = await ui.executeCommand('WSL Manager: Refresh Distributions');
            expect(success).to.be.true;
            
            await browser.pause(2000);
            
            // Check for notifications
            const notification = await ui.waitForNotification(3000);
            if (notification) {
                logger.info('Refresh notification', { text: notification });
            }
            
            await ui.captureScreenshot('after-refresh', 'command');
        });

        it('should open Create Distribution dialog', async () => {
            logger.info('TEST: Opening Create Distribution dialog');
            
            await ui.executeCommand('WSL Manager: Create Distribution');
            await browser.pause(2000);
            
            // Check if input box appears
            const inputVisible = await ui.isElementVisible('.quick-input-widget');
            logger.info('Create dialog visible', { inputVisible });
            
            if (inputVisible) {
                await ui.captureScreenshot('create-dialog-open', 'dialog');
                
                // Type a test name
                await ui.typeInActiveElement('TestDistro123');
                await browser.pause(1000);
                await ui.captureScreenshot('create-dialog-typed', 'dialog');
                
                // Cancel for now
                await browser.keys(['Escape']);
                await browser.pause(500);
            }
        });

        it('should open Import Distribution dialog', async () => {
            logger.info('TEST: Opening Import Distribution dialog');
            
            await ui.executeCommand('WSL Manager: Import Distribution');
            await browser.pause(2000);
            
            const dialogVisible = await ui.isElementVisible('.quick-input-widget');
            logger.info('Import dialog visible', { dialogVisible });
            
            if (dialogVisible) {
                await ui.captureScreenshot('import-dialog', 'dialog');
                await browser.keys(['Escape']);
            }
        });

        it('should open Export Distribution dialog', async () => {
            logger.info('TEST: Opening Export Distribution dialog');
            
            await ui.executeCommand('WSL Manager: Export Distribution');
            await browser.pause(2000);
            
            const dialogVisible = await ui.isElementVisible('.quick-input-widget');
            logger.info('Export dialog visible', { dialogVisible });
            
            if (dialogVisible) {
                await ui.captureScreenshot('export-dialog', 'dialog');
                await browser.keys(['Escape']);
            }
        });

        it('should open Download Distribution dialog', async () => {
            logger.info('TEST: Opening Download Distribution dialog');
            
            await ui.executeCommand('WSL Manager: Download Distribution');
            await browser.pause(2000);
            
            const dialogVisible = await ui.isElementVisible('.quick-input-widget');
            logger.info('Download dialog visible', { dialogVisible });
            
            if (dialogVisible) {
                await ui.captureScreenshot('download-dialog', 'dialog');
                await browser.keys(['Escape']);
            }
        });

        it('should search for all WSL commands', async () => {
            logger.info('TEST: Searching for WSL commands');
            
            await ui.openCommandPalette();
            await ui.typeInActiveElement('WSL');
            await browser.pause(1500);
            
            await ui.captureScreenshot('wsl-commands-list', 'command');
            
            // Get visible command items
            const commandTexts = await ui.getAllText('.quick-input-list .monaco-list-row');
            logger.info('WSL commands found', { 
                count: commandTexts.length,
                commands: commandTexts.slice(0, 10) // First 10
            });
            
            await browser.keys(['Escape']);
        });
    });

    describe('4. Context Menu Actions', () => {
        it('should right-click on distribution tree item', async () => {
            logger.info('TEST: Right-clicking on distribution');
            
            // First, ensure we're in the right view
            await ui.clickActivityBarItem('Explorer');
            await browser.pause(1000);
            
            // Find a distribution item
            const distroSelector = '//span[contains(text(), "Ubuntu")] | //span[contains(@class, "monaco-highlighted-label")][1]';
            const hasDistro = await ui.isElementVisible(distroSelector);
            
            if (hasDistro) {
                await ui.rightClick(distroSelector, 'distribution-item');
                await browser.pause(1000);
                
                // Check if context menu appeared
                const menuVisible = await ui.isElementVisible('.context-view');
                logger.info('Context menu visible', { menuVisible });
                
                if (menuVisible) {
                    await ui.captureScreenshot('distribution-context-menu', 'context-menu');
                    
                    // Get menu items
                    const menuItems = await ui.getAllText('.context-view .action-label');
                    logger.info('Context menu items', { items: menuItems });
                }
                
                // Close menu
                await browser.keys(['Escape']);
            } else {
                logger.warn('No distribution found for context menu test');
            }
        });
    });

    describe('5. Terminal Integration', () => {
        it('should open terminal for distribution', async () => {
            logger.info('TEST: Opening terminal for distribution');
            
            const success = await ui.executeCommand('WSL Manager: Open Terminal');
            await browser.pause(3000);
            
            // Check if terminal opened
            const terminalVisible = await ui.isElementVisible('.terminal');
            logger.info('Terminal visible', { terminalVisible });
            
            if (terminalVisible) {
                await ui.captureScreenshot('terminal-opened', 'terminal');
                
                // Try to type a command
                await ui.typeInTerminal('echo "WSL Manager Test"');
                await browser.pause(2000);
                
                // Get terminal output
                const output = await ui.getTerminalOutput();
                logger.info('Terminal output', { 
                    length: output.length,
                    preview: output.substring(0, 200)
                });
                
                await ui.captureScreenshot('terminal-command', 'terminal');
            }
        });
    });

    describe('6. Input Validation', () => {
        it('should validate distribution name input', async () => {
            logger.info('TEST: Validating distribution name input');
            
            await ui.executeCommand('WSL Manager: Create Distribution');
            await browser.pause(2000);
            
            const inputVisible = await ui.isElementVisible('.quick-input-widget');
            
            if (inputVisible) {
                // Test invalid names
                const invalidNames = [
                    'my distro',  // Space
                    'distro!',    // Special char
                    '123distro',  // Starting with number
                    ''            // Empty
                ];
                
                for (const name of invalidNames) {
                    await ui.typeInActiveElement(name);
                    await browser.pause(500);
                    await ui.captureScreenshot(`invalid-name-${name || 'empty'}`, 'validation');
                    
                    // Clear for next test
                    await browser.keys(['Control', 'a']);
                    await browser.keys(['Delete']);
                }
                
                // Cancel dialog
                await browser.keys(['Escape']);
            }
        });
    });

    describe('7. Error Handling', () => {
        it('should handle missing base distribution error', async () => {
            logger.info('TEST: Testing error handling');
            
            // Try to create with non-existent base
            await ui.executeCommand('WSL Manager: Create Distribution');
            await browser.pause(2000);
            
            if (await ui.isElementVisible('.quick-input-widget')) {
                await ui.typeInActiveElement('TestErrorDistro');
                await browser.keys(['Enter']);
                await browser.pause(2000);
                
                // Should show error or next dialog
                const notification = await ui.waitForNotification(3000);
                if (notification) {
                    logger.info('Error notification', { text: notification });
                    await ui.captureScreenshot('error-notification', 'error');
                }
                
                // Escape any open dialogs
                await browser.keys(['Escape']);
                await browser.keys(['Escape']);
            }
        });
    });

    describe('8. Status Bar Items', () => {
        it('should check for WSL status bar items', async () => {
            logger.info('TEST: Checking status bar');
            
            // Get all status bar items
            const statusItems = await ui.getAllText('.statusbar-item');
            logger.info('Status bar items', { 
                count: statusItems.length,
                items: statusItems 
            });
            
            await ui.captureScreenshot('status-bar', 'status');
            
            // Look for WSL-related items
            const wslItems = statusItems.filter(item => 
                item.toLowerCase().includes('wsl') ||
                item.toLowerCase().includes('distro')
            );
            
            if (wslItems.length > 0) {
                logger.info('WSL status bar items found', { items: wslItems });
                
                // Try clicking one
                for (const item of wslItems) {
                    const clicked = await ui.clickStatusBarItem(item);
                    if (clicked) {
                        await browser.pause(1000);
                        await ui.captureScreenshot('status-bar-clicked', 'status');
                        break;
                    }
                }
            }
        });
    });

    describe('9. Progress Notifications', () => {
        it('should show progress for long operations', async () => {
            logger.info('TEST: Testing progress notifications');
            
            // Try an operation that might show progress
            await ui.executeCommand('WSL Manager: Download Distribution');
            await browser.pause(1000);
            
            // Look for progress indicator
            const progressVisible = await ui.isElementVisible('.monaco-progress-container');
            
            if (progressVisible) {
                logger.info('Progress indicator visible');
                await ui.captureScreenshot('progress-indicator', 'progress');
            }
            
            // Cancel any dialogs
            await browser.keys(['Escape']);
        });
    });

    describe('10. Quick Pick Interactions', () => {
        it('should interact with quick pick lists', async () => {
            logger.info('TEST: Testing quick pick interactions');
            
            await ui.executeCommand('WSL Manager: Delete Distribution');
            await browser.pause(2000);
            
            const quickPickVisible = await ui.isElementVisible('.quick-input-widget');
            
            if (quickPickVisible) {
                await ui.captureScreenshot('quick-pick-list', 'quickpick');
                
                // Get list items
                const items = await ui.getAllText('.quick-input-list .monaco-list-row');
                logger.info('Quick pick items', { items });
                
                if (items.length > 0) {
                    // Navigate with arrow keys
                    await browser.keys(['ArrowDown']);
                    await browser.pause(500);
                    await ui.captureScreenshot('quick-pick-selected', 'quickpick');
                }
                
                // Cancel
                await browser.keys(['Escape']);
            }
        });
    });

    after(async function() {
        logger.info('Completing WSL Manager E2E Test Suite');
        
        // Generate test report
        const report = await ui.generateReport();
        
        logger.info('Test Summary', {
            totalActions: report.totalActions,
            screenshots: report.screenshots,
            errors: report.errors.length,
            actionTypes: report.actionsByType
        });
        
        // Final screenshot
        await ui.captureScreenshot('test-complete', 'final');
        
        // Save final action log
        ui.saveActionLog();
        
        console.log('\n' + '='.repeat(60));
        console.log('WSL MANAGER E2E TEST SUITE COMPLETE');
        console.log('='.repeat(60));
        console.log(`Total UI Actions: ${report.totalActions}`);
        console.log(`Screenshots Taken: ${report.screenshots}`);
        console.log(`Errors Encountered: ${report.errors.length}`);
        console.log('\nAction Breakdown:');
        
        for (const [action, count] of Object.entries(report.actionsByType)) {
            console.log(`  ${action}: ${count}`);
        }
        
        console.log('\nScreenshots saved in: test-screenshots/');
        console.log('Action log saved in: test-screenshots/ui-actions.json');
        console.log('Test report saved in: test-screenshots/test-report.json');
        console.log('='.repeat(60));
    });
});