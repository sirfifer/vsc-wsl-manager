"""Test extension commands."""
import pytest
import time


class TestCommands:
    """Test suite for extension commands."""
    
    def test_refresh_command(self, vscode):
        """Test refresh distributions command."""
        # Wait for extension
        vscode.wait_for_extension("WSL Manager", timeout=20)
        
        # Run refresh command
        success = vscode.run_command("WSL Manager: Refresh")
        assert success, "Failed to run refresh command"
        
        # Check for errors - give time for command to complete
        time.sleep(2)
        
        vscode.take_screenshot("after_refresh.png")
        
        # Test passes if VS Code is still responsive
        assert vscode.window is not None, "VS Code window lost after refresh"
    
    def test_show_help_command(self, vscode):
        """Test show help command."""
        vscode.wait_for_extension("WSL Manager", timeout=20)
        
        # Run help command
        success = vscode.run_command("WSL Manager: Learn about WSL")
        assert success, "Failed to run help command"
        
        time.sleep(2)
        vscode.take_screenshot("help_command.png")
        
        # Test passes if VS Code is still responsive
        assert vscode.window is not None, "VS Code window lost"
    
    @pytest.mark.skip(reason="Requires WSL configuration")
    def test_create_distribution(self, vscode):
        """Test create distribution command."""
        vscode.wait_for_extension("WSL Manager", timeout=20)
        
        # Run create command
        success = vscode.run_command("WSL Manager: Create Distribution")
        assert success, "Failed to run create command"
        
        # Would need to handle dialog interaction here
        time.sleep(2)
        vscode.take_screenshot("create_dialog.png")
    
    def test_command_error_handling(self, vscode):
        """Test that commands handle errors gracefully."""
        vscode.wait_for_extension("WSL Manager", timeout=20)
        
        # Try to run a command that might fail
        vscode.run_command("WSL Manager: Export Distribution")
        
        # Should not crash VS Code
        time.sleep(3)
        assert vscode.window is not None, "VS Code crashed"
        
        vscode.take_screenshot("error_handling.png")