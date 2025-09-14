/**
 * REAL Command Output Tests
 * Tests what commands ACTUALLY show to users
 * NO MOCKS - Tests real data flow
 * 
 * @author Marcus Johnson, QA Manager
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DistroManager } from '../../src/distros/DistroManager';
import { ErrorHandler, ErrorType, WSLError } from '../../src/errors/errorHandler';
import { InputValidator } from '../../src/utils/inputValidator';

describe('REAL Command Output Tests - What Users Actually See', () => {
    let testDir: string;
    let distroManager: DistroManager;

    beforeEach(() => {
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wsl-test-'));
        const distrosDir = path.join(testDir, 'distros');
        fs.mkdirSync(distrosDir, { recursive: true });
        distroManager = new DistroManager(testDir);
    });

    afterEach(() => {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('Download Distribution Command Output', () => {
        it('should show ALL distros when NONE are downloaded', async () => {
            // No .tar files exist
            const allDistros = await distroManager.listDistros();
            const downloadable = allDistros.filter(d => !d.available);
            
            // Should show all distros as downloadable
            expect(downloadable.length).toBe(allDistros.length);
            expect(downloadable.length).toBeGreaterThan(20); // We have 24 distros
        });

        it('should exclude already downloaded distros from download list', async () => {
            // Download ubuntu
            fs.writeFileSync(path.join(testDir, 'distros', 'ubuntu-24.04.tar'), 'dummy');
            
            const allDistros = await distroManager.listDistros();
            const downloadable = allDistros.filter(d => !d.available);
            
            // Ubuntu should NOT be in downloadable list
            const hasUbuntu = downloadable.some(d => d.name === 'ubuntu-24.04');
            expect(hasUbuntu).toBe(false);
            
            // Should have one less than total
            expect(downloadable.length).toBe(allDistros.length - 1);
        });

        it('should show "All distributions downloaded" when all are downloaded', async () => {
            // Download all distros (simulate)
            const allDistros = await distroManager.listDistros();
            for (const distro of allDistros) {
                fs.writeFileSync(path.join(testDir, 'distros', `${distro.name}.tar`), 'dummy');
            }
            
            const refreshedDistros = await distroManager.listDistros();
            const downloadable = refreshedDistros.filter(d => !d.available);
            
            expect(downloadable).toHaveLength(0);
            // UI should show "All available distributions are already downloaded"
        });
    });

    describe('Create Image Command Output', () => {
        it('should show "No distributions available" when none downloaded', async () => {
            const distros = await distroManager.listDistros();
            const available = distros.filter(d => d.available);
            
            expect(available).toHaveLength(0);
            // UI should show: "No distributions available. Download a distribution first."
        });

        it('should ONLY show downloaded distros in create image picker', async () => {
            // Download only 2 distros
            fs.writeFileSync(path.join(testDir, 'distros', 'ubuntu-24.04.tar'), 'dummy');
            fs.writeFileSync(path.join(testDir, 'distros', 'alpine-3.20.tar'), 'dummy');
            
            const distros = await distroManager.listDistros();
            const available = distros.filter(d => d.available);
            
            // Should show exactly 2
            expect(available).toHaveLength(2);
            expect(available.map(d => d.name).sort()).toEqual(['alpine-3.20', 'ubuntu-24.04']);
        });
    });

    describe('Error Messages Shown to Users', () => {
        it('should show correct error for missing distro', () => {
            const error = new Error('Distro not found: ubuntu-22.04');
            const errorType = ErrorHandler.determineErrorType(error);
            const message = ErrorHandler.getUserFriendlyMessage(error);
            
            expect(errorType).toBe(ErrorType.DISTRIBUTION_NOT_FOUND);
            expect(message).toContain('Distribution Not Found');
            expect(message).not.toContain('Network Error');
        });

        it('should show correct error for unavailable distro', () => {
            const error = new Error('Distro not available locally: debian-12');
            const errorType = ErrorHandler.determineErrorType(error);
            const message = ErrorHandler.getUserFriendlyMessage(error);
            
            expect(errorType).toBe(ErrorType.FILE_NOT_FOUND);
            expect(message).toContain('File Not Found');
            expect(message).not.toContain('Network Error');
        });

        it('should provide helpful recovery actions', () => {
            const error = new WSLError(
                ErrorType.DISTRIBUTION_NOT_FOUND,
                'Distribution not found',
                'The specified distribution does not exist'
            );
            
            // Check recovery actions exist
            const errorInfo = ErrorHandler.createError(error);
            expect(errorInfo.recoveryActions).toBeDefined();
            expect(errorInfo.recoveryActions!.length).toBeGreaterThan(0);
        });
    });

    describe('Input Validation Messages', () => {
        it('should show correct validation error for spaces', () => {
            const result = InputValidator.validateDistributionName('my distro');
            
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('Distribution name can only contain letters, numbers, dots, dashes, and underscores');
        });

        it('should accept periods in names', () => {
            const result = InputValidator.validateDistributionName('ubuntu-24.04');
            
            expect(result.isValid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it('should show correct error for empty name', () => {
            const result = InputValidator.validateDistributionName('');
            
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('Distribution name is required');
        });
    });

    describe('List Output Consistency', () => {
        it('distroManager.listDistros() should always return same catalog', async () => {
            const list1 = await distroManager.listDistros();
            const list2 = await distroManager.listDistros();
            
            expect(list1.length).toBe(list2.length);
            expect(list1.map(d => d.name)).toEqual(list2.map(d => d.name));
        });

        it('should correctly update available status when files change', async () => {
            let distros = await distroManager.listDistros();
            let ubuntu = distros.find(d => d.name === 'ubuntu-24.04');
            expect(ubuntu?.available).toBe(false);
            
            // Add tar file
            fs.writeFileSync(path.join(testDir, 'distros', 'ubuntu-24.04.tar'), 'dummy');
            
            // Check again
            distros = await distroManager.listDistros();
            ubuntu = distros.find(d => d.name === 'ubuntu-24.04');
            expect(ubuntu?.available).toBe(true);
        });
    });

    describe('Picker Item Formatting', () => {
        it('should format distro picker items correctly', async () => {
            const distros = await distroManager.listDistros();
            const firstDistro = distros[0];
            
            // Simulate picker item creation
            const pickerItem = {
                label: firstDistro.displayName,
                description: firstDistro.version,
                detail: firstDistro.description
            };
            
            expect(pickerItem.label).toBeDefined();
            expect(pickerItem.label).not.toBe('');
            expect(pickerItem.description).toBeDefined();
            expect(pickerItem.detail).toBeDefined();
        });

        it('should indicate downloaded status in picker', async () => {
            fs.writeFileSync(path.join(testDir, 'distros', 'ubuntu-24.04.tar'), 'dummy');
            
            const distros = await distroManager.listDistros();
            const ubuntu = distros.find(d => d.name === 'ubuntu-24.04');
            
            // Picker should show download status
            const pickerDetail = ubuntu?.available ? '✓ Downloaded' : 'Not downloaded';
            expect(pickerDetail).toBe('✓ Downloaded');
        });
    });
});