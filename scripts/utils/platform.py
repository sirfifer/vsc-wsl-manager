#!/usr/bin/env python3
"""
Platform detection and utilities for cross-platform environment setup.
Provides consistent interfaces for platform-specific operations.
"""

import os
import platform
import subprocess
import sys
from pathlib import Path
from typing import Optional, Tuple, List, Dict


class PlatformUtils:
    """Utilities for cross-platform operations."""
    
    @staticmethod
    def get_platform() -> str:
        """
        Get the current platform identifier.
        
        Returns:
            str: 'windows', 'linux', 'macos', or 'unknown'
        """
        system = platform.system().lower()
        if system == 'windows':
            return 'windows'
        elif system == 'linux':
            return 'linux'
        elif system == 'darwin':
            return 'macos'
        else:
            return 'unknown'
    
    @staticmethod
    def is_windows() -> bool:
        """Check if running on Windows."""
        return PlatformUtils.get_platform() == 'windows'
    
    @staticmethod
    def is_linux() -> bool:
        """Check if running on Linux."""
        return PlatformUtils.get_platform() == 'linux'
    
    @staticmethod
    def is_macos() -> bool:
        """Check if running on macOS."""
        return PlatformUtils.get_platform() == 'macos'
    
    @staticmethod
    def is_wsl() -> bool:
        """Check if running inside WSL."""
        if not PlatformUtils.is_linux():
            return False
        
        # Check for WSL-specific files/environment
        return (
            os.path.exists('/proc/sys/fs/binfmt_misc/WSLInterop') or
            'microsoft' in platform.uname().release.lower() or
            'WSL' in os.environ.get('WSL_DISTRO_NAME', '')
        )
    
    @staticmethod
    def get_shell_command() -> List[str]:
        """
        Get the appropriate shell command for the platform.
        
        Returns:
            List[str]: Shell command array for subprocess
        """
        if PlatformUtils.is_windows():
            return ['cmd', '/c']
        else:
            return ['sh', '-c']
    
    @staticmethod
    def get_npm_command() -> str:
        """Get the npm command with proper extension for Windows."""
        if PlatformUtils.is_windows():
            return 'npm.cmd'
        return 'npm'
    
    @staticmethod
    def get_node_command() -> str:
        """Get the node command with proper extension for Windows."""
        if PlatformUtils.is_windows():
            return 'node.exe'
        return 'node'
    
    @staticmethod
    def find_executable(name: str) -> Optional[Path]:
        """
        Find an executable in the system PATH.
        
        Args:
            name: The executable name (without extension)
            
        Returns:
            Optional[Path]: Path to the executable, or None if not found
        """
        # Platform-specific executable names
        if PlatformUtils.is_windows():
            extensions = ['.exe', '.cmd', '.bat', '']
        else:
            extensions = ['']
        
        # Search in PATH
        path_env = os.environ.get('PATH', '').split(os.pathsep)
        
        for directory in path_env:
            for ext in extensions:
                executable = Path(directory) / f"{name}{ext}"
                if executable.is_file() and os.access(executable, os.X_OK):
                    return executable
        
        return None
    
    @staticmethod
    def run_command(command: List[str], check: bool = True, capture_output: bool = True) -> subprocess.CompletedProcess:
        """
        Run a command with platform-appropriate settings.
        
        Args:
            command: Command array
            check: Whether to raise on non-zero exit
            capture_output: Whether to capture stdout/stderr
            
        Returns:
            subprocess.CompletedProcess: The completed process
        """
        # Use shell on Windows for better compatibility
        use_shell = PlatformUtils.is_windows()
        
        if capture_output:
            return subprocess.run(
                command,
                check=check,
                capture_output=True,
                text=True,
                shell=use_shell
            )
        else:
            return subprocess.run(
                command,
                check=check,
                shell=use_shell
            )
    
    @staticmethod
    def get_user_home() -> Path:
        """Get the user's home directory."""
        return Path.home()
    
    @staticmethod
    def get_app_data_dir(app_name: str) -> Path:
        """
        Get the appropriate application data directory.
        
        Args:
            app_name: The application name
            
        Returns:
            Path: The application data directory
        """
        if PlatformUtils.is_windows():
            base = os.environ.get('APPDATA', str(Path.home() / 'AppData' / 'Roaming'))
            return Path(base) / app_name
        elif PlatformUtils.is_macos():
            return Path.home() / 'Library' / 'Application Support' / app_name
        else:  # Linux and others
            xdg_data = os.environ.get('XDG_DATA_HOME', str(Path.home() / '.local' / 'share'))
            return Path(xdg_data) / app_name
    
    @staticmethod
    def add_to_path(directory: Path, permanent: bool = False) -> bool:
        """
        Add a directory to PATH.
        
        Args:
            directory: Directory to add to PATH
            permanent: Whether to make the change permanent
            
        Returns:
            bool: Success status
        """
        directory_str = str(directory)
        
        # Add to current session
        current_path = os.environ.get('PATH', '')
        if directory_str not in current_path.split(os.pathsep):
            os.environ['PATH'] = f"{directory_str}{os.pathsep}{current_path}"
        
        if not permanent:
            return True
        
        # Platform-specific permanent PATH modification
        try:
            if PlatformUtils.is_windows():
                # Use setx for Windows (user PATH)
                PlatformUtils.run_command([
                    'setx', 'PATH', f"%PATH%;{directory_str}"
                ], check=False)
                print(f"Added {directory_str} to user PATH. Restart your terminal for changes to take effect.")
            else:
                # For Unix-like systems, append to shell profile
                shell = os.environ.get('SHELL', '/bin/bash')
                if 'zsh' in shell:
                    profile = Path.home() / '.zshrc'
                elif 'fish' in shell:
                    profile = Path.home() / '.config' / 'fish' / 'config.fish'
                else:
                    profile = Path.home() / '.bashrc'
                
                export_line = f'\nexport PATH="{directory_str}:$PATH"\n'
                
                if profile.exists():
                    content = profile.read_text()
                    if directory_str not in content:
                        profile.write_text(content + export_line)
                        print(f"Added {directory_str} to {profile}. Run 'source {profile}' or restart your terminal.")
                else:
                    profile.write_text(export_line)
                    print(f"Created {profile} with PATH update. Run 'source {profile}' or restart your terminal.")
            
            return True
            
        except Exception as e:
            print(f"Warning: Could not permanently add to PATH: {e}")
            return False
    
    @staticmethod
    def check_wsl_installed() -> Tuple[bool, str]:
        """
        Check if WSL is installed on Windows.
        
        Returns:
            Tuple[bool, str]: (is_installed, version_or_error_message)
        """
        if not PlatformUtils.is_windows():
            return True, "Not Windows - WSL check skipped"
        
        try:
            result = PlatformUtils.run_command(['wsl', '--version'], capture_output=True)
            if result.returncode == 0:
                return True, result.stdout.strip()
            else:
                return False, "WSL is not installed or not in PATH"
        except (subprocess.SubprocessError, FileNotFoundError):
            return False, "WSL is not installed. Please install WSL 2 from Microsoft Store or run 'wsl --install' in an admin PowerShell."
    
    @staticmethod
    def get_python_version() -> Tuple[int, int]:
        """
        Get the current Python version.
        
        Returns:
            Tuple[int, int]: (major, minor) version numbers
        """
        return sys.version_info.major, sys.version_info.minor
    
    @staticmethod
    def ensure_admin_windows() -> bool:
        """
        Check if running with administrator privileges on Windows.
        
        Returns:
            bool: True if admin/elevated, False otherwise
        """
        if not PlatformUtils.is_windows():
            return True
        
        try:
            import ctypes
            return ctypes.windll.shell32.IsUserAnAdmin() != 0
        except:
            return False
    
    @staticmethod
    def get_terminal_size() -> Tuple[int, int]:
        """
        Get terminal size.
        
        Returns:
            Tuple[int, int]: (columns, rows)
        """
        try:
            size = os.get_terminal_size()
            return size.columns, size.lines
        except:
            return 80, 24  # Default size
    
    @staticmethod
    def clear_terminal():
        """Clear the terminal screen."""
        if PlatformUtils.is_windows():
            os.system('cls')
        else:
            os.system('clear')


# Convenience functions
def is_windows() -> bool:
    """Check if running on Windows."""
    return PlatformUtils.is_windows()

def is_linux() -> bool:
    """Check if running on Linux."""
    return PlatformUtils.is_linux()

def is_macos() -> bool:
    """Check if running on macOS."""
    return PlatformUtils.is_macos()

def is_wsl() -> bool:
    """Check if running inside WSL."""
    return PlatformUtils.is_wsl()

def find_executable(name: str) -> Optional[Path]:
    """Find an executable in PATH."""
    return PlatformUtils.find_executable(name)