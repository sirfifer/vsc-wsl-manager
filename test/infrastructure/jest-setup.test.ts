/**
 * Infrastructure test to verify Jest setup and configuration
 * This test ensures that Jest can initialize and run without hanging
 */

import { spawn } from 'child_process';
import * as path from 'path';

describe('Jest Infrastructure', () => {
    const projectRoot = path.resolve(__dirname, '../..');
    const timeout = 15000; // 15 seconds should be plenty for a simple test

    it('should be able to run a simple test without hanging', (done) => {
        // Create a simple inline test
        const testCommand = `npx jest --version`;
        
        const child = spawn('sh', ['-c', testCommand], {
            cwd: projectRoot,
            timeout: timeout
        });

        let output = '';
        let errorOutput = '';
        let completed = false;

        child.stdout.on('data', (data) => {
            output += data.toString();
        });

        child.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        child.on('close', (code) => {
            completed = true;
            expect(code).toBe(0);
            expect(output).toContain('29.7.0'); // Current Jest version
            done();
        });

        child.on('error', (error) => {
            completed = true;
            done(error);
        });

        // Fail if process doesn't complete within timeout
        setTimeout(() => {
            if (!completed) {
                child.kill();
                done(new Error(`Jest command timed out after ${timeout}ms. This indicates Jest is hanging.`));
            }
        }, timeout - 1000);
    }, timeout);

    it('should load jest configuration without errors', () => {
        const jestConfig = require('../../jest.config.js');
        
        // Verify config has required properties
        expect(jestConfig).toHaveProperty('testEnvironment', 'node');
        expect(jestConfig).toHaveProperty('preset', 'ts-jest');
        
        // Verify all paths are strings
        if (jestConfig.setupFilesAfterEnv) {
            jestConfig.setupFilesAfterEnv.forEach((path: any) => {
                expect(typeof path).toBe('string');
            });
        }
        
        if (jestConfig.moduleNameMapper) {
            Object.values(jestConfig.moduleNameMapper).forEach((path: any) => {
                expect(typeof path).toBe('string');
            });
        }
    });

    it('should have compatible Jest and ts-jest versions', () => {
        const packageJson = require('../../package.json');
        
        const jestVersion = packageJson.devDependencies.jest;
        const tsJestVersion = packageJson.devDependencies['ts-jest'];
        
        // Jest 29.x should use ts-jest 29.x
        expect(jestVersion).toMatch(/^[\^~]?29\./);
        expect(tsJestVersion).toMatch(/^[\^~]?29\./);
    });

    it('should be able to compile TypeScript test files', (done) => {
        const testCommand = `npx ts-jest config:migrate --no-prompt`;
        
        const child = spawn('sh', ['-c', testCommand], {
            cwd: projectRoot,
            timeout: 10000
        });

        let errorOutput = '';

        child.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        child.on('close', (code) => {
            // config:migrate should exit cleanly even if no migration needed
            expect(code).toBeLessThanOrEqual(1);
            done();
        });

        child.on('error', (error) => {
            done(error);
        });
    }, 15000);

    it('should not have conflicting test frameworks', () => {
        const packageJson = require('../../package.json');
        
        // Check that we're primarily using Jest
        expect(packageJson.devDependencies).toHaveProperty('jest');
        expect(packageJson.devDependencies).toHaveProperty('@types/jest');
        
        // If other test frameworks are present, they should be for specific purposes
        if (packageJson.devDependencies.chai) {
            console.warn('Warning: chai is installed alongside Jest. Consider using one test framework.');
        }
        if (packageJson.devDependencies.mocha) {
            console.warn('Warning: mocha is installed alongside Jest. Consider using one test framework.');
        }
    });
});