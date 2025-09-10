"""Path conversion utilities for WSL <-> Windows."""
import os
import sys
import subprocess
from pathlib import Path


def wsl_to_windows(wsl_path: str) -> str:
    """Convert WSL path to Windows path."""
    if not wsl_path.startswith('/mnt/'):
        raise ValueError(f"Path must be on Windows mount: {wsl_path}")
    
    # Convert /mnt/c/... to C:\...
    parts = wsl_path.split('/')
    if len(parts) < 3:
        raise ValueError(f"Invalid WSL path: {wsl_path}")
    
    drive = parts[2].upper()
    rest = '\\'.join(parts[3:])
    return f"{drive}:\\{rest}" if rest else f"{drive}:\\"


def get_project_root() -> str:
    """Get the project root in Windows format."""
    # When running from Windows, we're already in the project
    if sys.platform == 'win32':
        # Get the actual project root (4 levels up from this file)
        project_root = str(Path(__file__).parent.parent.parent.parent.resolve())
        # Ensure it's in Windows format with backslashes
        project_root = project_root.replace('/', '\\')
        print(f"Project root (Windows): {project_root}")
        return project_root
    else:
        # Convert from WSL path - this shouldn't happen in our setup
        cwd = os.getcwd()
        windows_path = wsl_to_windows(cwd)
        print(f"Project root (converted from WSL): {windows_path}")
        return windows_path


def find_vscode_executable() -> str:
    """Find VS Code executable on Windows."""
    candidates = [
        r"C:\Users\ramerman\AppData\Local\Programs\Microsoft VS Code\Code.exe",
        r"C:\Program Files\Microsoft VS Code\Code.exe",
        r"C:\Program Files (x86)\Microsoft VS Code\Code.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Microsoft VS Code\Code.exe"),
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Microsoft VS Code Insiders\Code - Insiders.exe"),
    ]
    
    # Try to find via where command
    try:
        result = subprocess.run(['where', 'code'], capture_output=True, text=True)
        if result.returncode == 0:
            code_path = result.stdout.strip().split('\n')[0]
            if os.path.exists(code_path):
                return code_path
    except:
        pass
    
    # Check standard locations
    for candidate in candidates:
        expanded = os.path.expandvars(candidate)
        if os.path.exists(expanded):
            print(f"Found VS Code at: {expanded}")
            return expanded
    
    raise FileNotFoundError("VS Code executable not found. Please install VS Code or add it to PATH.")