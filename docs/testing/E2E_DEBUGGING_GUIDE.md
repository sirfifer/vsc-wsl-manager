# E2E Testing Debug Guide

## Quick Start

### Running Tests with Debug Logging

```bash
# Run with full debug logging
DEBUG=* npm run test:e2e:windows

# Run with specific debug levels
DEBUG_LEVEL=DEBUG npm run test:e2e:windows

# Run minimal test with debugging
npm run test:e2e:bridge -- --minimal --debug

# Run with crash monitoring
node test/e2e-debug/safe-test-runner.js
```

### Where to Find Logs

All debug logs are stored in `test/e2e-debug/logs/` and are automatically gitignored.

- **Main debug logs**: `test/e2e-debug/logs/debug-{timestamp}.log`
- **Crash dumps**: `test/e2e-debug/crash-dumps/crash-{timestamp}.json`
- **Process logs**: `test/e2e-debug/process-logs/{pid}.log`
- **WebdriverIO errors**: `test/wdio-error.log`

### Basic Troubleshooting

1. **Check if VS Code is crashing**:
   ```bash
   tail -f test/e2e-debug/logs/debug-*.log | grep FATAL
   ```

2. **View latest crash dump**:
   ```bash
   ls -lt test/e2e-debug/crash-dumps/ | head -1
   cat test/e2e-debug/crash-dumps/crash-*.json | jq .
   ```

3. **Analyze log patterns**:
   ```bash
   node test/e2e-debug/analyze-logs.js
   ```

## Log Files Guide

### Log File Structure

Each log file contains JSON-formatted entries with the following structure:

```json
{
  "timestamp": "2025-01-09T10:30:45.123Z",
  "level": "INFO|DEBUG|WARN|ERROR|FATAL",
  "message": "Human-readable message",
  "data": {
    // Additional structured data
  },
  "sessionId": 1704795045123,
  "elapsed": 1234,
  "caller": {
    "function": "functionName",
    "file": "filename.js",
    "line": "123"
  }
}
```

### Log Types

#### 1. Debug Logs (`debug-*.log`)
Main application logs containing all debug information:
- Test execution flow
- VS Code launch parameters
- Extension loading status
- Command execution
- Error traces

#### 2. Crash Dumps (`crash-*.json`)
Detailed crash information including:
- Error message and stack trace
- Process memory usage
- Environment variables
- Command line arguments
- System information

#### 3. Process Logs (`process-{pid}.log`)
Individual process monitoring:
- Process lifecycle events
- Resource usage (CPU, memory)
- Exit codes
- Crash detection

## Debug Levels

Configure debug output using environment variables:

### Debug Level Configuration

```bash
# Set debug level (DEBUG, INFO, WARN, ERROR, FATAL)
export DEBUG_LEVEL=DEBUG

# Enable all debug output
export DEBUG=*

# Enable specific namespaces
export DEBUG=wdio:*         # WebdriverIO only
export DEBUG=vscode:*       # VS Code process only
export DEBUG=test:*         # Test execution only
export DEBUG=wdio:*,vscode:* # Multiple namespaces
```

### Log Levels Explained

- **DEBUG**: Detailed execution flow, variable states, function calls
- **INFO**: Important events, test progress, process lifecycle
- **WARN**: Potential issues, deprecations, recoverable errors
- **ERROR**: Errors that don't stop execution
- **FATAL**: Critical errors causing test failure or crash

## Common Issues and Solutions

### VS Code Crashes on Launch

**Symptoms**: VS Code process exits immediately or crashes during startup

**Check logs**:
```bash
grep "VS Code Event" test/e2e-debug/logs/debug-*.log
grep "exitCode" test/e2e-debug/logs/debug-*.log
```

**Common causes and solutions**:

1. **Conflicting command line flags**
   - Look for: `--disable-extensions` with `--extensionDevelopmentPath`
   - Solution: Remove `--disable-extensions` flag
   
2. **Profile directory conflicts**
   - Look for: Permission errors in logs
   - Solution: Use isolated profile directories

3. **Extension path issues**
   - Look for: "Extension not found" errors
   - Solution: Verify extension path is Windows format

### Extension Not Loading

**Symptoms**: Tests fail because extension is not active

**Check logs**:
```bash
grep "extension" test/e2e-debug/logs/debug-*.log -i
grep "activate" test/e2e-debug/logs/debug-*.log -i
```

**Solutions**:
1. Verify extension is compiled: `npm run compile`
2. Check extension path in logs matches actual location
3. Ensure no TypeScript compilation errors

### Tests Timeout

**Symptoms**: Tests hang and eventually timeout

**Check process health**:
```bash
# Check if VS Code process is still running
grep "Process status" test/e2e-debug/logs/debug-*.log
grep "alive" test/e2e-debug/logs/debug-*.log
```

**Solutions**:
1. Increase timeout in test configuration
2. Check for deadlocks in extension code
3. Verify VS Code window is responsive

### WebdriverIO Connection Fails

**Symptoms**: Cannot connect to VS Code automation interface

**Check logs**:
```bash
grep "WebdriverIO Event" test/e2e-debug/logs/debug-*.log
grep "connection" test/e2e-debug/logs/debug-*.log -i
```

**Solutions**:
1. Ensure wdio-vscode-service is installed
2. Check VS Code is launching with automation flags
3. Verify no firewall blocking connections

## Analysis Tools

### Log Analyzer

Analyze patterns in log files:

```bash
# Run log analyzer
node test/e2e-debug/analyze-logs.js

# Analyze specific log file
node test/e2e-debug/analyze-logs.js --file test/e2e-debug/logs/debug-2025-01-09.log

# Generate summary report
node test/e2e-debug/analyze-logs.js --report

# Find specific patterns
node test/e2e-debug/analyze-logs.js --pattern "FATAL|ERROR"
```

### Output includes:
- Error frequency analysis
- Common failure patterns
- Performance metrics
- Crash statistics
- Timeline of events

### Crash Report Generator

Generate detailed crash reports:

```bash
# Generate report for latest crash
node test/e2e-debug/analyze-logs.js --crash-report

# Generate report for specific session
node test/e2e-debug/analyze-logs.js --session 1704795045123
```

## Advanced Debugging

### Attaching Debugger to VS Code Process

1. **Enable debug mode in tests**:
   ```javascript
   // In wdio.conf.windows.js
   vscodeArgs: ['--inspect=9229']
   ```

2. **Attach Chrome DevTools**:
   - Open Chrome: `chrome://inspect`
   - Click "Configure" and add `localhost:9229`
   - Click "inspect" when VS Code appears

3. **Use VS Code debugger**:
   - Create `.vscode/launch.json` configuration
   - Attach to Node.js process on port 9229

### Using Windows Event Viewer

For Windows-specific crashes:

1. Open Event Viewer: `eventvwr.msc`
2. Navigate to: Windows Logs → Application
3. Filter by: Source = "Code.exe"
4. Look for Error or Critical events

### Network Traffic Monitoring

Monitor extension API calls:

```bash
# Enable network debug
export DEBUG=wdio:request,wdio:response

# Use Fiddler or Wireshark for detailed analysis
```

### Performance Profiling

1. **Enable CPU profiling**:
   ```javascript
   // In test
   await browser.executeWorkbench(async (vscode) => {
       console.profile('test-profile');
       // Test code
       console.profileEnd();
   });
   ```

2. **Analyze in Chrome DevTools**:
   - Load profile in Performance tab
   - Look for bottlenecks

## Best Practices

### 1. Always Clean Up

```javascript
// In test teardown
afterEach(async () => {
    const logger = require('./test/e2e-debug/debug-logger').getLogger();
    logger.info('Test completed', { test: this.currentTest.title });
    
    // Kill any hanging processes
    await cleanup();
});
```

### 2. Use Structured Logging

```javascript
// Good
logger.info('Extension activated', {
    extensionId: 'wsl-manager',
    activationTime: 1234,
    success: true
});

// Bad
console.log('Extension activated');
```

### 3. Log at Appropriate Levels

- Use DEBUG for detailed flow
- Use INFO for important events
- Use ERROR for actual errors
- Reserve FATAL for crashes

### 4. Include Context

```javascript
logger.error('Command failed', {
    command: 'WSL: Create Distribution',
    error: error.message,
    stack: error.stack,
    context: {
        distroName: 'Ubuntu',
        basePath: '/mnt/c/distros'
    }
});
```

### 5. Monitor Resources

```javascript
setInterval(() => {
    logger.debug('Resource check', {
        memory: process.memoryUsage(),
        uptime: process.uptime()
    });
}, 5000);
```

## Troubleshooting Scripts

### Debug Test Runner

```bash
# Run with maximum debugging
./scripts/debug-e2e-test.sh

# Run specific test with debugging
./scripts/debug-e2e-test.sh --spec test/e2e/minimal.test.js

# Run with crash recovery
./scripts/debug-e2e-test.sh --safe-mode
```

### Log Cleanup

```bash
# Clean all debug artifacts
npm run test:e2e:clean

# Clean logs older than 7 days
find test/e2e-debug/logs -mtime +7 -delete

# Archive logs
tar -czf logs-backup.tar.gz test/e2e-debug/logs/
```

## Environment Variables Reference

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `DEBUG` | Debug namespaces | - | `*`, `wdio:*` |
| `DEBUG_LEVEL` | Minimum log level | `INFO` | `DEBUG`, `ERROR` |
| `DEBUG_TO_FILE` | Write debug to file | `true` | `false` |
| `DEBUG_MAX_FILES` | Max log files to keep | `10` | `20` |
| `DEBUG_CONSOLE` | Also log to console | `true` | `false` |
| `CRASH_DUMP` | Enable crash dumps | `true` | `false` |
| `PROCESS_MONITOR` | Monitor subprocesses | `true` | `false` |

## Getting Help

If you encounter issues not covered here:

1. **Check existing logs** for similar patterns
2. **Run with maximum debugging** (`DEBUG=* DEBUG_LEVEL=DEBUG`)
3. **Use the log analyzer** to identify patterns
4. **Create minimal reproduction** using debug tools
5. **File an issue** with logs and crash dumps attached

## Summary

The debug infrastructure provides:

- ✅ **Comprehensive logging** at multiple levels
- ✅ **Automatic crash detection** and dumps
- ✅ **Process monitoring** for VS Code lifecycle
- ✅ **Log analysis tools** for pattern detection
- ✅ **Clean separation** from git (all logs gitignored)
- ✅ **Structured JSON format** for easy parsing
- ✅ **Rotation system** to prevent disk filling
- ✅ **Multiple debug namespaces** for filtering

Use these tools to quickly identify and resolve test failures!