# Security Policy

## Supported Versions

Currently, we support the following versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 0.0.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

1. **DO NOT** create a public GitHub issue for security vulnerabilities
2. Email security concerns to: [security@vsc-wsl-manager.dev]
3. Include the following information:
   - Type of vulnerability
   - Affected components
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 1 week
- **Status Updates**: Every 2 weeks until resolved
- **Public Disclosure**: After fix is released (coordinated with reporter)

## Security Measures

### Current Implementation

#### Input Validation
- All user inputs are validated using the InputValidator utility
- Distribution names restricted to alphanumeric characters, dashes, and underscores
- Path inputs validated against traversal attacks
- Length limits enforced on all string inputs

#### Command Execution
- All system commands executed using `spawn()` instead of `exec()`
- Command parameters properly escaped using CommandBuilder utility
- No string concatenation in command construction
- Whitelist of allowed WSL commands

#### File Operations
- Secure temporary file creation with random names
- Proper file permissions (0600) for sensitive files
- Path normalization to prevent traversal attacks
- Atomic operations where possible

#### Error Handling
- Error messages sanitized to prevent information disclosure
- Stack traces never exposed to users
- Detailed errors logged internally only

### Planned Enhancements

1. **Rate Limiting**
   - Prevent command execution abuse
   - Configurable limits per operation type

2. **Audit Logging**
   - Security-relevant operations logged
   - Tamper-evident log storage

3. **Permission System**
   - Granular permissions for operations
   - Integration with VS Code workspace trust

## Security Best Practices for Contributors

> 📢 **Note**: While we're currently only accepting ideas and feedback (not code contributions), these guidelines will apply when we open up for community contributions.

### Code Review Checklist

When we begin accepting code contributions, ensure:

- [ ] No user input directly concatenated into commands
- [ ] All paths validated and normalized
- [ ] Error messages don't expose system information
- [ ] Temporary files created securely
- [ ] No hardcoded secrets or credentials
- [ ] Dependencies checked for vulnerabilities
- [ ] Security tests included for new features

### Common Vulnerabilities to Avoid

#### Command Injection
```typescript
// ❌ NEVER DO THIS
const cmd = `wsl.exe -d "${userInput}" command`;
exec(cmd);

// ✅ DO THIS INSTEAD
spawn('wsl.exe', ['-d', sanitizedInput, 'command']);
```

#### Path Traversal
```typescript
// ❌ NEVER DO THIS
const path = `/base/${userInput}`;

// ✅ DO THIS INSTEAD
const safe = path.normalize(path.join('/base', userInput));
if (!safe.startsWith('/base')) throw new Error('Invalid path');
```

#### Information Disclosure
```typescript
// ❌ NEVER DO THIS
catch (error) {
    showError(`Failed: ${error.stack}`);
}

// ✅ DO THIS INSTEAD
catch (error) {
    logger.error('Operation failed', error);
    showError('Operation failed. Check logs for details.');
}
```

## Dependencies

### Security Scanning

- Dependencies scanned weekly using npm audit
- GitHub Dependabot enabled for automatic updates
- Manual review required for major version updates

### Current Security Dependencies

- No direct security libraries currently (planned for future)
- VS Code API provides workspace trust integration
- Node.js crypto module used for random generation

## Incident Response

In case of a security incident:

1. **Immediate Actions**
   - Assess scope and impact
   - Implement temporary mitigation
   - Notify affected users if necessary

2. **Investigation**
   - Root cause analysis
   - Timeline reconstruction
   - Impact assessment

3. **Resolution**
   - Develop and test fix
   - Security review of fix
   - Coordinated release

4. **Post-Incident**
   - Update security measures
   - Document lessons learned
   - Improve detection/prevention

## Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [VS Code Extension Security](https://code.visualstudio.com/api/advanced-topics/security)

## Contact

For security concerns: [security@vsc-wsl-manager.dev]
For general issues: Use GitHub Issues