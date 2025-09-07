# Command Whitelisting for Autonomous Iteration

## Overview

This document describes the proper Claude Code permission configuration that enables autonomous iteration on the VSC WSL Manager extension without requiring user intervention for each command.

## Claude Code Settings Configuration

### Official Settings Location

Claude Code uses a specific configuration format and file location:

- **Project settings**: `.claude/settings.json` (checked into repository)
- **Local overrides**: `.claude/settings.local.json` (gitignored, user-specific)
- **User settings**: `~/.claude/settings.json` (global user settings)

### Proper Permission Format

The correct format for Claude Code permissions uses the `Tool(command)` syntax:

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run compile)",
      "Bash(npm run quick-test)",
      "Bash(npm test)"
    ],
    "deny": [
      "Read(./.env)",
      "Bash(rm -rf *)"
    ],
    "ask": [
      "Bash(npm install *)"
    ]
  }
}
```

## Project Configuration (`.claude/settings.json`)

The project includes a comprehensive permission configuration that:

### ✅ Allows (No User Intervention)
- **Build & Compilation**: `npm run compile`, `tsc -p ./`
- **Testing**: All test commands (`quick-test`, `automate`, `test:*`)
- **Linting**: `npm run lint`, `npm run lint:fix`
- **Development**: `npm run watch`, `npm run dev`
- **Diagnostics**: `npm run diagnostics`, log viewing
- **Safe Runner**: `node scripts/safe-runner.js *`

### ❌ Denies (Blocked)
- **Sensitive Files**: `.env`, credentials, secrets, SSH keys
- **Destructive Commands**: `rm -rf`, `format`, `del`
- **Publishing**: `npm publish`, `npm login`
- **Network Operations**: `curl`, `wget`
- **Git Push**: Prevents accidental pushes

### ❓ Asks (Requires Confirmation)
- **Package Management**: `npm install`, `npm uninstall`
- **Git Operations**: `commit`, `merge`, `rebase`
- **Branch Management**: Creating or deleting branches

## Local Overrides (`.claude/settings.local.json`)

Users can create local overrides for their specific needs:

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run my-custom-script)"
    ],
    "deny": [
      "Read(./my-private-file.txt)"
    ]
  }
}
```

This file should be:
- Added to `.gitignore`
- Created by individual developers
- Used for personal workflow customizations

## Safe Command Wrappers (Supplementary)

While Claude Code's permission system is the primary security layer, the project also includes safe command wrappers as an additional safeguard:

### Node.js Wrapper (`scripts/safe-runner.js`)
```bash
# Use as an extra safety layer
node scripts/safe-runner.js compile
node scripts/safe-runner.js quick-test
```

### Bash Wrapper (`scripts/safe-runner.sh`)
```bash
# Alternative bash implementation
./scripts/safe-runner.sh compile
```

These wrappers:
- Provide an additional security layer
- Can be used for manual testing
- Work independently of Claude Code settings

## Hooks Configuration

The settings include optional hooks for command visibility:

```json
{
  "hooks": {
    "PreToolUse": {
      "Bash": "echo '[Claude Code] Executing command...'"
    },
    "PostToolUse": {
      "Bash": "echo '[Claude Code] Command completed'"
    }
  }
}
```

## Security Best Practices

### 1. Principle of Least Privilege
- Only allow commands necessary for development
- Deny access to sensitive files explicitly
- Use "ask" mode for potentially dangerous operations

### 2. Pattern-Based Permissions
- `Bash(npm run test:*)` - Allows all test variants
- `Read(**/.env*)` - Denies all .env files in any directory
- `Bash(node scripts/*.js)` - Allows specific script patterns

### 3. Defense in Depth
- Claude Code permissions (primary)
- Safe command wrappers (secondary)
- Git hooks (tertiary)
- Code review (final check)

## Autonomous Iteration Workflow

With proper permissions configured:

1. **Claude Code can automatically**:
   - Compile TypeScript code
   - Run all test suites
   - Fix linting issues
   - Read source files
   - Write fixes
   - Validate changes

2. **Claude Code will ask before**:
   - Installing new packages
   - Committing changes
   - Creating branches

3. **Claude Code cannot**:
   - Delete files destructively
   - Access sensitive credentials
   - Push to remote repository
   - Make network requests

## Testing the Configuration

### Verify Permissions Work

```bash
# These should work without prompting
npm run compile
npm run quick-test
npm run automate

# These should be blocked
rm -rf src  # Denied
cat .env    # Denied

# These should ask for confirmation
npm install new-package  # Asks
git commit -m "test"    # Asks
```

### Monitor Autonomous Iteration

```bash
# Start automation
npm run automate

# Watch progress
tail -f test-automation.log

# Check errors
cat .fix-request.json
```

## Troubleshooting

### Commands Not Running
1. Check `.claude/settings.json` exists
2. Verify command format: `Tool(command)`
3. Ensure no typos in permission strings
4. Check for conflicting deny rules

### Permission Denied
1. Command may be in deny list
2. Pattern might not match exactly
3. Check for more specific deny rules

### Too Many Prompts
1. Move commands from "ask" to "allow"
2. Use patterns for similar commands
3. Create local overrides for your workflow

## Migration from Previous Setup

If you had the old `.claude-whitelist.json`:
1. ✅ It has been deleted
2. ✅ Settings migrated to `.claude/settings.json`
3. ✅ Proper permission format applied
4. ✅ Hooks added for visibility

## Summary

The permission system is now properly configured according to Claude Code's official documentation, enabling:
- ✅ Autonomous iteration on code
- ✅ Automatic testing and validation
- ✅ Protection of sensitive files
- ✅ Prevention of destructive operations
- ✅ User control over critical actions

The system is ready for efficient, safe, autonomous development!