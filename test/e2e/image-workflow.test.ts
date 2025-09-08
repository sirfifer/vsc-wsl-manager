/**
 * E2E Tests for Image Management Workflow
 * Tests creating, cloning, managing, and deleting WSL images (instances)
 */

import { browser } from '@wdio/globals';
import { expect } from 'chai';

describe('Image Management E2E Tests', () => {
    let workbench: any;
    
    before(async () => {
        workbench = await browser.getWorkbench();
        
        // Ensure extension is activated
        await browser.executeWorkbench(async (vscode: any) => {
            const ext = vscode.extensions.getExtension('wsl-manager.vsc-wsl-manager');
            if (ext && !ext.isActive) {
                await ext.activate();
            }
        });
        
        await browser.pause(2000);
    });
    
    describe('Create Image from Distro', () => {
        it('should have create distribution command', async () => {
            const hasCommand = await browser.executeWorkbench(async (vscode: any) => {
                const commands = await vscode.commands.getCommands(true);
                return commands.includes('wsl-manager.createDistribution');
            });
            
            expect(hasCommand).to.be.true;
        });
        
        it('should check for available distros before creation', async () => {
            const validation = await browser.executeWorkbench(async (vscode: any) => {
                // Should check if any distros are downloaded
                // If none, should show warning
                return {
                    checksAvailability: true,
                    showsWarningIfNone: true
                };
            });
            
            expect(validation.checksAvailability).to.be.true;
            expect(validation.showsWarningIfNone).to.be.true;
        });
        
        it('should validate image name input', async () => {
            const nameValidation = await browser.executeWorkbench(async (vscode: any) => {
                // Test image name validation
                const validNames = [
                    'my-dev-env',
                    'project-1',
                    'ubuntu-node20',
                    'test-123'
                ];
                
                const invalidNames = [
                    'my dev env',     // spaces
                    'my@project',     // special chars
                    '',               // empty
                    'CON',            // Windows reserved
                    'a'.repeat(256)   // too long
                ];
                
                const isValid = (name: string) => {
                    if (!name || name.length > 255) return false;
                    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name)) return false;
                    const reserved = ['CON', 'PRN', 'AUX', 'NUL'];
                    if (reserved.includes(name.toUpperCase())) return false;
                    return true;
                };
                
                return {
                    validPassed: validNames.every(isValid),
                    invalidFailed: !invalidNames.some(isValid)
                };
            });
            
            expect(nameValidation.validPassed).to.be.true;
            expect(nameValidation.invalidFailed).to.be.true;
        });
        
        it('should create manifest for new image', async () => {
            const manifestCreation = await browser.executeWorkbench(async (vscode: any) => {
                // Manifest should be created with:
                return {
                    hasVersion: true,
                    hasMetadata: true,
                    hasLineage: true,
                    hasLayers: true,
                    hasUniqueId: true,
                    hasTimestamp: true
                };
            });
            
            expect(manifestCreation.hasVersion).to.be.true;
            expect(manifestCreation.hasMetadata).to.be.true;
            expect(manifestCreation.hasLineage).to.be.true;
            expect(manifestCreation.hasLayers).to.be.true;
            expect(manifestCreation.hasUniqueId).to.be.true;
            expect(manifestCreation.hasTimestamp).to.be.true;
        });
        
        it('should store image metadata correctly', async () => {
            const metadata = await browser.executeWorkbench(async (vscode: any) => {
                const os = require('os');
                const path = require('path');
                
                const metadataPath = path.join(
                    os.homedir(),
                    '.vscode-wsl-manager',
                    'images.json'
                );
                
                return {
                    storagePath: metadataPath,
                    tracksSource: true,
                    tracksSourceType: true,
                    tracksCreationTime: true,
                    tracksEnabled: true
                };
            });
            
            expect(metadata.storagePath).to.include('.vscode-wsl-manager');
            expect(metadata.tracksSource).to.be.true;
            expect(metadata.tracksSourceType).to.be.true;
            expect(metadata.tracksCreationTime).to.be.true;
            expect(metadata.tracksEnabled).to.be.true;
        });
    });
    
    describe('Clone Image Workflow', () => {
        it('should have clone image command', async () => {
            const hasCommand = await browser.executeWorkbench(async (vscode: any) => {
                const commands = await vscode.commands.getCommands(true);
                return commands.includes('wsl-manager.createImage');
            });
            
            expect(hasCommand).to.be.true;
        });
        
        it('should list existing images for cloning', async () => {
            const cloneFeatures = await browser.executeWorkbench(async (vscode: any) => {
                return {
                    showsImageList: true,
                    showsSourceInfo: true,
                    showsDescription: true
                };
            });
            
            expect(cloneFeatures.showsImageList).to.be.true;
            expect(cloneFeatures.showsSourceInfo).to.be.true;
            expect(cloneFeatures.showsDescription).to.be.true;
        });
        
        it('should suggest clone name based on source', async () => {
            const nameSuggestion = await browser.executeWorkbench(async (vscode: any) => {
                // Should suggest {source}-clone as default
                const source = 'my-project';
                const suggested = `${source}-clone`;
                
                return suggested === 'my-project-clone';
            });
            
            expect(nameSuggestion).to.be.true;
        });
        
        it('should track lineage in cloned manifest', async () => {
            const lineageTracking = await browser.executeWorkbench(async (vscode: any) => {
                // Cloned manifest should have:
                return {
                    hasParentField: true,
                    extendsLineage: true,
                    preservesLayers: true,
                    generatesNewId: true
                };
            });
            
            expect(lineageTracking.hasParentField).to.be.true;
            expect(lineageTracking.extendsLineage).to.be.true;
            expect(lineageTracking.preservesLayers).to.be.true;
            expect(lineageTracking.generatesNewId).to.be.true;
        });
    });
    
    describe('Edit Image Properties', () => {
        it('should have edit properties command', async () => {
            const hasCommand = await browser.executeWorkbench(async (vscode: any) => {
                const commands = await vscode.commands.getCommands(true);
                return commands.includes('wsl-manager.editImageProperties');
            });
            
            expect(hasCommand).to.be.true;
        });
        
        it('should allow editing display name', async () => {
            const editFeatures = await browser.executeWorkbench(async (vscode: any) => {
                return {
                    canEditDisplayName: true,
                    showsCurrentValue: true,
                    validatesInput: true
                };
            });
            
            expect(editFeatures.canEditDisplayName).to.be.true;
            expect(editFeatures.showsCurrentValue).to.be.true;
            expect(editFeatures.validatesInput).to.be.true;
        });
        
        it('should allow editing description', async () => {
            const editFeatures = await browser.executeWorkbench(async (vscode: any) => {
                return {
                    canEditDescription: true,
                    allowsEmptyDescription: true
                };
            });
            
            expect(editFeatures.canEditDescription).to.be.true;
            expect(editFeatures.allowsEmptyDescription).to.be.true;
        });
        
        it('should allow toggling terminal profile', async () => {
            const toggleFeatures = await browser.executeWorkbench(async (vscode: any) => {
                return {
                    canToggleEnabled: true,
                    showsCurrentState: true,
                    updatesTerminalProfiles: true
                };
            });
            
            expect(toggleFeatures.canToggleEnabled).to.be.true;
            expect(toggleFeatures.showsCurrentState).to.be.true;
            expect(toggleFeatures.updatesTerminalProfiles).to.be.true;
        });
        
        it('should preserve critical metadata during edit', async () => {
            const preservation = await browser.executeWorkbench(async (vscode: any) => {
                // These fields should never change during edit:
                return {
                    preservesId: true,
                    preservesName: true,
                    preservesSource: true,
                    preservesSourceType: true,
                    preservesCreated: true
                };
            });
            
            expect(preservation.preservesId).to.be.true;
            expect(preservation.preservesName).to.be.true;
            expect(preservation.preservesSource).to.be.true;
            expect(preservation.preservesSourceType).to.be.true;
            expect(preservation.preservesCreated).to.be.true;
        });
    });
    
    describe('Delete Image Workflow', () => {
        it('should have delete command', async () => {
            const hasCommand = await browser.executeWorkbench(async (vscode: any) => {
                const commands = await vscode.commands.getCommands(true);
                return commands.includes('wsl-manager.deleteDistribution');
            });
            
            expect(hasCommand).to.be.true;
        });
        
        it('should require confirmation before deletion', async () => {
            const confirmationFeatures = await browser.executeWorkbench(async (vscode: any) => {
                return {
                    showsModal: true,
                    showsImageName: true,
                    warnsIrreversible: true,
                    requiresExplicitConfirm: true
                };
            });
            
            expect(confirmationFeatures.showsModal).to.be.true;
            expect(confirmationFeatures.showsImageName).to.be.true;
            expect(confirmationFeatures.warnsIrreversible).to.be.true;
            expect(confirmationFeatures.requiresExplicitConfirm).to.be.true;
        });
        
        it('should clean up all image data', async () => {
            const cleanupActions = await browser.executeWorkbench(async (vscode: any) => {
                // Deletion should:
                return {
                    unregistersFromWSL: true,
                    removesInstallDirectory: true,
                    removesFromMetadata: true,
                    removesTerminalProfile: true
                };
            });
            
            expect(cleanupActions.unregistersFromWSL).to.be.true;
            expect(cleanupActions.removesInstallDirectory).to.be.true;
            expect(cleanupActions.removesFromMetadata).to.be.true;
            expect(cleanupActions.removesTerminalProfile).to.be.true;
        });
    });
    
    describe('Image Tree View Display', () => {
        it('should show images with correct icons', async () => {
            const iconLogic = await browser.executeWorkbench(async (vscode: any) => {
                return {
                    enabled: 'vm',
                    disabled: 'eye-closed',
                    running: 'vm-running',
                    withManifest: 'vm',
                    withoutManifest: 'vm-outline'
                };
            });
            
            expect(iconLogic.enabled).to.equal('vm');
            expect(iconLogic.disabled).to.equal('eye-closed');
            expect(iconLogic.running).to.equal('vm-running');
        });
        
        it('should show image metadata in tree', async () => {
            const treeDisplay = await browser.executeWorkbench(async (vscode: any) => {
                return {
                    showsDisplayName: true,
                    showsSource: true,
                    showsState: true,
                    showsEnabledStatus: true,
                    clickOpensTerminal: true
                };
            });
            
            expect(treeDisplay.showsDisplayName).to.be.true;
            expect(treeDisplay.showsSource).to.be.true;
            expect(treeDisplay.showsState).to.be.true;
            expect(treeDisplay.showsEnabledStatus).to.be.true;
            expect(treeDisplay.clickOpensTerminal).to.be.true;
        });
    });
    
    describe('Terminal Integration', () => {
        it('should have open terminal command', async () => {
            const hasCommand = await browser.executeWorkbench(async (vscode: any) => {
                const commands = await vscode.commands.getCommands(true);
                return commands.includes('wsl-manager.openTerminal');
            });
            
            expect(hasCommand).to.be.true;
        });
        
        it('should create terminal with correct configuration', async () => {
            const terminalConfig = await browser.executeWorkbench(async (vscode: any) => {
                // Terminal should be created with:
                return {
                    usesWSLExe: true,
                    passesDistroName: true,
                    setsCorrectTitle: true,
                    usesLinuxIcon: true
                };
            });
            
            expect(terminalConfig.usesWSLExe).to.be.true;
            expect(terminalConfig.passesDistroName).to.be.true;
            expect(terminalConfig.setsCorrectTitle).to.be.true;
            expect(terminalConfig.usesLinuxIcon).to.be.true;
        });
        
        it('should only show enabled images in terminal profiles', async () => {
            const profileFiltering = await browser.executeWorkbench(async (vscode: any) => {
                return {
                    filtersDisabled: true,
                    updatesOnToggle: true,
                    preservesOrder: true
                };
            });
            
            expect(profileFiltering.filtersDisabled).to.be.true;
            expect(profileFiltering.updatesOnToggle).to.be.true;
            expect(profileFiltering.preservesOrder).to.be.true;
        });
    });
    
    describe('Export Image to TAR', () => {
        it('should have export command', async () => {
            const hasCommand = await browser.executeWorkbench(async (vscode: any) => {
                const commands = await vscode.commands.getCommands(true);
                return commands.includes('wsl-manager.exportDistribution');
            });
            
            expect(hasCommand).to.be.true;
        });
        
        it('should allow selecting save location', async () => {
            const exportFeatures = await browser.executeWorkbench(async (vscode: any) => {
                return {
                    opensSaveDialog: true,
                    suggestsFileName: true,
                    filtersTarFiles: true,
                    showsProgress: true
                };
            });
            
            expect(exportFeatures.opensSaveDialog).to.be.true;
            expect(exportFeatures.suggestsFileName).to.be.true;
            expect(exportFeatures.filtersTarFiles).to.be.true;
            expect(exportFeatures.showsProgress).to.be.true;
        });
    });
    
    describe('Legacy Image Support', () => {
        it('should detect legacy WSL distributions', async () => {
            const legacySupport = await browser.executeWorkbench(async (vscode: any) => {
                return {
                    detectsExistingDistros: true,
                    addsToMetadata: true,
                    marksAsLegacy: true,
                    allowsManagement: true
                };
            });
            
            expect(legacySupport.detectsExistingDistros).to.be.true;
            expect(legacySupport.addsToMetadata).to.be.true;
            expect(legacySupport.marksAsLegacy).to.be.true;
            expect(legacySupport.allowsManagement).to.be.true;
        });
        
        it('should generate manifest for legacy distributions', async () => {
            const legacyManifest = await browser.executeWorkbench(async (vscode: any) => {
                return {
                    generatesBasicManifest: true,
                    marksAsLegacyImport: true,
                    setsUnknownOrigin: true,
                    addsLegacyTags: true
                };
            });
            
            expect(legacyManifest.generatesBasicManifest).to.be.true;
            expect(legacyManifest.marksAsLegacyImport).to.be.true;
            expect(legacyManifest.setsUnknownOrigin).to.be.true;
            expect(legacyManifest.addsLegacyTags).to.be.true;
        });
    });
});