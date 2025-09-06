import * as assert from 'assert';
import * as vscode from 'vscode';
import { WSLManager } from '../../wslManager';
import { WSLTreeDataProvider } from '../../wslTreeDataProvider';

suite('WSL Manager Extension Test Suite', () => {
    vscode.window.showInformationMessage('Starting WSL Manager tests');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('your-publisher-name.vsc-wsl-manager'));
    });

    test('Should activate', async () => {
        const ext = vscode.extensions.getExtension('your-publisher-name.vsc-wsl-manager');
        if (ext) {
            await ext.activate();
            assert.ok(ext.isActive);
        }
    });

    test('Should register all commands', async () => {
        const commands = await vscode.commands.getCommands();
        
        const expectedCommands = [
            'wsl-manager.refreshDistributions',
            'wsl-manager.createDistribution',
            'wsl-manager.importDistribution',
            'wsl-manager.exportDistribution',
            'wsl-manager.deleteDistribution',
            'wsl-manager.openTerminal'
        ];

        expectedCommands.forEach(cmd => {
            assert.ok(
                commands.includes(cmd),
                `Command ${cmd} not registered`
            );
        });
    });

    test('WSLManager should list distributions', async () => {
        const manager = new WSLManager();
        const distributions = await manager.listDistributions();
        
        // Should return an array (even if empty on systems without WSL)
        assert.ok(Array.isArray(distributions));
    });

    test('Tree provider should provide items', async () => {
        const manager = new WSLManager();
        const provider = new WSLTreeDataProvider(manager);
        
        const children = await provider.getChildren();
        assert.ok(Array.isArray(children));
    });
});