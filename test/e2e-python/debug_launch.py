"""Debug script to test VS Code launching without pytest complexity."""
import subprocess
import time
import os
import sys

def test_basic_launch():
    """Test basic VS Code launching scenarios."""
    
    # VS Code executable path
    code_path = r"C:\Users\ramerman\AppData\Local\Programs\Microsoft VS Code\Code.exe"
    
    # Check if VS Code exists
    if not os.path.exists(code_path):
        print(f"ERROR: VS Code not found at {code_path}")
        return False
    
    print(f"Found VS Code at: {code_path}")
    
    # Test 1: Just get version
    print("\n" + "="*50)
    print("Test 1: Getting VS Code version...")
    try:
        proc = subprocess.Popen(
            [code_path, "--version"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        stdout, stderr = proc.communicate(timeout=5)
        print(f"Version output: {stdout}")
        if stderr:
            print(f"Errors: {stderr}")
        print(f"Exit code: {proc.returncode}")
    except Exception as e:
        print(f"Failed to get version: {e}")
        return False
    
    # Test 2: Launch with help (should exit immediately)
    print("\n" + "="*50)
    print("Test 2: Launch with --help flag...")
    try:
        proc = subprocess.Popen(
            [code_path, "--help"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        stdout, stderr = proc.communicate(timeout=5)
        print(f"Help launched successfully")
        print(f"Exit code: {proc.returncode}")
    except Exception as e:
        print(f"Failed with --help: {e}")
        return False
    
    # Test 3: Launch VS Code in new window (will actually open)
    print("\n" + "="*50)
    print("Test 3: Launch VS Code in new window...")
    print("VS Code should open now. Will close in 5 seconds...")
    try:
        proc = subprocess.Popen([
            code_path,
            "--new-window",
            "--disable-gpu",
            "--disable-extensions"
        ])
        time.sleep(5)
        print("Terminating VS Code...")
        proc.terminate()
        time.sleep(1)
        print("VS Code terminated successfully")
    except Exception as e:
        print(f"Failed to launch new window: {e}")
        return False
    
    # Test 4: Launch with extension development path
    print("\n" + "="*50)
    print("Test 4: Launch with extension development path...")
    ext_path = r"C:\data\rea\dev\vsc-wsl-manager"
    
    # Check if extension path exists
    if not os.path.exists(ext_path):
        print(f"WARNING: Extension path not found: {ext_path}")
        print("Skipping extension test")
        return True
    
    # Check if extension is compiled
    extension_main = os.path.join(ext_path, "out", "src", "extension.js")
    if not os.path.exists(extension_main):
        print(f"WARNING: Extension not compiled: {extension_main}")
        print("Please run 'npm run compile' first")
        return False
    
    print(f"Extension path: {ext_path}")
    print("Launching VS Code with extension in development mode...")
    print("VS Code should open with the extension. Will close in 10 seconds...")
    
    try:
        proc = subprocess.Popen([
            code_path,
            "--new-window",
            "--extensionDevelopmentPath", ext_path,
            "--disable-gpu",
            "--disable-extensions",  # Disable other extensions
            "--skip-welcome",
            "--skip-release-notes",
            "--disable-telemetry",
            "--disable-updates"
        ])
        time.sleep(10)
        print("Terminating VS Code...")
        proc.terminate()
        time.sleep(1)
        print("VS Code with extension terminated successfully")
    except Exception as e:
        print(f"Failed to launch with extension: {e}")
        # Try to kill VS Code if it's still running
        try:
            subprocess.run(['taskkill', '/F', '/IM', 'Code.exe'], 
                         capture_output=True)
        except:
            pass
        return False
    
    print("\n" + "="*50)
    print("All tests completed successfully!")
    return True


if __name__ == "__main__":
    print("VS Code Launch Debug Script")
    print("="*50)
    
    success = test_basic_launch()
    
    if success:
        print("\n✅ VS Code can be launched successfully")
        print("You can now try running the full E2E tests")
    else:
        print("\n❌ VS Code launch tests failed")
        print("Please check the errors above")
    
    sys.exit(0 if success else 1)