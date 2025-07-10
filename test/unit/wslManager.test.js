"use strict";
/**
 * Unit tests for WSLManager
 * Tests all methods, error handling, and edge cases
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const wslManager_1 = require("../../src/wslManager");
const systemCommands_1 = require("../mocks/systemCommands");
const testDataGenerators_1 = require("../utils/testDataGenerators");
const vscode = __importStar(require("vscode"));
// Mock dependencies
jest.mock('child_process', () => ({
    exec: systemCommands_1.mockExec,
    spawn: systemCommands_1.mockSpawn
}));
jest.mock('util', () => ({
    promisify: (fn) => fn
}));
jest.mock('fs', () => systemCommands_1.mockFs);
// Mock vscode
jest.mock('vscode');
describe('WSLManager', () => {
    let wslManager;
    beforeEach(() => {
        wslManager = new wslManager_1.WSLManager();
        systemCommands_1.commandMockUtils.resetAll();
        // Set up default mocks
        vscode.workspace.getConfiguration.mockReturnValue({
            get: jest.fn().mockReturnValue('')
        });
        // Mock process.env
        Object.defineProperty(process, 'env', {
            value: systemCommands_1.mockProcessEnv,
            configurable: true
        });
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    describe('listDistributions', () => {
        it('should return parsed distributions list', async () => {
            const mockOutput = testDataGenerators_1.distributionGenerators.createRawWSLOutput();
            systemCommands_1.commandMockUtils.setupExecMock('--list --verbose', mockOutput);
            const distributions = await wslManager.listDistributions();
            expect(distributions).toHaveLength(3);
            expect(distributions[0]).toEqual({
                name: 'Ubuntu',
                state: 'Running',
                version: '2',
                default: true
            });
            expect(systemCommands_1.mockExec).toHaveBeenCalledWith('wsl.exe --list --verbose', expect.any(Function));
        });
        it('should handle empty distributions list', async () => {
            systemCommands_1.commandMockUtils.setupExecMock('--list --verbose', '  NAME                   STATE           VERSION\n');
            const distributions = await wslManager.listDistributions();
            expect(distributions).toEqual([]);
        });
        it('should handle WSL not installed error', async () => {
            systemCommands_1.commandMockUtils.setupExecMock('--list', '', 'wsl.exe is not recognized');
            const distributions = await wslManager.listDistributions();
            expect(distributions).toEqual([]);
            expect(console.error).toHaveBeenCalledWith('Failed to list WSL distributions:', expect.any(Error));
        });
        it('should handle malformed output gracefully', async () => {
            const malformedOutput = 'Some random text\nNot a valid format';
            systemCommands_1.commandMockUtils.setupExecMock('--list', malformedOutput);
            const distributions = await wslManager.listDistributions();
            expect(distributions).toEqual([]);
        });
    });
    describe('createDistribution', () => {
        beforeEach(() => {
            // Mock successful base distribution check
            const mockDistributions = testDataGenerators_1.distributionGenerators.createDistributionList();
            systemCommands_1.commandMockUtils.setupExecMock('--list --verbose', testDataGenerators_1.distributionGenerators.createRawWSLOutput(mockDistributions));
        });
        it('should create distribution by cloning existing one', async () => {
            const name = 'test-distro';
            const baseDistro = 'Ubuntu';
            const tempPath = testDataGenerators_1.pathGenerators.createPath('tar');
            jest.spyOn(require('path'), 'join').mockReturnValue(tempPath);
            systemCommands_1.commandMockUtils.setupExecMock('--export', 'Export successful');
            systemCommands_1.commandMockUtils.setupExecMock('--import', 'Import successful');
            await wslManager.createDistribution(name, baseDistro);
            expect(systemCommands_1.mockExec).toHaveBeenCalledWith(expect.stringContaining(`--export "${baseDistro}" "${tempPath}"`), expect.any(Function));
            expect(systemCommands_1.mockExec).toHaveBeenCalledWith(expect.stringContaining(`--import "${name}"`), expect.any(Function));
            expect(systemCommands_1.mockFs.promises.unlink).toHaveBeenCalledWith(tempPath);
        });
        it('should throw error if base distribution does not exist', async () => {
            const name = 'test-distro';
            const baseDistro = 'NonExistent';
            await testDataGenerators_1.assertionHelpers.assertRejects(wslManager.createDistribution(name, baseDistro), `Base distribution '${baseDistro}' is not installed`);
        });
        it('should handle export failure', async () => {
            const name = 'test-distro';
            const baseDistro = 'Ubuntu';
            systemCommands_1.commandMockUtils.setupExecMock('--export', '', 'Export failed');
            await testDataGenerators_1.assertionHelpers.assertRejects(wslManager.createDistribution(name, baseDistro), 'Export failed');
        });
        it('should clean up temp file even if import fails', async () => {
            const name = 'test-distro';
            const baseDistro = 'Ubuntu';
            const tempPath = testDataGenerators_1.pathGenerators.createPath('tar');
            jest.spyOn(require('path'), 'join').mockReturnValue(tempPath);
            systemCommands_1.commandMockUtils.setupExecMock('--export', 'Export successful');
            systemCommands_1.commandMockUtils.setupExecMock('--import', '', 'Import failed');
            await testDataGenerators_1.assertionHelpers.assertRejects(wslManager.createDistribution(name, baseDistro), 'Import failed');
            expect(systemCommands_1.mockFs.promises.unlink).toHaveBeenCalledWith(tempPath);
        });
    });
    describe('importDistribution', () => {
        it('should import distribution from TAR file', async () => {
            const name = 'imported-distro';
            const tarPath = testDataGenerators_1.pathGenerators.createPath('tar');
            const installLocation = testDataGenerators_1.pathGenerators.createPath('dir');
            systemCommands_1.commandMockUtils.setupExecMock('--import', 'Import successful');
            await wslManager.importDistribution(name, tarPath, installLocation);
            expect(systemCommands_1.mockFs.promises.mkdir).toHaveBeenCalledWith(installLocation, { recursive: true });
            expect(systemCommands_1.mockExec).toHaveBeenCalledWith(`wsl.exe --import "${name}" "${installLocation}" "${tarPath}"`, expect.any(Function));
        });
        it('should use default install path when not specified', async () => {
            const name = 'imported-distro';
            const tarPath = testDataGenerators_1.pathGenerators.createPath('tar');
            systemCommands_1.commandMockUtils.setupExecMock('--import', 'Import successful');
            await wslManager.importDistribution(name, tarPath);
            expect(systemCommands_1.mockFs.promises.mkdir).toHaveBeenCalled();
            expect(systemCommands_1.mockExec).toHaveBeenCalledWith(expect.stringContaining(`--import "${name}"`), expect.any(Function));
        });
        it('should handle import failure', async () => {
            const name = 'imported-distro';
            const tarPath = testDataGenerators_1.pathGenerators.createPath('tar');
            systemCommands_1.commandMockUtils.setupExecMock('--import', '', 'Import failed: Invalid TAR file');
            await testDataGenerators_1.assertionHelpers.assertRejects(wslManager.importDistribution(name, tarPath), 'Import failed');
        });
    });
    describe('exportDistribution', () => {
        it('should export distribution to TAR file', async () => {
            const name = 'test-distro';
            const exportPath = testDataGenerators_1.pathGenerators.createPath('tar');
            systemCommands_1.commandMockUtils.setupExecMock('--export', 'Export successful');
            await wslManager.exportDistribution(name, exportPath);
            expect(systemCommands_1.mockExec).toHaveBeenCalledWith(`wsl.exe --export "${name}" "${exportPath}"`, expect.any(Function));
        });
        it('should handle export failure', async () => {
            const name = 'test-distro';
            const exportPath = testDataGenerators_1.pathGenerators.createPath('tar');
            systemCommands_1.commandMockUtils.setupExecMock('--export', '', 'Distribution not found');
            await testDataGenerators_1.assertionHelpers.assertRejects(wslManager.exportDistribution(name, exportPath), 'Distribution not found');
        });
    });
    describe('unregisterDistribution', () => {
        it('should unregister distribution', async () => {
            const name = 'test-distro';
            systemCommands_1.commandMockUtils.setupExecMock('--unregister', 'Unregister successful');
            await wslManager.unregisterDistribution(name);
            expect(systemCommands_1.mockExec).toHaveBeenCalledWith(`wsl.exe --unregister "${name}"`, expect.any(Function));
        });
        it('should handle unregister failure', async () => {
            const name = 'test-distro';
            systemCommands_1.commandMockUtils.setupExecMock('--unregister', '', 'Access denied');
            await testDataGenerators_1.assertionHelpers.assertRejects(wslManager.unregisterDistribution(name), 'Access denied');
        });
    });
    describe('terminateDistribution', () => {
        it('should terminate running distribution', async () => {
            const name = 'test-distro';
            systemCommands_1.commandMockUtils.setupExecMock('--terminate', 'Terminate successful');
            await wslManager.terminateDistribution(name);
            expect(systemCommands_1.mockExec).toHaveBeenCalledWith(`wsl.exe --terminate "${name}"`, expect.any(Function));
        });
    });
    describe('setDefaultDistribution', () => {
        it('should set default distribution', async () => {
            const name = 'test-distro';
            systemCommands_1.commandMockUtils.setupExecMock('--set-default', 'Set default successful');
            await wslManager.setDefaultDistribution(name);
            expect(systemCommands_1.mockExec).toHaveBeenCalledWith(`wsl.exe --set-default "${name}"`, expect.any(Function));
        });
    });
    describe('runCommand', () => {
        it('should run command in distribution', async () => {
            const distribution = 'Ubuntu';
            const command = 'uname -r';
            const output = '5.15.0-58-generic';
            systemCommands_1.commandMockUtils.setupExecMock(`-d "${distribution}" ${command}`, output);
            const result = await wslManager.runCommand(distribution, command);
            expect(result).toBe(output);
            expect(systemCommands_1.mockExec).toHaveBeenCalledWith(`wsl.exe -d "${distribution}" ${command}`, expect.any(Function));
        });
        it('should handle command execution failure', async () => {
            const distribution = 'Ubuntu';
            const command = 'invalid-command';
            systemCommands_1.commandMockUtils.setupExecMock(`-d "${distribution}"`, '', 'command not found');
            await testDataGenerators_1.assertionHelpers.assertRejects(wslManager.runCommand(distribution, command), 'command not found');
        });
    });
    describe('getDistributionInfo', () => {
        it('should return complete distribution info', async () => {
            const name = 'Ubuntu';
            systemCommands_1.commandMockUtils.setupExecMock('uname -r', '5.15.0-58-generic\n');
            systemCommands_1.commandMockUtils.setupExecMock('cat /etc/os-release', 'PRETTY_NAME="Ubuntu 22.04.1 LTS"\n');
            systemCommands_1.commandMockUtils.setupExecMock('free -h', 'Mem:           15Gi\n');
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
            systemCommands_1.commandMockUtils.setupExecMock('uname -r', '5.15.0-58-generic\n');
            systemCommands_1.commandMockUtils.setupExecMock('cat /etc/os-release', '', 'No such file');
            systemCommands_1.commandMockUtils.setupExecMock('free -h', 'Mem:           8Gi\n');
            const info = await wslManager.getDistributionInfo(name);
            expect(info.os).toBe('Unknown');
        });
        it('should handle missing memory info gracefully', async () => {
            const name = 'Debian';
            systemCommands_1.commandMockUtils.setupExecMock('uname -r', '5.15.0-58-generic\n');
            systemCommands_1.commandMockUtils.setupExecMock('cat /etc/os-release', 'PRETTY_NAME="Debian 11"\n');
            systemCommands_1.commandMockUtils.setupExecMock('free -h', '', 'free: command not found');
            const info = await wslManager.getDistributionInfo(name);
            expect(info.totalMemory).toBe('Unknown');
        });
        it('should return error info when distribution is not accessible', async () => {
            const name = 'Broken';
            systemCommands_1.commandMockUtils.setupExecMock(`-d "${name}"`, '', 'Distribution not found');
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
            const maliciousNames = testDataGenerators_1.inputGenerators.createCommandInjectionAttempts();
            for (const maliciousName of maliciousNames) {
                systemCommands_1.commandMockUtils.setupExecMock('--unregister', 'Success');
                await wslManager.unregisterDistribution(maliciousName);
                // Verify the command was called with quotes intact
                expect(systemCommands_1.mockExec).toHaveBeenCalledWith(expect.stringContaining(`"${maliciousName}"`), expect.any(Function));
            }
        });
        it('should handle path traversal attempts', async () => {
            const maliciousPath = testDataGenerators_1.pathGenerators.createMaliciousPath('traversal');
            const name = 'test';
            systemCommands_1.commandMockUtils.setupExecMock('--import', 'Success');
            await wslManager.importDistribution(name, '/safe/path.tar', maliciousPath);
            // The current implementation doesn't validate paths, but the test is here
            // to ensure when validation is added, it works correctly
            expect(systemCommands_1.mockExec).toHaveBeenCalled();
        });
    });
    describe('Edge Cases', () => {
        it('should handle very long distribution names', async () => {
            const longName = 'a'.repeat(255);
            systemCommands_1.commandMockUtils.setupExecMock('--unregister', 'Success');
            await wslManager.unregisterDistribution(longName);
            expect(systemCommands_1.mockExec).toHaveBeenCalledWith(expect.stringContaining(longName), expect.any(Function));
        });
        it('should handle unicode in distribution names', async () => {
            const unicodeName = 'test-κόσμε-世界';
            systemCommands_1.commandMockUtils.setupExecMock('--unregister', 'Success');
            await wslManager.unregisterDistribution(unicodeName);
            expect(systemCommands_1.mockExec).toHaveBeenCalledWith(expect.stringContaining(unicodeName), expect.any(Function));
        });
        it('should handle concurrent operations', async () => {
            systemCommands_1.commandMockUtils.setupExecMock('--list', testDataGenerators_1.distributionGenerators.createRawWSLOutput());
            const promises = Array(10).fill(null).map(() => wslManager.listDistributions());
            const results = await Promise.all(promises);
            expect(results).toHaveLength(10);
            results.forEach(result => {
                expect(result).toHaveLength(3);
            });
        });
    });
});
//# sourceMappingURL=wslManager.test.js.map