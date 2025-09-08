# Python E2E Testing Guide

## Overview

This guide covers the Python-based end-to-end testing framework for the VSC WSL Manager extension. The framework uses pywinauto to automate VS Code on Windows while tests run from WSL.

## Architecture

```
WSL (Linux)                    Windows Host
-----------                    -------------
Test Scripts  ──cmd.exe───→   Python Tests
pytest                         pywinauto
Test Results  ←─────────────  VS Code UI
```

## Requirements

### System Requirements
- **Project Location**: Must be under `/mnt/c/...` (Windows-accessible path)
- **Python**: Installed on both WSL and Windows
- **VS Code**: Installed on Windows
- **Operating System**: Windows 10/11 with WSL2

### Python Dependencies
```bash
# Install on Windows via WSL
cmd.exe /c "pip install -r test/e2e-python/requirements.txt"
```

Required packages:
- pytest >= 7.4.0
- pywinauto >= 0.6.8
- pyautogui >= 0.9.54
- Pillow >= 10.0.0
- pytest-html >= 3.2.0
- pytest-timeout >= 2.1.0

## Directory Structure

```
test/e2e-python/
├── __init__.py
├── requirements.txt
├── conftest.py              # Pytest configuration and fixtures
├── debug_launch.py          # Debug script for troubleshooting
├── helpers/
│   ├── __init__.py
│   ├── path_converter.py    # WSL to Windows path conversion
│   └── vscode_helper.py     # VS Code automation utilities
├── tests/
│   ├── __init__.py
│   ├── test_extension_activation.py
│   ├── test_commands.py
│   ├── test_minimal.py
│   └── test_single.py
├── reports/                 # Test reports (generated)
└── screenshots/            # Test screenshots (generated)
```

## Writing Tests

### Basic Test Structure

```python
import pytest
import time

def test_extension_loads(vscode):
    """Test that WSL Manager extension loads successfully."""
    # Wait for extension to load
    assert vscode.wait_for_extension("WSL Manager", timeout=20), \
        "WSL Manager extension did not load"
    
    # Take screenshot for verification
    vscode.take_screenshot("extension_loaded.png")
```

### Using the VS Code Fixture

The `vscode` fixture automatically launches and closes VS Code:

```python
def test_with_vscode(vscode):
    # VS Code is already launched
    assert vscode.process is not None
    
    # Interact with VS Code
    vscode.open_command_palette()
    vscode.run_command("WSL Manager: Refresh")
    
    # VS Code will be closed automatically after test
```

### Available Helper Methods

```python
# Launch and connection
vscode.launch(workspace_path=None, new_window=True, wait_time=10)
vscode.connect_to_window(timeout=30)

# Extension management
vscode.wait_for_extension(extension_name, timeout=30)

# UI interaction
vscode.open_command_palette()
vscode.run_command(command_name)
vscode.send_keys(keys)
vscode.find_text(text)

# Screenshots
vscode.take_screenshot(filename)

# Cleanup
vscode.close()
```

## Running Tests

### Run All Tests
```bash
npm run test:e2e:python
```

### Run Specific Test Suite
```bash
npm run test:e2e:python:activation
npm run test:e2e:python:commands
```

### Run Single Test
```bash
./scripts/run-single-python-test.sh
```

### Run with Custom Options
```bash
# Run specific test by name
bash scripts/run-python-e2e.sh "test_extension_loads"

# Run with verbose output
bash scripts/run-python-e2e.sh -v

# Run with custom timeout
bash scripts/run-python-e2e.sh --timeout=120
```

### Clean Test Artifacts
```bash
npm run test:e2e:python:clean
```

## Debugging

### Debug VS Code Launch Issues

Run the debug script to test VS Code launching:

```bash
cmd.exe /c "python test\\e2e-python\\debug_launch.py"
```

This script:
1. Tests basic VS Code launch
2. Verifies extension path
3. Checks for common issues
4. Provides detailed error messages

### Common Issues and Solutions

#### VS Code Crashes
**Problem**: VS Code crashes when tests run
**Solution**: Remove conflicting flags in `vscode_helper.py`:
- Don't use `--disable-extensions` with `--extensionDevelopmentPath`
- Use isolated profile directories instead

#### Path Errors
**Problem**: "Path must be on Windows mount" error
**Solution**: Ensure project is under `/mnt/c/`:
```bash
# Move project to Windows filesystem
mv ~/projects/vsc-wsl-manager /mnt/c/projects/
```

#### Import Errors
**Problem**: Python packages not found
**Solution**: Install on Windows Python:
```bash
cmd.exe /c "pip install -r test\\e2e-python\\requirements.txt"
```

#### Tests Timeout
**Problem**: Tests timeout before completing
**Solution**: Increase timeout in test or fixture:
```python
# In test
pytest.mark.timeout(120)

# In fixture
vscode.wait_for_extension("WSL Manager", timeout=60)
```

#### Multiple Windows Open
**Problem**: Multiple VS Code windows open during tests
**Solution**: Ensure proper cleanup in `conftest.py`:
```python
# Kill existing processes before test
subprocess.run(['taskkill', '/F', '/IM', 'Code.exe', '/T'])
```

## Test Reports

### HTML Report
Tests generate an HTML report at `test/e2e-python/reports/report.html`:
```bash
# View report (Windows path)
cmd.exe /c "start test\\e2e-python\\reports\\report.html"
```

### Screenshots
Failed tests automatically capture screenshots to `test/e2e-python/screenshots/`:
- Named with test name and timestamp
- PNG format
- Useful for debugging UI issues

## Best Practices

1. **Always Clean Up**: Ensure VS Code processes are killed after tests
2. **Use Explicit Waits**: Don't rely on `time.sleep()` alone
3. **Take Screenshots**: Capture state on failures for debugging
4. **Isolate Tests**: Each test should be independent
5. **Check Process State**: Verify VS Code is still running during tests
6. **Use Windows Paths**: Convert WSL paths for Windows execution
7. **Handle Timeouts**: Set appropriate timeouts for operations

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Python E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: windows-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    
    - name: Install dependencies
      run: |
        pip install -r test/e2e-python/requirements.txt
    
    - name: Run E2E tests
      run: |
        python -m pytest test/e2e-python/tests -v
      timeout-minutes: 10
    
    - name: Upload screenshots
      if: failure()
      uses: actions/upload-artifact@v3
      with:
        name: screenshots
        path: test/e2e-python/screenshots/
```

## Extending the Framework

### Adding New Helper Methods

Edit `test/e2e-python/helpers/vscode_helper.py`:

```python
def click_activity_bar_icon(self, icon_name: str) -> bool:
    """Click an icon in the activity bar."""
    # Implementation
    pass
```

### Creating Custom Fixtures

Edit `test/e2e-python/conftest.py`:

```python
@pytest.fixture
def vscode_with_wsl() -> Generator[VSCodeHelper, None, None]:
    """VS Code with WSL distribution ready."""
    helper = VSCodeHelper()
    helper.launch()
    # Setup WSL
    yield helper
    helper.close()
```

## Troubleshooting Scripts

The framework includes several troubleshooting scripts:

1. **debug_launch.py**: Test basic VS Code launching
2. **run-single-python-test.sh**: Run one test in isolation
3. **run-python-e2e.sh**: Main test runner with error handling

Each script provides detailed output to help diagnose issues.

## Summary

The Python E2E testing framework provides:
- ✅ Reliable VS Code UI automation
- ✅ Cross-platform test execution (WSL → Windows)
- ✅ Comprehensive error handling
- ✅ Automatic screenshot capture
- ✅ HTML test reports
- ✅ Easy debugging tools

This approach ensures the VSC WSL Manager extension works correctly in real-world usage scenarios.