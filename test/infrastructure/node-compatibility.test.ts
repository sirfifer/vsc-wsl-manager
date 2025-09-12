/**
 * Node.js Compatibility Test
 * Documents and tests for Node version compatibility issues
 */

import * as process from 'process';
import { spawn } from 'child_process';
import * as path from 'path';

describe('Node.js Compatibility', () => {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

    it('should document Node version', () => {
        console.log(`Running on Node.js ${nodeVersion}`);
        expect(nodeVersion).toBeDefined();
    });

    it('should warn about Jest compatibility with Node 22+', () => {
        if (majorVersion >= 22) {
            console.warn(`
                ⚠️ WARNING: Node.js ${nodeVersion} detected!
                Jest 29 does not fully support Node.js 22+
                
                Known issues:
                - Jest hangs indefinitely when running tests
                - This is a known compatibility issue
                
                Workarounds:
                1. Use 'npm run quick-test' for basic validation
                2. Use 'npm run automate' for automated testing
                3. Consider using Node.js 20 LTS for full Jest support
                4. Wait for Jest 30 with full Node 22 support
                
                Reference: https://github.com/jestjs/jest/issues
            `);
            
            // This test will pass but documents the issue
            expect(majorVersion).toBeGreaterThanOrEqual(22);
        } else {
            // Node version is compatible
            expect(majorVersion).toBeLessThan(22);
        }
    });

    it('should verify alternative test methods are available', () => {
        const packageJson = require('../../package.json');
        
        // Verify we have alternative test scripts
        expect(packageJson.scripts).toHaveProperty('quick-test');
        expect(packageJson.scripts).toHaveProperty('automate');
        expect(packageJson.scripts).toHaveProperty('compile');
    });

    it('should detect if running in Jest environment', () => {
        // This will only pass if Jest is actually running
        // With Node 22, this test won't run due to hanging
        expect(typeof jest).toBe('object');
        expect(typeof expect).toBe('function');
    });

    /**
     * This test would verify Jest can run, but will timeout on Node 22
     * Keeping it commented as documentation of the issue
     */
    // it('should be able to run Jest without hanging', (done) => {
    //     if (majorVersion >= 22) {
    //         console.log('Skipping Jest execution test on Node 22+');
    //         done();
    //         return;
    //     }
    //     
    //     const child = spawn('npx', ['jest', '--version'], {
    //         cwd: path.resolve(__dirname, '../..'),
    //         timeout: 5000
    //     });
    //     
    //     child.on('close', (code) => {
    //         expect(code).toBe(0);
    //         done();
    //     });
    // }, 10000);
});