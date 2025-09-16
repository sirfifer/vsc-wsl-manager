# Test Directory - Agent Instructions

## Overview
This directory contains all test files for the VSC WSL Manager extension. Tests here follow strict TDD principles and use Vitest as the primary testing framework.

## Test Organization

### Directory Structure
```
test/
├── unit/                  # Isolated unit tests
│   ├── *.test.ts         # Individual component tests
│   └── mcp/              # MCP-specific unit tests
├── integration/          # Component integration tests
│   └── *.test.ts        # Multi-component interaction tests
├── e2e/                 # End-to-end tests
│   └── *.test.ts       # Full workflow tests
└── mocks/              # Shared mock implementations
    ├── vscode.ts       # VS Code API mocks
    └── wsl.ts         # WSL command mocks
```

## Writing Tests - Vitest Patterns

### Test File Naming
- Unit tests: `{component}.test.ts`
- Integration tests: `{feature}.integration.test.ts`
- E2E tests: `{workflow}.e2e.test.ts`

### Standard Test Structure
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Component/Feature Name', () => {
  // Setup
  beforeEach(() => {
    vi.clearAllMocks();
    // Component-specific setup
  });

  // Teardown
  afterEach(() => {
    // Cleanup resources
  });

  describe('method/functionality', () => {
    it('should handle normal case', async () => {
      // Arrange
      const input = 'test';

      // Act
      const result = await functionUnderTest(input);

      // Assert
      expect(result).toBe('expected');
    });

    it('should handle error case', async () => {
      // Test error scenarios
      await expect(functionThatThrows()).rejects.toThrow('Expected error');
    });

    it('should handle edge case', () => {
      // Test boundaries and special cases
    });
  });
});
```

## VS Code Extension Testing Specifics

### Mocking VS Code API
```typescript
import { vi } from 'vitest';

// Mock entire vscode module
vi.mock('vscode', () => ({
  window: {
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    showInputBox: vi.fn(),
    createTerminal: vi.fn(),
    createTreeView: vi.fn()
  },
  commands: {
    registerCommand: vi.fn(),
    executeCommand: vi.fn()
  },
  EventEmitter: vi.fn(() => ({
    fire: vi.fn(),
    event: vi.fn()
  }))
}));
```

### Testing Tree Data Providers
```typescript
describe('TreeDataProvider', () => {
  it('should provide children for root', async () => {
    const provider = new MyTreeProvider();
    const children = await provider.getChildren();

    expect(children).toHaveLength(expectedCount);
    expect(children[0]).toMatchObject({
      label: expect.any(String),
      collapsibleState: expect.any(Number)
    });
  });

  it('should refresh on data change', () => {
    const provider = new MyTreeProvider();
    const fireSpy = vi.spyOn(provider['_onDidChangeTreeData'], 'fire');

    provider.refresh();

    expect(fireSpy).toHaveBeenCalledWith(undefined);
  });
});
```

### Testing Commands
```typescript
describe('Command Registration', () => {
  it('should register all commands', () => {
    const context = createMockContext();

    registerCommands(context);

    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      'wsl-manager.refreshDistributions',
      expect.any(Function)
    );
    // Check all other commands...
  });
});
```

## MCP Server Testing

### Testing MCP Tool Registration
```typescript
describe('MCP Tools', () => {
  it('should register WSL management tools', () => {
    const server = new MCPServer();
    const tools = server.getTools();

    expect(tools).toContainEqual({
      name: 'list-distributions',
      description: expect.any(String),
      parameters: {
        type: 'object',
        properties: expect.any(Object)
      }
    });
  });
});
```

### Testing MCP Request Handling
```typescript
describe('MCP Request Handler', () => {
  it('should handle tool invocation', async () => {
    const handler = new MCPRequestHandler();
    const result = await handler.invoke('list-distributions', {});

    expect(result).toHaveProperty('distributions');
    expect(result.distributions).toBeInstanceOf(Array);
  });
});
```

## Test Coverage Requirements

### Coverage Targets
- **100%** for all metrics:
  - Statements
  - Branches
  - Functions
  - Lines

### Checking Coverage
```bash
# Run tests with coverage
npm run coverage

# View HTML report
open coverage/index.html
```

### Coverage Exceptions
**NONE** - Every line of code must be tested. No exceptions.

## Test Data and Fixtures

### Using Test Fixtures
```typescript
// test/fixtures/distributions.ts
export const validDistribution = {
  name: 'Ubuntu-22.04',
  state: 'Running',
  version: 2,
  default: true
};

// In test file
import { validDistribution } from '../fixtures/distributions';

it('should handle valid distribution', () => {
  const result = processDistribution(validDistribution);
  expect(result).toBeDefined();
});
```

### Generating Test Data
```typescript
// Use builders for complex data
class DistributionBuilder {
  private distribution = { ...defaultDistribution };

  withName(name: string): this {
    this.distribution.name = name;
    return this;
  }

  build(): Distribution {
    return { ...this.distribution };
  }
}
```

## Async Testing Patterns

### Testing Promises
```typescript
it('should handle async operation', async () => {
  const result = await asyncFunction();
  expect(result).toBe('expected');
});

it('should handle async rejection', async () => {
  await expect(asyncFunctionThatRejects()).rejects.toThrow('Error message');
});
```

### Testing with Timeouts
```typescript
it('should complete within timeout', async () => {
  const result = await longRunningOperation();
  expect(result).toBeDefined();
}, 10000); // 10 second timeout
```

## Security Testing

### Command Injection Prevention
```typescript
describe('Security', () => {
  it('should prevent command injection', () => {
    const maliciousInput = '; rm -rf /';

    expect(() => {
      executeCommand(maliciousInput);
    }).toThrow('Invalid input');
  });

  it('should use spawn instead of exec', () => {
    // Verify no exec usage in codebase
    const sourceCode = fs.readFileSync(filePath, 'utf8');
    expect(sourceCode).not.toContain('exec(');
    expect(sourceCode).not.toContain('execSync(');
  });
});
```

## Error Handling Tests

### Testing Error Scenarios
```typescript
describe('Error Handling', () => {
  it('should handle WSL not installed', async () => {
    vi.mocked(commandExists).mockResolvedValue(false);

    await expect(wslManager.listDistributions()).rejects.toThrow(
      'WSL is not installed'
    );
  });

  it('should provide helpful error messages', async () => {
    const error = new WSLError('Distribution not found');

    expect(error.message).toContain('not found');
    expect(error.suggestions).toContain('Install a distribution');
  });
});
```

## Performance Testing

### Testing Performance Requirements
```typescript
describe('Performance', () => {
  it('should list distributions quickly', async () => {
    const startTime = Date.now();
    await wslManager.listDistributions();
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(1000); // Under 1 second
  });
});
```

## Test Isolation

### Ensuring Test Independence
```typescript
describe('Isolated Tests', () => {
  let tempDir: string;

  beforeEach(() => {
    // Create unique temp directory for this test
    tempDir = `/tmp/test-${Date.now()}-${Math.random()}`;
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should work in isolation', () => {
    // Test using tempDir
  });
});
```

## Common Testing Pitfalls to Avoid

1. **Don't test implementation details** - Test behavior, not internal structure
2. **Don't share state between tests** - Each test should be independent
3. **Don't ignore async behavior** - Always await promises
4. **Don't skip error cases** - Test all error paths
5. **Don't hardcode paths** - Use path.join and temp directories
6. **Don't leave resources open** - Clean up in afterEach

## Running Specific Tests

```bash
# Run single test file
npm test -- wslManager.test.ts

# Run tests matching pattern
npm test -- --grep "listDistributions"

# Run only unit tests
npm test test/unit

# Run in watch mode for TDD
npm run test:watch

# Run with UI for debugging
npm run test:ui
```

## Debugging Tests

### Using VS Code Debugger
1. Set breakpoints in test files
2. Use "Debug Vitest Tests" launch configuration
3. Step through test execution

### Console Debugging
```typescript
it('should debug this test', () => {
  console.log('Value:', someValue);
  // Temporarily add console.log for debugging
  // Remember to remove before commit!
});
```

## Test Review Checklist

Before committing tests:
- [ ] All tests pass locally
- [ ] 100% coverage maintained
- [ ] No `.only` or `.skip` modifiers
- [ ] No hardcoded values
- [ ] Proper cleanup in afterEach
- [ ] Meaningful test descriptions
- [ ] Tests are independent
- [ ] No console.log statements
- [ ] Security cases tested
- [ ] Error cases tested

## Remember

- **Write tests FIRST** - TDD is mandatory
- **Test behavior, not implementation** - Focus on what, not how
- **Each test should be independent** - No shared state
- **Clean up after yourself** - Use afterEach for cleanup
- **Test the sad path** - Errors are as important as success

---

**Parent Document**: [/AGENTS.md](../../AGENTS.md)
**Test Framework**: Vitest
**Coverage Requirement**: 100%