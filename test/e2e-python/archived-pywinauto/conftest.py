"""Pytest configuration and fixtures."""
import pytest
import os
import sys
from typing import Generator

# Add helpers to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'helpers'))

from vscode_helper import VSCodeHelper


@pytest.fixture(scope="function")
def vscode() -> Generator[VSCodeHelper, None, None]:
    """Fixture to provide VS Code instance for testing.
    
    Yields:
        VSCodeHelper instance
    """
    # Kill any existing VS Code processes first
    import subprocess
    import time
    try:
        subprocess.run(['taskkill', '/F', '/IM', 'Code.exe', '/T'], 
                      capture_output=True, timeout=5)
        time.sleep(2)  # Wait for processes to die
    except:
        pass
    
    helper = VSCodeHelper()
    
    # Launch VS Code
    if not helper.launch():
        pytest.fail("Failed to launch VS Code")
    
    yield helper
    
    # Cleanup
    helper.close()
    
    # Extra cleanup to ensure no lingering processes
    time.sleep(1)


@pytest.fixture(scope="function")
def vscode_with_workspace(tmp_path) -> Generator[VSCodeHelper, None, None]:
    """Fixture to provide VS Code with a test workspace.
    
    Yields:
        VSCodeHelper instance with workspace
    """
    # Create test workspace
    workspace_dir = tmp_path / "test_workspace"
    workspace_dir.mkdir()
    
    # Create a test file
    test_file = workspace_dir / "test.md"
    test_file.write_text("# Test Workspace\n\nFor E2E testing")
    
    helper = VSCodeHelper()
    
    # Launch VS Code with workspace
    if not helper.launch(workspace_path=str(workspace_dir)):
        pytest.fail("Failed to launch VS Code with workspace")
    
    yield helper
    
    # Cleanup
    helper.close()


@pytest.fixture(autouse=True)
def screenshot_on_failure(request):
    """Automatically take screenshot on test failure."""
    yield
    
    # Check if test failed
    if hasattr(request.node, 'rep_call') and request.node.rep_call.failed:
        # Get VS Code helper if available
        if 'vscode' in request.fixturenames:
            vscode = request.getfixturevalue('vscode')
            test_name = request.node.name
            screenshot_name = f"failure_{test_name}.png"
            vscode.take_screenshot(screenshot_name)


@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """Make test result available to fixtures."""
    outcome = yield
    rep = outcome.get_result()
    setattr(item, "rep_" + rep.when, rep)