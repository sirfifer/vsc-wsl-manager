# VSC WSL Manager - Quick Reference Card

## 🎯 Core Principles

### The Three Commandments
1. **TEST FIRST** - No code without tests
2. **100% COVERAGE** - No exceptions
3. **DOCUMENT EVERYTHING** - Code should explain itself

## 🤖 Autonomous Agents Support

### ChatGPT Codex
- ✅ Reads AGENTS.md automatically
- ✅ Up to 60 parallel instances/hour
- ✅ Cloud sandboxed execution
- ✅ Branch: `codex/issue-*`

### GitHub Copilot Agents
- ✅ Supports AGENTS.md + alternatives
- ✅ GitHub Actions environment
- ✅ Multiple parallel tasks
- ✅ Branch: `copilot/issue-*`

## 🔄 TDD Cycle (MANDATORY)

```
┌─────────────┐
│   1. RED    │ Write failing test
└──────┬──────┘
       ↓
┌─────────────┐
│  2. GREEN   │ Write minimal code to pass
└──────┬──────┘
       ↓
┌─────────────┐
│ 3. REFACTOR │ Improve while keeping green
└─────────────┘
```

## ✅ Before You Code

- [ ] Read AGENTS.md completely
- [ ] Check existing tests
- [ ] Understand the feature/bug
- [ ] Write test file first

## 🚫 NEVER DO THIS

```typescript
// ❌ FORBIDDEN - Security Risk!
import { exec } from 'child_process';
exec(`wsl ${userInput}`);

// ❌ FORBIDDEN - Test after code
writeCode();
// "I'll add tests later"

// ❌ FORBIDDEN - No documentation
function doSomething(x) {
  return x * 2;
}

// ❌ FORBIDDEN - Console in production
console.log('debug', data);
```

## ✔️ ALWAYS DO THIS

```typescript
// ✅ CORRECT - Secure execution
import { spawn } from 'child_process';
spawn('wsl', [sanitizedInput]);

// ✅ CORRECT - Test first
describe('feature', () => {
  test('requirement', () => {
    expect(feature()).toBe(expected);
  });
});
// Then implement

// ✅ CORRECT - Documented
/**
 * Doubles the input value
 * @param x - Number to double
 * @returns The doubled value
 */
function double(x: number): number {
  return x * 2;
}
```

## 📊 Coverage Commands

```bash
# Check coverage
npm run coverage

# Must see:
# Statements   : 100%
# Branches     : 100%
# Functions    : 100%
# Lines        : 100%
```

## 🏗️ File Structure

```
feature.ts          → src/features/feature.ts
feature.test.ts     → src/test/unit/features/feature.test.ts
feature.docs.md     → docs/features/feature.md
```

## 📝 Commit Message Format

```
[component] Action taken

- Test coverage: 100% ✓
- Tests written first ✓
- Documentation updated ✓
```

## 🔍 PR Checklist

**EVERY PR MUST HAVE:**
- [ ] Tests written BEFORE code
- [ ] 100% coverage maintained
- [ ] All CI checks green
- [ ] JSDoc for all exports
- [ ] No `exec()` usage
- [ ] No `console.log`
- [ ] Updated relevant docs
- [ ] Meaningful commit history

## 🚀 Quick Commands

```bash
# Development flow
npm test            # Run tests
npm run coverage    # Check coverage
npm run lint        # Check style
npm run security    # Security check
npm run build       # Build extension

# Automation
npm run automate    # Run test automation loop

# Agent compliance
npm run test:agent-compliance  # Verify AGENTS.md compliance
```

## ⚡ Parallel Execution Safety

For autonomous agents working simultaneously:
```typescript
// ✅ SAFE - Unique resources
const testId = Date.now();
const testDir = `/tmp/test-${testId}`;

// ❌ UNSAFE - Shared resources
const testDir = '/tmp/test';

// ✅ SAFE - Cleanup
afterEach(() => fs.rmSync(testDir, { recursive: true }));

// ❌ UNSAFE - No cleanup
// Resources left behind
```

## 🛡️ Security Rules

1. **Input Validation**: Always sanitize user input
2. **Process Execution**: Only use `spawn()`, never `exec()`
3. **Path Handling**: Use `path.join()`, not string concat
4. **Error Messages**: Never expose system paths

## 📚 Documentation Requirements

Every function needs:
```typescript
/**
 * Brief description (what)
 * Detailed explanation (why)
 * 
 * @param name - Description
 * @returns What it returns
 * @throws {ErrorType} When it throws
 * @example
 * const result = myFunction('input');
 */
```

## 🔄 CI Pipeline Order

1. **Compile** → Must succeed
2. **Lint** → No errors
3. **Security** → No `exec()`
4. **Tests** → All pass
5. **Coverage** → 100%
6. **Docs** → Complete
7. **Bundle** → < 5MB

## ⚡ Performance Targets

- Build time: < 2 minutes
- Test suite: < 30 seconds
- Bundle size: < 5MB
- Extension startup: < 1 second

## 🆘 When Stuck

1. Check test output carefully
2. Read `.fix-request.json` if present
3. Verify environment setup
4. Consult AGENTS.md
5. Check existing similar code
6. Ask for clarification

## 🎨 Code Style

- TypeScript strict mode
- Async/await over callbacks
- Interfaces over type aliases
- Explicit types (no `any`)
- Early returns over nested ifs
- Descriptive names over comments

## 🏆 Definition of Done

A feature is DONE when:
- ✅ All tests pass
- ✅ 100% coverage
- ✅ Documentation complete
- ✅ Security checked
- ✅ Code reviewed
- ✅ CI pipeline green
- ✅ AGENTS.md updated (if needed)

---

**Remember**: If you're not sure whether to write a test, write a test.

**Golden Rule**: Would a new developer understand this code in 6 months?

**For AI Agents**: This card summarizes AGENTS.md. Always consult the full AGENTS.md before starting work.

**Version**: 1.0.0 | **Updated**: Sept 2025
