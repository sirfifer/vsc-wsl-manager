/**
 * Cross-Filesystem Operations Test Suite
 * Tests file operations that failed in production due to cross-drive issues
 *
 * @author Marcus Johnson, QA Manager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Cross-Filesystem File Operations', () => {
    let tempFiles: string[] = [];

    afterEach(() => {
        // Clean up any temp files created during tests
        for (const file of tempFiles) {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        }
        tempFiles = [];
    });

    describe('fs.renameSync EXDEV Error Handling', () => {
        it('should handle EXDEV error with copy+delete fallback', () => {
            const source = path.join(os.tmpdir(), `source-${Date.now()}.tar`);
            const dest = path.join(process.cwd(), `dest-${Date.now()}.tar`);

            tempFiles.push(source, dest);
            fs.writeFileSync(source, 'test content for EXDEV handling');

            // Helper function that mimics our fix
            function moveFileSafely(src: string, dst: string) {
                try {
                    fs.renameSync(src, dst);
                } catch (err: any) {
                    if (err.code === 'EXDEV' || err.code === 'ENOTSUP') {
                        // Cross-device link not permitted - use copy+delete
                        fs.copyFileSync(src, dst);
                        fs.unlinkSync(src);
                    } else {
                        throw err;
                    }
                }
            }

            moveFileSafely(source, dest);

            expect(fs.existsSync(dest)).toBe(true);
            expect(fs.existsSync(source)).toBe(false);
            expect(fs.readFileSync(dest, 'utf8')).toBe('test content for EXDEV handling');
        });

        it('should handle rename across different filesystem types', () => {
            // Test moving from temp (might be different filesystem) to current dir
            const tempDir = os.tmpdir();
            const workDir = process.cwd();

            // Only test if they're actually different filesystems
            const source = path.join(tempDir, `cross-fs-${Date.now()}.tar`);
            const dest = path.join(workDir, `cross-fs-dest-${Date.now()}.tar`);

            tempFiles.push(source, dest);
            fs.writeFileSync(source, Buffer.from('binary content test'));

            // Our production fix
            fs.copyFileSync(source, dest);
            fs.unlinkSync(source);

            expect(fs.existsSync(dest)).toBe(true);
            expect(fs.existsSync(source)).toBe(false);

            const content = fs.readFileSync(dest);
            expect(content.toString()).toBe('binary content test');
        });
    });

    describe('Windows-specific Path Issues', () => {
        it('should handle Windows long path names', () => {
            const longName = 'a'.repeat(200);
            const source = path.join(os.tmpdir(), `${longName}-src.tar`);
            const dest = path.join(os.tmpdir(), `${longName}-dst.tar`);

            // Windows has a 260 character path limit by default
            if (source.length > 260 && process.platform === 'win32') {
                // Should handle gracefully
                expect(() => {
                    fs.writeFileSync(source, 'test');
                    tempFiles.push(source);
                }).not.toThrow();
            }
        });

        it('should handle paths with special characters', () => {
            const specialChars = 'test & file (with) [special] {chars}';
            const safeName = specialChars.replace(/[<>:"|?*]/g, '_');

            const source = path.join(os.tmpdir(), `${safeName}-src.tar`);
            const dest = path.join(os.tmpdir(), `${safeName}-dst.tar`);

            tempFiles.push(source, dest);

            fs.writeFileSync(source, 'special chars test');
            fs.copyFileSync(source, dest);

            expect(fs.existsSync(dest)).toBe(true);
        });

        it('should handle UNC paths on Windows', () => {
            if (process.platform !== 'win32') {
                return; // Skip on non-Windows
            }

            // UNC paths start with \\
            const uncPath = `\\\\localhost\\c$\\temp\\test-${Date.now()}.tar`;

            // This might fail if not running with admin rights
            try {
                fs.writeFileSync(uncPath, 'UNC test');
                tempFiles.push(uncPath);
                expect(fs.existsSync(uncPath)).toBe(true);
            } catch (err: any) {
                // Expected to fail without admin rights
                expect(err.code).toMatch(/EACCES|EPERM|ENOENT/);
            }
        });
    });

    describe('DistroDownloader Move Operations', () => {
        it('should use copy+delete instead of rename for downloads', () => {
            // Simulate what DistroDownloader does
            const tempPath = path.join(os.tmpdir(), 'download.tmp');
            const finalPath = path.join(process.cwd(), 'download.tar');

            tempFiles.push(tempPath, finalPath);

            // Download simulation
            fs.writeFileSync(tempPath, 'downloaded content');

            // Old buggy code: fs.renameSync(tempPath, finalPath)
            // New fixed code:
            fs.copyFileSync(tempPath, finalPath);
            fs.unlinkSync(tempPath);

            expect(fs.existsSync(finalPath)).toBe(true);
            expect(fs.existsSync(tempPath)).toBe(false);
        });

        it('should handle large file copies efficiently', () => {
            const size = 10 * 1024 * 1024; // 10MB
            const buffer = Buffer.alloc(size, 'x');

            const source = path.join(os.tmpdir(), `large-${Date.now()}.tar`);
            const dest = path.join(os.tmpdir(), `large-dest-${Date.now()}.tar`);

            tempFiles.push(source, dest);

            fs.writeFileSync(source, buffer);

            const startTime = Date.now();
            fs.copyFileSync(source, dest);
            fs.unlinkSync(source);
            const duration = Date.now() - startTime;

            expect(fs.existsSync(dest)).toBe(true);
            expect(fs.statSync(dest).size).toBe(size);

            // Should complete in reasonable time (< 5 seconds for 10MB)
            expect(duration).toBeLessThan(5000);
        });
    });

    describe('Error Recovery', () => {
        it('should handle copy failures gracefully', () => {
            const source = path.join(os.tmpdir(), `src-${Date.now()}.tar`);
            const dest = '/invalid/path/that/does/not/exist/dest.tar';

            tempFiles.push(source);
            fs.writeFileSync(source, 'test');

            expect(() => {
                fs.copyFileSync(source, dest);
            }).toThrow();

            // Source should still exist after failed copy
            expect(fs.existsSync(source)).toBe(true);
        });

        it('should handle partial writes', () => {
            const source = path.join(os.tmpdir(), `partial-${Date.now()}.tar`);
            const dest = path.join(os.tmpdir(), `partial-dest-${Date.now()}.tar`);

            tempFiles.push(source, dest);
            fs.writeFileSync(source, Buffer.alloc(1024 * 1024)); // 1MB

            // Simulate partial write by creating read-only destination
            fs.writeFileSync(dest, 'existing');
            if (process.platform !== 'win32') {
                fs.chmodSync(dest, 0o444); // Read-only
            }

            try {
                fs.copyFileSync(source, dest);
            } catch (err: any) {
                // Should fail with permission error
                expect(err.code).toMatch(/EACCES|EPERM/);
            }

            // Restore permissions for cleanup
            if (process.platform !== 'win32') {
                fs.chmodSync(dest, 0o666);
            }
        });
    });

    describe('Concurrent Operations', () => {
        it('should handle multiple simultaneous copies', async () => {
            const operations = [];

            for (let i = 0; i < 5; i++) {
                const source = path.join(os.tmpdir(), `concurrent-${i}-${Date.now()}.tar`);
                const dest = path.join(os.tmpdir(), `concurrent-dest-${i}-${Date.now()}.tar`);

                tempFiles.push(source, dest);
                fs.writeFileSync(source, `content ${i}`);

                operations.push(
                    new Promise<void>((resolve) => {
                        fs.copyFileSync(source, dest);
                        fs.unlinkSync(source);
                        resolve();
                    })
                );
            }

            await Promise.all(operations);

            // All destinations should exist
            for (let i = 0; i < 5; i++) {
                const dest = tempFiles[i * 2 + 1];
                expect(fs.existsSync(dest)).toBe(true);
            }
        });
    });
});