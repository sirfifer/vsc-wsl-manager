# VSC WSL Manager - Agent Instructions

## Autonomous Agent Compatibility
This AGENTS.md is designed to work with ChatGPT Codex, GitHub Copilot Agents, and other autonomous AI coding assistants that can work in parallel instances. Instructions are stateless and can be executed independently.

**Agent Recognition**: If you are an autonomous agent (Codex, Copilot Agent, etc.), follow these instructions exactly as written. Each task can be executed independently without affecting other parallel instances.

## Project Overview
VSC WSL Manager is a Visual Studio Code extension for managing Windows Subsystem for Linux (WSL) distributions. It provides a tree view interface for creating, importing, exporting, and managing WSL distributions directly from VS Code.

**Critical Requirements**: 100% test coverage, Test-Driven Development, comprehensive documentation, and security-first implementation.

## Related Documentation
- **[CLAUDE.md](./CLAUDE.md)** - Claude-specific optimizations and configurations
- **[docs/testing/TESTING-RULES.md](./docs/testing/TESTING-RULES.md)** - Mandatory testing rules (NO MOCKS - HARD STOP)
- **[docs/testing/TESTING.md](./docs/testing/TESTING.md)** - Comprehensive testing guide
- **[docs/testing/TESTING-ARCHITECTURE.md](./docs/testing/TESTING-ARCHITECTURE.md)** - Three-level testing architecture
- **[docs/testing/cross-platform-testing-strategy.md](./docs/testing/cross-platform-testing-strategy.md)** - Platform adaptation strategy
- **Hierarchical AGENTS.md** - See subdirectory-specific guidelines:
  - `/src/commands/AGENTS.md` - Command handler implementation patterns
  - `/src/views/AGENTS.md` - Tree view provider patterns

## Development Principles

### Test-Driven Development (TDD) with Real Testing
**MANDATORY**: Follow strict TDD workflow with NO MOCKS for ALL changes:
1. **RED**: Write failing test(s) FIRST using real system calls
2. **GREEN**: Write MINIMAL code to make tests pass
3. **REFACTOR**: Improve code while keeping tests green
4. **NEVER** write implementation code before tests
5. **NEVER** use mocks - all tests must use real implementations

### Three-Level Testing Architecture
**CRITICAL**: All tests follow our three-level architecture (NO MOCKS at any level):

1. **Level 1 (Unit Tests)** - 2-5 seconds
   - Framework: Vitest
   - Real system calls to wsl.exe
   - Real file operations
   - Run: `npm run test:unit`

2. **Level 2 (VS Code API Tests)** - 20-30 seconds
   - Framework: @vscode/test-electron with Xvfb
   - Real VS Code instance (headless in WSL)
   - Full Extension Host access
   - Run: `npm run test:integration`

3. **Level 3 (E2E UI Tests)** - 1-2 minutes
   - Framework: WebdriverIO MCP
   - Real VS Code on Windows
   - Visible UI testing
   - Run: `npm run test:e2e`

Example TDD workflow with Vitest (NO MOCKS):
```typescript
// Step 1: Write failing test with REAL implementation
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('WSLManager.listDistributions', () => {
  it('should return actual WSL distributions', async () => {
    const manager = new WSLManager();
    const result = await manager.listDistributions();

    // Verify against REAL wsl.exe output
    const actualWsl = execSync('wsl.exe --list --quiet', { encoding: 'utf16le' });
    const actualCount = actualWsl.split('\n').filter(line => line.trim()).length;

    expect(result.length).toBe(actualCount);
  });
});

// Step 2: Minimal implementation with REAL WSL calls
class WSLManager {
  async listDistributions(): Promise<Distribution[]> {
    const output = execSync('wsl.exe --list --verbose', { encoding: 'utf16le' });
    // Parse real output
    return this.parseWslOutput(output);
  }
}

// Step 3: Refactor while maintaining real testing
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

## MCP (Model Context Protocol) Integration

### Testing MCP Servers
When building MCP server functionality for this extension:

1. **Server Lifecycle Testing**
   ```typescript
   describe('MCP Server', () => {
     it('should initialize server correctly', async () => {
       const server = new MCPServer();
       await server.start();
       expect(server.isRunning()).toBe(true);
       await server.stop();
     });

     it('should handle shutdown gracefully', async () => {
       // Test graceful shutdown with cleanup
     });
   });
   ```

2. **Tool Implementation Testing**
   - Test each MCP tool independently
   - Verify parameter validation
   - Test error responses
   - Validate response schemas

3. **MCP Endpoint Testing**
   ```typescript
   describe('MCP Endpoints', () => {
     it('should discover available tools', async () => {
       const tools = await mcpClient.listTools();
       expect(tools).toContainEqual({
         name: 'wsl-list',
         description: 'List WSL distributions',
         parameters: expect.any(Object)
       });
     });

     it('should handle concurrent requests', async () => {
       // Test multiple simultaneous MCP requests
     });
   });
   ```

### MCP Integration Requirements
- Mock MCP client connections in unit tests
- Test tool discovery and registration
- Validate request/response schemas match MCP spec
- Test error handling for network issues
- Ensure MCP server doesn't interfere with extension activation

## Testing Framework - Vitest

### Primary Testing Framework
**Vitest** is the primary testing framework (fully compatible with VS Code Test API):

```bash
# Run tests with Vitest
npm test

# Run specific test file
npm test -- wslManager.test.ts

# Run in watch mode for TDD
npm run test:watch

# Check coverage (must be 100%)
npm run coverage

# Run with UI for debugging
npm run test:ui
```

### Fallback Test Runner
For quick validation without dependencies:
```bash
# Simple test runner (no dependencies required)
node test-runner-simple.js
```

### Test File Structure
```
test/
  unit/           # Unit tests (must run in CI)
    *.test.ts     # Vitest test files
  integration/    # Integration tests (must run in CI)
    *.test.ts
  e2e/           # End-to-end UI tests
    *.test.ts
  mocks/         # Shared mocks
    vscode.ts    # VS Code API mocks for Vitest
```

## Test Generation Templates

### Extension Activation Test Template
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { activate, deactivate } from '../../src/extension';

vi.mock('vscode');

describe('Extension Activation', () => {
  let context: vscode.ExtensionContext;

  beforeEach(() => {
    context = {
      subscriptions: [],
      // ... mock context properties
    } as any;
    vi.clearAllMocks();
  });

  it('should activate extension successfully', async () => {
    await activate(context);
    expect(vscode.commands.registerCommand).toHaveBeenCalled();
    // Add specific assertions
  });

  it('should handle activation errors gracefully', async () => {
    // Test error scenarios
  });
});
```

### TreeDataProvider Test Template
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MyTreeProvider } from '../../src/views/myTreeProvider';
import * as vscode from 'vscode';

describe('TreeDataProvider', () => {
  let provider: MyTreeProvider;
  let mockManager: any;

  beforeEach(() => {
    mockManager = {
      listItems: vi.fn().mockResolvedValue([]),
      // ... other mocked methods
    };
    provider = new MyTreeProvider(mockManager);
  });

  it('should return root elements', async () => {
    const children = await provider.getChildren();
    expect(children).toBeDefined();
    // Add specific assertions
  });

  it('should refresh tree on data change', () => {
    const fireSpy = vi.spyOn(provider['_onDidChangeTreeData'], 'fire');
    provider.refresh();
    expect(fireSpy).toHaveBeenCalledWith(undefined);
  });

  it('should handle errors in getChildren', async () => {
    mockManager.listItems.mockRejectedValue(new Error('Test error'));
    const children = await provider.getChildren();
    expect(children).toEqual([]); // Should return empty array on error
  });
});
```

### Command Handler Test Template
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleCreateDistribution } from '../../src/commands/create';
import * as vscode from 'vscode';

describe('Command: Create Distribution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(vscode.window.showInputBox).mockResolvedValue('test-name');
    vi.mocked(vscode.window.showQuickPick).mockResolvedValue({ label: 'Ubuntu' } as any);
  });

  it('should create distribution with user input', async () => {
    await handleCreateDistribution();

    expect(vscode.window.showInputBox).toHaveBeenCalledWith({
      prompt: expect.any(String),
      validateInput: expect.any(Function)
    });
    // Add more assertions
  });

  it('should handle user cancellation', async () => {
    vi.mocked(vscode.window.showInputBox).mockResolvedValue(undefined);
    await handleCreateDistribution();
    // Assert graceful cancellation
  });

  it('should show progress during creation', async () => {
    await handleCreateDistribution();
    expect(vscode.window.withProgress).toHaveBeenCalled();
  });
});
```

### MCP Server Test Template
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MCPServer } from '../../src/mcp/server';

describe('MCP Server', () => {
  let server: MCPServer;

  beforeEach(async () => {
    server = new MCPServer();
    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  it('should register WSL management tools', () => {
    const tools = server.getTools();
    expect(tools).toContainEqual({
      name: 'list-distributions',
      description: expect.any(String),
      parameters: expect.any(Object)
    });
  });

  it('should handle tool invocation', async () => {
    const result = await server.invokeTool('list-distributions', {});
    expect(result).toHaveProperty('distributions');
  });

  it('should validate tool parameters', async () => {
    await expect(
      server.invokeTool('create-distribution', { name: '' })
    ).rejects.toThrow('Invalid distribution name');
  });
});
```

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

# Install Vitest and VS Code test dependencies
npm install --save-dev vitest @vitest/ui @vscode/test-electron

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
   touch test/unit/newFeature.test.ts
   ```

2. **Write comprehensive tests** covering all requirements:
   ```typescript
   import { describe, it, expect } from 'vitest';

   describe('NewFeature', () => {
     it('should meet requirement 1', () => {
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
│   ├── mcp/                 # MCP server implementation
│   │   ├── server.ts
│   │   └── tools.ts
│   ├── commands/            # Command handlers (see AGENTS.md)
│   │   ├── create.ts
│   │   ├── import.ts
│   │   └── export.ts
│   ├── views/              # View providers (see AGENTS.md)
│   │   └── treeProviders.ts
│   └── utils/              # Utility functions
│       ├── commandBuilder.ts # MUST use spawn, not exec
│       └── errorHandler.ts
├── test/                   # All tests (see AGENTS.md)
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── mocks/            # Shared mocks
├── coverage/             # Coverage reports (gitignored)
├── scripts/             # Build and automation scripts
├── .vscode/            # VS Code configuration
├── AGENTS.md          # This file
├── README.md         # User documentation
└── package.json     # Dependencies and scripts
```

## CI/CD Requirements

### Required Checks (ALL must pass)
```yaml
- Compilation: npm run compile
- Linting: npm run lint
- Unit Tests: npm test
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

### Test Debugging with Vitest
```json
{
  "name": "Debug Vitest Tests",
  "type": "node",
  "request": "launch",
  "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
  "args": ["run", "${file}"],
  "console": "integratedTerminal"
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
describe('Slow test', () => {
  it('should handle long operation', async () => {
    // Test implementation
  }, 10000); // 10 second timeout
});
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

### For Claude Code
- Refer to [CLAUDE.md](./CLAUDE.md) for Claude-specific optimizations
- Use MCP integration for enhanced tool capabilities
- Follow test-first approach rigorously

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

**Version**: 2.0.0
**Last Updated**: December 2024
**Agent Compatibility**: ChatGPT Codex, GitHub Copilot Agents, Claude Code, Cursor
**Review this document if**: You're starting work, CI fails, or processes change