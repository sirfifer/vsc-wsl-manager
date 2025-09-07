import * as assert from 'assert';
import * as vscode from 'vscode';
import { WSLManager } from '../../wslManager';
import { WSLTreeDataProvider } from '../../wslTreeDataProvider';
import { WSLImageManager } from '../../imageManager';

suite('WSL Manager Extension Test Suite', () => {
    vscode.window.showInformationMessage('Starting WSL Manager tests');

    test('Extension should be present', () => {
        const extensions = vscode.extensions.all.map(ext => ext.id);
        console.log('Available extensions:', extensions.filter(id => id.includes('wsl')));
        const ext = vscode.extensions.getExtension('wsl-manager.vsc-wsl-manager');
        console.log('Our extension found:', !!ext);
        assert.ok(ext);
    });

    test('Should activate', async () => {
        const ext = vscode.extensions.getExtension('wsl-manager.vsc-wsl-manager');
        if (ext) {
            await ext.activate();
            assert.ok(ext.isActive);
        }
    });

    test('Should register all commands', async () => {
        const commands = await vscode.commands.getCommands();
        
        const expectedCommands = [
            'wsl-manager.refreshDistributions',
            'wsl-manager.downloadDistribution',
            'wsl-manager.createDistribution',
            'wsl-manager.createImage',
            'wsl-manager.importDistribution',
            'wsl-manager.exportDistribution',
            'wsl-manager.deleteDistribution',
            'wsl-manager.openTerminal'
        ];

        console.log('WSL commands found:', commands.filter(cmd => cmd.includes('wsl-manager')));
        console.log('Total commands:', commands.length);

        expectedCommands.forEach(cmd => {
            const found = commands.includes(cmd);
            console.log(`Command ${cmd}: ${found ? 'FOUND' : 'MISSING'}`);
            assert.ok(
                found,
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
        const imageManager = new WSLImageManager();
        const provider = new WSLTreeDataProvider(manager, imageManager);
        
        const children = await provider.getChildren();
        assert.ok(Array.isArray(children));
    });
});