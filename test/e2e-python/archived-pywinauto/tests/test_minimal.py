"""Minimal test to verify VS Code can launch with extension."""
import pytest
import time


def test_vscode_launches(vscode):
    """Test that VS Code launches without crashing."""
    print("VS Code launched successfully")
    
    # Just verify the process is running
    assert vscode.process is not None, "VS Code process not started"
    
    # Wait a bit
    time.sleep(3)
    
    # Check if still running
    if vscode.process.poll() is None:
        print("VS Code is still running - test passed")
        assert True
    else:
        print(f"VS Code exited with code: {vscode.process.returncode}")
        assert False, "VS Code process terminated unexpectedly"
    
    # Take a screenshot for verification
    vscode.take_screenshot("minimal_test.png")


def test_extension_present(vscode):
    """Test that extension loads without crashing VS Code."""
    print("Checking if extension loads...")
    
    # Just wait and see if VS Code stays alive
    success = vscode.wait_for_extension("WSL Manager", timeout=15)
    
    if success:
        print("Extension loaded (or VS Code still running)")
    else:
        print("VS Code crashed while loading extension")
    
    assert success, "Extension failed to load or VS Code crashed"
    
    # Take screenshot
    vscode.take_screenshot("extension_check.png")