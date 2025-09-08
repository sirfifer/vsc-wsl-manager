/**
 * Simple Windows VS Code E2E Test
 * Verifies that VS Code launches on Windows from WSL
 */

import { browser } from '@wdio/globals';
import { expect } from 'chai';

describe('Windows VS Code Launch Test', () => {
    it('should launch VS Code on Windows', async () => {
        console.log('Starting Windows VS Code test');
        
        // Get workbench - this will launch VS Code
        const workbench = await browser.getWorkbench();
        console.log('Got workbench object');
        
        // Basic verification that VS Code launched
        expect(workbench).to.exist;
        
        // Try to get VS Code info
        const info = await browser.executeWorkbench(async (vscode: any) => {
            return {
                version: vscode.version,
                platform: process.platform,
                nodeVersion: process.version
            };
        });
        
        console.log('VS Code info:', info);
        expect(info.platform).to.equal('win32'); // Should be Windows
    });
    
    it('should find WSL Manager extension', async () => {
        const extensionInfo = await browser.executeWorkbench(async (vscode: any) => {
            const ext = vscode.extensions.getExtension('wsl-manager.vsc-wsl-manager');
            if (!ext) {
                // Try without publisher prefix
                const allExts = vscode.extensions.all;
                const wslExt = allExts.find((e: any) => 
                    e.id.includes('wsl-manager') || 
                    e.packageJSON?.name === 'vsc-wsl-manager'
                );
                return wslExt ? {
                    found: true,
                    id: wslExt.id,
                    name: wslExt.packageJSON?.displayName || wslExt.id
                } : { found: false };
            }
            return {
                found: true,
                id: ext.id,
                isActive: ext.isActive
            };
        });
        
        console.log('Extension info:', extensionInfo);
        expect(extensionInfo.found).to.be.true;
    });
});