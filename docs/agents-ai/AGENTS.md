# VSC WSL Manager - Agent Instructions

## Autonomous Agent Compatibility
This AGENTS.md is designed to work with ChatGPT Codex, GitHub Copilot Agents, and other autonomous AI coding assistants that can work in parallel instances. Instructions are stateless and can be executed independently.

**Agent Recognition**: If you are an autonomous agent (Codex, Copilot Agent, etc.), follow these instructions exactly as written. Each task can be executed independently without affecting other parallel instances.

## Project Overview
VSC WSL Manager is a Visual Studio Code extension for managing Windows Subsystem for Linux (WSL) distributions. It provides a tree view interface for creating, importing, exporting, and managing WSL distributions directly from VS Code.

**Critical Requirements**: 100% test coverage, Test-Driven Development, comprehensive documentation, and security-first implementation.

## Development Principles

### Test-Driven Development (TDD)
**MANDATORY**: Follow strict TDD workflow for ALL changes:
1. **RED**: Write failing test(s) FIRST that define expected behavior
2. **GREEN**: Write MINIMAL code to make tests pass
3. **REFACTOR**: Improve code while keeping tests green
4. **NEVER** write implementation code before tests

Example TDD workflow:
```typescript
// Step 1: Write failing test
describe('WSLManager.listDistributions', () => {
  it('should return array of distributions', async () => {
    const manager = new WSLManager();
    const result = await manager.listDistributions();
    expect(result).to.be.an('array');
  });
});

// Step 2: Minimal implementation
class WSLManager {
  async listDistributions(): Promise<Distribution[]> {
    return []; // Just enough to pass
  }
}

// Step 3: Refactor with actual logic
```

### Code Coverage Requirements
**MANDATORY**: Maintain 100% test coverage at all times.
- Check coverage before ANY commit: `npm run coverage`
- Coverage must include: statements, branches, functions, lines
- CI will FAIL if coverage drops below 100%
- No exceptions, no "TODO: add tests later"

### Documentation Standards
**MANDATORY**: Document all code thoroughly:
```typescript
/**
 * Lists all WSL distributions on the system.
 * @returns Promise resolving to array of Distribution objects
 * @throws {WSLNotFoundError} When WSL is not installed
 * @example
 * const distributions = await manager.listDistributions();
 * console.log(`Found ${distributions.length} WSL distributions`);
 */
```

Every function needs:
- Purpose description
- Parameter documentation
- Return value description
- Possible exceptions
- Usage example
- Inline comments for complex logic

## Parallel Execution Guidelines

### For Autonomous Agents (Codex, Copilot, etc.)
When multiple agent instances work simultaneously:

1. **Independent Work Units**: Each task/issue MUST be completable independently
2. **No Shared State**: Don't assume other agents' work is complete
3. **Isolated Testing**: Each test suite runs in its own environment
4. **Branch Isolation**: Work only in your assigned branch (e.g., `copilot/*`, `codex/*`)
5. **Resource Awareness**: Tests use ports 3000-3100; each agent should use unique ports within this range

### Task Isolation Requirements
```bash
# Each agent instance should:
1. Create unique test databases/fixtures
2. Use timestamped temp directories: /tmp/wsl-test-$(date +%s)
3. Clean up resources after completion
4. Not modify global configuration files
```

### Conflict Prevention
- File locks: Check for `.lock` files before modifying shared resources
- Test naming: Prefix tests with issue number (e.g., `issue-123-feature.test.ts`)
- Coverage reports: Generate to unique paths (e.g., `coverage/agent-${TASK_ID}/`)

## Environment Setup

### Initial Setup
```bash
# Clone repository
git clone https://github.com/your-org/vsc-wsl-manager.git
cd vsc-wsl-manager

# Install dependencies
npm install

# Install test dependencies
npm install --save-dev @vscode/test-electron @vscode/test-cli mocha @types/mocha chai @types/chai glob rimraf

# Verify setup
npm run compile
npm test
```

### Required Tools
- Node.js 16.x or higher
- npm 7.x or higher
- VS Code 1.74.0 or higher
- Git
- WSL (for integration testing on Windows)

## Testing Instructions

### Running Tests
```bash
# Run all tests with coverage
npm run test:coverage

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Run with watch mode during development
npm run test:watch

# Run automated test loop
npm run automate
```

### Test File Structure
```
src/
  test/
    unit/           # Unit tests (must run in CI)
      wslManager.test.ts
      commandBuilder.test.ts
    integration/    # Integration tests (must run in CI)
      extension.test.ts
    e2e/           # End-to-end UI tests (optional for CI)
      treeView.test.ts
```

### Writing Tests
ALWAYS write tests for:
- Happy path scenarios
- Error cases
- Edge cases
- Security concerns
- Async operations

Example test structure:
```typescript
suite('Component Name', () => {
  setup(() => {
    // Test setup
  });

  teardown(() => {
    // Cleanup
  });

  test('should handle normal case', async () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = await functionUnderTest(input);
    
    // Assert
    expect(result).to.equal('expected');
  });

  test('should handle error case', async () => {
    // Test error handling
    await expect(functionThatThrows()).to.be.rejected;
  });
});
```

### Coverage Verification
```bash
# Generate coverage report
npm run coverage

# View HTML report
open coverage/index.html

# Check coverage in CI
npm run coverage:check
```

## Code Style Guidelines

### TypeScript Standards
```typescript
// ✅ CORRECT: Clear, typed, documented
export interface Distribution {
  name: string;
  state: 'Running' | 'Stopped';
  version: number;
  isDefault: boolean;
}

// ❌ WRONG: Unclear, untyped
export const distro = {
  n: '',
  s: 0
};
```

### Async/Await Pattern
ALWAYS use async/await instead of callbacks:
```typescript
// ✅ CORRECT
async function executeCommand(cmd: string): Promise<string> {
  try {
    const result = await promisifiedExec(cmd);
    return result.stdout;
  } catch (error) {
    throw new CommandError(`Failed to execute: ${cmd}`, error);
  }
}

// ❌ WRONG
function executeCommand(cmd: string, callback: (err: any, result: any) => void) {
  exec(cmd, callback);
}
```

### Security Requirements
**CRITICAL SECURITY RULE**: NEVER use `exec()` or `execSync()`
```typescript
// ✅ CORRECT: Using spawn for security
import { spawn } from 'child_process';

export class CommandBuilder {
  execute(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args);
      // Handle process...
    });
  }
}

// ❌ WRONG: Security vulnerability!
import { exec } from 'child_process';
exec(`wsl ${userInput}`); // Command injection risk!
```

### Error Handling
All errors must be:
- Properly typed
- Contain helpful messages
- Include context
- Be tested

```typescript
export class WSLNotFoundError extends Error {
  constructor(message: string = 'WSL is not installed on this system') {
    super(message);
    this.name = 'WSLNotFoundError';
  }
}
```

## Workflow Instructions

### Creating New Features
1. **Create test file first**:
   ```bash
   touch src/test/unit/newFeature.test.ts
   ```

2. **Write comprehensive tests** covering all requirements:
   ```typescript
   suite('NewFeature', () => {
     test('should meet requirement 1', () => {
       // Test implementation
     });
   });
   ```

3. **Run tests to ensure they fail**:
   ```bash
   npm test
   # Should see red/failing tests
   ```

4. **Implement minimal code** to pass tests:
   ```bash
   touch src/newFeature.ts
   # Add just enough code
   ```

5. **Verify tests pass**:
   ```bash
   npm test
   # Should see green/passing tests
   ```

6. **Refactor** while keeping tests green

7. **Check coverage**:
   ```bash
   npm run coverage
   # Must be 100%
   ```

8. **Update documentation**:
   - Add JSDoc comments
   - Update README if needed
   - Update AGENTS.md if process changes

### Fixing Bugs
1. **Write test that reproduces the bug FIRST**
2. **Verify test fails** (confirms bug exists)
3. **Fix the code** to make test pass
4. **Add regression tests** to prevent recurrence
5. **Verify all tests pass** with 100% coverage
6. **Document the fix** in comments

### Code Review Checklist
Before submitting PR, verify:
- [ ] Tests written before code
- [ ] 100% test coverage achieved
- [ ] All tests passing
- [ ] No `exec()` usage
- [ ] JSDoc comments complete
- [ ] No console.log statements
- [ ] Error handling comprehensive
- [ ] TypeScript strict mode passes
- [ ] CI pipeline green

## Common Patterns

### Tree Data Provider Pattern
```typescript
export class WSLTreeDataProvider implements vscode.TreeDataProvider<WSLDistribution> {
  private _onDidChangeTreeData = new vscode.EventEmitter<WSLDistribution | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private wslManager: WSLManager) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: WSLDistribution): vscode.TreeItem {
    // Implementation with full testing
  }

  async getChildren(element?: WSLDistribution): Promise<WSLDistribution[]> {
    // Implementation with error handling
  }
}
```

### Command Registration Pattern
```typescript
export function registerCommands(context: vscode.ExtensionContext): void {
  const commands = [
    { id: 'wsl-manager.refresh', handler: handleRefresh },
    { id: 'wsl-manager.create', handler: handleCreate },
  ];

  commands.forEach(({ id, handler }) => {
    const disposable = vscode.commands.registerCommand(id, handler);
    context.subscriptions.push(disposable);
  });
}
```

## File Structure
```
vsc-wsl-manager/
├── src/
│   ├── extension.ts          # Extension entry point
│   ├── wslManager.ts         # Core WSL management logic
│   ├── wslTreeDataProvider.ts # Tree view provider
│   ├── commands/             # Command handlers
│   │   ├── create.ts
│   │   ├── import.ts
│   │   └── export.ts
│   ├── utils/               # Utility functions
│   │   ├── commandBuilder.ts # MUST use spawn, not exec
│   │   └── errorHandler.ts
│   └── test/               # All tests
│       ├── unit/           # Unit tests
│       ├── integration/    # Integration tests
│       └── suite/         # Test suite setup
├── coverage/              # Coverage reports (gitignored)
├── scripts/              # Build and automation scripts
├── .vscode/             # VS Code configuration
├── AGENTS.md           # This file
├── README.md          # User documentation
└── package.json      # Dependencies and scripts
```

## CI/CD Requirements

### Required Checks (ALL must pass)
```yaml
- Compilation: npm run compile
- Linting: npm run lint
- Unit Tests: npm run test:unit
- Integration Tests: npm run test:integration  
- Coverage: npm run coverage:check (must be 100%)
- Security: npm run security:check (no exec usage)
- Documentation: npm run docs:check
```

### Pre-commit Hooks
Install pre-commit hooks to catch issues early:
```bash
npm run setup:hooks
```

This will prevent commits if:
- Tests fail
- Coverage drops below 100%
- Linting errors exist
- Security violations detected

## Security Considerations

### Input Validation
ALWAYS validate and sanitize user input:
```typescript
function validateDistributionName(name: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new ValidationError('Invalid distribution name');
  }
}
```

### Process Execution
- NEVER use `exec()` or `execSync()`
- ALWAYS use `spawn()` with explicit arguments
- NEVER construct shell commands from user input
- ALWAYS validate command arguments

### File System Operations
- Use path.join() for paths, never string concatenation
- Validate file paths are within expected directories
- Use async file operations
- Handle permissions errors gracefully

## Debugging

### VS Code Launch Configuration
```json
{
  "name": "Run Extension",
  "type": "extensionHost",
  "request": "launch",
  "args": ["--extensionDevelopmentPath=${workspaceFolder}"]
}
```

### Test Debugging
```json
{
  "name": "Debug Tests",
  "type": "extensionHost",
  "request": "launch",
  "args": [
    "--extensionDevelopmentPath=${workspaceFolder}",
    "--extensionTestsPath=${workspaceFolder}/out/test/suite/index"
  ]
}
```

## Monitoring and Metrics

Track these metrics:
- Test count (should increase with features)
- Coverage percentage (must be 100%)
- Build time (optimize if > 2 minutes)
- Test execution time (optimize if > 30 seconds)
- Bundle size (keep under 5MB)

## PR Instructions

Title format: `[component] Brief description`
Examples:
- `[wslManager] Add distribution import feature`
- `[tests] Improve commandBuilder coverage`
- `[docs] Update AGENTS.md with new patterns`

Every PR must:
1. Follow TDD (reviewable in commit history)
2. Maintain 100% coverage
3. Pass all CI checks
4. Include documentation updates
5. Have descriptive commit messages

## Common Issues and Solutions

### Issue: Tests timing out
Solution: Increase timeout in test configuration
```typescript
this.timeout(10000); // 10 seconds for async operations
```

### Issue: Coverage dropping on new code
Solution: Write tests FIRST, always

### Issue: Command injection vulnerability
Solution: Use spawn with argument array, never exec

### Issue: Flaky tests
Solution: Properly handle async operations and cleanup

## Remember

- **Tests come first, always**
- **100% coverage is non-negotiable**
- **Document why, not just what**
- **Security over convenience**
- **Clean code over clever code**

When in doubt, ask yourself: "Have I written the test for this yet?"

## Agent-Specific Instructions

### For ChatGPT Codex
- Run all tests mentioned in this file before submitting work
- Use the sandboxed environment for all test execution
- Verify changes work across multiple files before committing
- Generate comprehensive PR descriptions following the format above

### For GitHub Copilot Agents
- Follow branch naming: `copilot/issue-{number}-{description}`
- Wait for human approval before CI/CD runs
- Respond to @copilot mentions in PR reviews
- Use GitHub Actions environment for all testing

### For All Autonomous Agents
1. **Self-Verification**: After implementing, re-read this AGENTS.md and verify compliance
2. **Test Independence**: Ensure your tests don't interfere with parallel agent instances
3. **Complete PRs**: Include all necessary files (code, tests, docs) in single PR
4. **Error Recovery**: If tests fail, analyze and fix autonomously before requesting review

### Agent Performance Metrics
Your work will be evaluated on:
- TDD compliance (tests written first)
- Test coverage (must be 100%)
- Documentation completeness
- Security compliance (no exec() usage)
- PR completeness (no follow-up commits needed)

---

**Version**: 1.0.0  
**Last Updated**: September 2025  
**Agent Compatibility**: ChatGPT Codex, GitHub Copilot Agents, Claude Code, Cursor
**Review this document if**: You're starting work, CI fails, or processes change
