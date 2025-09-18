/**
 * VS Code Extension Test Suite
 * Real VS Code API tests without mocks
 *
 * @author Marcus Johnson, QA Manager
 */

import * as path from 'path';
import * as glob from 'glob';

export function run(): Promise<void> {
    // Create the test runner
    const testsRoot = path.resolve(__dirname, '..');

    return new Promise((resolve, reject) => {
        glob('**/**.test.js', { cwd: testsRoot }, (err, files) => {
            if (err) {
                return reject(err);
            }

            // Add files to the test suite
            files.forEach(f => require(path.resolve(testsRoot, f)));

            resolve();
        });
    });
}