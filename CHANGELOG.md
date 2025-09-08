# Changelog

All notable changes to the VSC WSL Manager extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - 2025-09-08
- **Python E2E Testing Framework**
  - Complete Python-based UI testing using pywinauto
  - WSL to Windows test execution bridge
  - Automatic screenshot capture on test failure
  - Test fixtures for VS Code automation
  - Debug launch script for troubleshooting
  - Multiple test runner scripts for different scenarios

- **WebdriverIO Improvements**
  - Fixed flag conflicts (--disable-extensions with --extensionDevelopmentPath)
  - Improved process cleanup between tests
  - Added Windows-specific configuration (wdio.conf.windows.ts)
  - Fixed path conversion for Windows execution
  - Enhanced error handling and logging

- **Test Infrastructure Fixes**
  - Fixed integration test imports (terminalProfileManager → WSLTerminalProfileManager)
  - Fixed constructor mismatches (added WSLImageManager parameter)
  - Added missing mock definitions
  - Fixed TypeScript compilation errors
  - Improved test timeout handling

### Fixed
- Extension now launches properly with F5 debugging
- Integration tests compile without errors
- Mock implementations match actual class interfaces
- Test cleanup properly kills VS Code processes
- Path handling works correctly across WSL/Windows boundary

## [1.0.0] - 2025-01-10

### Added
- **Core Features**
  - View all WSL distributions in VS Code sidebar with real-time status updates
  - Create new distributions by cloning existing ones
  - Import distributions from TAR files with progress notifications
  - Export distributions to TAR files for backup and sharing
  - Delete distributions with safety confirmation
  - Automatic terminal profile registration for quick access
  - Distribution information display (OS version, kernel, memory usage)
  - Context menu actions for distribution management
  - Refresh command to update distribution list

- **Security**
  - Secure command execution using `child_process.spawn()` instead of `exec()`
  - Comprehensive input validation for all user inputs
  - Path traversal attack prevention with strict validation
  - Rate limiting for all operations to prevent abuse
  - Command whitelisting to restrict WSL operations
  - Secure temporary file handling with proper cleanup
  - Permission prompts for destructive operations
  - Audit logging for security events
  - Error message sanitization to prevent information disclosure

- **Developer Experience**
  - Comprehensive test suite with >80% code coverage
  - Full API documentation generated with TypeDoc
  - TypeScript strict mode for type safety
  - ESLint configuration for code quality
  - Modular architecture with clear separation of concerns
  - Mock-based testing for better test isolation
  - Detailed error messages with recovery suggestions

- **Documentation**
  - Getting Started guide for new users
  - Advanced Usage guide for power users
  - Comprehensive FAQ section
  - Architecture documentation with diagrams
  - Security architecture and threat model
  - Contributing guidelines with code examples
  - API reference documentation

- **CI/CD**
  - GitHub Actions workflow for automated testing
  - Multi-version testing (Node.js 16.x, 18.x, 20.x)
  - Build and package verification workflow
  - Security scanning with multiple tools
  - Release automation workflow
  - Code coverage reporting with Codecov

### Changed
- Replaced all `exec()` calls with secure `spawn()` implementation
- Restructured codebase with proper module organization
- Enhanced error handling with user-friendly messages
- Improved logging with multiple levels and sanitization

### Fixed
- Command injection vulnerabilities in WSL operations
- Path traversal vulnerabilities in file operations
- Unsafe temporary file handling
- Missing input validation on user inputs
- Error messages exposing system information

### Security
- No known vulnerabilities in this release
- All identified security issues from review have been addressed
- Implemented defense-in-depth security model

---

## Version Guidelines

### Version Number Format: MAJOR.MINOR.PATCH

- **MAJOR**: Incompatible API changes
- **MINOR**: Backwards-compatible functionality additions
- **PATCH**: Backwards-compatible bug fixes

### Pre-release Versions
- Alpha: X.X.X-alpha.1
- Beta: X.X.X-beta.1
- Release Candidate: X.X.X-rc.1