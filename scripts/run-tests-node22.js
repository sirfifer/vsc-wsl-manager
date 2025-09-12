#!/usr/bin/env node

/**
 * Test Runner for Node.js 22+
 * 
 * This is a workaround for Jest not supporting Node.js 22.
 * It runs basic validation tests without Jest.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🧪 Running Tests (Node 22+ Compatible Mode)\n');
console.log(`Node Version: ${process.version}`);
console.log('Note: Using custom test runner due to Jest/Node 22 incompatibility\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
    totalTests++;
    try {
        fn();
        passedTests++;
        console.log(`  ✅ ${name}`);
    } catch (error) {
        failedTests++;
        console.log(`  ❌ ${name}`);
        console.log(`     Error: ${error.message}`);
    }
}

function expect(actual) {
    return {
        toBe(expected) {
            if (actual !== expected) {
                throw new Error(`Expected ${expected} but got ${actual}`);
            }
        },
        toBeDefined() {
            if (actual === undefined) {
                throw new Error(`Expected value to be defined but got undefined`);
            }
        },
        toContain(substring) {
            if (!actual.includes(substring)) {
                throw new Error(`Expected "${actual}" to contain "${substring}"`);
            }
        },
        toExist() {
            if (!fs.existsSync(actual)) {
                throw new Error(`Expected file/directory "${actual}" to exist`);
            }
        }
    };
}

console.log('📦 1. Compilation Tests\n');

test('TypeScript compiles without errors', () => {
    try {
        execSync('npx tsc --noEmit', { stdio: 'pipe' });
    } catch (error) {
        throw new Error('TypeScript compilation failed');
    }
});

test('Output directory exists after compilation', () => {
    expect(path.join(__dirname, '../out')).toExist();
});

console.log('\n📁 2. File Structure Tests\n');

const requiredFiles = [
    'src/extension.ts',
    'src/wslManager.ts',
    'src/utils/commandBuilder.ts',
    'src/utils/inputValidator.ts',
    'src/security/securityValidator.ts',
    'package.json',
    'tsconfig.json',
    'jest.config.js'
];

requiredFiles.forEach(file => {
    test(`Required file exists: ${file}`, () => {
        expect(path.join(__dirname, '..', file)).toExist();
    });
});

console.log('\n🔒 3. Security Tests\n');

test('No direct exec() usage in wslManager', () => {
    const content = fs.readFileSync(path.join(__dirname, '../src/wslManager.ts'), 'utf8');
    if (content.includes('.exec(') && !content.includes('spawn')) {
        throw new Error('Direct exec() usage detected - security risk');
    }
});

test('Input validator has required methods', () => {
    const content = fs.readFileSync(path.join(__dirname, '../src/utils/inputValidator.ts'), 'utf8');
    expect(content).toContain('validateDistributionName');
    expect(content).toContain('validateFilePath');
});

console.log('\n⚙️ 4. Configuration Tests\n');

test('package.json has required scripts', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
    expect(pkg.scripts.compile).toBeDefined();
    expect(pkg.scripts.test).toBeDefined();
    expect(pkg.scripts['quick-test']).toBeDefined();
});

test('Jest configuration exists', () => {
    const jestConfig = require('../jest.config.js');
    expect(jestConfig.testEnvironment).toBe('node');
    expect(jestConfig.preset).toBe('ts-jest');
});

console.log('\n🏗️ 5. Build Tests\n');

test('Extension compiles successfully', () => {
    try {
        execSync('npm run compile', { stdio: 'pipe' });
        expect(path.join(__dirname, '../out/src/extension.js')).toExist();
    } catch (error) {
        throw new Error('Extension compilation failed');
    }
});

// Summary
console.log('\n' + '='.repeat(60));
console.log('TEST SUMMARY');
console.log('='.repeat(60));
console.log(`Total Tests: ${totalTests}`);
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);
console.log('='.repeat(60));

if (failedTests > 0) {
    console.log('\n❌ TESTS FAILED');
    console.log('\n⚠️  Note: For full test coverage with Jest, use Node.js 20 LTS');
    console.log('    Current Node version (22+) is not fully compatible with Jest 29');
    process.exit(1);
} else {
    console.log('\n✅ ALL TESTS PASSED!');
    console.log('\n📝 Note: This is a basic test suite. For full coverage:');
    console.log('   - Use Node.js 20 LTS to run Jest tests');
    console.log('   - Or wait for Jest 30 with Node 22 support');
    process.exit(0);
}