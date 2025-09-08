/**
 * Simple E2E Test to verify WebdriverIO setup
 */

import { browser } from '@wdio/globals';
import { expect } from 'chai';

describe('Simple E2E Test', () => {
    it('should launch VS Code and verify extension', async () => {
        console.log('Test started - getting workbench');
        const workbench = await browser.getWorkbench();
        console.log('Got workbench');
        
        // Try to get extension info
        const extensionInfo = await browser.executeWorkbench(async (vscode: any) => {
            console.log('Inside VS Code context');
            return {
                extensions: vscode.extensions.all.length,
                platform: process.platform,
                nodeVersion: process.version
            };
        });
        
        console.log('Extension info:', extensionInfo);
        expect(extensionInfo).to.exist;
        expect(extensionInfo.extensions).to.be.greaterThan(0);
    });
});