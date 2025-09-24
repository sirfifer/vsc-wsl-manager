/**
 * Windows VS Code Environment Tests
 * Tests critical Windows-specific functionality that failed in production
 *
 * @author Marcus Johnson, QA Manager
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EnhancedDistroManager } from '../../src/distros/EnhancedDistroManager';
import { DistroManager } from '../../src/distros/DistroManager';
import { DistroDownloader } from '../../src/distros/DistroDownloader';

describe('Windows VS Code Environment Tests', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        // Save original environment
        originalEnv = { ...process.env };
    });

    afterEach(() => {
        // Restore original environment
        process.env = originalEnv;
    });

    describe('Storage Path Resolution', () => {
        it('should handle missing USERPROFILE/HOME environment variables', () => {
            // Clear environment variables that might be used for path resolution
            delete process.env.USERPROFILE;
            delete process.env.HOME;

            // Create manager without explicit path
            const manager = new EnhancedDistroManager();
            const distroPath = manager.getDistroPath('test');

            // Path should NOT be relative to current directory
            expect(distroPath).not.toMatch(/^distros/);
            expect(distroPath).not.toMatch(/^\.\/distros/);

            // Should contain .vscode-wsl-manager
            expect(distroPath).toContain('.vscode-wsl-manager');

            // Should NOT be in VS Code program directory
            expect(distroPath).not.toContain('Microsoft VS Code');
            expect(distroPath).not.toContain('Programs');
        });

        it('should use os.homedir() as fallback', () => {
            delete process.env.USERPROFILE;
            delete process.env.HOME;

            const homeDir = os.homedir();
            const manager = new DistroManager();
            const distroPath = manager.getDistroPath('test');

            // Should use home directory
            expect(distroPath).toContain(homeDir);
            expect(distroPath).toContain('.vscode-wsl-manager');
        });

        it('should use temp directory as last resort', () => {
            // Mock os.homedir to return empty
            const originalHomedir = os.homedir;
            (os as any).homedir = () => '';

            delete process.env.USERPROFILE;
            delete process.env.HOME;

            const manager = new DistroManager();
            const distroPath = manager.getDistroPath('test');

            // Should contain temp directory path
            expect(distroPath).toContain('vscode-wsl-manager');

            // Restore
            (os as any).homedir = originalHomedir;
        });

        it('should prioritize explicit storage path over environment', () => {
            const customPath = path.join(os.tmpdir(), 'custom-wsl-test');
            const manager = new DistroManager(customPath);
            const distroPath = manager.getDistroPath('test');

            expect(distroPath).toContain('custom-wsl-test');
            expect(distroPath).toContain('distros');
        });
    });

    describe('Cross-Drive File Operations', () => {
        it('should handle file moves across different drives', async () => {
            // Create temp files in different locations
            const tempDir1 = os.tmpdir();
            const tempDir2 = process.cwd();

            const sourceFile = path.join(tempDir1, `test-${Date.now()}.tar`);
            const destFile = path.join(tempDir2, `dest-${Date.now()}.tar`);

            // Create source file
            fs.writeFileSync(sourceFile, 'test content for cross-drive move');

            try {
                // Use fs.copyFileSync + unlinkSync (our fix)
                fs.copyFileSync(sourceFile, destFile);
                fs.unlinkSync(sourceFile);

                // Verify destination exists and source is gone
                expect(fs.existsSync(destFile)).toBe(true);
                expect(fs.existsSync(sourceFile)).toBe(false);

                // Verify content
                const content = fs.readFileSync(destFile, 'utf8');
                expect(content).toBe('test content for cross-drive move');
            } finally {
                // Cleanup
                if (fs.existsSync(sourceFile)) fs.unlinkSync(sourceFile);
                if (fs.existsSync(destFile)) fs.unlinkSync(destFile);
            }
        });

        it('should handle EXDEV error from fs.renameSync', () => {
            const source = path.join(os.tmpdir(), `source-${Date.now()}.tar`);
            const dest = path.join(process.cwd(), `dest-${Date.now()}.tar`);

            fs.writeFileSync(source, 'test content');

            try {
                // Try rename first (might fail with EXDEV)
                let renamed = false;
                try {
                    fs.renameSync(source, dest);
                    renamed = true;
                } catch (err: any) {
                    if (err.code === 'EXDEV') {
                        // Cross-device link error - use copy+delete
                        fs.copyFileSync(source, dest);
                        fs.unlinkSync(source);
                        renamed = true;
                    } else {
                        throw err;
                    }
                }

                expect(renamed).toBe(true);
                expect(fs.existsSync(dest)).toBe(true);
            } finally {
                if (fs.existsSync(source)) fs.unlinkSync(source);
                if (fs.existsSync(dest)) fs.unlinkSync(dest);
            }
        });
    });

    describe('VS Code Extension Context', () => {
        it('should detect Windows platform correctly', () => {
            // Check various platform detection methods
            const platform = process.platform;
            const isWindows = platform === 'win32' ||
                             platform === 'windows' ||
                             process.env.OS === 'Windows_NT';

            // At least one should indicate Windows
            if (process.env.CI && process.env.RUNNER_OS === 'Windows') {
                expect(isWindows).toBe(true);
            }
        });

        it('should handle VS Code global storage path', () => {
            // Simulate VS Code context
            const mockContext = {
                globalStorageUri: {
                    fsPath: path.join(os.homedir(), '.vscode', 'extensions', 'wsl-manager')
                }
            };

            const storageDir = mockContext.globalStorageUri?.fsPath ||
                path.join(os.homedir(), '.vscode-wsl-manager');

            expect(storageDir).toBeTruthy();
            expect(storageDir).not.toContain('undefined');
            expect(storageDir).not.toBe('');
        });
    });

    describe('Path Sanitization', () => {
        it('should handle paths with spaces correctly', () => {
            const pathWithSpaces = 'C:\\Users\\Test User\\AppData\\Local';
            const manager = new DistroManager(pathWithSpaces);
            const distroPath = manager.getDistroPath('test');

            expect(distroPath).toContain('Test User');
            expect(distroPath).toContain('distros');
            expect(distroPath).toContain('test.tar');
        });

        it('should handle UNC paths on Windows', () => {
            const uncPath = '\\\\server\\share\\wsl-manager';
            const manager = new DistroManager(uncPath);
            const distroPath = manager.getDistroPath('test');

            expect(distroPath).toContain('server');
            expect(distroPath).toContain('share');
        });
    });

    describe('Download Target Path Issues', () => {
        it('should not create paths in VS Code program directory', () => {
            // Simulate the bug scenario
            delete process.env.USERPROFILE;
            delete process.env.HOME;

            // Set current working directory to VS Code location (simulated)
            const originalCwd = process.cwd;
            (process as any).cwd = () => 'C:\\Program Files\\Microsoft VS Code';

            const manager = new DistroManager();
            const distroPath = manager.getDistroPath('alpine');

            // Should NOT be in Program Files
            expect(distroPath).not.toContain('Program Files');
            expect(distroPath).not.toContain('Microsoft VS Code');

            // Restore
            (process as any).cwd = originalCwd;
        });
    });
});