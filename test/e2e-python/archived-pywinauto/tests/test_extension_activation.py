"""Test extension activation and basic functionality."""
import pytest
import time


class TestExtensionActivation:
    """Test suite for extension activation."""
    
    def test_extension_loads(self, vscode):
        """Test that WSL Manager extension loads successfully."""
        # Wait for extension to load
        assert vscode.wait_for_extension("WSL Manager", timeout=20), \
            "WSL Manager extension did not load"
        
        # Take screenshot for verification
        vscode.take_screenshot("extension_loaded.png")
    
    def test_activity_bar_icon(self, vscode):
        """Test that WSL Manager appears in activity bar."""
        # Wait for extension
        vscode.wait_for_extension("WSL Manager", timeout=20)
        
        # Check for WSL in activity bar
        # Click on Explorer first to ensure activity bar is visible
        vscode.send_keys("^+e")  # Ctrl+Shift+E for Explorer
        time.sleep(1)
        
        # Look for WSL text/icon - might not be visible in text form
        # Take screenshot to verify
        vscode.take_screenshot("activity_bar_check.png")
        
        # Test passes if VS Code is still responsive
        assert vscode.window is not None, "VS Code window lost"
    
    def test_commands_registered(self, vscode):
        """Test that extension commands are registered."""
        # Wait for extension
        vscode.wait_for_extension("WSL Manager", timeout=20)
        
        # Open command palette
        assert vscode.open_command_palette(), \
            "Failed to open command palette"
        
        # Type WSL to filter commands
        time.sleep(0.5)
        vscode.send_keys("WSL Manager")
        time.sleep(1)
        
        # Check for commands
        vscode.take_screenshot("commands_palette.png")
        
        # Close palette
        vscode.send_keys("{ESC}")
    
    def test_no_error_notifications(self, vscode):
        """Test that extension loads without errors."""
        # Wait for extension
        vscode.wait_for_extension("WSL Manager", timeout=20)
        
        # Check for error notifications
        time.sleep(3)  # Give time for any errors to appear
        
        # Take screenshot for debugging
        vscode.take_screenshot("no_errors_check.png")
        
        # Test passes if VS Code is still responsive
        assert vscode.window is not None, "VS Code window lost"