# Vitest Migration Guide for VSC WSL Manager

## Why Vitest?
- **Better TypeScript support** - Native TS execution without compilation
- **Faster** - Uses Vite's transformation pipeline
- **Compatible with Jest API** - Most Jest tests work unchanged
- **No Node v22 issues** - Works with latest Node versions
- **Better error messages** - More helpful debugging output

## Step 1: Install Vitest

```bash
# Remove Jest dependencies
npm uninstall jest @types/jest ts-jest

# Install Vitest
npm install -D vitest @vitest/ui c8
```

## Step 2: Create Vitest Configuration

Create `vitest.config.ts` in project root:

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'test/']
    },
    setupFiles: ['./test/setup.ts'],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'vscode': path.resolve(__dirname, './test/mocks/vscode.ts')
    }
  }
});
```

## Step 3: Create VS Code Mock for Vitest

Create `test/mocks/vscode.ts`:

```typescript
// Mock vscode module for testing
export const window = {
  showInformationMessage: vi.fn(),
  showErrorMessage: vi.fn(),
  showWarningMessage: vi.fn(),
  createTreeView: vi.fn(() => ({ dispose: vi.fn() })),
  createTerminal: vi.fn(() => ({
    show: vi.fn(),
    sendText: vi.fn(),
    dispose: vi.fn()
  }))
};

export const commands = {
  registerCommand: vi.fn(),
  executeCommand: vi.fn(),
  getCommands: vi.fn(() => Promise.resolve([]))
};

export const workspace = {
  getConfiguration: vi.fn(() => ({
    get: vi.fn(),
    update: vi.fn()
  }))
};

export const TreeItem = class {
  constructor(public label: string) {}
};

export const TreeItemCollapsibleState = {
  None: 0,
  Collapsed: 1,
  Expanded: 2
};

export const ThemeIcon = class {
  constructor(public id: string) {}
};

export const EventEmitter = class {
  fire = vi.fn();
  event = vi.fn();
  dispose = vi.fn();
};
```

## Step 4: Update Test Files

Update `test/wslManager.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WSLManager } from '../src/wslManager';
import { CommandBuilder } from '../src/utils/commandBuilder';

// Mock CommandBuilder
vi.mock('../src/utils/commandBuilder', () => ({
  CommandBuilder: vi.fn().mockImplementation(() => ({
    spawn: vi.fn().mockResolvedValue('mock output')
  }))
}));

describe('WSLManager', () => {
  let wslManager: WSLManager;

  beforeEach(() => {
    vi.clearAllMocks();
    wslManager = new WSLManager();
  });

  describe('listDistributions', () => {
    it('should parse WSL distribution list correctly', async () => {
      const mockOutput = `NAME            STATE           VERSION
Ubuntu-22.04    Running         2
Debian          Stopped         2`;

      const mockBuilder = CommandBuilder as any;
      mockBuilder.mockImplementation(() => ({
        spawn: vi.fn().mockResolvedValue(mockOutput)
      }));

      const distributions = await wslManager.listDistributions();

      expect(distributions).toHaveLength(2);
      expect(distributions[0]).toEqual({
        name: 'Ubuntu-22.04',
        state: 'Running',
        version: '2'
      });
      expect(distributions[1]).toEqual({
        name: 'Debian',
        state: 'Stopped',
        version: '2'
      });
    });

    it('should handle empty distribution list', async () => {
      const mockBuilder = CommandBuilder as any;
      mockBuilder.mockImplementation(() => ({
        spawn: vi.fn().mockResolvedValue('NAME            STATE           VERSION\n')
      }));

      const distributions = await wslManager.listDistributions();
      expect(distributions).toEqual([]);
    });

    it('should handle WSL not installed', async () => {
      const mockBuilder = CommandBuilder as any;
      mockBuilder.mockImplementation(() => ({
        spawn: vi.fn().mockRejectedValue(new Error('WSL is not installed'))
      }));

      await expect(wslManager.listDistributions()).rejects.toThrow('WSL is not installed');
    });
  });

  describe('startDistribution', () => {
    it('should start a distribution', async () => {
      await expect(wslManager.startDistribution('Ubuntu')).resolves.not.toThrow();
    });
  });

  describe('stopDistribution', () => {
    it('should stop a distribution', async () => {
      await expect(wslManager.stopDistribution('Ubuntu')).resolves.not.toThrow();
    });
  });
});
```

## Step 5: Update package.json Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",
    "test:watch": "vitest watch",
    "coverage": "vitest run --coverage",
    "test:debug": "vitest --inspect-brk --inspect --logHeapUsage --threads=false"
  }
}
```

## Step 6: Create Test Automation Script for Vitest

Create `test/automation/vitest-harness.ts`:

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

export class VitestHarness {
  private logFile: string;
  private attempts = 0;
  private maxAttempts = 30;

  constructor() {
    this.logFile = path.join(process.cwd(), 'vitest-automation.log');
  }

  private log(message: string) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(this.logFile, logEntry);
    console.log(message);
  }

  async runTests(): Promise<{ passed: boolean; failures: string[] }> {
    try {
      this.log('Running Vitest tests...');
      const { stdout, stderr } = await execAsync('npm run test:run');
      
      const passed = stdout.includes('✓') && !stdout.includes('✗');
      const failures: string[] = [];
      
      if (!passed) {
        const failureMatches = stdout.match(/✗.*$/gm) || [];
        failures.push(...failureMatches);
      }
      
      return { passed, failures };
    } catch (error: any) {
      // Vitest exits with non-zero on test failures
      const output = error.stdout || '';
      const failures = output.match(/✗.*$/gm) || [error.message];
      
      return { passed: false, failures };
    }
  }

  async compile(): Promise<boolean> {
    try {
      this.log('Checking TypeScript compilation...');
      const { stderr } = await execAsync('npx tsc --noEmit');
      
      if (stderr && !stderr.includes('warning')) {
        this.log(`Compilation errors: ${stderr}`);
        return false;
      }
      
      this.log('TypeScript check passed');
      return true;
    } catch (error: any) {
      this.log(`Compilation failed: ${error.message}`);
      return false;
    }
  }

  async iterateUntilPass(): Promise<boolean> {
    this.log('Starting Vitest automated testing...\n');
    
    while (this.attempts < this.maxAttempts) {
      this.attempts++;
      this.log(`\n=== Iteration ${this.attempts} ===`);
      
      // Check TypeScript
      const compiled = await this.compile();
      if (!compiled) {
        this.createFixRequest('compilation', ['TypeScript compilation errors']);
        await this.sleep(3000);
        continue;
      }
      
      // Run tests
      const { passed, failures } = await this.runTests();
      
      if (passed) {
        this.log('\n✅ All tests passed!');
        return true;
      }
      
      this.log(`\n❌ ${failures.length} test(s) failed`);
      this.createFixRequest('tests', failures);
      
      await this.sleep(3000);
    }
    
    this.log('\n⚠️  Max attempts reached');
    return false;
  }

  private createFixRequest(type: string, errors: string[]) {
    const fixRequest = {
      iteration: this.attempts,
      type,
      errors,
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(
      path.join(process.cwd(), '.vitest-fix-request.json'),
      JSON.stringify(fixRequest, null, 2)
    );
    
    this.log(`Fix request written to .vitest-fix-request.json`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run if executed directly
if (require.main === module) {
  const harness = new VitestHarness();
  harness.iterateUntilPass().then(success => {
    process.exit(success ? 0 : 1);
  });
}
```

## Step 7: Run Migration

```bash
# 1. Install Vitest
npm install -D vitest @vitest/ui c8

# 2. Create the configuration files above

# 3. Run tests
npm run test

# 4. For automated iteration
npx ts-node test/automation/vitest-harness.ts
```

## Advantages Over Jest

1. **No Node v22 issues** - Works with all Node versions
2. **Faster execution** - 2-5x faster than Jest
3. **Better TypeScript** - Native TS without compilation
4. **Hot Module Replacement** - Instant test reruns
5. **Better debugging** - Clear error messages and stack traces
6. **Compatible API** - Most Jest tests work unchanged

## Debugging Commands

```bash
# Interactive UI
npm run test:ui

# Watch mode with instant feedback
npm run test:watch

# Debug in VS Code
npm run test:debug

# Coverage report
npm run coverage
```

## VS Code Integration

Add to `.vscode/settings.json`:

```json
{
  "vitest.enable": true,
  "vitest.commandLine": "npm run test",
  "vitest.nodeExecutable": "node"
}
```

## Common Issues & Solutions

### Issue: Import errors
**Solution**: Check the vscode mock in `test/mocks/vscode.ts`

### Issue: Timeout in tests  
**Solution**: Increase timeout in `vitest.config.ts`

### Issue: Coverage not working
**Solution**: Ensure c8 is installed and paths are correct

## Next Steps

1. ✅ Tests run without hanging
2. ✅ Full TypeScript support
3. ✅ Fast iteration cycles
4. ✅ Better error messages
5. ✅ Works with Node v22

The migration from Jest to Vitest should solve your timeout issues completely!