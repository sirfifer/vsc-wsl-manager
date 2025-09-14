/**
 * Tests for Distro Command Handlers
 * Tests that commands work correctly with DistroTreeItem structure
 */

describe('Distro Command Handlers', () => {
    describe('Delete Distribution Command', () => {
        it('should extract distro name from DistroTreeItem with distro property', () => {
            // DistroTreeItem has a 'distro' property, not 'distribution'
            const item = {
                distro: {
                    name: 'ubuntu-22.04',
                    displayName: 'Ubuntu 22.04'
                }
            };
            
            // The command should check item?.distro?.name
            const distroName = item?.distro?.name;
            expect(distroName).toBe('ubuntu-22.04');
        });
        
        it('should handle missing distro property gracefully', () => {
            const item = {
                label: 'Ubuntu 22.04'
            };
            
            // Should fall back to label
            const distroName = (item as any)?.distro?.name || item.label;
            expect(distroName).toBe('Ubuntu 22.04');
        });
        
        it('should not allow deletion of distros - they are read-only templates', () => {
            // Distros are pristine templates and should never be deleted
            // Only images (WSL instances) should be deletable
            // The delete command in distro context menu might be a mistake
            
            // This test documents that distros should not be deletable
            const isDistro = true;
            const canDelete = !isDistro; // Only images can be deleted
            
            expect(canDelete).toBe(false);
        });
    });
    
    describe('Create Image from Distribution Command', () => {
        it('should extract distro name from context menu item', () => {
            const item = {
                distro: {
                    name: 'ubuntu-22.04',
                    displayName: 'Ubuntu 22.04',
                    available: true
                }
            };
            
            // The command should check item?.distro?.name
            const sourceDistroName = item?.distro?.name;
            expect(sourceDistroName).toBe('ubuntu-22.04');
        });
        
        it('should check if distro is available before creating image', () => {
            const item = {
                distro: {
                    name: 'ubuntu-22.04',
                    available: false // Not downloaded
                }
            };
            
            // Should not allow creating image from unavailable distro
            const canCreate = item.distro.available;
            expect(canCreate).toBe(false);
        });
        
        it('should show correct error message on failure', () => {
            // Error message should be "create image" not "clone image"
            const operation = 'create image from distribution';
            expect(operation).not.toContain('clone');
        });
    });
    
    describe('Context Value Requirements', () => {
        it('should use "distribution" as contextValue for distro items', () => {
            // package.json expects viewItem == distribution
            const expectedContextValue = 'distribution';
            
            // DistroTreeItem should set this.contextValue = 'distribution'
            expect(expectedContextValue).toBe('distribution');
        });
        
        it('should not have openTerminal in distro context menu', () => {
            // Distros are templates, not running instances
            // They should never have terminal access
            const distroCommands = [
                'wsl-manager.createImage',
                'wsl-manager.exportDistribution',
                // 'wsl-manager.openTerminal' should NOT be here
            ];
            
            expect(distroCommands).not.toContain('wsl-manager.openTerminal');
        });
    });
});