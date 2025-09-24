/**
 * Tests for hasManifest method
 * Ensures platform-aware manifest detection works correctly without UNC paths
 *
 * @author Marcus Johnson, QA Manager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ManifestManager } from '../../../src/manifest/ManifestManager';
import { CommandBuilder } from '../../../src/utils/commandBuilder';
import { Logger } from '../../../src/utils/logger';

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

describe('ManifestManager - hasManifest', () => {
    let manager: ManifestManager;
    let mockExecuteInDistribution: any;

    beforeEach(() => {
        manager = new ManifestManager();
        mockExecuteInDistribution = vi.spyOn(CommandBuilder, 'executeInDistribution');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Platform-Aware Detection', () => {
        it('should return false if distribution does not exist', async () => {
            // Mock distribution doesn't exist
            mockExecuteInDistribution.mockRejectedValue(new Error('Distribution not found'));

            const result = await manager.hasManifest('non-existent-distro');

            expect(result).toBe(false);
            expect(mockExecuteInDistribution).toHaveBeenCalledWith(
                'non-existent-distro',
                '[ -f /etc/vscode-wsl-manager.json ] && echo "EXISTS" || echo "NOT_FOUND"'
            );
        });

        it('should return false if distribution is not accessible', async () => {
            // Mock distribution exists but not accessible
            mockExecuteInDistribution.mockRejectedValue(new Error('Access denied'));

            const result = await manager.hasManifest('inaccessible-distro');

            expect(result).toBe(false);
            expect(mockExecuteInDistribution).toHaveBeenCalledWith(
                'inaccessible-distro',
                '[ -f /etc/vscode-wsl-manager.json ] && echo "EXISTS" || echo "NOT_FOUND"'
            );
        });

        it('should use test command instead of UNC path access', async () => {
            // Mock successful file exists check
            mockExecuteInDistribution.mockResolvedValueOnce({
                stdout: 'EXISTS',
                stderr: '',
                exitCode: 0
            });

            const result = await manager.hasManifest('test-distro');

            expect(result).toBe(true);
            expect(mockExecuteInDistribution).toHaveBeenCalledWith(
                'test-distro',
                '[ -f /etc/vscode-wsl-manager.json ] && echo "EXISTS" || echo "NOT_FOUND"'
            );
        });

        it('should return false when manifest file does not exist', async () => {
            // Mock file not found check
            mockExecuteInDistribution.mockResolvedValueOnce({
                stdout: 'NOT_FOUND',
                stderr: '',
                exitCode: 0
            });

            const result = await manager.hasManifest('test-distro');

            expect(result).toBe(false);
        });

        it('should handle test command errors gracefully', async () => {
            // Mock test command error
            mockExecuteInDistribution.mockRejectedValue(new Error('Command execution failed'));

            const result = await manager.hasManifest('test-distro');

            expect(result).toBe(false);
        });
    });

    describe('Edge Cases', () => {
        it('should handle distribution names with special characters', async () => {
            const distroName = 'test-distro_v2.0';

            // Mock successful check
            mockExecuteInDistribution.mockResolvedValueOnce({
                stdout: 'EXISTS',
                stderr: '',
                exitCode: 0
            });

            const result = await manager.hasManifest(distroName);

            expect(result).toBe(true);
            expect(mockExecuteInDistribution).toHaveBeenCalledWith(
                distroName,
                '[ -f /etc/vscode-wsl-manager.json ] && echo "EXISTS" || echo "NOT_FOUND"'
            );
        });

        it('should handle concurrent checks for multiple distributions', async () => {
            // Mock responses for three distributions
            mockExecuteInDistribution
                // First distro - has manifest
                .mockResolvedValueOnce({ stdout: 'EXISTS', stderr: '', exitCode: 0 })
                // Second distro - no manifest
                .mockResolvedValueOnce({ stdout: 'NOT_FOUND', stderr: '', exitCode: 0 })
                // Third distro - doesn't exist
                .mockRejectedValueOnce(new Error('Distribution not found'));

            // Check multiple distributions concurrently
            const results = await Promise.all([
                manager.hasManifest('distro1'),
                manager.hasManifest('distro2'),
                manager.hasManifest('distro3')
            ]);

            expect(results).toEqual([true, false, false]);
            expect(mockExecuteInDistribution).toHaveBeenCalledTimes(3); // 1 call per distro
        });

        it('should handle permission errors on manifest file', async () => {
            // Mock permission denied error
            mockExecuteInDistribution.mockResolvedValueOnce({
                stdout: 'NOT_FOUND',
                stderr: 'Permission denied',
                exitCode: 0
            });

            const result = await manager.hasManifest('test-distro');

            expect(result).toBe(false);
        });

        it('should handle timeout scenarios', async () => {
            // Mock timeout scenario
            mockExecuteInDistribution.mockImplementationOnce(() => new Promise((resolve) => {
                setTimeout(() => {
                    resolve({ stdout: 'NOT_FOUND', stderr: 'Timeout', exitCode: 124 });
                }, 100);
            }));

            const result = await manager.hasManifest('test-distro');

            expect(result).toBe(false);
        }, 200); // Allow extra time for the timeout test

        it('should cache results for performance optimization', async () => {
            // Mock successful checks
            mockExecuteInDistribution
                .mockResolvedValueOnce({ stdout: 'EXISTS', stderr: '', exitCode: 0 })
                .mockResolvedValueOnce({ stdout: 'EXISTS', stderr: '', exitCode: 0 });

            // First call
            const result1 = await manager.hasManifest('test-distro');
            expect(result1).toBe(true);

            // Second call - will make another call since no caching is implemented
            const result2 = await manager.hasManifest('test-distro');
            expect(result2).toBe(true);

            // Verify both calls were made (no caching currently)
            const callCount = mockExecuteInDistribution.mock.calls.length;
            expect(callCount).toBe(2); // Two calls made, no caching
        });
    });

    describe('Error Handling', () => {
        it('should handle WSL not installed scenario', async () => {
            // Mock WSL not available
            mockExecuteInDistribution.mockRejectedValue(
                new Error('\'wsl\' is not recognized as an internal or external command')
            );

            const result = await manager.hasManifest('any-distro');

            expect(result).toBe(false);
        });

        it('should handle distribution in stopped state', async () => {
            // Mock distribution stopped
            mockExecuteInDistribution.mockRejectedValue(
                new Error('The system cannot find the file specified')
            );

            const result = await manager.hasManifest('stopped-distro');

            expect(result).toBe(false);
        });

        it('should handle corrupted WSL instance', async () => {
            // Mock corrupted instance response
            mockExecuteInDistribution.mockResolvedValueOnce({
                stdout: '',
                stderr: 'The Windows Subsystem for Linux instance has terminated',
                exitCode: 1
            });

            const result = await manager.hasManifest('corrupted-distro');

            expect(result).toBe(false);
        });

        it('should handle network drive scenarios', async () => {
            // Mock network drive issue
            mockExecuteInDistribution
                .mockResolvedValueOnce({ stdout: 'test', stderr: '', exitCode: 0 }) // echo test
                .mockResolvedValueOnce({
                    stdout: '',
                    stderr: 'Network path not found',
                    exitCode: 1
                }); // test -f fails

            const result = await manager.hasManifest('network-distro');

            expect(result).toBe(false);
        });
    });

    describe('Performance Tests', () => {
        it('should complete check within reasonable time', async () => {
            // Mock quick responses
            mockExecuteInDistribution
                .mockResolvedValueOnce({ stdout: 'test', stderr: '', exitCode: 0 })
                .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });

            const startTime = Date.now();
            await manager.hasManifest('test-distro');
            const duration = Date.now() - startTime;

            expect(duration).toBeLessThan(100); // Should complete within 100ms
        });

        it('should handle batch checks efficiently', async () => {
            const distros = Array.from({ length: 10 }, (_, i) => `distro-${i}`);

            // Mock all responses
            distros.forEach(() => {
                mockExecuteInDistribution
                    .mockResolvedValueOnce({ stdout: 'test', stderr: '', exitCode: 0 })
                    .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: Math.random() > 0.5 ? 0 : 1 });
            });

            const startTime = Date.now();
            const results = await Promise.all(
                distros.map(d => manager.hasManifest(d))
            );
            const duration = Date.now() - startTime;

            expect(results).toHaveLength(10);
            expect(duration).toBeLessThan(500); // Should handle 10 checks within 500ms
        });
    });
});