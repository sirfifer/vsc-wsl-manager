"use strict";
/**
 * Unit tests for CommandBuilder
 * Tests secure command construction and execution
 */
Object.defineProperty(exports, "__esModule", { value: true });
const commandBuilder_1 = require("../../src/utils/commandBuilder");
const child_process_1 = require("child_process");
const events_1 = require("events");
// Mock child_process
jest.mock('child_process');
describe('CommandBuilder', () => {
    let mockSpawn;
    let mockChildProcess;
    beforeEach(() => {
        mockChildProcess = new events_1.EventEmitter();
        mockChildProcess.stdout = new events_1.EventEmitter();
        mockChildProcess.stderr = new events_1.EventEmitter();
        mockChildProcess.kill = jest.fn();
        mockSpawn = child_process_1.spawn;
        mockSpawn.mockReturnValue(mockChildProcess);
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    describe('executeWSL', () => {
        it('should execute valid WSL commands', async () => {
            const resultPromise = commandBuilder_1.CommandBuilder.executeWSL(['--list', '--verbose']);
            // Simulate successful execution
            mockChildProcess.stdout.emit('data', 'Ubuntu Running 2\n');
            mockChildProcess.emit('close', 0);
            const result = await resultPromise;
            expect(result.stdout).toBe('Ubuntu Running 2');
            expect(result.exitCode).toBe(0);
            expect(mockSpawn).toHaveBeenCalledWith('wsl.exe', ['--list', '--verbose'], expect.objectContaining({
                shell: false,
                windowsHide: true
            }));
        });
        it('should reject invalid WSL commands', async () => {
            await expect(commandBuilder_1.CommandBuilder.executeWSL(['--dangerous-command'])).rejects.toThrow("Command '--dangerous-command' is not allowed");
            expect(mockSpawn).not.toHaveBeenCalled();
        });
        it('should reject commands with shell metacharacters', async () => {
            await expect(commandBuilder_1.CommandBuilder.executeWSL(['--list', '; rm -rf /'])).rejects.toThrow('potentially dangerous characters');
            expect(mockSpawn).not.toHaveBeenCalled();
        });
        it('should handle command timeout', async () => {
            const resultPromise = commandBuilder_1.CommandBuilder.executeWSL(['--list'], { timeout: 100 });
            // Don't emit close event to simulate hanging process
            await expect(resultPromise).rejects.toThrow('Command timed out after 100ms');
            expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');
        });
        it('should handle command failure with exit code', async () => {
            const resultPromise = commandBuilder_1.CommandBuilder.executeWSL(['--list']);
            mockChildProcess.stderr.emit('data', 'WSL not found');
            mockChildProcess.emit('close', 1);
            await expect(resultPromise).rejects.toThrow('Command failed with exit code 1');
        });
        it('should handle process spawn error', async () => {
            mockSpawn.mockImplementation(() => {
                throw new Error('Spawn failed');
            });
            await expect(commandBuilder_1.CommandBuilder.executeWSL(['--list'])).rejects.toThrow('Spawn failed');
        });
        it('should collect both stdout and stderr', async () => {
            const resultPromise = commandBuilder_1.CommandBuilder.executeWSL(['--list']);
            mockChildProcess.stdout.emit('data', 'Output line 1\n');
            mockChildProcess.stdout.emit('data', 'Output line 2\n');
            mockChildProcess.stderr.emit('data', 'Warning message\n');
            mockChildProcess.emit('close', 0);
            const result = await resultPromise;
            expect(result.stdout).toBe('Output line 1\nOutput line 2');
            expect(result.stderr).toBe('Warning message');
        });
    });
    describe('executeInDistribution', () => {
        it('should execute command in specified distribution', async () => {
            const resultPromise = commandBuilder_1.CommandBuilder.executeInDistribution('Ubuntu', 'uname -r', {});
            mockChildProcess.stdout.emit('data', '5.15.0-generic\n');
            mockChildProcess.emit('close', 0);
            const result = await resultPromise;
            expect(result.stdout).toBe('5.15.0-generic');
            expect(mockSpawn).toHaveBeenCalledWith('wsl.exe', ['-d', 'Ubuntu', '--', 'sh', '-c', 'uname -r'], expect.any(Object));
        });
        it('should reject invalid distribution names', async () => {
            await expect(commandBuilder_1.CommandBuilder.executeInDistribution('', 'ls', {})).rejects.toThrow('Invalid distribution name');
            await expect(commandBuilder_1.CommandBuilder.executeInDistribution(null, 'ls', {})).rejects.toThrow('Invalid distribution name');
        });
    });
    describe('Command builders', () => {
        it('should build list command correctly', () => {
            expect(commandBuilder_1.CommandBuilder.buildListCommand()).toEqual(['--list', '--verbose']);
            expect(commandBuilder_1.CommandBuilder.buildListCommand(false)).toEqual(['--list']);
        });
        it('should build import command correctly', () => {
            const args = commandBuilder_1.CommandBuilder.buildImportCommand('test-distro', '/path/to/install', '/path/to/file.tar');
            expect(args).toEqual([
                '--import',
                'test-distro',
                '/path/to/install',
                '/path/to/file.tar'
            ]);
        });
        it('should build export command correctly', () => {
            const args = commandBuilder_1.CommandBuilder.buildExportCommand('test-distro', '/path/to/export.tar');
            expect(args).toEqual([
                '--export',
                'test-distro',
                '/path/to/export.tar'
            ]);
        });
        it('should build unregister command correctly', () => {
            const args = commandBuilder_1.CommandBuilder.buildUnregisterCommand('test-distro');
            expect(args).toEqual(['--unregister', 'test-distro']);
        });
        it('should build terminate command correctly', () => {
            const args = commandBuilder_1.CommandBuilder.buildTerminateCommand('test-distro');
            expect(args).toEqual(['--terminate', 'test-distro']);
        });
        it('should build set default command correctly', () => {
            const args = commandBuilder_1.CommandBuilder.buildSetDefaultCommand('test-distro');
            expect(args).toEqual(['--set-default', 'test-distro']);
        });
    });
    describe('parseOutput', () => {
        it('should parse output lines correctly', () => {
            const output = 'Line 1\nLine 2\nLine 3\n';
            const lines = commandBuilder_1.CommandBuilder.parseOutput(output);
            expect(lines).toEqual(['Line 1', 'Line 2', 'Line 3']);
        });
        it('should handle Windows line endings', () => {
            const output = 'Line 1\r\nLine 2\r\nLine 3\r\n';
            const lines = commandBuilder_1.CommandBuilder.parseOutput(output);
            expect(lines).toEqual(['Line 1', 'Line 2', 'Line 3']);
        });
        it('should filter empty lines', () => {
            const output = 'Line 1\n\n  \nLine 2\n\n';
            const lines = commandBuilder_1.CommandBuilder.parseOutput(output);
            expect(lines).toEqual(['Line 1', 'Line 2']);
        });
        it('should handle empty output', () => {
            expect(commandBuilder_1.CommandBuilder.parseOutput('')).toEqual([]);
            expect(commandBuilder_1.CommandBuilder.parseOutput(null)).toEqual([]);
            expect(commandBuilder_1.CommandBuilder.parseOutput(undefined)).toEqual([]);
        });
    });
    describe('Security validation', () => {
        const dangerousInputs = [
            '; echo hacked',
            '&& rm -rf /',
            '| cat /etc/passwd',
            '`whoami`',
            '$(pwd)',
            '${HOME}',
            'test\necho hacked',
            'test\r\necho hacked',
            'test[0]',
            'test{1..10}',
            'test>output.txt',
            'test<input.txt'
        ];
        it('should reject all dangerous inputs', async () => {
            for (const dangerous of dangerousInputs) {
                await expect(commandBuilder_1.CommandBuilder.executeWSL(['--list', dangerous])).rejects.toThrow('potentially dangerous characters');
            }
        });
        it('should handle process termination by signal', async () => {
            const resultPromise = commandBuilder_1.CommandBuilder.executeWSL(['--list']);
            mockChildProcess.emit('close', null, 'SIGKILL');
            await expect(resultPromise).rejects.toThrow('Process terminated by signal: SIGKILL');
        });
    });
    describe('Options handling', () => {
        it('should pass custom environment variables', async () => {
            const customEnv = { PATH: '/custom/path', USER: 'test' };
            commandBuilder_1.CommandBuilder.executeWSL(['--list'], { env: customEnv });
            expect(mockSpawn).toHaveBeenCalledWith('wsl.exe', ['--list'], expect.objectContaining({ env: customEnv }));
        });
        it('should pass custom working directory', async () => {
            commandBuilder_1.CommandBuilder.executeWSL(['--list'], { cwd: '/custom/dir' });
            expect(mockSpawn).toHaveBeenCalledWith('wsl.exe', ['--list'], expect.objectContaining({ cwd: '/custom/dir' }));
        });
        it('should use custom encoding', async () => {
            const resultPromise = commandBuilder_1.CommandBuilder.executeWSL(['--list'], { encoding: 'latin1' });
            const buffer = Buffer.from('Special chars: ñáéíóú', 'latin1');
            mockChildProcess.stdout.emit('data', buffer);
            mockChildProcess.emit('close', 0);
            const result = await resultPromise;
            expect(result.stdout).toBe('Special chars: ñáéíóú');
        });
    });
    describe('Error handling edge cases', () => {
        it('should handle missing stdout/stderr streams', async () => {
            mockChildProcess.stdout = null;
            mockChildProcess.stderr = null;
            const resultPromise = commandBuilder_1.CommandBuilder.executeWSL(['--list']);
            mockChildProcess.emit('close', 0);
            const result = await resultPromise;
            expect(result.stdout).toBe('');
            expect(result.stderr).toBe('');
        });
        it('should clear timeout on process error', async () => {
            const resultPromise = commandBuilder_1.CommandBuilder.executeWSL(['--list'], { timeout: 5000 });
            mockChildProcess.emit('error', new Error('Process error'));
            await expect(resultPromise).rejects.toThrow('Process error');
            // Timeout should not fire after error
        });
    });
});
//# sourceMappingURL=commandBuilder.test.js.map