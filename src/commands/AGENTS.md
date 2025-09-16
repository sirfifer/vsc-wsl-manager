# Commands Directory - Agent Instructions

## Overview
This directory contains all command handlers for the VSC WSL Manager extension. Each command follows a consistent pattern and must be thoroughly tested before implementation.

## Command Handler Pattern

### Standard Command Structure
```typescript
import * as vscode from 'vscode';
import { WSLManager } from '../wslManager';
import { ErrorHandler } from '../utils/errorHandler';
import { InputValidator } from '../utils/inputValidator';

/**
 * Handles the {command-name} command
 * @param context - Optional context from tree item or command palette
 * @returns Promise that resolves when command completes
 */
export async function handle{CommandName}(context?: any): Promise<void> {
  try {
    // 1. Validate context/parameters
    if (context && !validateContext(context)) {
      throw new Error('Invalid context');
    }

    // 2. Get user input if needed
    const userInput = await getUserInput();
    if (!userInput) {
      return; // User cancelled
    }

    // 3. Validate input
    const validation = InputValidator.validate(userInput);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    // 4. Show progress for long operations
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Processing...',
      cancellable: true
    }, async (progress, token) => {
      // 5. Execute the command logic
      progress.report({ message: 'Starting...' });

      // Check for cancellation
      if (token.isCancellationRequested) {
        return;
      }

      // Perform operation
      await performOperation(validation.sanitizedValue);

      progress.report({ increment: 100, message: 'Complete' });
    });

    // 6. Show success message
    vscode.window.showInformationMessage('Command completed successfully');

  } catch (error) {
    // 7. Handle errors gracefully
    await ErrorHandler.showError(error, 'command-name');
  }
}
```

## Command Implementation Guidelines

### 1. User Input Handling
```typescript
/**
 * Gets user input with validation
 */
async function getUserInput(): Promise<string | undefined> {
  return vscode.window.showInputBox({
    prompt: 'Enter distribution name',
    placeHolder: 'my-distribution',
    validateInput: (value) => {
      if (!value) {
        return 'Name is required';
      }
      const validation = InputValidator.validateDistributionName(value);
      if (!validation.isValid) {
        return validation.error;
      }
      return undefined; // Valid
    }
  });
}
```

### 2. Quick Pick Selection
```typescript
/**
 * Shows quick pick for selection
 */
async function selectDistribution(): Promise<Distribution | undefined> {
  const distributions = await wslManager.listDistributions();

  if (distributions.length === 0) {
    vscode.window.showWarningMessage('No distributions found');
    return undefined;
  }

  const items = distributions.map(d => ({
    label: d.name,
    description: d.state,
    detail: `Version: ${d.version}${d.default ? ' (Default)' : ''}`,
    distribution: d
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a distribution'
  });

  return selected?.distribution;
}
```

### 3. Progress Indication
```typescript
/**
 * Long-running operation with progress
 */
async function importDistribution(file: string, name: string): Promise<void> {
  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: `Importing ${name}`,
    cancellable: false
  }, async (progress) => {
    progress.report({ increment: 0, message: 'Preparing...' });

    // Validate file
    progress.report({ increment: 20, message: 'Validating file...' });
    await validateTarFile(file);

    // Import
    progress.report({ increment: 40, message: 'Importing...' });
    await wslManager.importDistribution(file, name);

    // Verify
    progress.report({ increment: 30, message: 'Verifying...' });
    await verifyImport(name);

    progress.report({ increment: 10, message: 'Complete!' });
  });
}
```

## Command Categories

### Distribution Management Commands

#### Create Distribution
```typescript
// src/commands/createDistribution.ts
export async function handleCreateDistribution(): Promise<void> {
  // 1. Get base distribution selection
  // 2. Get new distribution name
  // 3. Validate inputs
  // 4. Create with progress
  // 5. Refresh tree view
}
```

#### Import Distribution
```typescript
// src/commands/importDistribution.ts
export async function handleImportDistribution(): Promise<void> {
  // 1. Show file picker for TAR file
  // 2. Get distribution name
  // 3. Validate TAR file
  // 4. Import with progress
  // 5. Refresh tree view
}
```

#### Export Distribution
```typescript
// src/commands/exportDistribution.ts
export async function handleExportDistribution(item?: DistributionItem): Promise<void> {
  // 1. Select distribution (if not provided)
  // 2. Show save dialog
  // 3. Export with progress
  // 4. Show completion message
}
```

#### Delete Distribution
```typescript
// src/commands/deleteDistribution.ts
export async function handleDeleteDistribution(item?: DistributionItem): Promise<void> {
  // 1. Confirm deletion
  // 2. Check if distribution is running
  // 3. Delete distribution
  // 4. Refresh tree view
}
```

### Terminal Commands

#### Open Terminal
```typescript
// src/commands/openTerminal.ts
export async function handleOpenTerminal(item?: DistributionItem): Promise<void> {
  // 1. Get distribution (from item or selection)
  // 2. Create terminal with WSL configuration
  // 3. Show terminal
}
```

### Tree View Commands

#### Refresh Commands
```typescript
// src/commands/refresh.ts
export async function handleRefresh(): Promise<void> {
  // 1. Refresh all tree providers
  // 2. Update terminal profiles
  // 3. Show refresh complete message
}
```

## Testing Requirements

### Unit Test Template for Commands
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleCommandName } from '../../src/commands/commandName';
import * as vscode from 'vscode';

vi.mock('vscode');

describe('Command: CommandName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should execute successfully with valid input', async () => {
    // Mock user input
    vi.mocked(vscode.window.showInputBox).mockResolvedValue('test-input');

    // Execute command
    await handleCommandName();

    // Verify behavior
    expect(vscode.window.showInputBox).toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('success')
    );
  });

  it('should handle user cancellation', async () => {
    // Mock cancellation
    vi.mocked(vscode.window.showInputBox).mockResolvedValue(undefined);

    // Execute command
    await handleCommandName();

    // Should exit gracefully
    expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
  });

  it('should show error on failure', async () => {
    // Mock error scenario
    vi.mocked(vscode.window.showInputBox).mockResolvedValue('invalid');

    // Execute command
    await handleCommandName();

    // Should show error
    expect(vscode.window.showErrorMessage).toHaveBeenCalled();
  });

  it('should show progress for long operations', async () => {
    // Execute command
    await handleCommandName();

    // Verify progress was shown
    expect(vscode.window.withProgress).toHaveBeenCalled();
  });
});
```

## Error Handling Patterns

### Standard Error Types
```typescript
export class CommandError extends Error {
  constructor(
    message: string,
    public readonly command: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'CommandError';
  }
}

export class UserCancelledError extends Error {
  constructor() {
    super('Operation cancelled by user');
    this.name = 'UserCancelledError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

### Error Recovery
```typescript
async function handleCommandWithRecovery(): Promise<void> {
  try {
    await riskyOperation();
  } catch (error) {
    if (error instanceof UserCancelledError) {
      // Silent exit for user cancellation
      return;
    }

    if (error instanceof ValidationError) {
      // Show validation error with correction hint
      vscode.window.showErrorMessage(error.message, 'Retry').then(selection => {
        if (selection === 'Retry') {
          return handleCommandWithRecovery();
        }
      });
      return;
    }

    // Unknown error - log and show generic message
    console.error('Command failed:', error);
    vscode.window.showErrorMessage('Command failed. See output for details.');
  }
}
```

## Security Considerations

### Input Sanitization
```typescript
/**
 * ALWAYS sanitize user input before using in commands
 */
function sanitizeInput(input: string): string {
  // Remove dangerous characters
  return input.replace(/[;&|`$(){}[\]<>]/g, '');
}
```

### Command Execution
```typescript
/**
 * NEVER use exec() - ALWAYS use spawn()
 */
import { spawn } from 'child_process';

function executeWSLCommand(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const process = spawn('wsl.exe', args);

    let output = '';
    process.stdout.on('data', (data) => {
      output += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });
  });
}
```

## Command Registration

### Registering Commands in Extension
```typescript
// src/extension.ts
export function activate(context: vscode.ExtensionContext) {
  // Register all commands
  const commands = [
    { id: 'wsl-manager.createDistribution', handler: handleCreateDistribution },
    { id: 'wsl-manager.importDistribution', handler: handleImportDistribution },
    { id: 'wsl-manager.exportDistribution', handler: handleExportDistribution },
    { id: 'wsl-manager.deleteDistribution', handler: handleDeleteDistribution },
    { id: 'wsl-manager.openTerminal', handler: handleOpenTerminal },
    { id: 'wsl-manager.refresh', handler: handleRefresh }
  ];

  commands.forEach(({ id, handler }) => {
    const disposable = vscode.commands.registerCommand(id, handler);
    context.subscriptions.push(disposable);
  });
}
```

## Command Context Actions

### Tree Item Context Commands
```typescript
/**
 * Commands that work with tree items
 */
export async function handleDeleteDistribution(item?: TreeItem): Promise<void> {
  let distribution: Distribution;

  if (item && item.distribution) {
    // Called from context menu
    distribution = item.distribution;
  } else {
    // Called from command palette - need to select
    const selected = await selectDistribution();
    if (!selected) return;
    distribution = selected;
  }

  // Continue with distribution...
}
```

## Command Validation

### Pre-execution Checks
```typescript
/**
 * Validate environment before command execution
 */
async function validateEnvironment(): Promise<boolean> {
  // Check WSL is installed
  if (!await isWSLInstalled()) {
    vscode.window.showErrorMessage(
      'WSL is not installed',
      'Install WSL'
    ).then(selection => {
      if (selection === 'Install WSL') {
        vscode.env.openExternal(vscode.Uri.parse('https://aka.ms/wsl'));
      }
    });
    return false;
  }

  // Check user permissions
  if (!await hasRequiredPermissions()) {
    vscode.window.showErrorMessage('Administrator privileges required');
    return false;
  }

  return true;
}
```

## Performance Guidelines

### Async Command Execution
```typescript
/**
 * All commands should be async
 */
export async function handleCommand(): Promise<void> {
  // Don't block UI thread
  await doAsyncWork();

  // Use setImmediate for CPU-intensive work
  await new Promise(resolve => {
    setImmediate(() => {
      // CPU-intensive work here
      resolve(undefined);
    });
  });
}
```

## Common Command Patterns

### Confirmation Dialogs
```typescript
async function confirmDangerousAction(action: string): Promise<boolean> {
  const result = await vscode.window.showWarningMessage(
    `Are you sure you want to ${action}?`,
    { modal: true },
    'Yes',
    'No'
  );

  return result === 'Yes';
}
```

### Multi-step Wizards
```typescript
async function multiStepCommand(): Promise<void> {
  // Step 1
  const step1 = await vscode.window.showInputBox({
    prompt: 'Step 1: Enter name'
  });
  if (!step1) return;

  // Step 2
  const step2 = await vscode.window.showQuickPick(['Option A', 'Option B'], {
    placeHolder: 'Step 2: Select option'
  });
  if (!step2) return;

  // Step 3 - Execute
  await executeWithInputs(step1, step2);
}
```

## Command Testing Checklist

Before implementing any command:
- [ ] Write tests first (TDD)
- [ ] Test success path
- [ ] Test cancellation
- [ ] Test validation failures
- [ ] Test error scenarios
- [ ] Test with/without context
- [ ] Test progress indication
- [ ] Verify no exec() usage
- [ ] Check input sanitization
- [ ] Verify 100% coverage

## Remember

- **Test first** - Write command tests before implementation
- **Validate everything** - Never trust user input
- **Show progress** - Users should know what's happening
- **Handle cancellation** - Users can cancel anytime
- **Clean errors** - Show helpful error messages
- **Security first** - Use spawn(), never exec()

---

**Parent Document**: [/AGENTS.md](../../AGENTS.md)
**Testing Required**: 100% coverage before implementation
**Security**: No exec() or execSync() usage allowed