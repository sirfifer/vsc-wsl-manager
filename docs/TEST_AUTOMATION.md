# VSCode Extension Test Automation Setup

## Overview
This test automation system enables continuous iteration and testing for the VSC WSL Manager extension. It allows for rapid development cycles with automated testing, error analysis, and fix suggestions.

## Components

### 1. Test Infrastructure (`src/test/`)
- **runTest.ts**: VS Code test runner using @vscode/test-electron
- **suite/index.ts**: Mocha test suite loader
- **suite/extension.test.ts**: Main VS Code extension tests

### 2. Automation Harness (`src/test/automation/`)
- **testHarness.ts**: Core automation engine with:
  - Compilation checking
  - Test execution
  - Requirement validation
  - Error analysis
  - Fix request generation

### 3. Automation Scripts (`scripts/`)
- **automate-testing.ts**: Full automation loop (up to 50 iterations)
- **quick-test.ts**: Quick validation of core functionality

## Available Commands

```bash
# Quick validation (recommended for fast feedback)
npm run quick-test

# Full automation loop (iterates until all tests pass)
npm run automate

# Alias for automation
npm run fix-iteration

# Run VS Code extension tests
npm run test:vscode

# Standard Jest tests
npm test
```

## How It Works

### Automation Loop
1. **Compile** - Checks TypeScript compilation
2. **Test** - Runs test suite
3. **Validate** - Checks requirements are met
4. **Analyze** - If failures, generates `.fix-request.json`
5. **Iterate** - Repeats until success or max attempts

### Quick Test Validation
The quick test validates:
- ✅ TypeScript compilation
- ✅ Essential files exist
- ✅ No security vulnerabilities (no exec() usage)
- ✅ Input validation is implemented

## Fix Request System

When tests fail, the automation creates `.fix-request.json`:
```json
{
  "iteration": 1,
  "errors": ["Error details..."],
  "timestamp": "2024-01-01T00:00:00.000Z",
  "suggestions": [
    "Check import statements and file paths",
    "Ensure CommandBuilder is using spawn() not exec()"
  ]
}
```

## Monitoring Progress

The automation creates `test-automation.log` with:
- Iteration attempts
- Compilation results
- Test results
- Requirement pass/fail status
- Error details

## Success Criteria

The extension is considered working when:
1. ✅ Compiles without errors
2. ✅ All essential files exist
3. ✅ No security vulnerabilities
4. ✅ Input validation is implemented
5. ✅ Tests pass successfully

## Usage for Continuous Development

### Initial Setup
```bash
# Install dependencies (already done)
npm install

# Verify setup
npm run quick-test
```

### Development Workflow
1. Make changes to source code
2. Run `npm run quick-test` for fast validation
3. Run `npm run automate` for full testing loop
4. Check `.fix-request.json` if tests fail
5. Fix issues and repeat

### Manual Testing
```bash
# Compile only
npm run compile

# Run Jest tests
npm test

# Run with watch mode
npm run test:watch

# Test in VS Code
Press F5 in VS Code
```

## MCP Configuration

The project includes MCP configuration (`.vscode/mcp.json`) for enhanced development with Claude Code:
```json
{
  "servers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "${workspaceFolder}"]
    }
  }
}
```

## Troubleshooting

### Tests hang
- Adjust timeout in `testHarness.ts`
- Use `npm run quick-test` instead of full automation

### Compilation fails
- Check TypeScript errors: `npx tsc --noEmit`
- Verify all imports are correct

### VS Code tests fail
- Ensure VS Code is not already running the extension
- Check launch.json configuration

## Next Steps

With the automation setup complete:
1. ✅ Core test infrastructure is ready
2. ✅ Automation harness can iterate on failures
3. ✅ Quick validation ensures basic functionality
4. ✅ Fix request system guides development

You can now use this system for rapid, iterative development with immediate feedback on what needs fixing.