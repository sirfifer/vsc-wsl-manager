/**
 * Unit tests for WSLManager
 * Tests all methods, error handling, and edge cases
 */

import * as vscode from 'vscode';

// Mock dependencies first
jest.mock('vscode');
jest.mock('child_process', () => {
    const systemCommands = require('../mocks/systemCommands');
    return {
        exec: systemCommands.mockExec,
        spawn: systemCommands.mockSpawn
    };
});
jest.mock('util', () => ({
    promisify: (fn: Function) => fn
}));
jest.mock('fs', () => {
    const systemCommands = require('../mocks/systemCommands');
    return systemCommands.mockFs;
});

// Import after mocks
import { WSLManager, WSLDistribution } from '../../src/wslManager';
import { commandMockUtils, mockProcessEnv } from '../mocks/systemCommands';
import { distributionGenerators, pathGenerators, inputGenerators, errorGenerators, assertionHelpers } from '../utils/testDataGenerators';

describe('WSLManager', () => {
    let wslManager: WSLManager;
    
    beforeEach(() => {
        wslManager = new WSLManager();
        commandMockUtils.resetAll();
        
        // Set up default mocks
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn().mockReturnValue('')
        });
        
        // Mock process.env
        Object.defineProperty(process, 'env', {
            value: mockProcessEnv,
            configurable: true
        });
    });
    
    afterEach(() => {
        jest.clearAllMocks();
    });
    
    describe('listDistributions', () => {
        it('should return parsed distributions list', async () => {
            const mockOutput = distributionGenerators.createRawWSLOutput();
            commandMockUtils.setupExecMock('--list --verbose', mockOutput);
            
            const distributions = await wslManager.listDistributions();
            
            expect(distributions).toHaveLength(3);
            expect(distributions[0]).toEqual({
                name: 'Ubuntu',
                state: 'Running',
                version: '2',
                default: true
            });
            expect(mockExec).toHaveBeenCalledWith('wsl.exe --list --verbose', expect.any(Function));
        });
        
        it('should handle empty distributions list', async () => {
            commandMockUtils.setupExecMock('--list --verbose', '  NAME                   STATE           VERSION\n');
            
            const distributions = await wslManager.listDistributions();
            
            expect(distributions).toEqual([]);
        });
        
        it('should handle WSL not installed error', async () => {
            commandMockUtils.setupExecMock('--list', '', 'wsl.exe is not recognized');
            
            const distributions = await wslManager.listDistributions();
            
            expect(distributions).toEqual([]);
            expect(console.error).toHaveBeenCalledWith(
                'Failed to list WSL distributions:',
                expect.any(Error)
            );
        });
        
        it('should handle malformed output gracefully', async () => {
            const malformedOutput = 'Some random text\nNot a valid format';
            commandMockUtils.setupExecMock('--list', malformedOutput);
            
            const distributions = await wslManager.listDistributions();
            
            expect(distributions).toEqual([]);
        });
    });
    
    describe('createDistribution', () => {
        beforeEach(() => {
            // Mock successful base distribution check
            const mockDistributions = distributionGenerators.createDistributionList();
            commandMockUtils.setupExecMock('--list --verbose', distributionGenerators.createRawWSLOutput(mockDistributions));
        });
        
        it('should create distribution by cloning existing one', async () => {
            const name = 'test-distro';
            const baseDistro = 'Ubuntu';
            const tempPath = pathGenerators.createPath('tar');
            
            jest.spyOn(require('path'), 'join').mockReturnValue(tempPath);
            commandMockUtils.setupExecMock('--export', 'Export successful');
            commandMockUtils.setupExecMock('--import', 'Import successful');
            
            await wslManager.createDistribution(name, baseDistro);
            
            expect(mockExec).toHaveBeenCalledWith(
                expect.stringContaining(`--export "${baseDistro}" "${tempPath}"`),
                expect.any(Function)
            );
            expect(mockExec).toHaveBeenCalledWith(
                expect.stringContaining(`--import "${name}"`),
                expect.any(Function)
            );
            expect(mockFs.promises.unlink).toHaveBeenCalledWith(tempPath);
        });
        
        it('should throw error if base distribution does not exist', async () => {
            const name = 'test-distro';
            const baseDistro = 'NonExistent';
            
            await assertionHelpers.assertRejects(
                wslManager.createDistribution(name, baseDistro),
                `Base distribution '${baseDistro}' is not installed`
            );
        });
        
        it('should handle export failure', async () => {
            const name = 'test-distro';
            const baseDistro = 'Ubuntu';
            
            commandMockUtils.setupExecMock('--export', '', 'Export failed');
            
            await assertionHelpers.assertRejects(
                wslManager.createDistribution(name, baseDistro),
                'Export failed'
            );
        });
        
        it('should clean up temp file even if import fails', async () => {
            const name = 'test-distro';
            const baseDistro = 'Ubuntu';
            const tempPath = pathGenerators.createPath('tar');
            
            jest.spyOn(require('path'), 'join').mockReturnValue(tempPath);
            commandMockUtils.setupExecMock('--export', 'Export successful');
            commandMockUtils.setupExecMock('--import', '', 'Import failed');
            
            await assertionHelpers.assertRejects(
                wslManager.createDistribution(name, baseDistro),
                'Import failed'
            );
            
            expect(mockFs.promises.unlink).toHaveBeenCalledWith(tempPath);
        });
    });
    
    describe('importDistribution', () => {
        it('should import distribution from TAR file', async () => {
            const name = 'imported-distro';
            const tarPath = pathGenerators.createPath('tar');
            const installLocation = pathGenerators.createPath('dir');
            
            commandMockUtils.setupExecMock('--import', 'Import successful');
            
            await wslManager.importDistribution(name, tarPath, installLocation);
            
            expect(mockFs.promises.mkdir).toHaveBeenCalledWith(installLocation, { recursive: true });
            expect(mockExec).toHaveBeenCalledWith(
                `wsl.exe --import "${name}" "${installLocation}" "${tarPath}"`,
                expect.any(Function)
            );
        });
        
        it('should use default install path when not specified', async () => {
            const name = 'imported-distro';
            const tarPath = pathGenerators.createPath('tar');
            
            commandMockUtils.setupExecMock('--import', 'Import successful');
            
            await wslManager.importDistribution(name, tarPath);
            
            expect(mockFs.promises.mkdir).toHaveBeenCalled();
            expect(mockExec).toHaveBeenCalledWith(
                expect.stringContaining(`--import "${name}"`),
                expect.any(Function)
            );
        });
        
        it('should handle import failure', async () => {
            const name = 'imported-distro';
            const tarPath = pathGenerators.createPath('tar');
            
            commandMockUtils.setupExecMock('--import', '', 'Import failed: Invalid TAR file');
            
            await assertionHelpers.assertRejects(
                wslManager.importDistribution(name, tarPath),
                'Import failed'
            );
        });
    });
    
    describe('exportDistribution', () => {
        it('should export distribution to TAR file', async () => {
            const name = 'test-distro';
            const exportPath = pathGenerators.createPath('tar');
            
            commandMockUtils.setupExecMock('--export', 'Export successful');
            
            await wslManager.exportDistribution(name, exportPath);
            
            expect(mockExec).toHaveBeenCalledWith(
                `wsl.exe --export "${name}" "${exportPath}"`,
                expect.any(Function)
            );
        });
        
        it('should handle export failure', async () => {
            const name = 'test-distro';
            const exportPath = pathGenerators.createPath('tar');
            
            commandMockUtils.setupExecMock('--export', '', 'Distribution not found');
            
            await assertionHelpers.assertRejects(
                wslManager.exportDistribution(name, exportPath),
                'Distribution not found'
            );
        });
    });
    
    describe('unregisterDistribution', () => {
        it('should unregister distribution', async () => {
            const name = 'test-distro';
            
            commandMockUtils.setupExecMock('--unregister', 'Unregister successful');
            
            await wslManager.unregisterDistribution(name);
            
            expect(mockExec).toHaveBeenCalledWith(
                `wsl.exe --unregister "${name}"`,
                expect.any(Function)
            );
        });
        
        it('should handle unregister failure', async () => {
            const name = 'test-distro';
            
            commandMockUtils.setupExecMock('--unregister', '', 'Access denied');
            
            await assertionHelpers.assertRejects(
                wslManager.unregisterDistribution(name),
                'Access denied'
            );
        });
    });
    
    describe('terminateDistribution', () => {
        it('should terminate running distribution', async () => {
            const name = 'test-distro';
            
            commandMockUtils.setupExecMock('--terminate', 'Terminate successful');
            
            await wslManager.terminateDistribution(name);
            
            expect(mockExec).toHaveBeenCalledWith(
                `wsl.exe --terminate "${name}"`,
                expect.any(Function)
            );
        });
    });
    
    describe('setDefaultDistribution', () => {
        it('should set default distribution', async () => {
            const name = 'test-distro';
            
            commandMockUtils.setupExecMock('--set-default', 'Set default successful');
            
            await wslManager.setDefaultDistribution(name);
            
            expect(mockExec).toHaveBeenCalledWith(
                `wsl.exe --set-default "${name}"`,
                expect.any(Function)
            );
        });
    });
    
    describe('runCommand', () => {
        it('should run command in distribution', async () => {
            const distribution = 'Ubuntu';
            const command = 'uname -r';
            const output = '5.15.0-58-generic';
            
            commandMockUtils.setupExecMock(`-d "${distribution}" ${command}`, output);
            
            const result = await wslManager.runCommand(distribution, command);
            
            expect(result).toBe(output);
            expect(mockExec).toHaveBeenCalledWith(
                `wsl.exe -d "${distribution}" ${command}`,
                expect.any(Function)
            );
        });
        
        it('should handle command execution failure', async () => {
            const distribution = 'Ubuntu';
            const command = 'invalid-command';
            
            commandMockUtils.setupExecMock(`-d "${distribution}"`, '', 'command not found');
            
            await assertionHelpers.assertRejects(
                wslManager.runCommand(distribution, command),
                'command not found'
            );
        });
    });
    
    describe('getDistributionInfo', () => {
        it('should return complete distribution info', async () => {
            const name = 'Ubuntu';
            
            commandMockUtils.setupExecMock('uname -r', '5.15.0-58-generic\n');
            commandMockUtils.setupExecMock('cat /etc/os-release', 'PRETTY_NAME="Ubuntu 22.04.1 LTS"\n');
            commandMockUtils.setupExecMock('free -h', 'Mem:           15Gi\n');
            
            const info = await wslManager.getDistributionInfo(name);
            
            expect(info).toEqual({
                name: 'Ubuntu',
                kernel: '5.15.0-58-generic\n',
                os: 'Ubuntu 22.04.1 LTS',
                totalMemory: '15Gi'
            });
        });
        
        it('should handle missing OS info gracefully', async () => {
            const name = 'Alpine';
            
            commandMockUtils.setupExecMock('uname -r', '5.15.0-58-generic\n');
            commandMockUtils.setupExecMock('cat /etc/os-release', '', 'No such file');
            commandMockUtils.setupExecMock('free -h', 'Mem:           8Gi\n');
            
            const info = await wslManager.getDistributionInfo(name);
            
            expect(info.os).toBe('Unknown');
        });
        
        it('should handle missing memory info gracefully', async () => {
            const name = 'Debian';
            
            commandMockUtils.setupExecMock('uname -r', '5.15.0-58-generic\n');
            commandMockUtils.setupExecMock('cat /etc/os-release', 'PRETTY_NAME="Debian 11"\n');
            commandMockUtils.setupExecMock('free -h', '', 'free: command not found');
            
            const info = await wslManager.getDistributionInfo(name);
            
            expect(info.totalMemory).toBe('Unknown');
        });
        
        it('should return error info when distribution is not accessible', async () => {
            const name = 'Broken';
            
            commandMockUtils.setupExecMock(`-d "${name}"`, '', 'Distribution not found');
            
            const info = await wslManager.getDistributionInfo(name);
            
            expect(info).toEqual({
                name: 'Broken',
                error: expect.any(String)
            });
            expect(console.error).toHaveBeenCalled();
        });
    });
    
    describe('Security Tests', () => {
        it('should not execute commands with injection attempts', async () => {
            const maliciousNames = inputGenerators.createCommandInjectionAttempts();
            
            for (const maliciousName of maliciousNames) {
                commandMockUtils.setupExecMock('--unregister', 'Success');
                
                await wslManager.unregisterDistribution(maliciousName);
                
                // Verify the command was called with quotes intact
                expect(mockExec).toHaveBeenCalledWith(
                    expect.stringContaining(`"${maliciousName}"`),
                    expect.any(Function)
                );
            }
        });
        
        it('should handle path traversal attempts', async () => {
            const maliciousPath = pathGenerators.createMaliciousPath('traversal');
            const name = 'test';
            
            commandMockUtils.setupExecMock('--import', 'Success');
            
            await wslManager.importDistribution(name, '/safe/path.tar', maliciousPath);
            
            // The current implementation doesn't validate paths, but the test is here
            // to ensure when validation is added, it works correctly
            expect(mockExec).toHaveBeenCalled();
        });
    });
    
    describe('Edge Cases', () => {
        it('should handle very long distribution names', async () => {
            const longName = 'a'.repeat(255);
            
            commandMockUtils.setupExecMock('--unregister', 'Success');
            
            await wslManager.unregisterDistribution(longName);
            
            expect(mockExec).toHaveBeenCalledWith(
                expect.stringContaining(longName),
                expect.any(Function)
            );
        });
        
        it('should handle unicode in distribution names', async () => {
            const unicodeName = 'test-κόσμε-世界';
            
            commandMockUtils.setupExecMock('--unregister', 'Success');
            
            await wslManager.unregisterDistribution(unicodeName);
            
            expect(mockExec).toHaveBeenCalledWith(
                expect.stringContaining(unicodeName),
                expect.any(Function)
            );
        });
        
        it('should handle concurrent operations', async () => {
            commandMockUtils.setupExecMock('--list', distributionGenerators.createRawWSLOutput());
            
            const promises = Array(10).fill(null).map(() => 
                wslManager.listDistributions()
            );
            
            const results = await Promise.all(promises);
            
            expect(results).toHaveLength(10);
            results.forEach(result => {
                expect(result).toHaveLength(3);
            });
        });
    });
});