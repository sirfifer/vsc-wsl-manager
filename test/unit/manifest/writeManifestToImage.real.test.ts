/**
 * Tests for writeManifestToImage method
 * Ensures platform-aware manifest writing works correctly
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ManifestManager } from '../../../src/manifest/ManifestManager';
import { CommandBuilder } from '../../../src/utils/commandBuilder';
import { Logger } from '../../../src/utils/logger';
import { LayerType } from '../../../src/manifest/ManifestTypes';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Mock the logger
vi.mock('../../../src/utils/logger', () => ({
    Logger: {
        getInstance: vi.fn(() => ({
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn()
        }))
    }
}));

describe('ManifestManager - writeManifestToImage', () => {
    let manager: ManifestManager;
    let mockExecuteInDistribution: any;
    let tempDir: string;

    beforeEach(() => {
        manager = new ManifestManager();
        mockExecuteInDistribution = vi.spyOn(CommandBuilder, 'executeInDistribution');

        // Create a temporary directory for testing
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'manifest-test-'));
    });

    afterEach(() => {
        vi.restoreAllMocks();
        // Clean up temp directory
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('Platform-Aware Writing', () => {
        it('should verify distribution exists before writing', async () => {
            const manifest = createTestManifest();

            // Mock distribution doesn't exist
            mockExecuteInDistribution.mockRejectedValue(new Error('Distribution not found'));

            await expect(
                manager.writeManifestToImage('test-distro', manifest)
            ).rejects.toThrow('Cannot write manifest: Distribution \'test-distro\' is not accessible');

            expect(mockExecuteInDistribution).toHaveBeenCalledWith('test-distro', 'echo "test"');
        });

        it('should write manifest using WSL commands instead of UNC paths', async () => {
            const manifest = createTestManifest();

            // Mock successful command execution
            mockExecuteInDistribution
                .mockResolvedValueOnce({ stdout: 'test', stderr: '', exitCode: 0 }) // echo test
                .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // mkdir
                .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // printf write
                .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // chmod
                .mockResolvedValueOnce({ stdout: 'OK', stderr: '', exitCode: 0 }); // verify

            await manager.writeManifestToImage('test-distro', manifest);

            // Verify commands were called
            expect(mockExecuteInDistribution).toHaveBeenCalledWith('test-distro', 'echo "test"');
            expect(mockExecuteInDistribution).toHaveBeenCalledWith('test-distro', 'mkdir -p /etc');
            expect(mockExecuteInDistribution).toHaveBeenCalledWith('test-distro', expect.stringContaining('printf'));
            expect(mockExecuteInDistribution).toHaveBeenCalledWith('test-distro', 'chmod 644 /etc/vscode-wsl-manager.json');
            expect(mockExecuteInDistribution).toHaveBeenCalledWith('test-distro', '[ -f /etc/vscode-wsl-manager.json ] && echo "OK" || echo "FAIL"');
        });

        it('should use temp file fallback if direct write fails', async () => {
            const manifest = createTestManifest();

            // Mock command execution with printf failing
            mockExecuteInDistribution
                .mockResolvedValueOnce({ stdout: 'test', stderr: '', exitCode: 0 }) // echo test
                .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // mkdir
                .mockResolvedValueOnce({ stdout: '', stderr: 'Error', exitCode: 1 }) // printf fails
                .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // cat (temp file)
                .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // chmod
                .mockResolvedValueOnce({ stdout: 'OK', stderr: '', exitCode: 0 }); // verify

            await manager.writeManifestToImage('test-distro', manifest);

            // Verify fallback was used
            const calls = mockExecuteInDistribution.mock.calls;
            const catCall = calls.find((call: any[]) => call[1].includes('cat'));
            expect(catCall).toBeDefined();
        });

        it('should backup existing manifest when requested', async () => {
            const manifest = createTestManifest();

            // Mock successful execution
            mockExecuteInDistribution
                .mockResolvedValueOnce({ stdout: 'test', stderr: '', exitCode: 0 }) // echo test
                .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // mkdir
                .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // backup
                .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // printf write
                .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // chmod
                .mockResolvedValueOnce({ stdout: 'OK', stderr: '', exitCode: 0 }); // verify

            await manager.writeManifestToImage('test-distro', manifest, { backup: true });

            // Verify backup command was called
            const backupCall = mockExecuteInDistribution.mock.calls.find(
                (call: any[]) => call[1].includes('.backup')
            );
            expect(backupCall).toBeDefined();
        });

        it('should handle special characters in manifest content', async () => {
            const manifest = createTestManifest();
            manifest.metadata.description = 'Test with "quotes" and $variables and `backticks`';

            // Mock successful execution
            mockExecuteInDistribution
                .mockResolvedValueOnce({ stdout: 'test', stderr: '', exitCode: 0 }) // echo test
                .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // mkdir
                .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // printf write
                .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // chmod
                .mockResolvedValueOnce({ stdout: 'OK', stderr: '', exitCode: 0 }); // verify

            await manager.writeManifestToImage('test-distro', manifest);

            // Verify content was properly escaped
            const printfCall = mockExecuteInDistribution.mock.calls.find(
                (call: any[]) => call[1].includes('printf')
            );
            expect(printfCall).toBeDefined();
            const command = printfCall[1];
            expect(command).toContain('\\"'); // Escaped quotes
            expect(command).toContain('\\$'); // Escaped dollar signs
            expect(command).toContain('\\`'); // Escaped backticks
        });

        it('should throw error if verification fails', async () => {
            const manifest = createTestManifest();

            // Mock execution with verification failing
            mockExecuteInDistribution
                .mockResolvedValueOnce({ stdout: 'test', stderr: '', exitCode: 0 }) // echo test
                .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // mkdir
                .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // printf write
                .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // chmod
                .mockResolvedValueOnce({ stdout: 'FAIL', stderr: '', exitCode: 0 }); // verify fails

            await expect(
                manager.writeManifestToImage('test-distro', manifest)
            ).rejects.toThrow('Failed to verify manifest was written successfully');
        });
    });

    describe('Validation', () => {
        it('should validate manifest before writing by default', async () => {
            const invalidManifest = createTestManifest();
            // @ts-ignore - Intentionally creating invalid manifest
            delete invalidManifest.version;

            await expect(
                manager.writeManifestToImage('test-distro', invalidManifest)
            ).rejects.toThrow('Invalid manifest');
        });

        it('should skip validation when requested', async () => {
            const invalidManifest = createTestManifest();
            // @ts-ignore
            delete invalidManifest.version;

            // Mock successful execution
            mockExecuteInDistribution
                .mockResolvedValueOnce({ stdout: 'test', stderr: '', exitCode: 0 }) // echo test
                .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // mkdir
                .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // printf write
                .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // chmod
                .mockResolvedValueOnce({ stdout: 'OK', stderr: '', exitCode: 0 }); // verify

            await manager.writeManifestToImage('test-distro', invalidManifest, { validate: false });

            expect(mockExecuteInDistribution).toHaveBeenCalled();
        });
    });

    describe('Cross-Platform Compatibility', () => {
        it('should handle Windows paths correctly in temp file approach', async () => {
            const manifest = createTestManifest();
            const originalPlatform = process.platform;

            // Mock Windows environment
            Object.defineProperty(process, 'platform', {
                value: 'win32',
                configurable: true
            });

            // Force temp file approach
            mockExecuteInDistribution
                .mockResolvedValueOnce({ stdout: 'test', stderr: '', exitCode: 0 }) // echo test
                .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // mkdir
                .mockResolvedValueOnce({ stdout: '', stderr: 'Error', exitCode: 1 }) // printf fails
                .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // cat (temp file)
                .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // chmod
                .mockResolvedValueOnce({ stdout: 'OK', stderr: '', exitCode: 0 }); // verify

            await manager.writeManifestToImage('test-distro', manifest);

            // Verify Windows-style path was converted
            const catCall = mockExecuteInDistribution.mock.calls.find(
                (call: any[]) => call[1].includes('cat')
            );
            expect(catCall).toBeDefined();
            expect(catCall[1]).toContain('/mnt/c'); // Windows path converted

            // Restore platform
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
                configurable: true
            });
        });

        it('should handle Linux paths correctly in temp file approach', async () => {
            const manifest = createTestManifest();
            const originalPlatform = process.platform;

            // Mock Linux environment
            Object.defineProperty(process, 'platform', {
                value: 'linux',
                configurable: true
            });

            // Force temp file approach
            mockExecuteInDistribution
                .mockResolvedValueOnce({ stdout: 'test', stderr: '', exitCode: 0 }) // echo test
                .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // mkdir
                .mockResolvedValueOnce({ stdout: '', stderr: 'Error', exitCode: 1 }) // printf fails
                .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // cat (temp file)
                .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // chmod
                .mockResolvedValueOnce({ stdout: 'OK', stderr: '', exitCode: 0 }); // verify

            await manager.writeManifestToImage('test-distro', manifest);

            // Verify Linux-style path was used
            const catCall = mockExecuteInDistribution.mock.calls.find(
                (call: any[]) => call[1].includes('cat')
            );
            expect(catCall).toBeDefined();
            expect(catCall[1]).not.toContain('/mnt/c'); // No Windows path conversion

            // Restore platform
            Object.defineProperty(process, 'platform', {
                value: originalPlatform,
                configurable: true
            });
        });
    });
});

// Helper function to create test manifest
function createTestManifest() {
    return {
        version: '1.0.0',
        metadata: {
            id: 'test-id',
            name: 'test-image',
            source: 'test-distro',
            lineage: ['test-distro'],
            created: new Date().toISOString(),
            created_by: 'test',
            description: 'Test manifest'
        },
        layers: [
            {
                type: LayerType.DISTRO,
                name: 'test-distro',
                version: '1.0',
                applied: new Date().toISOString(),
                description: 'Base distribution'
            }
        ],
        tags: ['test'],
        notes: 'Test notes'
    };
}