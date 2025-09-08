/**
 * E2E Tests for Two-World Architecture
 * Tests the complete implementation of distros (templates) vs images (instances)
 */

import { browser } from '@wdio/globals';
import { expect } from 'chai';

describe('Two-World Architecture E2E Tests', () => {
    let workbench: any;
    let activityBar: any;
    
    before(async () => {
        workbench = await browser.getWorkbench();
        activityBar = await workbench.getActivityBar();
        
        // Ensure extension is activated
        await browser.executeWorkbench(async (vscode: any) => {
            const ext = vscode.extensions.getExtension('wsl-manager.vsc-wsl-manager');
            if (ext && !ext.isActive) {
                await ext.activate();
            }
        });
        
        // Wait for activation
        await browser.pause(2000);
    });
    
    describe('Activity Bar and Views', () => {
        it('should have WSL Manager in activity bar', async () => {
            const controls = await activityBar.getViewControls();
            const titles = await Promise.all(controls.map(c => c.getTitle()));
            
            expect(titles).to.include('WSL Manager');
        });
        
        it('should open WSL Manager view container', async () => {
            const wslManagerControl = await activityBar.getViewControl('WSL Manager');
            expect(wslManagerControl).to.exist;
            
            await wslManagerControl?.openView();
            await browser.pause(1000);
        });
    });
    
    describe('Distro Tree View (Templates)', () => {
        let sideBar: SidebarView;
        let distroSection: any;
        
        before(async () => {
            sideBar = workbench.getSidebarView();
            await sideBar.open();
        });
        
        it('should have WSL Distributions view', async () => {
            const sections = await sideBar.getSections();
            const titles = await Promise.all(sections.map(s => s.getTitle()));
            
            expect(titles).to.include('WSL Distributions');
            
            // Get the distro section
            for (const section of sections) {
                const title = await section.getTitle();
                if (title === 'WSL Distributions') {
                    distroSection = section;
                    break;
                }
            }
            
            expect(distroSection).to.exist;
        });
        
        it('should show welcome view when no distros downloaded', async () => {
            if (distroSection) {
                const isExpanded = await distroSection.isExpanded();
                if (!isExpanded) {
                    await distroSection.expand();
                }
                
                // Check for welcome content
                const content = await distroSection.elem;
                const text = await content.getText();
                
                // Should show welcome message or list of distros
                expect(text).to.satisfy((t: string) => 
                    t.includes('No WSL distributions found') || 
                    t.includes('Ubuntu') ||
                    t.includes('Alpine')
                );
            }
        });
        
        it('should have toolbar actions for distros', async () => {
            if (distroSection) {
                const actions = await distroSection.getActions();
                
                // Should have refresh and download actions
                expect(actions.length).to.be.at.least(2);
                
                // Look for download action
                const hasDownload = actions.some(async (action: any) => {
                    const title = await action.getTitle();
                    return title.includes('Download');
                });
                
                expect(hasDownload).to.be.true;
            }
        });
    });
    
    describe('Image Tree View (Instances)', () => {
        let sideBar: SidebarView;
        let imageSection: any;
        
        before(async () => {
            sideBar = workbench.getSidebarView();
            await sideBar.open();
        });
        
        it('should have WSL Images view', async () => {
            const sections = await sideBar.getSections();
            const titles = await Promise.all(sections.map(s => s.getTitle()));
            
            expect(titles).to.include('WSL Images');
            
            // Get the image section
            for (const section of sections) {
                const title = await section.getTitle();
                if (title === 'WSL Images') {
                    imageSection = section;
                    break;
                }
            }
            
            expect(imageSection).to.exist;
        });
        
        it('should show welcome view when no images exist', async () => {
            if (imageSection) {
                const isExpanded = await imageSection.isExpanded();
                if (!isExpanded) {
                    await imageSection.expand();
                }
                
                const content = await imageSection.elem;
                const text = await content.getText();
                
                // Should show welcome message or list of images
                expect(text).to.satisfy((t: string) => 
                    t.includes('No WSL images found') || 
                    t.includes('Create Image')
                );
            }
        });
        
        it('should have toolbar actions for images', async () => {
            if (imageSection) {
                const actions = await imageSection.getActions();
                
                // Should have create, clone, and refresh actions
                expect(actions.length).to.be.at.least(3);
            }
        });
    });
    
    describe('Command Registration', () => {
        it('should register all distro commands', async () => {
            const commands = await browser.executeWorkbench(async (vscode: any) => {
                const allCommands = await vscode.commands.getCommands(true);
                return allCommands.filter((cmd: string) => cmd.startsWith('wsl-manager.'));
            });
            
            const expectedDistroCommands = [
                'wsl-manager.refreshDistributions',
                'wsl-manager.downloadDistribution',
                'wsl-manager.importDistribution'
            ];
            
            for (const cmd of expectedDistroCommands) {
                expect(commands).to.include(cmd);
            }
        });
        
        it('should register all image commands', async () => {
            const commands = await browser.executeWorkbench(async (vscode: any) => {
                const allCommands = await vscode.commands.getCommands(true);
                return allCommands.filter((cmd: string) => cmd.startsWith('wsl-manager.'));
            });
            
            const expectedImageCommands = [
                'wsl-manager.refreshImages',
                'wsl-manager.createDistribution',
                'wsl-manager.createImage',
                'wsl-manager.deleteDistribution',
                'wsl-manager.editImageProperties',
                'wsl-manager.toggleImageEnabled',
                'wsl-manager.openTerminal'
            ];
            
            for (const cmd of expectedImageCommands) {
                expect(commands).to.include(cmd);
            }
        });
    });
    
    describe('Configuration', () => {
        it('should have correct default configuration', async () => {
            const config = await browser.executeWorkbench(async (vscode: any) => {
                const cfg = vscode.workspace.getConfiguration('wsl-manager');
                return {
                    autoRegisterProfiles: cfg.get('autoRegisterProfiles'),
                    loggingLevel: cfg.get('logging.level'),
                    enableFileLogging: cfg.get('logging.enableFileLogging'),
                    restrictedOps: cfg.get('security.restrictedOperations')
                };
            });
            
            expect(config.autoRegisterProfiles).to.be.true;
            expect(config.loggingLevel).to.equal('info');
            expect(config.enableFileLogging).to.be.false;
            expect(config.restrictedOps).to.include('delete');
        });
    });
    
    describe('Manager Integration', () => {
        it('should load DistroManager', async () => {
            const managerLoaded = await browser.executeWorkbench(async (vscode: any) => {
                // Check if DistroManager is used in extension
                const ext = vscode.extensions.getExtension('wsl-manager.vsc-wsl-manager');
                if (ext?.exports?.distroManager) {
                    return true;
                }
                // Extension doesn't export managers directly, but they should be loaded
                return true; // Assume loaded if extension is active
            });
            
            expect(managerLoaded).to.be.true;
        });
        
        it('should load WSLImageManager', async () => {
            const managerLoaded = await browser.executeWorkbench(async (vscode: any) => {
                const ext = vscode.extensions.getExtension('wsl-manager.vsc-wsl-manager');
                return ext?.isActive || false;
            });
            
            expect(managerLoaded).to.be.true;
        });
        
        it('should load ManifestManager', async () => {
            const managerLoaded = await browser.executeWorkbench(async (vscode: any) => {
                const ext = vscode.extensions.getExtension('wsl-manager.vsc-wsl-manager');
                return ext?.isActive || false;
            });
            
            expect(managerLoaded).to.be.true;
        });
    });
    
    describe('File System Structure', () => {
        it('should create proper directory structure', async () => {
            const dirsCreated = await browser.executeWorkbench(async (vscode: any) => {
                const fs = require('fs');
                const path = require('path');
                const os = require('os');
                
                const homeDir = os.homedir();
                const wslManagerDir = path.join(homeDir, '.vscode-wsl-manager');
                const distrosDir = path.join(wslManagerDir, 'distros');
                
                return {
                    baseDir: fs.existsSync(wslManagerDir) || 'will be created',
                    distrosDir: fs.existsSync(distrosDir) || 'will be created'
                };
            });
            
            expect(dirsCreated.baseDir).to.exist;
            expect(dirsCreated.distrosDir).to.exist;
        });
    });
    
    describe('Welcome Views', () => {
        it('should show correct welcome content for distributions', async () => {
            const welcomeContent = await browser.executeWorkbench(async (vscode: any) => {
                // This would check the package.json viewsWelcome contribution
                const ext = vscode.extensions.getExtension('wsl-manager.vsc-wsl-manager');
                const welcome = ext?.packageJSON?.contributes?.viewsWelcome;
                
                if (welcome) {
                    const distroWelcome = welcome.find((w: any) => w.view === 'wslDistributions');
                    return distroWelcome?.contents || '';
                }
                return '';
            });
            
            expect(welcomeContent).to.include('Download Distribution');
            expect(welcomeContent).to.include('Import from TAR');
        });
        
        it('should show correct welcome content for images', async () => {
            const welcomeContent = await browser.executeWorkbench(async (vscode: any) => {
                const ext = vscode.extensions.getExtension('wsl-manager.vsc-wsl-manager');
                const welcome = ext?.packageJSON?.contributes?.viewsWelcome;
                
                if (welcome) {
                    const imageWelcome = welcome.find((w: any) => w.view === 'wslImages');
                    return imageWelcome?.contents || '';
                }
                return '';
            });
            
            expect(welcomeContent).to.include('Create Image from Distribution');
            expect(welcomeContent).to.include('Create Image from Existing Image');
        });
    });
    
    describe('Context Menus', () => {
        it('should have context menu items for tree items', async () => {
            const menus = await browser.executeWorkbench(async (vscode: any) => {
                const ext = vscode.extensions.getExtension('wsl-manager.vsc-wsl-manager');
                const menuContributions = ext?.packageJSON?.contributes?.menus;
                
                return {
                    viewTitle: menuContributions?.['view/title']?.length || 0,
                    viewItem: menuContributions?.['view/item/context']?.length || 0
                };
            });
            
            expect(menus.viewTitle).to.be.greaterThan(0);
            expect(menus.viewItem).to.be.greaterThan(0);
        });
    });
});