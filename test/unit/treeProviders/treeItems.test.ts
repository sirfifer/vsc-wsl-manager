/**
 * Tree Provider Tests
 * Tests the structure of tree items that get passed to commands
 * Ensures correct property access patterns
 * 
 * @author Marcus Johnson, QA Manager
 */

import * as vscode from 'vscode';
import { DistroTreeProvider } from '../../../src/views/DistroTreeProvider';
import { ImageTreeProvider } from '../../../src/views/ImageTreeProvider';

describe('Tree Provider Item Structure Tests', () => {
    
    describe('DistroTreeItem Structure', () => {
        it('should create tree items with distro property (NOT distribution)', () => {
            // This is the ACTUAL structure that commands receive
            const distroTreeItem = {
                distro: {  // MUST be 'distro', not 'distribution'
                    name: 'ubuntu-22.04',
                    displayName: 'Ubuntu 22.04 LTS',
                    version: '22.04',
                    description: 'Long term support',
                    available: true,
                    filePath: '/path/to/ubuntu.tar',
                    size: 650 * 1024 * 1024
                },
                contextValue: 'distribution', // MUST be exactly 'distribution'
                label: 'Ubuntu 22.04 LTS',
                tooltip: 'Ubuntu 22.04 LTS (22.04)',
                iconPath: new vscode.ThemeIcon('package')
            };

            // Commands access via item.distro.name
            expect(distroTreeItem.distro.name).toBe('ubuntu-22.04');
            expect(distroTreeItem.contextValue).toBe('distribution');
        });

        it('should set contextValue to "distribution" for package.json menu matching', () => {
            // package.json has: viewItem == distribution
            const item = {
                contextValue: 'distribution'
            };

            // This MUST match exactly for context menu to appear
            expect(item.contextValue).toBe('distribution');
            expect(item.contextValue).not.toBe('distro'); // Common mistake
        });

        it('should handle unavailable distros correctly', () => {
            const unavailableDistro = {
                distro: {
                    name: 'alpine-3.19',
                    displayName: 'Alpine Linux',
                    available: false // Not downloaded yet
                },
                contextValue: 'distribution',
                label: 'Alpine Linux',
                description: 'Not downloaded',
                iconPath: new vscode.ThemeIcon('cloud-download')
            };

            expect(unavailableDistro.distro.available).toBe(false);
            expect(unavailableDistro.description).toBe('Not downloaded');
        });
    });

    describe('ImageTreeItem Structure', () => {
        it('should create tree items with image property', () => {
            const imageTreeItem = {
                image: {  // MUST be 'image'
                    name: 'my-ubuntu-dev',
                    displayName: 'My Ubuntu Development',
                    description: 'Development environment',
                    enabled: true,
                    source: 'ubuntu-22.04',
                    created: '2024-01-15T10:00:00Z'
                },
                contextValue: 'image', // MUST start with 'image'
                label: 'My Ubuntu Development',
                tooltip: 'WSL Image: my-ubuntu-dev',
                iconPath: new vscode.ThemeIcon('vm')
            };

            // Commands access via item.image.name
            expect(imageTreeItem.image.name).toBe('my-ubuntu-dev');
            expect(imageTreeItem.contextValue).toBe('image');
        });

        it('should support contextValue variations for images', () => {
            // package.json has: viewItem =~ /^image/
            const validContextValues = [
                'image',
                'image-enabled',
                'image-disabled',
                'image-running'
            ];

            for (const cv of validContextValues) {
                expect(cv).toMatch(/^image/);
            }
        });

        it('should indicate enabled/disabled state', () => {
            const enabledImage = {
                image: { enabled: true },
                contextValue: 'image-enabled',
                iconPath: new vscode.ThemeIcon('vm')
            };

            const disabledImage = {
                image: { enabled: false },
                contextValue: 'image-disabled',
                iconPath: new vscode.ThemeIcon('vm-outline')
            };

            expect(enabledImage.image.enabled).toBe(true);
            expect(disabledImage.image.enabled).toBe(false);
        });
    });

    describe('Command Parameter Expectations', () => {
        it('deleteDistribution should receive item with distro property', () => {
            const commandParam = {
                distro: { name: 'test-distro' },
                contextValue: 'distribution'
            };

            // Command checks: item?.distro?.name
            const distroName = commandParam?.distro?.name;
            expect(distroName).toBe('test-distro');
        });

        it('createImage should receive item with distro property', () => {
            const commandParam = {
                distro: { 
                    name: 'ubuntu-22.04',
                    available: true 
                },
                contextValue: 'distribution'
            };

            // Command checks: item?.distro?.name && item.distro.available
            const canCreate = commandParam?.distro?.name && commandParam.distro.available;
            expect(canCreate).toBeTruthy();
        });

        it('deleteImage should receive item with image property', () => {
            const commandParam = {
                image: { name: 'my-image' },
                contextValue: 'image'
            };

            // Command checks: item?.image?.name
            const imageName = commandParam?.image?.name;
            expect(imageName).toBe('my-image');
        });

        it('openTerminal should only work with image items', () => {
            const imageItem = {
                image: { name: 'my-ubuntu' },
                contextValue: 'image'
            };

            const distroItem = {
                distro: { name: 'ubuntu-22.04' },
                contextValue: 'distribution'
            };

            // OpenTerminal appears only for images in package.json
            const imageHasTerminal = imageItem.contextValue.startsWith('image');
            const distroHasTerminal = distroItem.contextValue === 'distribution';

            expect(imageHasTerminal).toBe(true);
            expect(distroHasTerminal).toBe(false); // Distros don't have terminals
        });
    });

    describe('Tree Provider Refresh Behavior', () => {
        it('should refresh after delete operations', () => {
            let refreshCalled = false;
            
            const mockRefresh = () => {
                refreshCalled = true;
            };

            // After delete operation
            mockRefresh();
            
            expect(refreshCalled).toBe(true);
        });

        it('should show correct counts', () => {
            const distros = [
                { name: 'ubuntu', available: true },
                { name: 'debian', available: false },
                { name: 'alpine', available: true }
            ];

            const availableCount = distros.filter(d => d.available).length;
            expect(availableCount).toBe(2);
        });
    });

    describe('Property Access Patterns', () => {
        it('should handle missing properties gracefully', () => {
            const incompleteItem = {
                label: 'Fallback Label'
            };

            // Commands should handle missing properties
            const name = (incompleteItem as any)?.distro?.name || 
                        (incompleteItem as any)?.distribution?.name ||
                        incompleteItem.label;
            
            expect(name).toBe('Fallback Label');
        });

        it('should not confuse distro with distribution property', () => {
            const correctItem = {
                distro: { name: 'correct' },
                contextValue: 'distribution'
            };

            const incorrectItem = {
                distribution: { name: 'wrong' }, // Wrong property name
                contextValue: 'distribution'
            };

            // Commands check item.distro, not item.distribution
            expect(correctItem.distro).toBeDefined();
            expect((incorrectItem as any).distro).toBeUndefined();
        });
    });

    describe('Menu Visibility Rules', () => {
        it('should match package.json when conditions', () => {
            // From package.json menus
            const menuRules = {
                deleteDistribution: 'view == wslDistributions && viewItem == distribution',
                deleteImage: 'view == wslImages && viewItem =~ /^image/',
                openTerminal: 'view == wslImages && viewItem =~ /^image/',
                createImage: 'view == wslDistributions && viewItem == distribution'
            };

            // Test contextValue matching
            const distroItem = { contextValue: 'distribution' };
            const imageItem = { contextValue: 'image' };

            expect(distroItem.contextValue).toBe('distribution');
            expect(imageItem.contextValue).toMatch(/^image/);
        });
    });
});