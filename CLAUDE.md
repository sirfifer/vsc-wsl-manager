# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Build and Development
- **Build**: `npm run compile` - Compiles TypeScript to JavaScript
- **Watch**: `npm run watch` - Watches for changes and recompiles automatically
- **Lint**: `npm run lint` - Runs ESLint on TypeScript files
- **Pre-publish**: `npm run vscode:prepublish` - Runs before publishing to marketplace

### Testing
- **All tests**: `npm test` - Runs all Jest tests
- **Unit tests only**: `npm run test:unit` - Runs tests in test/unit/
- **Integration tests only**: `npm run test:integration` - Runs tests in test/integration/
- **Coverage**: `npm run test:coverage` - Generates coverage report
- **Watch mode**: `npm run test:watch` - Runs tests in watch mode
- **Single test file**: `npx jest path/to/test.ts` - Run specific test file

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

## Testing Strategy

- **Mocks**: VS Code API is mocked in `test/mocks/vscode.ts`
- **Test data generators**: Use `test/utils/testDataGenerators.ts` for consistent test data
- **Coverage threshold**: 80% for all metrics (branches, functions, lines, statements)
- **Security tests**: Dedicated security test suite in `test/security/`

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

## Ignore

- ignore the claude-personas folder