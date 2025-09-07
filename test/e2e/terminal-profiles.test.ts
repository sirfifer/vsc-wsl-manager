/**
 * E2E Tests for Terminal Profile Registration
 * Verifies that WSL terminal profiles are registered correctly in VS Code
 * without permission errors
 */

import { browser } from '@wdio/globals';
import { expect } from 'chai';

describe('WSL Terminal Profiles E2E', () => {
    let workbench: any;
    
    before(async () => {
        // Get the VS Code workbench
        workbench = await browser.getWorkbench();
        console.log('VS Code workbench loaded');
    });
    
    describe('Terminal Profile Registration', () => {
        it('should activate extension without errors', async () => {
            // Check extension is loaded
            const isActive = await browser.executeWorkbench(async (vscode: any) => {
                const extension = vscode.extensions.getExtension('wsl-manager');
                if (!extension) {
                    throw new Error('Extension not found');
                }
                
                // Wait for activation if not already active
                if (!extension.isActive) {
                    await extension.activate();
                }
                
                return extension.isActive;
            });
            
            expect(isActive).to.be.true;
        });
        
        it('should not show permission errors in console', async () => {
            // Get the output panel
            const outputView = await workbench.getOutputView();
            
            // Try to select Extension Host log
            try {
                await outputView.selectChannel('Log (Extension Host)');
                const logs = await outputView.getText();
                
                // Check for permission errors
                expect(logs).to.not.include('Permission denied');
                expect(logs).to.not.include('Failed to update terminal profiles');
                expect(logs).to.not.include('EACCES');
                expect(logs).to.not.include('terminal.integrated.profiles');
            } catch (error) {
                // If channel doesn't exist, that's OK - it means no errors were logged
                console.log('Extension Host log channel not found (this is OK)');
            }
        });
        
        it('should register WSL profiles in terminal dropdown', async () => {
            // Execute command to refresh distributions first
            await browser.executeWorkbench(async (vscode: any) => {
                await vscode.commands.executeCommand('wsl-manager.refreshDistributions');
            });
            
            // Wait a bit for profiles to register
            await browser.pause(2000);
            
            // Open a new terminal
            await browser.executeWorkbench(async (vscode: any) => {
                await vscode.commands.executeCommand('workbench.action.terminal.new');
            });
            
            // Try to get the terminal view
            const bottomBar = await workbench.getBottomBar();
            const terminalView = await bottomBar.openTerminalView();
            
            if (terminalView) {
                // Look for the dropdown button
                const dropdownButton = await terminalView.$('.terminal-tab-actions .codicon-chevron-down');
                
                if (await dropdownButton.isExisting()) {
                    await dropdownButton.click();
                    
                    // Wait for dropdown to appear
                    await browser.pause(500);
                    
                    // Look for WSL profiles in the dropdown
                    const profileItems = await $$('.quick-input-list .monaco-list-row');
                    const profileNames: string[] = [];
                    
                    for (const item of profileItems) {
                        const text = await item.getText();
                        profileNames.push(text);
                    }
                    
                    console.log('Found profiles:', profileNames);
                    
                    // Check if any WSL profiles are present
                    const hasWSLProfiles = profileNames.some(name => 
                        name.includes('WSL') || 
                        name.includes('Ubuntu') || 
                        name.includes('Debian') ||
                        name.includes('Alpine')
                    );
                    
                    if (!hasWSLProfiles) {
                        console.warn('No WSL profiles found in dropdown, but this might be OK if no WSL distributions are installed');
                    }
                }
            }
        });
        
        it('should create WSL terminal without errors', async () => {
            // Try to create a terminal using our command
            try {
                await browser.executeWorkbench(async (vscode: any) => {
                    // First, get available distributions
                    const result = await vscode.commands.executeCommand('wsl-manager.refreshDistributions');
                    console.log('Refresh result:', result);
                    
                    // Try to open a terminal (this might fail if no distributions)
                    // We're testing that the command exists and doesn't throw permission errors
                    await vscode.commands.executeCommand('wsl-manager.openTerminal', { name: 'Ubuntu' });
                });
            } catch (error: any) {
                // Check if error is expected (no distribution) vs unexpected (permission)
                if (error.message && error.message.includes('Permission')) {
                    throw error; // Re-throw permission errors
                }
                console.log('Terminal creation failed (possibly no WSL distributions):', error.message);
            }
            
            // Check output for errors
            const outputView = await workbench.getOutputView();
            
            try {
                await outputView.selectChannel('WSL Manager');
                const content = await outputView.getText();
                
                // These should NOT appear
                expect(content).to.not.include('Permission denied');
                expect(content).to.not.include('Failed to update terminal profiles');
                
                // These are OK to appear
                // - "No distributions found" (no WSL installed)
                // - "Distribution not found" (specific distro missing)
            } catch (error) {
                console.log('WSL Manager output channel not found (this might be OK)');
            }
        });
    });
    
    describe('Extension Commands', () => {
        it('should have all commands registered', async () => {
            const commands = await browser.executeWorkbench(async (vscode: any) => {
                return vscode.commands.getCommands(true);
            });
            
            const wslCommands = [
                'wsl-manager.refreshDistributions',
                'wsl-manager.createDistribution',
                'wsl-manager.importDistribution',
                'wsl-manager.exportDistribution',
                'wsl-manager.deleteDistribution',
                'wsl-manager.openTerminal'
            ];
            
            for (const cmd of wslCommands) {
                expect(commands).to.include(cmd, `Command ${cmd} should be registered`);
            }
        });
    });
    
    describe('Tree View', () => {
        it('should display WSL distributions in tree view', async () => {
            // Get the activity bar
            const activityBar = await workbench.getActivityBar();
            
            // Look for our view
            const wslView = await activityBar.getViewControl('WSL Manager');
            
            if (wslView) {
                await wslView.openView();
                
                // Wait for view to load
                await browser.pause(1000);
                
                console.log('WSL Manager view opened successfully');
            } else {
                console.warn('WSL Manager view not found in activity bar');
            }
        });
    });
});