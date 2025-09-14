# Testing Documentation - VSC WSL Manager

## 📋 Testing Overview

**QA Manager: Marcus Johnson**
**Last Updated: 2025-09-14**
**Coverage Target: 80% minimum across all metrics**

This document provides comprehensive testing documentation for the VSC WSL Manager extension, covering all test types, workflows, and guidelines.

## 🎯 Test Categories

### 1. Unit Tests (`test/unit/`)
- **Purpose**: Test individual components in isolation
- **Coverage**: 80%+ for all source files
- **Files**:
  - `commandBuilder.test.ts` - Command construction and security
  - `errorHandler.test.ts` - Error handling and user messages
  - `inputValidator.test.ts` - Input validation and sanitization
  - `securityValidator.test.ts` - Security checks and rate limiting
  - `wslManager.test.ts` - WSL operations
  - `distroManager.test.ts` - Distribution management
  - `distroCatalog.test.ts` - Distribution catalog operations
  - `distributionDownloader.test.ts` - Download functionality
  - `distributionRegistry.test.ts` - Registry operations
  - `imageManager.test.ts` - Image management
  - `terminalProfileProvider.test.ts` - Terminal integration
  - `wslTreeDataProvider.test.ts` - Tree view data providers
  - `contextMenuCommands.test.ts` - Context menu functionality
  - `commands/allCommands.test.ts` - All extension commands
  - `treeProviders/treeItems.test.ts` - Tree item structures
  - `errorScenarios/errorScenarios.test.ts` - Error scenario coverage

### 2. Integration Tests (`test/integration/`)
- **Purpose**: Test component interactions
- **Files**:
  - `commands.test.ts` - Command execution flows
  - `extension.test.ts` - Extension activation and lifecycle
  - `uiFlows.test.ts` - Complete UI workflows
  - `distribution-download.test.ts` - Download integration
  - `realTests.test.ts` - Real scenario testing

### 3. E2E Tests - Python (`test/e2e-python/`)
- **Purpose**: End-to-end UI testing with real VS Code instance
- **Framework**: Python + pywinauto (Windows automation)
- **Requirements**: Windows, Python 3.x, VS Code installed
- **Files**:
  - `test_extension_activation.py` - Extension activation tests
  - `test_commands.py` - Command palette and UI interactions
  - `test_complete_flow.py` - Full workflow testing
- **Reports**: HTML reports with screenshots in `test/e2e-python/reports/`

### 4. E2E Tests - WebdriverIO (`test/e2e/`)
- **Purpose**: Browser-based VS Code testing
- **Framework**: WebdriverIO + ChromeDriver
- **Files**:
  - `extension-activation.test.ts` - Activation tests
  - `terminal-profiles.test.ts` - Terminal integration
  - `complete-workflows.test.ts` - Full workflows
  - `distro-workflow.test.ts` - Distribution operations
  - `image-workflow.test.ts` - Image operations
  - `two-world-architecture.test.ts` - Architecture validation

### 5. Security Tests (`test/security/`)
- **Purpose**: Security validation and vulnerability testing
- **Files**:
  - `security.test.ts` - Input validation, rate limiting, command injection prevention

### 6. Functional Tests (`test/functional/`)
- **Purpose**: Business logic and feature testing
- **Files**:
  - `error-classification.test.ts` - Error type validation

### 7. Validation Tests (`test/validation/`)
- **Purpose**: Regression prevention and validation
- **Files**:
  - `catchRegressions.test.ts` - Prevents known issues from recurring

### 8. Real Output Tests (`test/real-output-tests/`)
- **Purpose**: Tests actual command output without mocks
- **Files**:
  - `commandOutput.test.ts` - Real command output validation
  - `treeProviderOutput.test.ts` - Tree provider output testing

### 9. Infrastructure Tests (`test/infrastructure/`)
- **Purpose**: Test environment and setup validation
- **Files**:
  - `jest-setup.test.ts` - Jest configuration tests
  - `node-compatibility.test.ts` - Node version compatibility

## 🚀 Running Tests

### Quick Test Commands

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run with coverage
npm run test:coverage

# Run security tests
npm run test:security

# Watch mode for development
npm run test:watch

# Run comprehensive test suite
npm run test:comprehensive
```

### E2E Testing

#### Python E2E Tests (Recommended for UI)
```bash
# Install Python dependencies (Windows)
npm run test:e2e:python:install

# Run all Python E2E tests
npm run test:e2e:python

# Run specific test suites
npm run test:e2e:python:activation
npm run test:e2e:python:commands

# Clean test artifacts
npm run test:e2e:python:clean
```

#### WebdriverIO E2E Tests
```bash
# Run WebdriverIO tests (Windows)
npm run test:e2e:windows

# Debug mode
npm run test:e2e:windows:debug
```

### Advanced Testing

```bash
# Node 22 compatibility
npm run test:node22

# Performance tests
npm run test:performance

# Run tests affected by changes
npm run test:affected

# Debug tests with inspector
npm run test:debug

# Quick automated test
npm run quick-test

# Full automation cycle
npm run automate
```

## 📊 Coverage Requirements

All code must meet the following coverage thresholds:

```javascript
{
  branches: 80,
  functions: 80,
  lines: 80,
  statements: 80
}
```

### Checking Coverage

```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open coverage/lcov-report/index.html
```

## 🧪 Test Structure

### Unit Test Template

```typescript
import { ComponentName } from '../../src/path/to/component';

describe('ComponentName', () => {
    let component: ComponentName;

    beforeEach(() => {
        // Setup
        component = new ComponentName();
    });

    afterEach(() => {
        // Cleanup
        jest.clearAllMocks();
    });

    describe('methodName', () => {
        it('should handle normal case', () => {
            // Arrange
            const input = 'test';

            // Act
            const result = component.methodName(input);

            // Assert
            expect(result).toBe('expected');
        });

        it('should handle error case', () => {
            // Test error scenarios
        });
    });
});
```

### Integration Test Template

```typescript
describe('Feature Integration', () => {
    it('should complete workflow end-to-end', async () => {
        // Setup environment
        // Execute workflow
        // Verify results
    });
});
```

## 🔧 Test Configuration

### Jest Configuration (`jest.config.js`)
- TypeScript support via ts-jest
- VS Code mocking
- Coverage collection
- Test timeouts: 10 seconds default

### Test Environment
- Node.js test environment
- Mocked VS Code API
- Isolated test directories
- Automatic cleanup

## 📝 Writing Tests Guidelines

### 1. Test Naming
- Use descriptive test names
- Follow pattern: `should [expected behavior] when [condition]`
- Group related tests with `describe` blocks

### 2. Test Coverage
- Test happy paths
- Test error cases
- Test edge cases
- Test security scenarios

### 3. Mocking
- Mock external dependencies
- Use `test/mocks/` for shared mocks
- Clear mocks between tests

### 4. Assertions
- Use specific assertions
- Test exact values when possible
- Verify side effects

### 5. Performance
- Keep tests fast (< 100ms for unit tests)
- Use `beforeAll` for expensive setup
- Clean up resources in `afterEach`

## 🐛 Debugging Tests

### VS Code Debugging
1. Set breakpoints in test files
2. Run "Debug: JavaScript Debug Terminal"
3. Execute: `npm run test:debug`

### Console Logging
```typescript
// Temporarily enable console in tests
global.console = console;
```

### Verbose Output
```bash
npm run test:watch:verbose
```

## 🔄 Continuous Integration

### GitHub Actions Workflow
Tests run automatically on:
- Push to main branch
- Pull requests
- Manual workflow dispatch

### Test Matrix
- Node versions: 16.x, 18.x, 20.x, 22.x
- VS Code versions: stable, insiders
- OS: Windows (primary), Ubuntu, macOS

## 📊 Test Reports

### Coverage Reports
- Location: `coverage/`
- Formats: lcov, HTML, text
- Published to Codecov

### E2E Reports
- Python: `test/e2e-python/reports/`
- Screenshots: `test/e2e-python/screenshots/`
- WebdriverIO: `test-results/`

## 🚨 Known Issues

### Jest/ESLint Timeout
- Some environments experience tool timeouts
- Workaround: Run tests in CI or fresh environment

### Python E2E Requirements
- Must run from `/mnt/c/` path in WSL
- Requires VS Code on Windows host
- Python must be installed on Windows

### WebdriverIO Limitations
- Extension loading can be flaky
- Prefer Python E2E for reliability

## 📚 Test Data

### Test Data Generators
Located in `test/utils/testDataGenerators.ts`:
- Generate consistent test data
- Create mock distributions
- Generate test file paths

### Fixtures
- Mock TAR files for import/export tests
- Sample configuration files
- Test distribution manifests

## ✅ Checklist for New Features

When adding new features:

1. [ ] Write unit tests first (TDD)
2. [ ] Add integration tests for workflows
3. [ ] Update command tests if adding commands
4. [ ] Add error scenario tests
5. [ ] Add regression tests for bugs
6. [ ] Update this documentation
7. [ ] Ensure 80% coverage maintained
8. [ ] Run full test suite before committing

## 🔗 Related Documentation

- [CLAUDE.md](CLAUDE.md) - AI assistant instructions
- [TEST_COVERAGE_REPORT.md](TEST_COVERAGE_REPORT.md) - Coverage analysis
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines
- [SECURITY.md](SECURITY.md) - Security testing details

## 📞 Support

For testing questions or issues:
1. Check existing test examples
2. Review this documentation
3. Open a GitHub issue with `testing` label
4. Include test output and environment details

---

**Maintained by:** QA Team
**Last Review:** 2025-09-14
**Next Review:** Monthly or as needed