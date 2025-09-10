"""Single test to verify VS Code launches properly with extension."""
import time


def test_vscode_launches_with_extension(vscode):
    """Test that VS Code launches with extension without crashing."""
    print("\n" + "="*50)
    print("TEST: VS Code Launch with Extension")
    print("="*50)
    
    # Verify the process started
    assert vscode.process is not None, "VS Code process not started"
    print(f"VS Code process started with PID: {vscode.process.pid}")
    
    # Wait a reasonable time for VS Code to stabilize
    print("Waiting for VS Code to stabilize...")
    time.sleep(5)
    
    # Check if still running
    if vscode.process.poll() is None:
        print("SUCCESS: VS Code is still running after 5 seconds")
        
        # Wait for extension
        print("Checking if extension loads...")
        success = vscode.wait_for_extension("WSL Manager", timeout=10)
        
        if success:
            print("SUCCESS: Extension loaded (or VS Code still running)")
        else:
            print("FAILURE: VS Code crashed while loading extension")
            assert False, "VS Code crashed"
        
        # Take a screenshot for verification
        screenshot_path = vscode.take_screenshot("single_test_success.png")
        if screenshot_path:
            print(f"Screenshot saved: {screenshot_path}")
        
        # Let it run a bit more
        print("Letting VS Code run for 5 more seconds...")
        time.sleep(5)
        
        # Final check
        if vscode.process.poll() is None:
            print("FINAL: VS Code still running - test PASSED")
            assert True
        else:
            print(f"FINAL: VS Code exited with code: {vscode.process.returncode}")
            assert False, "VS Code terminated unexpectedly"
    else:
        print(f"FAILURE: VS Code exited early with code: {vscode.process.returncode}")
        # Try to get output
        stdout, stderr = vscode.process.communicate()
        if stdout:
            print(f"Stdout: {stdout}")
        if stderr:
            print(f"Stderr: {stderr}")
        assert False, "VS Code process terminated unexpectedly"
    
    print("="*50)
    print("Test completed")
    print("="*50)