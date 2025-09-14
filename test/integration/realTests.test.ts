/**
 * Real Integration Tests
 * Tests that actually verify the code works, not just mocks
 * 
 * @author Marcus Johnson, QA Manager
 */

import * as path from 'path';
import * as fs from 'fs';

// Import the actual modules
import { ErrorHandler, ErrorType } from '../../src/errors/errorHandler';
import { DistroManager } from '../../src/distros/DistroManager';
import { InputValidator } from '../../src/utils/inputValidator';

describe('Real Integration Tests - Actually Test the Code', () => {

    describe('Issue #1: Network Error Classification', () => {
        it('should NOT classify "download" errors as network errors', () => {
            const error = new Error('Distribution not available locally. Please download it first.');
            const errorType = ErrorHandler.determineErrorType(error);
            
            // This was incorrectly returning NETWORK_ERROR before
            expect(errorType).not.toBe(ErrorType.NETWORK_ERROR);
            expect(errorType).toBe(ErrorType.FILE_NOT_FOUND);
        });

        it('should classify actual network errors correctly', () => {
            const networkError = new Error('ENETUNREACH: network is unreachable');
            const errorType = ErrorHandler.determineErrorType(networkError);
            
            expect(errorType).toBe(ErrorType.NETWORK_ERROR);
        });

        it('should handle "not available locally" without showing network error', () => {
            const error = new Error('Distro not available locally: ubuntu-22.04');
            const errorType = ErrorHandler.determineErrorType(error);
            
            expect(errorType).toBe(ErrorType.FILE_NOT_FOUND);
            
            // Get user-friendly message
            const message = ErrorHandler.getUserFriendlyMessage(error);
            expect(message).not.toContain('Network');
            expect(message).toContain('File Not Found');
        });
    });

    describe('Issue #2: Distro Catalog Management', () => {
        it('should keep default distros in catalog after deletion', async () => {
            // Create a temporary test directory
            const testDir = path.join(__dirname, 'test-distro-manager');
            if (!fs.existsSync(testDir)) {
                fs.mkdirSync(testDir, { recursive: true });
            }
            
            const manager = new DistroManager(testDir);
            
            // Get initial distros
            const initialDistros = await manager.listDistros();
            const ubuntuDistro = initialDistros.find(d => d.name === 'ubuntu-22.04');
            expect(ubuntuDistro).toBeDefined();
            
            // Remove the distro
            await manager.removeDistro('ubuntu-22.04');
            
            // Check it's still in the catalog but marked unavailable
            const afterRemoval = await manager.listDistros();
            const ubuntuAfter = afterRemoval.find(d => d.name === 'ubuntu-22.04');
            
            expect(ubuntuAfter).toBeDefined();
            expect(ubuntuAfter!.available).toBe(false);
            expect(ubuntuAfter!.sourceUrl).toBeDefined(); // Still has download URL
            
            // Clean up
            fs.rmSync(testDir, { recursive: true, force: true });
        });

        it('should remove custom distros completely from catalog', async () => {
            const testDir = path.join(__dirname, 'test-distro-manager-2');
            if (!fs.existsSync(testDir)) {
                fs.mkdirSync(testDir, { recursive: true });
            }
            
            const manager = new DistroManager(testDir);
            
            // Add a custom distro
            const customDistro = {
                name: 'my-custom-distro',
                displayName: 'My Custom Distro',
                description: 'Custom imported distro',
                version: '1.0',
                architecture: 'x64' as const,
                tags: ['custom']
            };
            
            // Create a dummy tar file
            const tarPath = path.join(testDir, 'custom.tar');
            fs.writeFileSync(tarPath, 'dummy tar content');
            
            await manager.addDistro(customDistro, tarPath);
            
            // Verify it was added
            let distros = await manager.listDistros();
            expect(distros.find(d => d.name === 'my-custom-distro')).toBeDefined();
            
            // Remove it
            await manager.removeDistro('my-custom-distro');
            
            // Verify it's completely gone (not a default distro)
            distros = await manager.listDistros();
            expect(distros.find(d => d.name === 'my-custom-distro')).toBeUndefined();
            
            // Clean up
            fs.rmSync(testDir, { recursive: true, force: true });
        });
    });

    describe('Issue #3: Input Validation Consistency', () => {
        it('should allow periods in distribution names', () => {
            const result = InputValidator.validateDistributionName('ubuntu-24.04');
            
            expect(result.isValid).toBe(true);
            expect(result.error).toBeUndefined();
            expect(result.sanitizedValue).toBe('ubuntu-24.04');
        });

        it('should allow all valid characters consistently', () => {
            const validNames = [
                'ubuntu-22.04',
                'my_distro',
                'test-123',
                'distro.with.dots',
                'under_score_name'
            ];
            
            for (const name of validNames) {
                const result = InputValidator.validateDistributionName(name);
                expect(result.isValid).toBe(true);
                expect(result.error).toBeUndefined();
            }
        });

        it('should reject invalid characters', () => {
            const invalidNames = [
                'my distro',      // Space
                'distro!',        // Exclamation
                'test@home',      // At sign
                '../etc/passwd',  // Path traversal
                'distro;rm -rf'   // Command injection
            ];
            
            for (const name of invalidNames) {
                const result = InputValidator.validateDistributionName(name);
                expect(result.isValid).toBe(false);
                expect(result.error).toBeDefined();
            }
        });
    });

    describe('Package.json Menu Configuration', () => {
        it('should have createImageFromImage in image context menu', () => {
            const packageJson = require('../../package.json');
            const contextMenus = packageJson.contributes.menus['view/item/context'];
            
            const createImageFromImage = contextMenus.find(
                (item: any) => item.command === 'wsl-manager.createImageFromImage'
            );
            
            expect(createImageFromImage).toBeDefined();
            expect(createImageFromImage.when).toContain('wslImages');
            expect(createImageFromImage.when).toMatch(/image/);
        });

        it('should have openTerminal in regular menu not just inline', () => {
            const packageJson = require('../../package.json');
            const contextMenus = packageJson.contributes.menus['view/item/context'];
            
            const openTerminalItems = contextMenus.filter(
                (item: any) => item.command === 'wsl-manager.openTerminal'
            );
            
            // Should have it in both regular menu and inline
            expect(openTerminalItems.length).toBeGreaterThanOrEqual(2);
            
            // Check for non-inline entry
            const regularMenu = openTerminalItems.find((item: any) => item.group !== 'inline');
            expect(regularMenu).toBeDefined();
        });
    });

    describe('Command Handler Real Tests', () => {
        it('error handler should provide correct recovery actions', () => {
            const error = new Error('Distribution not available locally');
            const wslError = ErrorHandler.createError(error);
            
            expect(wslError.type).toBe(ErrorType.FILE_NOT_FOUND);
            expect(wslError.recoveryActions).toBeDefined();
            expect(wslError.recoveryActions).toContain('Verify the file path is correct');
        });

        it('should correctly identify distro not found errors', () => {
            const errors = [
                'Distro not found: ubuntu',
                'Distribution not found',
                'The distribution is not installed'
            ];
            
            for (const errorMsg of errors) {
                const error = new Error(errorMsg);
                const type = ErrorHandler.determineErrorType(error);
                expect(type).toBe(ErrorType.DISTRIBUTION_NOT_FOUND);
            }
        });
    });

    describe('Validation Error Messages', () => {
        it('should provide helpful validation messages', () => {
            const result = InputValidator.validateDistributionName('my distro with spaces');
            
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('letters, numbers, dots, dashes, and underscores');
            expect(result.error).not.toContain('undefined');
        });

        it('should handle empty input correctly', () => {
            const result = InputValidator.validateDistributionName('');
            
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('Distribution name is required');
        });
    });
});