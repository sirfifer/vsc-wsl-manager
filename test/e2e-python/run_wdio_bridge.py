#!/usr/bin/env python3
"""
Python bridge to run WebdriverIO tests on Windows from WSL.
This script converts paths and executes WebdriverIO tests on the Windows side.
"""

import os
import sys
import subprocess
import json
import time
import argparse
from pathlib import Path


def convert_wsl_to_windows_path(wsl_path: str) -> str:
    """Convert WSL path to Windows path."""
    if wsl_path.startswith('/mnt/'):
        # Extract drive letter and path
        parts = wsl_path[5:].split('/', 1)
        if len(parts) == 2:
            drive = parts[0].upper()
            path = parts[1].replace('/', '\\')
            return f"{drive}:\\{path}"
        elif len(parts) == 1:
            drive = parts[0].upper()
            return f"{drive}:\\"
    return wsl_path


def check_requirements():
    """Check if all requirements are met."""
    issues = []
    
    # Check if we're in WSL
    if not os.path.exists('/proc/sys/fs/binfmt_misc/WSLInterop'):
        issues.append("This script must be run from WSL")
    
    # Check if project is on Windows filesystem
    cwd = os.getcwd()
    if not cwd.startswith('/mnt/'):
        issues.append(f"Project must be on Windows filesystem (/mnt/c/...), current: {cwd}")
    
    # Check for Node.js on Windows
    try:
        result = subprocess.run(
            ['cmd.exe', '/c', 'node', '--version'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode != 0:
            issues.append("Node.js not found on Windows")
        else:
            print(f"✅ Node.js version on Windows: {result.stdout.strip()}")
    except Exception as e:
        issues.append(f"Failed to check Node.js: {e}")
    
    # Check for npm on Windows
    try:
        result = subprocess.run(
            ['cmd.exe', '/c', 'npm', '--version'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode != 0:
            issues.append("npm not found on Windows")
        else:
            print(f"✅ npm version on Windows: {result.stdout.strip()}")
    except Exception as e:
        issues.append(f"Failed to check npm: {e}")
    
    # Check for VS Code on Windows
    try:
        result = subprocess.run(
            ['cmd.exe', '/c', 'where', 'code'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0 and 'code' in result.stdout.lower():
            print(f"✅ VS Code found on Windows")
        else:
            print("⚠️ VS Code not found in PATH, will try to use wdio-vscode-service")
    except Exception as e:
        print(f"⚠️ Could not check for VS Code: {e}")
    
    return issues


def compile_extension(win_path: str) -> bool:
    """Compile the extension if needed."""
    out_path = os.path.join(os.getcwd(), 'out', 'src', 'extension.js')
    
    if not os.path.exists(out_path):
        print("🔨 Compiling extension...")
        cmd = f'cd "{win_path}" && npm run compile'
        result = subprocess.run(
            ['cmd.exe', '/c', cmd],
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            print(f"❌ Compilation failed:\n{result.stderr}")
            return False
        print("✅ Extension compiled successfully")
    else:
        print("✅ Extension already compiled")
    
    return True


def run_wdio_tests(win_path: str, spec: str = None, debug: bool = False, use_minimal: bool = False) -> int:
    """Run WebdriverIO tests on Windows."""
    
    # Choose config file - use JavaScript to avoid TypeScript issues
    config_file = 'wdio.conf.windows.js'
    
    # If minimal test requested, use minimal spec
    if use_minimal:
        spec = 'test\\e2e\\minimal.test.js'  # Use Windows path separator
        print("🧪 Running minimal test for debugging...")
    
    # Build the command - use node to run wdio directly
    # This avoids issues with .cmd files not being generated
    # Remove quotes around path since subprocess will handle them
    wdio_cli = 'node node_modules\\@wdio\\cli\\bin\\wdio.js'  # Use backslashes for Windows
    cmd = f'cd /D {win_path} && {wdio_cli} run {config_file}'
    
    if spec:
        cmd += f' --spec {spec}'
    
    if debug:
        cmd += ' --logLevel=debug'
    
    print(f"\n🚀 Running WebdriverIO tests on Windows...")
    print(f"📁 Windows path: {win_path}")
    print(f"🔧 Command: {cmd}\n")
    print("=" * 60)
    
    # Create environment with color support
    env = os.environ.copy()
    env['FORCE_COLOR'] = '1'
    env['NODE_ENV'] = 'test'
    
    # Run the tests
    try:
        process = subprocess.Popen(
            ['cmd.exe', '/c', cmd],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            universal_newlines=True,
            env=env
        )
        
        # Collect output for debugging
        output_lines = []
        
        # Stream output in real-time
        for line in process.stdout:
            print(line, end='')
            output_lines.append(line)
            
            # Check for common error patterns
            if 'ENOENT' in line or 'cannot find module' in line:
                print("\n⚠️ Module resolution error detected")
            elif 'SyntaxError' in line or 'TypeError' in line:
                print("\n⚠️ JavaScript error detected")
            elif 'VS Code installation not found' in line:
                print("\n⚠️ VS Code not found - will download")
        
        # Wait for process to complete
        return_code = process.wait()
        
        print("=" * 60)
        
        if return_code == 0:
            print("✅ All tests passed!")
        else:
            print(f"❌ Tests failed with exit code: {return_code}")
            
            # Save error output for debugging
            if output_lines:
                error_file = os.path.join(os.getcwd(), 'test', 'wdio-error.log')
                with open(error_file, 'w') as f:
                    f.writelines(output_lines)
                print(f"📝 Full output saved to: {error_file}")
        
        return return_code
        
    except KeyboardInterrupt:
        print("\n⚠️ Test execution interrupted")
        process.terminate()
        cleanup_vs_code()
        return 130
    except Exception as e:
        print(f"❌ Error running tests: {e}")
        return 1


def cleanup_vs_code():
    """Clean up any lingering VS Code processes on Windows."""
    print("🧹 Cleaning up VS Code processes...")
    try:
        subprocess.run(
            ['cmd.exe', '/c', 'taskkill', '/F', '/IM', 'Code.exe', '/T'],
            capture_output=True,
            timeout=5
        )
    except:
        pass  # Ignore errors - processes might not exist


def show_test_results(win_path: str):
    """Display information about test results."""
    # Check for screenshots
    screenshots_dir = os.path.join(os.getcwd(), 'test', 'screenshots')
    if os.path.exists(screenshots_dir):
        screenshots = [f for f in os.listdir(screenshots_dir) if f.endswith('.png')]
        if screenshots:
            print(f"\n📸 Screenshots saved: {len(screenshots)} files")
            print(f"   Location: {screenshots_dir}")
            for screenshot in screenshots[:5]:  # Show first 5
                print(f"   - {screenshot}")
            if len(screenshots) > 5:
                print(f"   ... and {len(screenshots) - 5} more")
    
    # Check for test reports
    reports_dir = os.path.join(os.getcwd(), 'test', 'reports')
    if os.path.exists(reports_dir):
        reports = [f for f in os.listdir(reports_dir) if f.endswith('.html')]
        if reports:
            print(f"\n📊 Test reports generated:")
            for report in reports:
                win_report_path = convert_wsl_to_windows_path(
                    os.path.join(os.getcwd(), 'test', 'reports', report)
                )
                print(f"   {report}")
                print(f"   Open: cmd.exe /c start \"{win_report_path}\"")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Python bridge to run WebdriverIO tests on Windows from WSL'
    )
    parser.add_argument(
        '--spec',
        help='Specific test file to run',
        default=None
    )
    parser.add_argument(
        '--debug',
        action='store_true',
        help='Enable debug logging'
    )
    parser.add_argument(
        '--minimal',
        action='store_true',
        help='Run minimal test for debugging'
    )
    parser.add_argument(
        '--no-compile',
        action='store_true',
        help='Skip compilation check'
    )
    parser.add_argument(
        '--no-cleanup',
        action='store_true',
        help='Skip VS Code cleanup after tests'
    )
    
    args = parser.parse_args()
    
    print("🌉 WebdriverIO Bridge for WSL → Windows")
    print("=" * 60)
    
    # Check requirements
    issues = check_requirements()
    if issues:
        print("\n❌ Requirements check failed:")
        for issue in issues:
            print(f"  - {issue}")
        return 1
    
    # Get paths
    wsl_path = os.getcwd()
    win_path = convert_wsl_to_windows_path(wsl_path)
    
    print(f"\n📁 Project paths:")
    print(f"  WSL:     {wsl_path}")
    print(f"  Windows: {win_path}")
    
    # Compile if needed
    if not args.no_compile:
        if not compile_extension(win_path):
            return 1
    
    # Run tests
    exit_code = run_wdio_tests(win_path, args.spec, args.debug, args.minimal)
    
    # Show results
    show_test_results(win_path)
    
    # Cleanup
    if not args.no_cleanup:
        cleanup_vs_code()
    
    return exit_code


if __name__ == '__main__':
    sys.exit(main())