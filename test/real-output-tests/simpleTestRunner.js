/**
 * Simple Test Runner
 * Runs tests without Jest mocking infrastructure
 * Tests REAL code, not mocks
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class SimpleTestRunner {
    constructor() {
        this.passed = 0;
        this.failed = 0;
        this.currentDescribe = '';
        this.currentIt = '';
    }

    describe(description, fn) {
        this.currentDescribe = description;
        console.log(`\n📦 ${description}`);
        fn();
    }

    it(description, fn) {
        this.currentIt = description;
        try {
            // Run the test
            const result = fn();
            
            // Handle async tests
            if (result && typeof result.then === 'function') {
                return result
                    .then(() => {
                        console.log(`  ✅ ${description}`);
                        this.passed++;
                    })
                    .catch(error => {
                        console.log(`  ❌ ${description}`);
                        console.log(`     ${error.message}`);
                        this.failed++;
                    });
            } else {
                console.log(`  ✅ ${description}`);
                this.passed++;
            }
        } catch (error) {
            console.log(`  ❌ ${description}`);
            console.log(`     ${error.message}`);
            this.failed++;
        }
    }

    async beforeEach(fn) {
        await fn();
    }

    async afterEach(fn) {
        await fn();
    }

    expect(actual) {
        return {
            toBe: (expected) => {
                if (actual !== expected) {
                    throw new Error(`Expected ${expected} but got ${actual}`);
                }
            },
            toEqual: (expected) => {
                if (JSON.stringify(actual) !== JSON.stringify(expected)) {
                    throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
                }
            },
            toHaveLength: (expected) => {
                if (!actual || actual.length !== expected) {
                    const actualLength = actual ? actual.length : 'undefined';
                    throw new Error(`Expected length ${expected} but got ${actualLength}`);
                }
            },
            toBeGreaterThan: (expected) => {
                if (!(actual > expected)) {
                    throw new Error(`Expected ${actual} to be greater than ${expected}`);
                }
            },
            toBeDefined: () => {
                if (actual === undefined) {
                    throw new Error(`Expected value to be defined but got undefined`);
                }
            },
            toBeUndefined: () => {
                if (actual !== undefined) {
                    throw new Error(`Expected undefined but got ${actual}`);
                }
            },
            toContain: (expected) => {
                if (!actual || !actual.includes(expected)) {
                    throw new Error(`Expected to contain "${expected}"`);
                }
            },
            not: {
                toBe: (expected) => {
                    if (actual === expected) {
                        throw new Error(`Expected not to be ${expected}`);
                    }
                },
                toContain: (expected) => {
                    if (actual && actual.includes(expected)) {
                        throw new Error(`Expected not to contain "${expected}"`);
                    }
                }
            }
        };
    }

    static runTestFile(filePath) {
        const runner = new SimpleTestRunner();
        
        // Set up globals
        global.describe = runner.describe.bind(runner);
        global.it = runner.it.bind(runner);
        global.beforeEach = runner.beforeEach.bind(runner);
        global.afterEach = runner.afterEach.bind(runner);
        global.expect = runner.expect.bind(runner);
        
        // Mock minimal vscode
        global.vscode = {
            TreeItem: class TreeItem {
                constructor(label, collapsibleState) {
                    this.label = label;
                    this.collapsibleState = collapsibleState;
                }
            },
            TreeItemCollapsibleState: {
                None: 0,
                Collapsed: 1,
                Expanded: 2
            },
            ThemeIcon: class ThemeIcon {
                constructor(id) {
                    this.id = id;
                }
            }
        };
        
        // Clear require cache to ensure fresh test
        delete require.cache[require.resolve(filePath)];
        
        // Run the test file
        try {
            require(filePath);
        } catch (error) {
            console.error('Failed to load test file:', error);
            runner.failed++;
        }
        
        return {
            passed: runner.passed,
            failed: runner.failed
        };
    }
}

module.exports = SimpleTestRunner;