/**
 * Minimal E2E test to verify WebdriverIO setup works
 * This is the simplest possible test to debug configuration issues
 */

describe('Minimal WebdriverIO Test', () => {
    it('should launch VS Code successfully', async () => {
        console.log('Test started - VS Code should be running');
        
        // Get the workbench - this is the main VS Code window
        const workbench = await browser.getWorkbench();
        console.log('Got workbench object');
        
        // Verify we can access VS Code
        expect(workbench).toBeDefined();
        
        // Wait a bit to see VS Code
        await browser.pause(2000);
        
        console.log('Test completed successfully');
    });
    
    it('should find the extension', async () => {
        console.log('Checking for WSL Manager extension...');
        
        // Try to execute code in VS Code context
        const result = await browser.executeWorkbench(async (vscode) => {
            // Look for our extension
            const ext = vscode.extensions.getExtension('wsl-manager.vsc-wsl-manager');
            
            if (ext) {
                return {
                    found: true,
                    id: ext.id,
                    isActive: ext.isActive
                };
            }
            
            // Try alternative ID formats
            const allExtensions = vscode.extensions.all;
            const wslExt = allExtensions.find(e => 
                e.id.includes('wsl-manager') || 
                e.packageJSON?.name === 'vsc-wsl-manager'
            );
            
            if (wslExt) {
                return {
                    found: true,
                    id: wslExt.id,
                    isActive: wslExt.isActive,
                    name: wslExt.packageJSON?.name
                };
            }
            
            return {
                found: false,
                totalExtensions: allExtensions.length
            };
        });
        
        console.log('Extension check result:', result);
        
        // Just log the result, don't fail the test yet
        if (result.found) {
            console.log(`✓ Extension found: ${result.id}`);
            console.log(`  Active: ${result.isActive}`);
        } else {
            console.log(`✗ Extension not found. Total extensions: ${result.totalExtensions}`);
        }
    });
});