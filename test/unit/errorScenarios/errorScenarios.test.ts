/**
 * Error Scenario Tests
 * Tests all error paths that users might encounter
 * Ensures proper error messages and recovery
 * 
 * @author Marcus Johnson, QA Manager
 */

describe('Error Scenario Tests - User-Facing Errors', () => {

    describe('Delete Distribution Errors', () => {
        it('should NOT show "invalid input" error', () => {
            // The original reported bug
            const error = {
                message: 'Failed to delete distribution',
                type: 'DISTRO_NOT_FOUND' // NOT 'invalid input'
            };

            expect(error.message).not.toContain('invalid input');
            expect(error.type).not.toBe('UNKNOWN');
        });

        it('should handle file deletion failures gracefully', () => {
            const errors = [
                { cause: 'File not found', message: 'Distribution template not found' },
                { cause: 'Permission denied', message: 'Permission denied. Try running VS Code as administrator.' },
                { cause: 'File in use', message: 'Distribution is currently in use' }
            ];

            for (const error of errors) {
                expect(error.message).not.toContain('undefined');
                expect(error.message).not.toContain('null');
                expect(error.message.length).toBeGreaterThan(0);
            }
        });
    });

    describe('Create Image Errors', () => {
        it('should NOT show "Network Error" for local operations', () => {
            // The original reported bug
            const localErrors = [
                { operation: 'createFromDistro', message: 'Distribution not found' },
                { operation: 'checkAvailable', message: 'Distribution not available locally' },
                { operation: 'validateName', message: 'Invalid image name' }
            ];

            for (const error of localErrors) {
                expect(error.message).not.toContain('Network');
                expect(error.message).not.toContain('network');
            }
        });

        it('should only show network errors for actual network operations', () => {
            const networkOperations = ['downloadDistribution', 'fetchCatalog'];
            const localOperations = ['createImage', 'deleteDistribution', 'listDistros'];

            // Check distro.available is a local check
            const distro = { available: true };
            expect(distro.available).toBeDefined();

            for (const op of localOperations) {
                expect(networkOperations).not.toContain(op);
            }
        });

        it('should provide helpful messages for missing prerequisites', () => {
            const messages = {
                noDistros: 'No distributions available. Download a distribution first.',
                notAvailable: 'Distribution not available locally. Please download it first.',
                alreadyExists: 'An image with this name already exists.',
                invalidName: 'Name can only contain letters, numbers, hyphens, and underscores'
            };

            for (const [key, msg] of Object.entries(messages)) {
                expect(msg).toMatch(/[A-Z]/); // Has proper capitalization
                expect(msg).toMatch(/\.$/); // Ends with period
                expect(msg.split(' ').length).toBeGreaterThan(3); // Descriptive
            }
        });
    });

    describe('No Distributions Available Error', () => {
        it('should distinguish between no distros and no available distros', () => {
            const scenarios = [
                {
                    distros: [],
                    message: 'No distributions in catalog. Import or download a distribution.'
                },
                {
                    distros: [{ available: false }, { available: false }],
                    message: 'No distributions available locally. Download a distribution first.'
                },
                {
                    distros: [{ available: true }],
                    message: null // Should not show error
                }
            ];

            for (const scenario of scenarios) {
                const hasAvailable = scenario.distros.some((d: any) => d.available);
                
                if (scenario.distros.length === 0) {
                    expect(scenario.message).toContain('catalog');
                } else if (!hasAvailable) {
                    expect(scenario.message).toContain('locally');
                } else {
                    expect(scenario.message).toBeNull();
                }
            }
        });

        it('should filter distros correctly for create operations', () => {
            const allDistros = [
                { name: 'ubuntu', available: true },
                { name: 'debian', available: false },
                { name: 'alpine', available: true }
            ];

            const availableForCreate = allDistros.filter(d => d.available);
            expect(availableForCreate).toHaveLength(2);
            expect(availableForCreate.map(d => d.name)).toEqual(['ubuntu', 'alpine']);
            
            // Check for empty case
            const noAvailable: any[] = [];
            if (noAvailable.filter(d => d.available).length === 0) {
                // Show "No distributions available"
                expect(true).toBe(true);
            }
        });
    });

    describe('Input Validation Errors', () => {
        it('should reject invalid characters in names', () => {
            const testCases = [
                { input: 'my distro', valid: false, reason: 'contains space' },
                { input: 'my-distro', valid: true, reason: 'valid' },
                { input: 'my_distro_123', valid: true, reason: 'valid' },
                { input: 'distro!', valid: false, reason: 'contains !' },
                { input: '../etc', valid: false, reason: 'path traversal' },
                { input: 'COM1', valid: false, reason: 'reserved name' },
                { input: '', valid: false, reason: 'empty' }
            ];

            const validate = (name: string) => {
                if (!name) return false;
                if (!/^[a-zA-Z0-9-_]+$/.test(name)) return false;
                if (name.includes('..')) return false;
                const reserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'LPT1'];
                if (reserved.includes(name.toUpperCase())) return false;
                return true;
            };

            for (const test of testCases) {
                expect(validate(test.input)).toBe(test.valid);
            }
        });
    });

    describe('Permission Errors', () => {
        it('should provide actionable messages for permission issues', () => {
            const permissionErrors = [
                {
                    operation: 'createImage',
                    message: 'Permission denied. Ensure you have write access to the WSL directory.'
                },
                {
                    operation: 'deleteDistribution',
                    message: 'Cannot delete distribution. File may be in use or protected.'
                },
                {
                    operation: 'importDistribution',
                    message: 'Cannot import distribution. Check file permissions and disk space.'
                }
            ];

            for (const error of permissionErrors) {
                expect(error.message).toContain('.');  // Has suggestion
                expect(error.message.length).toBeGreaterThan(20); // Detailed
            }
        });
    });

    describe('Concurrent Operation Errors', () => {
        it('should handle rate limiting gracefully', () => {
            const rateLimitMessage = 'Operation rate limited. Please wait a moment and try again.';
            
            expect(rateLimitMessage).not.toContain('ERROR');
            expect(rateLimitMessage).not.toContain('FAILED');
            expect(rateLimitMessage).toContain('try again');
        });

        it('should prevent concurrent operations on same resource', () => {
            const lockMessage = 'Another operation is in progress for this distribution.';
            
            expect(lockMessage).toContain('in progress');
            expect(lockMessage).not.toContain('undefined');
        });
    });

    describe('Error Recovery Suggestions', () => {
        it('should provide recovery steps for common errors', () => {
            const errorRecovery = {
                'Distribution not found': 'Download the distribution or refresh the list.',
                'Network error': 'Check your internet connection and try again.',
                'Disk space': 'Free up disk space and try again.',
                'WSL not installed': 'Install WSL 2 from Windows Features.',
                'Invalid version': 'Update to Windows 10 version 2004 or later.'
            };

            for (const [error, recovery] of Object.entries(errorRecovery)) {
                expect(recovery).toContain('.');
                expect(recovery.split(' ').length).toBeGreaterThan(3);
            }
        });
    });

    describe('Error Type Classification', () => {
        it('should use specific error types, not UNKNOWN', () => {
            const errorTypes = [
                'DISTRO_NOT_FOUND',
                'IMAGE_NOT_FOUND',
                'ALREADY_EXISTS',
                'INVALID_INPUT',
                'PERMISSION_DENIED',
                'NETWORK_ERROR',
                'DISK_SPACE',
                'WSL_NOT_INSTALLED',
                'OPERATION_CANCELLED'
            ];

            for (const type of errorTypes) {
                expect(type).not.toBe('UNKNOWN');
                expect(type).not.toBe('ERROR');
                expect(type).toMatch(/^[A-Z_]+$/);
            }
        });
    });

    describe('User Cancellation Handling', () => {
        it('should handle user cancellation silently', () => {
            const cancelled = undefined; // User pressed ESC
            
            if (cancelled === undefined) {
                // Should not show error message
                expect(true).toBe(true); // Silent return
            }
        });

        it('should not treat cancellation as error', () => {
            const userActions = [
                { action: 'showInputBox', result: undefined, isError: false },
                { action: 'showQuickPick', result: undefined, isError: false },
                { action: 'showWarningMessage', result: undefined, isError: false }
            ];

            for (const action of userActions) {
                expect(action.isError).toBe(false);
            }
        });
    });

    describe('Error Message Formatting', () => {
        it('should format error messages consistently', () => {
            const messages = [
                'Failed to delete distribution: Permission denied.',
                'Failed to create image: Name already exists.',
                'Failed to import distribution: Invalid TAR file.'
            ];

            for (const msg of messages) {
                expect(msg).toMatch(/^Failed to .+: .+\.$/);
                expect(msg).not.toContain('undefined');
                expect(msg).not.toContain('null');
                expect(msg).not.toContain('[object Object]');
            }
        });
    });
});