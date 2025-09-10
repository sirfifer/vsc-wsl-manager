# MCP Testing Guide for VS Code Extension

## Overview

This guide documents the MCP (Model Context Protocol) testing infrastructure for the WSL Manager VS Code extension. MCP enables Claude to directly interact with VS Code's UI through Chrome DevTools Protocol.

## Prerequisites

### 1. MCP Server Configuration

Add the webdriverio-mcp server to your Claude Desktop configuration:

**Windows Location:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "webdriverio-mcp": {
      "command": "npx",
      "args": ["-y", "webdriverio-mcp"]
    }
  }
}
```

**Important:** After adding this configuration, you must fully restart Claude Desktop.

### 2. Project Location (WSL Users)

If you're using WSL, the project MUST be located under `/mnt/c/` (Windows-accessible path) for VS Code to launch properly.

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run test:mcp-setup` | Launch VS Code with debug port for MCP |
| `npm run test:mcp-cleanup` | Clean up all MCP test artifacts |
| `npm run test:mcp-check` | Verify MCP connection status |
| `npm run test:mcp` | Clean up and setup in one command |
| `npm run test:mcp-debug` | Launch with default port 9222 |

## Architecture

### Components

1. **Port Utilities** (`test/mcp-bridge/port-utils.js`)
   - Port availability checking
   - Process cleanup on ports
   - Debug port verification

2. **VS Code Launcher** (`test/mcp-bridge/launcher.js`)
   - Comprehensive VS Code path detection
   - Chrome DevTools port configuration
   - Extension loading without `--disable-extensions`
   - Process management

3. **Setup Script** (`test/mcp-bridge/setup.js`)
   - User-friendly launcher interface
   - Color-coded terminal output
   - Connection instructions

4. **Cleanup Script** (`test/mcp-bridge/cleanup.js`)
   - Process termination
   - Port cleanup
   - Artifact removal

5. **Connection Checker** (`test/mcp-bridge/check-connection.js`)
   - DevTools connectivity verification
   - Target enumeration
   - Extension load detection

## Usage Guide

### Manual Launch from Windows

Due to WSL/Windows boundary complexities, the most reliable approach is to launch VS Code directly from Windows:

1. **Open Windows Command Prompt or PowerShell**

2. **Navigate to your project directory:**
   ```cmd
   cd C:\data\rea\dev\vsc-wsl-manager
   ```

3. **Launch VS Code with debug port:**
   ```cmd
   "C:\Users\%USERNAME%\AppData\Local\Programs\Microsoft VS Code\Code.exe" ^
     --extensionDevelopmentPath=. ^
     --remote-debugging-port=9229 ^
     --user-data-dir=.vscode-mcp-profile ^
     --skip-release-notes ^
     --skip-welcome ^
     --disable-updates ^
     .test-workspace
   ```

4. **In Claude, connect using MCP:**
   ```javascript
   start_browser({ "debuggerAddress": "127.0.0.1:9229" })
   ```

### Automated Launch from WSL (Limited)

From WSL, you can attempt automated launch:

```bash
# Clean up any existing sessions
npm run test:mcp-cleanup

# Launch VS Code
npm run test:mcp-setup -- --port 9229

# In another terminal, check connection
npm run test:mcp-check
```

**Note:** When launching from WSL, VS Code opens on Windows but the process may not stay attached. This is a known limitation.

## MCP Commands in Claude

Once connected, Claude can use these MCP tools:

### Browser Management
```javascript
// Start browser session (connect to VS Code)
start_browser({ "debuggerAddress": "127.0.0.1:9229" })

// Close session
close_session()
```

### Navigation
```javascript
// Navigate to a URL
navigate({ "url": "about:blank" })

// Scroll
scroll_up()
scroll_down()
```

### Element Interaction
```javascript
// Find element
find_element({ "selector": ".activitybar" })

// Click element
click({ "selector": ".codicon-vm" })

// Enter text
set_value({ 
  "selector": "input[name='distribution-name']",
  "value": "Ubuntu-22.04"
})

// Get text
get_text({ "selector": ".status-message" })
```

### Observation
```javascript
// Take screenshot
take_screenshot()

// Check visibility
is_displayed({ "selector": ".tree-view" })

// Get all visible elements
get_visible_elements()
```

## VS Code Specific Selectors

| Component | Selector |
|-----------|----------|
| Activity Bar | `.activitybar` |
| Side Bar | `.sidebar` |
| Tree View | `.tree-explorer-viewlet-tree-view` |
| Command Palette | `.quick-input-widget` |
| Notifications | `.notifications-toasts` |
| Terminal | `.terminal` |
| Editor | `.editor` |
| Status Bar | `#workbench\\.parts\\.statusbar` |
| WSL Manager Icon | `.codicon-vm` |

## Testing Workflow Example

### 1. Test Extension Loading

```javascript
// Connect to VS Code
start_browser({ "debuggerAddress": "127.0.0.1:9229" })

// Click WSL Manager in activity bar
click({ "selector": ".activitybar .codicon-vm" })

// Take screenshot
take_screenshot()

// Check if tree view is visible
is_displayed({ "selector": ".tree-explorer-viewlet-tree-view" })
```

### 2. Test Command Execution

```javascript
// Open command palette (simulate Ctrl+Shift+P)
// Note: Keyboard shortcuts may not work directly
click({ "selector": ".monaco-workbench" })

// Find command input
find_element({ "selector": ".quick-input-box input" })

// Type command
set_value({ 
  "selector": ".quick-input-box input",
  "value": "WSL Manager: Refresh"
})

// Execute command
click({ "selector": ".quick-input-list .monaco-list-row:first-child" })
```

### 3. Test Tree Interaction

```javascript
// Expand distributions tree
click({ "selector": "[title*='WSL Distributions'] .codicon-chevron-right" })

// Right-click on a distribution
// Note: Right-click may need special handling
click({ "selector": "[title*='Ubuntu']" })

// Take screenshot of context menu
take_screenshot()
```

## Troubleshooting

### Issue: VS Code won't launch from WSL

**Solution:** Launch from Windows Command Prompt or PowerShell instead.

### Issue: Port already in use

**Solution:** 
```bash
npm run test:mcp-cleanup
# Or use a different port
npm run test:mcp-setup -- --port 9230
```

### Issue: Extension not loading

**Symptoms:** Tree view not visible, commands not available

**Solutions:**
1. Ensure NO `--disable-extensions` flag is present
2. Check extension path is correct
3. Verify `out/src/extension.js` exists
4. Check Debug Console for activation errors

### Issue: Can't connect from Claude

**Solutions:**
1. Verify MCP server is configured in Claude Desktop
2. Restart Claude Desktop completely
3. Check port is accessible: `curl http://127.0.0.1:9229/json/version`
4. Try different port if 9229 is blocked

### Issue: Elements not found

**Solutions:**
1. VS Code uses Shadow DOM - may need special selectors
2. Wait for elements to load
3. Use data-testid attributes when available
4. Take screenshot to see current state

## Limitations

1. **WSL Launch**: When launching from WSL, VS Code opens on Windows but process control is limited
2. **Keyboard Shortcuts**: Direct keyboard shortcuts may not work through MCP
3. **Context Menus**: Right-click menus may require special handling
4. **Modal Dialogs**: File dialogs and modals may not be accessible

## Best Practices

1. **Always Clean Up**: Run `npm run test:mcp-cleanup` after testing
2. **Use Unique Ports**: Avoid port conflicts by using different ports for different test runs
3. **Take Screenshots**: Document test state with screenshots
4. **Check Logs**: Monitor VS Code Debug Console for errors
5. **Verify Extension**: Always check extension loaded before testing features

## Advanced Usage

### Custom Test Scenarios

Create custom test scenarios in `test/mcp-bridge/scenarios.js`:

```javascript
async function testCustomScenario() {
  // Your test logic here
  return [
    { action: 'click', selector: '.my-element' },
    { action: 'screenshot', name: 'after-click' },
    // ... more actions
  ];
}
```

### Generating WebdriverIO Tests

MCP interactions can be converted to WebdriverIO test code:

```javascript
// After performing manual interactions through MCP
// Generate test code from the action log
const testCode = generateTestFromActions(actionLog);
```

## Next Steps

1. **Enhanced Wrapper**: Create VS Code-specific MCP wrapper for common operations
2. **Test Generation**: Build tools to convert MCP interactions to test code
3. **CI Integration**: Explore headless VS Code testing for CI/CD
4. **Custom MCP Server**: Develop VS Code-specific MCP server for better integration

## Resources

- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
- [WebdriverIO Documentation](https://webdriver.io/)
- [VS Code Extension Testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [MCP Documentation](https://github.com/anthropics/model-context-protocol)

---

**Note:** This is an experimental testing approach. For production testing, consider using VS Code's built-in testing framework or established E2E testing tools.