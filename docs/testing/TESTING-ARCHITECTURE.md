# 🏗️ VSC WSL Manager - Testing Architecture

## Overview

This document provides detailed implementation guidance for our three-level WSL-orchestrated testing architecture with Windows UI execution. This sophisticated approach enables AI-driven iterative development while maintaining 100% real testing with no mocks.

**Architecture Designer:** Marcus Johnson, QA Manager
**Last Updated:** September 2024
**Key Innovation:** WSL orchestration with Windows UI execution

**Note:** This document describes the current WSL+Windows implementation. For adapting this architecture to other platforms (macOS, Linux, pure Windows), see [Cross-Platform Testing Strategy](cross-platform-testing-strategy.md).

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Level 1: Unit Tests](#level-1-unit-tests)
3. [Level 2: VS Code API Tests](#level-2-vs-code-api-tests)
4. [Level 3: E2E UI Tests](#level-3-e2e-ui-tests)
5. [Cross-Platform Communication](#cross-platform-communication)
6. [Setup Instructions](#setup-instructions)
7. [Implementation Examples](#implementation-examples)
8. [Troubleshooting](#troubleshooting)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      WSL (Ubuntu)                            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Claude Code / AI Agent                     │ │
│  │                 Test Orchestrator                       │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │ Level 1: Unit Tests (Vitest)                          │ │
│  │ • Real wsl.exe calls                                  │ │
│  │ • Real file system operations                         │ │
│  │ • 2-5 seconds execution                               │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │ Level 2: VS Code API Tests (@vscode/test-electron)    │ │
│  │ • Headless VS Code via Xvfb                           │ │
│  │ • Full Extension Host access                          │ │
│  │ • 20-30 seconds execution                             │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │ Level 3: E2E Orchestration                            │ │
│  │ • Sends commands to Windows MCP                       │ │
│  │ • Receives test results                               │ │
│  └────────────────────────────────────┬──────────────────┘ │
└────────────────────────────────────────┼────────────────────┘
                                         │
                    WebSocket/HTTP       │
                    Port 4444           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Windows Host                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           WebdriverIO MCP Server                       │ │
│  │  • Receives test commands from WSL                     │ │
│  │  • Launches VS Code with extension                     │ │
│  │  • Executes UI interactions                            │ │
│  │  • Returns results to WSL                              │ │
│  │  • Screen recording capability                         │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Level 1: Unit Tests

### Purpose
Test individual functions and classes with real system calls, no mocks.

### Technology Stack
- **Framework:** Vitest
- **Location:** WSL (Ubuntu)
- **Execution:** Direct Node.js process
- **Coverage:** c8

### Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/unit/**/*.test.ts'],
    exclude: ['node_modules', '.vscode-test'],
    coverage: {
      provider: 'c8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['test/', 'out/', 'scripts/'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    },
    testTimeout: 10000,
    // NO MOCK CONFIGURATION - Real testing only
    mockReset: false,
    clearMocks: false,
    restoreMocks: false
  }
  // NO MOCK ALIASES - Direct imports only
});
```

### Example Test

```typescript
// test/unit/wslManager.test.ts
import { describe, it, expect } from 'vitest';
import { WSLManager } from '../../src/wslManager';
import { execSync } from 'child_process';

describe('WSLManager - Real Tests', () => {
  it('should list actual WSL distributions', async () => {
    const manager = new WSLManager();
    const distros = await manager.listDistributions();

    // Verify against actual wsl.exe output
    const actualOutput = execSync('wsl.exe --list --verbose', { encoding: 'utf16le' });
    const actualCount = actualOutput.split('\n').filter(line => line.trim()).length - 1;

    expect(distros.length).toBe(actualCount);
  });
});
```

## Level 2: VS Code API Tests

### Purpose
Test extension interaction with VS Code APIs using real Extension Host.

### Technology Stack
- **Framework:** @vscode/test-electron
- **Location:** WSL with Xvfb (headless)
- **Execution:** Inside VS Code Extension Host
- **Display:** Virtual framebuffer

### Prerequisites

```bash
# Install Xvfb and dependencies in WSL
sudo apt-get update
sudo apt-get install -y xvfb libgtk-3-0 libx11-xcb1 libasound2 libgbm1
```

### Configuration

```typescript
// test/runTest.ts
import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../..');
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    // Download VS Code and run tests
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        '--disable-extensions', // Disable other extensions
        '--disable-gpu',        // For headless operation
        '--no-sandbox'          // Required in some environments
      ]
    });
  } catch (err) {
    console.error('Failed to run tests:', err);
    process.exit(1);
  }
}

main();
```

### Running with Xvfb

```json
// package.json
{
  "scripts": {
    "test:integration": "xvfb-run -a node ./out/test/runTest.js",
    "test:integration:debug": "DISPLAY=:99 xvfb-run -s '-screen 0 1024x768x24' node ./out/test/runTest.js"
  }
}
```

### Example Test

```typescript
// test/suite/extension.test.ts
import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
  test('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('wsl-manager.vsc-wsl-manager'));
  });

  test('Should register all commands', async () => {
    const commands = await vscode.commands.getCommands();
    assert.ok(commands.includes('wsl-manager.refreshDistributions'));
    assert.ok(commands.includes('wsl-manager.createDistribution'));
  });

  test('Should show tree view', async () => {
    const treeView = vscode.window.createTreeView('wslDistributions', {
      treeDataProvider: new WSLTreeDataProvider()
    });
    assert.ok(treeView.visible !== undefined);
  });
});
```

## Level 3: E2E UI Tests

### Purpose
Test complete user workflows through actual VS Code UI on Windows.

### Technology Stack
- **Framework:** WebdriverIO
- **Orchestrator:** WSL
- **Executor:** Windows MCP Server
- **Protocol:** WebSocket/HTTP

### Windows MCP Server Setup

```javascript
// windows-mcp-server.js (runs on Windows)
const { remote } = require('webdriverio');
const express = require('express');
const app = express();

app.post('/execute', async (req, res) => {
  const { test, options } = req.body;

  // Launch VS Code with WebDriver
  const browser = await remote({
    capabilities: {
      'goog:chromeOptions': {
        binary: 'C:\\Program Files\\Microsoft VS Code\\Code.exe',
        args: [
          `--extensionDevelopmentPath=${req.body.extensionPath}`,
          '--remote-debugging-port=9229'
        ]
      }
    }
  });

  // Execute test
  const result = await executeTest(browser, test, options);

  res.json(result);
});

app.listen(4444, () => {
  console.log('MCP Server running on port 4444');
});
```

### WSL Orchestrator

```typescript
// test/e2e/orchestrator.ts (runs in WSL)
import axios from 'axios';
import { convertPath } from './utils';

class E2EOrchestrator {
  private mcpUrl = 'http://host.docker.internal:4444';

  async runUITest(testFile: string) {
    // Convert WSL path to Windows path
    const windowsPath = convertPath('/mnt/c/project');

    const response = await axios.post(`${this.mcpUrl}/execute`, {
      test: testFile,
      extensionPath: windowsPath,
      options: {
        visible: true,
        record: true,
        timeout: 120000
      }
    });

    return response.data;
  }
}
```

### Example E2E Test

```typescript
// test/e2e/distribution-workflow.test.ts
import { browser, $, expect } from '@wdio/globals';

describe('Distribution Management Workflow', () => {
  it('should create a new distribution', async () => {
    // Open command palette
    await browser.keys(['Control', 'Shift', 'P']);

    // Type command
    await browser.keys('WSL: Create Distribution');
    await browser.keys('Enter');

    // Select template
    const picker = await $('.quick-input-list');
    await picker.waitForExist();
    await picker.selectByVisibleText('Ubuntu-24.04');

    // Enter name
    const input = await $('.input');
    await input.setValue('test-distro');
    await browser.keys('Enter');

    // Verify in tree view
    const treeItem = await $('*[aria-label="test-distro"]');
    await expect(treeItem).toExist();
  });
});
```

## Cross-Platform Communication

### Path Translation

```typescript
// utils/pathTranslator.ts
export class PathTranslator {
  static wslToWindows(wslPath: string): string {
    // /mnt/c/project -> C:\project
    if (wslPath.startsWith('/mnt/')) {
      const drive = wslPath[5].toUpperCase();
      const path = wslPath.substring(7).replace(/\//g, '\\');
      return `${drive}:\\${path}`;
    }
    return wslPath;
  }

  static windowsToWSL(winPath: string): string {
    // C:\project -> /mnt/c/project
    const match = winPath.match(/^([A-Z]):\\(.*)$/);
    if (match) {
      const drive = match[1].toLowerCase();
      const path = match[2].replace(/\\/g, '/');
      return `/mnt/${drive}/${path}`;
    }
    return winPath;
  }
}
```

### Port Accessibility

```typescript
// WSL to Windows connection
const WINDOWS_HOST = process.env.WSL_HOST || 'host.docker.internal';
const MCP_PORT = 4444;

// In WSL bashrc or profile
export WSL_HOST=$(ip route show | grep default | awk '{print $3}')
```

## Setup Instructions

### 1. WSL Environment Setup

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Xvfb for headless testing
sudo apt-get install -y xvfb libgtk-3-0 libx11-xcb1 libasound2 libgbm1

# Install project dependencies
npm install
```

### 2. Windows MCP Server Setup

```powershell
# In Windows PowerShell
cd C:\mcp-server
npm init -y
npm install express webdriverio @wdio/cli
node windows-mcp-server.js
```

### 3. Configure VS Code

```json
// .vscode/settings.json
{
  "terminal.integrated.defaultProfile.linux": "bash",
  "terminal.integrated.profiles.linux": {
    "bash": {
      "path": "/bin/bash",
      "env": {
        "DISPLAY": ":99"
      }
    }
  }
}
```

## Implementation Examples

### Master Test Runner

```typescript
// scripts/master-test-runner.ts
import { execSync } from 'child_process';
import axios from 'axios';

class MasterTestRunner {
  async runAllLevels() {
    console.log('🔷 Level 1: Running Unit Tests...');
    execSync('npm run test:unit', { stdio: 'inherit' });

    console.log('🔗 Level 2: Running VS Code API Tests...');
    execSync('xvfb-run -a npm run test:integration', { stdio: 'inherit' });

    console.log('🌐 Level 3: Running E2E UI Tests...');
    await this.runWindowsUITests();

    console.log('✅ All test levels completed!');
  }

  private async runWindowsUITests() {
    const response = await axios.post('http://host.docker.internal:4444/execute', {
      command: 'npm run test:e2e',
      workspace: process.cwd()
    });

    if (response.data.exitCode !== 0) {
      throw new Error(`UI tests failed: ${response.data.error}`);
    }
  }
}

// Execute
new MasterTestRunner().runAllLevels().catch(console.error);
```

## Troubleshooting

### Common Issues and Solutions

#### Xvfb Display Issues
```bash
# Error: cannot open display
export DISPLAY=:99
Xvfb :99 -screen 0 1024x768x24 &

# Or use xvfb-run
xvfb-run -a -s "-screen 0 1024x768x24" npm run test:integration
```

#### WSL to Windows Connection
```bash
# Test connectivity
ping $(ip route | grep default | awk '{print $3}')

# If using Docker Desktop
ping host.docker.internal

# Manual IP
ping 172.17.0.1
```

#### VS Code Download Issues
```bash
# Clear VS Code test cache
rm -rf .vscode-test

# Download specific version
npx @vscode/test-electron --version 1.85.0
```

#### Permission Issues
```bash
# Fix node_modules permissions
sudo chown -R $(whoami) node_modules

# Fix VS Code test directory
chmod -R 755 .vscode-test
```

## Best Practices

1. **Always run Level 1 tests first** - Fastest feedback
2. **Use Level 2 for API changes** - Validates extension integration
3. **Reserve Level 3 for user workflows** - Most expensive but most realistic
4. **Parallelize within levels** - Not between levels
5. **Cache VS Code downloads** - Reuse .vscode-test directory
6. **Record Level 3 failures** - Visual debugging is invaluable
7. **Monitor MCP server health** - Implement heartbeat checks

## Conclusion

This three-level architecture provides:
- **Fast iteration** with Level 1 unit tests
- **API confidence** with Level 2 headless tests
- **User validation** with Level 3 UI tests
- **AI compatibility** through WSL orchestration
- **Real testing** with no mocks throughout

The architecture scales from quick 5-second unit tests to comprehensive 5-minute full stack validation, all orchestrated from WSL while maintaining Windows compatibility for UI testing.