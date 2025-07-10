# Contributing to VSC WSL Manager

First off, thank you for considering contributing to VSC WSL Manager! It's people like you that make this extension better for everyone.

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code:

- **Be respectful and inclusive** - Welcome all contributors regardless of background
- **Be patient** - Remember that everyone was new once
- **Be constructive** - Focus on helping the project improve
- **Be collaborative** - Work together to solve problems

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

**Bug Report Template:**
```markdown
**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
 - OS: [e.g. Windows 11 22H2]
 - VS Code Version: [e.g. 1.80.0]
 - Extension Version: [e.g. 1.0.0]
 - WSL Version: [run `wsl --version`]
 - Distribution: [e.g. Ubuntu 22.04]

**Logs**
Attach relevant logs from Output panel (WSL Manager channel)

**Additional context**
Add any other context about the problem here.
```

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- **Use case**: Why is this enhancement needed?
- **Proposed solution**: How do you envision it working?
- **Alternatives considered**: What other solutions did you consider?
- **Additional context**: Mockups, examples, etc.

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes
5. Make sure your code follows the existing style
6. Issue that pull request!

## Development Setup

### Prerequisites

- Windows 10/11 with WSL 2
- Node.js 16.x or later
- npm 7.x or later
- VS Code
- Git

### Setting Up Your Development Environment

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/your-username/vsc-wsl-manager.git
   cd vsc-wsl-manager
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the extension**
   ```bash
   npm run compile
   ```

4. **Run tests**
   ```bash
   npm test
   ```

5. **Run the extension in development mode**
   - Open the project in VS Code
   - Press `F5` to open a new Extension Development Host window
   - The extension will be available in the new window

### Development Workflow

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-number-description
   ```

2. **Make your changes**
   - Write code following our style guide
   - Add/update tests as needed
   - Update documentation

3. **Test your changes**
   ```bash
   # Run all tests
   npm test
   
   # Run tests with coverage
   npm run test:coverage
   
   # Run specific test file
   npm test -- wslManager.test.ts
   
   # Run in watch mode
   npm run test:watch
   ```

4. **Lint your code**
   ```bash
   npm run lint
   
   # Auto-fix some issues
   npm run lint -- --fix
   ```

5. **Build and verify**
   ```bash
   npm run compile
   ```

6. **Generate documentation**
   ```bash
   npm run docs
   ```

## Style Guide

### TypeScript Style Guide

We follow the standard TypeScript style guide with these specific requirements:

- **Indentation**: 4 spaces (not tabs)
- **Quotes**: Single quotes for strings
- **Semicolons**: Always use semicolons
- **Line length**: 120 characters max
- **File naming**: camelCase for files, PascalCase for classes
- **Async/Await**: Prefer over Promise chains
- **Type annotations**: Always include return types

Example:
```typescript
/**
 * Example class showing our code style
 */
export class ExampleClass {
    private readonly timeout: number = 30000;
    private readonly logger = Logger.getInstance();
    
    /**
     * Document all public methods
     * 
     * @param name - Parameter description
     * @returns Description of return value
     * @throws {ValidationError} When input is invalid
     * 
     * @example
     * ```typescript
     * const example = new ExampleClass();
     * await example.doSomething('test');
     * ```
     */
    public async doSomething(name: string): Promise<void> {
        // Validate inputs first
        const validation = InputValidator.validateName(name);
        if (!validation.isValid) {
            throw new ValidationError(validation.error);
        }
        
        const startTime = Date.now();
        this.logger.info('Starting operation', { name });
        
        try {
            await this.performAction(validation.sanitizedValue!);
            this.logger.performance('Operation completed', Date.now() - startTime);
        } catch (error) {
            this.logger.error('Operation failed', error);
            throw new Error(`Operation failed: ${error.message}`);
        }
    }
    
    private async performAction(name: string): Promise<void> {
        // Implementation
    }
}
```

### Security Guidelines

**All contributions must follow these security practices:**

1. **Input Validation**: Always validate and sanitize user inputs
   ```typescript
   const validation = InputValidator.validateDistributionName(userInput);
   if (!validation.isValid) {
       throw new Error(validation.error);
   }
   ```

2. **Command Execution**: Use CommandBuilder with spawn()
   ```typescript
   // NEVER do this:
   exec(`wsl --list ${userInput}`);
   
   // ALWAYS do this:
   await CommandBuilder.executeWSL(['--list', sanitizedInput]);
   ```

3. **Path Handling**: Validate paths to prevent traversal
   ```typescript
   const pathValidation = InputValidator.validateFilePath(userPath, {
       basePath: '/allowed/directory'
   });
   ```

4. **Error Messages**: Don't expose sensitive information
   ```typescript
   // Bad: Exposes system paths
   throw new Error(`Failed to read /home/user/.ssh/config: ${error}`);
   
   // Good: Generic message
   throw new Error('Failed to read configuration file');
   ```

5. **Rate Limiting**: Implement for resource-intensive operations

### Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only changes
- `style`: Code style changes (formatting, missing semicolons, etc)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding missing tests or correcting existing tests
- `build`: Changes that affect the build system or external dependencies
- `ci`: Changes to CI configuration files and scripts
- `chore`: Other changes that don't modify src or test files

**Examples:**
```
feat(wsl): add distribution cloning functionality

- Implement createDistribution method
- Add progress notifications during clone
- Update tree view after creation
- Add input validation for distribution names

Closes #123
```

```
fix(terminal): correct profile registration for distributions with spaces

Previously, distributions with spaces in names would fail to create
proper terminal profiles. This fix properly escapes the distribution
name when creating the profile configuration.

- Add proper escaping for distribution names
- Update tests to cover edge cases
- Add validation for terminal profile names

Fixes #456
```

```
docs(readme): add troubleshooting section for WSL installation

- Add common WSL installation issues
- Include solutions for each issue
- Add links to official Microsoft documentation
```

## Testing

### Test Requirements

- **Coverage**: Maintain minimum 80% code coverage
- **Isolation**: Tests should not depend on system state
- **Clarity**: Use descriptive test names
- **Completeness**: Test both success and failure cases

### Writing Tests

**Unit Test Example:**
```typescript
describe('WSLManager', () => {
    let wslManager: WSLManager;
    let mockSecurityValidator: jest.Mocked<SecurityValidator>;
    
    beforeEach(() => {
        jest.clearAllMocks();
        mockSecurityValidator = createMockSecurityValidator();
        wslManager = new WSLManager();
    });
    
    afterEach(() => {
        jest.restoreAllMocks();
    });
    
    describe('listDistributions', () => {
        it('should return array of distributions when WSL is installed', async () => {
            // Arrange
            const expectedDistributions = [
                createMockDistribution({ name: 'Ubuntu', state: 'Running' }),
                createMockDistribution({ name: 'Debian', state: 'Stopped' })
            ];
            mockCommandOutput(formatWSLListOutput(expectedDistributions));
            
            // Act
            const result = await wslManager.listDistributions();
            
            // Assert
            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({
                name: 'Ubuntu',
                state: 'Running'
            });
            expect(mockSecurityValidator.validateCommand).toHaveBeenCalledWith(
                expect.objectContaining({
                    command: 'list',
                    args: ['--list', '--verbose']
                })
            );
        });
        
        it('should throw WSLError when WSL is not installed', async () => {
            // Arrange
            mockWSLNotInstalled();
            
            // Act & Assert
            await expect(wslManager.listDistributions()).rejects.toThrow(WSLError);
            await expect(wslManager.listDistributions()).rejects.toMatchObject({
                type: ErrorType.WSL_NOT_INSTALLED,
                recoveryActions: expect.arrayContaining([
                    expect.stringContaining('Install WSL')
                ])
            });
        });
        
        it('should return empty array when security validation fails', async () => {
            // Arrange
            mockSecurityValidator.validateCommand.mockResolvedValue({
                allowed: false,
                reason: 'Rate limit exceeded'
            });
            
            // Act
            const result = await wslManager.listDistributions();
            
            // Assert
            expect(result).toEqual([]);
            expect(logger.security).toHaveBeenCalledWith(
                'List command blocked',
                expect.objectContaining({ reason: 'Rate limit exceeded' })
            );
        });
    });
});
```

**Integration Test Example:**
```typescript
describe('Extension Integration', () => {
    let extension: vscode.Extension<any>;
    
    beforeAll(async () => {
        extension = vscode.extensions.getExtension('your-publisher.wsl-manager')!;
        await extension.activate();
    });
    
    it('should register all expected commands', () => {
        const commands = [
            'wsl-manager.refreshDistributions',
            'wsl-manager.createDistribution',
            'wsl-manager.importDistribution',
            'wsl-manager.exportDistribution',
            'wsl-manager.deleteDistribution',
            'wsl-manager.openTerminal'
        ];
        
        commands.forEach(cmd => {
            expect(vscode.commands.getCommands()).resolves.toContain(cmd);
        });
    });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run in watch mode for TDD
npm run test:watch

# Run specific test file
npm test -- wslManager.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="should validate"
```

## Documentation

### Code Documentation Requirements

1. **All public APIs must have JSDoc comments**
2. **Include @example sections for complex methods**
3. **Document all parameters with @param**
4. **Document return values with @returns**
5. **Document exceptions with @throws**
6. **Add @remarks for important notes**
7. **Use @deprecated when phasing out APIs**

### Updating Documentation

When making changes:

1. **Update README.md** if adding user-facing features
2. **Update API docs**: Run `npm run docs` after changes
3. **Update guides** in `docs/guides/` if behavior changes
4. **Update CHANGELOG.md** with your changes
5. **Add screenshots** for UI changes

### Documentation Example:

```typescript
/**
 * Imports a TAR file as a new WSL distribution
 * 
 * @param name - Name for the imported distribution (must be unique)
 * @param tarPath - Path to the TAR file to import
 * @param installLocation - Optional custom installation directory
 * 
 * @returns Promise that resolves when import is complete
 * 
 * @throws {ValidationError} When inputs are invalid
 * @throws {WSLError} When distribution already exists
 * @throws {Error} When import operation fails
 * 
 * @remarks
 * - The TAR file must be a valid WSL distribution export
 * - Large files may take several minutes to import
 * - Requires sufficient disk space at the installation location
 * 
 * @example
 * ```typescript
 * // Import with default location
 * await wslManager.importDistribution('my-ubuntu', '/downloads/ubuntu.tar');
 * 
 * // Import with custom location
 * await wslManager.importDistribution(
 *     'dev-env',
 *     '/backups/dev.tar',
 *     'D:\\WSL\\Distributions'
 * );
 * ```
 * 
 * @see {@link exportDistribution} for creating TAR files
 * @since 1.0.0
 */
public async importDistribution(
    name: string,
    tarPath: string,
    installLocation?: string
): Promise<void> {
    // Implementation
}
```

## Release Process

### Version Numbering

We use [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes and minor improvements

### Release Checklist

1. **Update version**
   ```bash
   npm version patch|minor|major
   ```

2. **Update CHANGELOG.md**
   - Add release date
   - List all changes
   - Credit contributors

3. **Run full test suite**
   ```bash
   npm test
   npm run test:coverage
   npm run lint
   ```

4. **Build and package**
   ```bash
   npm run compile
   vsce package
   ```

5. **Test VSIX locally**
   - Install the .vsix file
   - Test key functionality
   - Verify on different Windows versions

6. **Create GitHub release**
   - Tag with version number
   - Attach VSIX file
   - Copy CHANGELOG entries

7. **Publish to marketplace**
   ```bash
   vsce publish
   ```

## Getting Help

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and ideas
- **Pull Request**: Tag @maintainers for review
- **Email**: project-email@example.com

## Recognition

Contributors are recognized in:
- CHANGELOG.md for specific contributions
- README.md contributors section
- GitHub contributors graph
- Release notes

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to VSC WSL Manager! Your efforts help make WSL management better for everyone. 🚀