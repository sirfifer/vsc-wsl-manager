# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## CRITICAL: Mandatory End-to-End Validation

**YOU MUST COMPLETE ALL THESE STEPS BEFORE DECLARING WORK DONE. NO EXCEPTIONS.**

### Step 1: Clean Build (MANDATORY)
```bash
npm run clean
npm run compile
```

### Step 2: Verify Build Output (MANDATORY)
```bash
ls -la out/
# Ensure NO old files exist (like terminalProfileManager.js)
# Verify package.json "main" points to correct file (usually ./out/src/extension.js)
```

### Step 3: Run All Tests (MANDATORY - Three-Level Architecture)
```bash
# Level 1: Unit tests with real system calls (2-5 seconds)
npm run test:unit

# Level 2: VS Code API tests with real Extension Host (20-30 seconds)
npm run test:integration

# Level 3: E2E UI tests on Windows (optional but recommended)
npm run test:e2e

# Or run all three levels:
npm run test:all

# All tests MUST pass - NO MOCKS allowed
```

### Step 4: VS Code Launch Test (MANDATORY)
```bash
# Launch extension in VS Code
code --extensionDevelopmentPath=. --new-window
# OR press F5 in VS Code
```

### Step 4a: Python E2E UI Testing (RECOMMENDED)
```bash
# Run Python-based E2E tests (runs on Windows from WSL)
npm run test:e2e:python

# Run specific test suites
npm run test:e2e:python:activation
npm run test:e2e:python:commands

# Run single test for debugging
./scripts/run-single-python-test.sh

# Clean test artifacts
npm run test:e2e:python:clean
```

**Python E2E Testing Requirements:**
- Project MUST be located under `/mnt/c/...` (Windows-accessible path)
- Python must be installed on Windows
- VS Code must be installed on Windows
- Tests will launch VS Code on Windows while running from WSL

### Step 4b: WebdriverIO UI Testing (ALTERNATIVE)
```bash
# Run WebdriverIO tests (if Python tests fail)
npm run test:e2e:windows

# Note: WebdriverIO may have issues with extension loading
# Prefer Python E2E tests for more reliable results
```

### Step 5: Functional Testing (MANDATORY)
In the launched VS Code instance:
1. Open Debug Console (Ctrl+Shift+Y)
2. Verify "WSL Manager extension is now active!" appears
3. Verify NO permission errors
4. Test EVERY command:
   - Refresh Distributions (Ctrl+Shift+P → "WSL: Refresh")
   - Create Distribution (should show appropriate error if no base distro)
   - Import Distribution (should allow file selection)
   - Open Terminal (if distributions exist)

### Step 6: Error Scenario Testing (MANDATORY)
1. Try to create distribution with invalid name (e.g., "my distro" with space)
2. Try to create with non-existent base (e.g., selecting Ubuntu when not installed)
3. Verify errors show proper type (NOT "UNKNOWN")
4. Verify error messages are user-friendly

### Step 7: Console Verification (MANDATORY)
Check Debug Console for:
- NO permission errors (especially "Failed to update terminal profiles")
- NO unhandled exceptions
- Proper error types (DISTRIBUTION_NOT_FOUND, not UNKNOWN)
- Clean activation without errors

**If ANY step fails:** 
- Fix the issue
- Start over from Step 1
- DO NOT proceed without ALL steps passing
- DO NOT hand over to user until fully validated

## Commands

### Build and Development
- **Build**: `npm run compile` - Compiles TypeScript to JavaScript
- **Watch**: `npm run watch` - Watches for changes and recompiles automatically
- **Lint**: `npm run lint` - Runs ESLint on TypeScript files
- **Pre-publish**: `npm run vscode:prepublish` - Runs before publishing to marketplace

### Testing (Three-Level Architecture - NO MOCKS)
- **Level 1 - Unit Tests**: `npm run test:unit` - Real system calls with Vitest (2-5 seconds)
- **Level 2 - API Tests**: `npm run test:integration` - Real VS Code instance with Xvfb (20-30 seconds)
- **Level 3 - E2E Tests**: `npm run test:e2e` - Full UI testing on Windows (1-2 minutes)
- **All Levels**: `npm run test:all` - Complete three-level validation
- **Coverage**: `npm run test:coverage` - Real test coverage (80% min, 100% critical)
- **Watch mode**: `npm run test:unit:watch` - TDD mode with real tests
- **Security**: `npm run test:security` - Real security validation

### Documentation
- **Generate docs**: `npm run docs` - Generates TypeDoc API documentation
- **Watch docs**: `npm run docs:watch` - Regenerates docs on changes

## Architecture

This VS Code extension follows a layered architecture:

1. **Presentation Layer**: Commands, Tree View, Terminal Profiles
2. **Business Logic Layer**: WSLManager, TerminalProfileManager, SecurityValidator
3. **Utility Layer**: CommandBuilder, InputValidator, ErrorHandler
4. **System Layer**: WSL.exe integration, File System, VS Code API

### Core Components

- **WSLManager** (`src/wslManager.ts`): Central component for WSL operations. Uses CommandBuilder to safely construct WSL commands and handles all distribution management.
- **SecurityValidator** (`src/security/securityValidator.ts`): Singleton that enforces rate limiting and validates operations. All destructive operations go through this validator.
- **InputValidator** (`src/utils/inputValidator.ts`): Validates and sanitizes all user inputs to prevent command injection and path traversal attacks.
- **ErrorHandler** (`src/errors/errorHandler.ts`): Provides user-friendly error messages with recovery suggestions. Uses custom WSLError class with error types.

### Command Execution Pattern

All WSL commands follow this secure pattern:
1. Input validation via InputValidator
2. Security checks via SecurityValidator (rate limiting, permissions)
3. Command construction via CommandBuilder (prevents injection)
4. Execution with timeouts and proper error handling
5. User-friendly error display via ErrorHandler

## Testing Strategy (Three-Level Real Testing)

- **NO MOCKS**: All tests use real implementations - no mocking allowed
- **Three-Level Architecture**: Unit (5s) → API (30s) → E2E (2min)
- **Real test data**: Use actual WSL distributions and real file operations
- **Coverage threshold**: 80% minimum (branches, functions, lines, statements), 100% for critical paths
- **Security tests**: Real security validation in `test/security/`
- **Test documentation**: Complete guides in `docs/testing/`

### Testing Documentation
- **Main Guide**: [docs/testing/TESTING.md](docs/testing/TESTING.md)
- **Architecture**: [docs/testing/TESTING-ARCHITECTURE.md](docs/testing/TESTING-ARCHITECTURE.md)
- **Mandatory Rules**: [docs/testing/TESTING-RULES.md](docs/testing/TESTING-RULES.md)
- **Cross-Platform**: [docs/testing/cross-platform-testing-strategy.md](docs/testing/cross-platform-testing-strategy.md)

## Important Context

### WSL Integration
- Uses `wsl.exe` for all operations (list, create, import, export, delete)
- Supports WSL 2 only (Windows 10/11 requirement)
- Long operations (import/export) have 5-minute timeouts
- Distribution names are sanitized to prevent command injection

### VS Code Extension Specifics
- Tree view refreshes automatically after operations
- Terminal profiles are registered dynamically for each distribution
- Uses VS Code's built-in progress notifications for long operations
- Configuration is stored in VS Code settings (wsl-manager.*)

### Security First Design
- All user inputs are validated and sanitized
- Rate limiting prevents abuse (configurable per operation)
- Destructive operations require explicit confirmation
- Security events can be logged for auditing
- Uses `child_process.spawn()` instead of `exec()` for safety

## Troubleshooting

### Python E2E Tests
- **VS Code crashes**: Remove `--disable-extensions` flag conflict in vscode_helper.py
- **Tests timeout**: Increase timeout in conftest.py or test files
- **Path errors**: Ensure project is under /mnt/c/ not ~/
- **Import errors**: Run `cmd.exe /c "pip install -r test\\e2e-python\\requirements.txt"`

### WebdriverIO Tests
- **Extension not loading**: Check for flag conflicts (--disable-extensions with --extensionDevelopmentPath)
- **Multiple windows open**: Ensure proper cleanup in conftest.py
- **ChromeDriver version mismatch**: Install matching version for VS Code

### Test Failures
- **Integration tests fail**: Check mock imports match actual file paths
- **Constructor mismatches**: Verify all dependencies are mocked properly
- **TypeScript errors**: Run `npx tsc --noEmit` to check compilation

## Ignore

- ignore the claude-personas folder