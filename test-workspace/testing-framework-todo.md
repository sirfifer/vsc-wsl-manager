# 🧪 VSC WSL Manager - Testing Framework Implementation TODO

**Document Version:** 1.0
**Created:** September 2024
**Owner:** QA Team
**Mandate:** NO MOCKS - 100% REAL TESTING

## 📋 Executive Summary

This document outlines the complete plan to bring our testing framework to full compliance with the "NO MOCKS - HARD STOP" requirement while achieving 80% minimum test coverage across all metrics.

**Current State:**
- 86 test files total, 39 using mocks (45% contaminated)
- 22 source files requiring test coverage
- Mixed testing frameworks (Jest, Mocha, Vitest)
- Incomplete three-level architecture

**Target State:**
- 0 mock usage
- 80% minimum coverage (100% for critical paths)
- Three-level real testing architecture
- Single framework (Vitest + @vscode/test-electron + WebdriverIO)

---

## 🚨 Phase 1: Mock Elimination (CRITICAL - Week 1)

### 1.1 Delete Mock-Dependent Test Files
**Priority:** BLOCKER
**Time Estimate:** 4 hours

Files to delete immediately:
```
test/unit/commands.registration.test.ts
test/unit/distroTreeProvider.test.ts
test/unit/terminal.openTerminal.test.ts
test/unit/wslManager.createDistribution.test.ts
test/unit/wslManager.listDistributions.test.ts
test/unit/extension.activation.test.ts
test/unit/commands/allCommands.test.ts
test/unit/distroCatalog.test.ts
test/unit/contextMenuCommands.test.ts
test/unit/wslImageManager.test.ts
test/unit/distroManager.test.ts
test/unit/manifest.test.ts
test/unit/utf16-parsing.test.ts
test/unit/wslTreeDataProvider.test.ts
test/unit/wslManager.test.ts
test/unit/wslImageTreeDataProvider.test.ts
test/unit/wslDistributionTreeDataProvider.test.ts
test/unit/vscodeApiCompliance.test.ts
test/unit/terminalProfileProvider.test.ts
test/unit/securityValidator.test.ts
test/unit/inputValidator.test.ts
test/unit/imageManager.test.ts
test/unit/errorHandler.test.ts
test/unit/distributionRegistry.test.ts
test/unit/distributionDownloader.test.ts
test/unit/commandBuilder.test.ts
test/integration/uiFlows.test.ts
test/integration/commands.test.ts
test/integration/extension.test.ts
test/integration/distribution-download.test.ts
test/real-output-tests/treeProviderOutput.test.ts
test/security/security.test.ts
```

### 1.2 Remove Mock Infrastructure
**Priority:** BLOCKER
**Time Estimate:** 2 hours

Actions:
- [ ] Delete `/test/mocks/` directory entirely
- [ ] Delete `/test/mocks/vscode.ts`
- [ ] Delete `/test/mocks/vscode-vitest.ts`
- [ ] Delete `/test/mocks/wslMock.ts`
- [ ] Delete `/test/mocks/systemCommands.ts`
- [ ] Archive `/test/config/jest.config.js`
- [ ] Remove `/test/setup.ts` if it contains mock setup
- [ ] Clean `/test/utils/testDataGenerators.ts` of mock helpers

### 1.3 Clean Package Dependencies
**Priority:** HIGH
**Time Estimate:** 1 hour

Remove from package.json:
- [ ] jest
- [ ] ts-jest
- [ ] @types/jest
- [ ] jest-mock
- [ ] Any mocha-related packages

Keep:
- [ ] vitest
- [ ] @vitest/ui
- [ ] @vscode/test-electron
- [ ] wdio-vscode-service
- [ ] @wdio/cli

### 1.4 Update Configuration
**Priority:** HIGH
**Time Estimate:** 1 hour

- [ ] Verify `vitest.config.ts` has no mock aliases
- [ ] Remove jest/mocha test scripts from package.json
- [ ] Consolidate test commands to three levels only

---

## 🏗️ Phase 2: Three-Level Architecture Implementation

### 2.1 Level 1: Unit Tests (Vitest)
**Priority:** HIGH
**Time Estimate:** 3 days

#### Core Components (Must Have 100% Coverage)
- [ ] `test/unit/wslManager.real.test.ts`
  - [ ] listDistributions() - real wsl.exe call
  - [ ] createDistribution() - real distribution creation
  - [ ] importDistribution() - real TAR import
  - [ ] exportDistribution() - real TAR export
  - [ ] unregisterDistribution() - test distribution cleanup
  - [ ] terminateDistribution() - process termination
  - [ ] setDefaultDistribution() - default switching
  - [ ] runCommand() - command execution
  - [ ] getDistributionInfo() - info retrieval
  - [ ] ensureBaseDistribution() - validation

- [ ] `test/unit/security/securityValidator.real.test.ts`
  - [ ] Rate limiting with real timers
  - [ ] Operation validation
  - [ ] Permission checks

- [ ] `test/unit/utils/inputValidator.real.test.ts`
  - [ ] Command injection prevention
  - [ ] Path traversal prevention
  - [ ] Input sanitization

- [ ] `test/unit/utils/commandBuilder.real.test.ts`
  - [ ] Safe command construction
  - [ ] Argument escaping
  - [ ] Platform-specific paths

#### Distribution Management
- [ ] `test/unit/distros/distroManager.real.test.ts`
  - [ ] Catalog loading from real files
  - [ ] Distribution discovery
  - [ ] Availability checking

- [ ] `test/unit/distros/distroDownloader.real.test.ts`
  - [ ] Real HTTPS downloads
  - [ ] Progress tracking
  - [ ] Checksum validation
  - [ ] Resume capability

- [ ] `test/unit/distributionRegistry.real.test.ts`
  - [ ] Registry operations
  - [ ] Version management
  - [ ] Metadata handling

#### View Components
- [ ] `test/unit/views/distroTreeProvider.real.test.ts`
  - [ ] Tree item generation from real WSL data
  - [ ] Dynamic updates
  - [ ] Icon handling

- [ ] `test/unit/views/imageTreeProvider.real.test.ts`
  - [ ] Image listing
  - [ ] Tree structure
  - [ ] Context values

#### Error Handling
- [ ] `test/unit/errors/errorHandler.real.test.ts`
  - [ ] Error classification
  - [ ] User-friendly messages
  - [ ] Recovery suggestions

#### Terminal Integration
- [ ] `test/unit/terminal/wslTerminalProfileProvider.real.test.ts`
  - [ ] Profile generation
  - [ ] Terminal launching
  - [ ] Environment setup

#### Image Management
- [ ] `test/unit/images/wslImageManager.real.test.ts`
  - [ ] Image creation
  - [ ] Image import/export
  - [ ] Image deletion

#### Manifest Management
- [ ] `test/unit/manifest/manifestManager.real.test.ts`
  - [ ] Manifest parsing
  - [ ] Validation
  - [ ] Updates

### 2.2 Level 2: VS Code API Tests
**Priority:** HIGH
**Time Estimate:** 2 days

Location: `/test/integration/`

- [ ] `extension.activation.real.test.ts`
  - [ ] Extension loads without errors
  - [ ] All commands registered
  - [ ] Tree views initialized
  - [ ] Terminal profiles available

- [ ] `commands.execution.real.test.ts`
  - [ ] Each command executes
  - [ ] Progress notifications shown
  - [ ] Error messages displayed
  - [ ] Input prompts work

- [ ] `treeview.interaction.real.test.ts`
  - [ ] Tree refreshes on changes
  - [ ] Context menus work
  - [ ] Icons display correctly
  - [ ] Collapsible states persist

- [ ] `terminal.integration.real.test.ts`
  - [ ] Terminals open for distributions
  - [ ] Profile provider works
  - [ ] Multiple terminals supported

---

## 📁 Phase 3: Test Infrastructure

### 3.1 Test Fixtures
**Priority:** HIGH
**Time Estimate:** 1 day

Create in `/test/fixtures/`:
- [ ] `alpine-test.tar` - Minimal Alpine distribution
- [ ] `ubuntu-test.tar` - Ubuntu test image
- [ ] `corrupt.tar` - Corrupted TAR for error testing
- [ ] `manifest-samples/` - Various manifest files
- [ ] `wsl-outputs/` - Sample WSL command outputs

### 3.2 Test Helpers
**Priority:** MEDIUM
**Time Estimate:** 1 day

Create in `/test/helpers/`:
- [ ] `wslTestEnvironment.ts`
  ```typescript
  export class WSLTestEnvironment {
    async createTestDistribution(name: string): Promise<void>
    async cleanupTestDistribution(name: string): Promise<void>
    async waitForState(name: string, state: string): Promise<void>
  }
  ```

- [ ] `testDataBuilder.ts`
  ```typescript
  export class TestDataBuilder {
    buildDistribution(): WSLDistribution
    buildManifest(): DistributionManifest
    buildTreeItem(): vscode.TreeItem
  }
  ```

- [ ] `assertions.ts`
  ```typescript
  export function assertWSLOutput(actual: string, expected: Pattern): void
  export function assertCommandSucceeds(cmd: string): Promise<void>
  export function assertFileExists(path: string): void
  ```

### 3.3 Coverage Configuration
**Priority:** HIGH
**Time Estimate:** 2 hours

Update `vitest.config.ts`:
- [ ] Set coverage thresholds to 80%
- [ ] Configure HTML reporter
- [ ] Add lcov for CI integration
- [ ] Exclude test files from coverage

---

## 📊 Phase 4: Coverage Achievement

### 4.1 Coverage Targets by Component
**Priority:** CRITICAL
**Time Estimate:** 1 week

| Component | Current | Target | Priority |
|-----------|---------|--------|----------|
| wslManager.ts | 0% | 100% | CRITICAL |
| securityValidator.ts | 0% | 100% | CRITICAL |
| inputValidator.ts | 0% | 100% | CRITICAL |
| commandBuilder.ts | 0% | 100% | CRITICAL |
| errorHandler.ts | 0% | 90% | HIGH |
| distroManager.ts | 0% | 85% | HIGH |
| distroDownloader.ts | 0% | 85% | HIGH |
| extension.ts | 0% | 80% | HIGH |
| Tree Providers | 0% | 80% | MEDIUM |
| Terminal Provider | 0% | 80% | MEDIUM |
| Image Manager | 0% | 75% | LOW |

### 4.2 Test Categories per Component
Each component needs:
- [ ] Happy path tests (normal operation)
- [ ] Error condition tests (failures)
- [ ] Edge case tests (boundaries)
- [ ] Security tests (validation)
- [ ] Integration tests (with other components)

---

## 🚀 Phase 5: CI/CD Integration

### 5.1 GitHub Actions Workflow
**Priority:** MEDIUM
**Time Estimate:** 4 hours

Create `.github/workflows/test.yml`:
- [ ] Level 1: Unit tests on every push
- [ ] Level 2: API tests on PR
- [ ] Level 3: E2E tests on main branch
- [ ] Coverage reporting to Codecov
- [ ] Test status badges in README

### 5.2 Pre-commit Hooks
**Priority:** LOW
**Time Estimate:** 2 hours

- [ ] Run unit tests before commit
- [ ] Check coverage thresholds
- [ ] Lint test files

### 5.3 Level 3: E2E UI Tests
**Priority:** MEDIUM
**Time Estimate:** 2 days

Location: `/test/e2e/`

- [ ] `complete-workflow.e2e.test.ts`
  - [ ] Create distribution flow
  - [ ] Import TAR file flow
  - [ ] Export to TAR flow
  - [ ] Delete distribution flow

- [ ] `error-scenarios.e2e.test.ts`
  - [ ] Invalid input handling
  - [ ] Network failure recovery
  - [ ] Permission denied handling
  - [ ] WSL not installed scenario

- [ ] `ui-interactions.e2e.test.ts`
  - [ ] Tree view clicking
  - [ ] Command palette usage
  - [ ] Settings modification
  - [ ] Multi-window support


---

## 📚 Phase 6: Documentation

### 6.1 Update Testing Guides
**Priority:** MEDIUM
**Time Estimate:** 4 hours

- [ ] Update `docs/testing/TESTING.md`
- [ ] Update `docs/testing/TESTING-ARCHITECTURE.md`
- [ ] Create `docs/testing/WRITING-REAL-TESTS.md`
- [ ] Add examples for each test level
- [ ] Document test execution commands

### 6.2 Test Writing Guidelines
**Priority:** MEDIUM
**Time Estimate:** 2 hours

Document:
- [ ] How to write real unit tests
- [ ] How to handle async WSL operations
- [ ] How to create test fixtures
- [ ] How to debug failing tests
- [ ] Common testing patterns

---

## ✅ Success Criteria

### Must Have (Week 4)
- [x] Zero mock usage (0 files with mocks)
- [ ] 80% code coverage minimum
- [ ] All critical paths tested (security, commands)
- [ ] Three-level architecture working
- [ ] CI pipeline passing

### Should Have (Week 5)
- [ ] 90% coverage for critical components
- [ ] E2E tests for all workflows
- [ ] Performance benchmarks established
- [ ] Documentation complete

### Nice to Have (Week 6)
- [ ] 95% overall coverage
- [ ] Visual regression tests
- [ ] Load testing scenarios
- [ ] Mutation testing

---

## 🎯 Definition of Done

A component is considered fully tested when:
1. ✅ No mocks used in any tests
2. ✅ Coverage exceeds 80% (100% for critical paths)
3. ✅ All test levels implemented (where applicable)
4. ✅ Tests run in under time limits (5s/30s/2m)
5. ✅ Documentation updated
6. ✅ CI/CD pipeline passing

---

## 📈 Progress Tracking

### Phase 1: Mock Elimination
- [ ] 39 mock test files deleted
- [ ] Mock infrastructure removed
- [ ] Dependencies cleaned

### Phase 2: Architecture Implementation
- [ ] Level 1: 0/22 source files tested
- [ ] Level 2: 0/4 integration scenarios tested
- [ ] Level 3: 0/3 E2E workflows tested

### Phase 3: Infrastructure
- [ ] 0/5 test fixtures created
- [ ] 0/3 helper utilities implemented
- [ ] Coverage configuration updated

### Phase 4: Coverage
- [ ] Current: ~0% real coverage
- [ ] Target: 80% minimum
- [ ] Critical paths: 0% → 100%

### Phase 5: CI/CD
- [ ] GitHub Actions configured
- [ ] Coverage reporting enabled
- [ ] Status badges added

### Phase 6: Documentation
- [ ] Testing guides updated
- [ ] Examples provided
- [ ] Guidelines documented

---

## 🔍 Validation Checklist

Before declaring the testing framework complete:

- [ ] Run `grep -r "mock\|Mock\|jest\.mock\|vi\.mock" test/` returns no results
- [ ] Run `npm run test:unit` executes in < 5 seconds
- [ ] Run `npm run test:integration` executes in < 30 seconds
- [ ] Run `npm run test:e2e` executes in < 2 minutes
- [ ] Run `npm run test:coverage` shows >= 80% for all metrics
- [ ] All source files have corresponding test files
- [ ] No test failures in CI/CD pipeline
- [ ] Documentation reflects current implementation

---

## 🚦 Risk Mitigation

### High Risk Areas
1. **WSL Command Execution**: Some tests may affect system WSL state
   - Mitigation: Use test-specific distribution names
   - Cleanup: Always unregister test distributions

2. **File System Operations**: Tests may leave artifacts
   - Mitigation: Use temp directories
   - Cleanup: Implement afterEach cleanup

3. **Network Operations**: Downloads may be slow/fail
   - Mitigation: Use local test servers where possible
   - Timeout: Set appropriate timeouts

4. **VS Code API**: Some APIs may not work in test environment
   - Mitigation: Use @vscode/test-electron
   - Fallback: Document untestable scenarios

---

## 📞 Support & Resources

- **Testing Architecture**: `docs/testing/TESTING-ARCHITECTURE.md`
- **NO MOCKS Rule**: `docs/testing/TESTING-RULES.md`
- **VS Code Testing**: https://code.visualstudio.com/api/working-with-extensions/testing-extension
- **Vitest Docs**: https://vitest.dev/
- **WebdriverIO**: https://webdriver.io/

---

**Remember: NO MOCKS means NO MOCKS. Every test must use real implementations.**