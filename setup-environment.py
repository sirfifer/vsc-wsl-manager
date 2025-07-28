#!/usr/bin/env python3
"""
VSC WSL Manager - Environment Setup Script
==========================================

This script validates and sets up the development environment for the VSC WSL Manager extension.
It checks for required dependencies, installs missing components, and validates the setup.

Usage:
    python setup-environment.py [options]

Options:
    --skip-optional    Skip optional dependency installation
    --ci              Run in CI mode (non-interactive)
    --verbose         Show detailed output
    --help            Show this help message
"""

import argparse
import json
import os
import sys
import subprocess
import shutil
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any
from datetime import datetime

# Add scripts directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'scripts'))

from utils.platform import PlatformUtils, is_windows, is_linux, is_macos, is_wsl


class Colors:
    """Terminal color codes for pretty output."""
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    
    @staticmethod
    def disable():
        """Disable colors (for CI environments)."""
        Colors.HEADER = ''
        Colors.BLUE = ''
        Colors.CYAN = ''
        Colors.GREEN = ''
        Colors.YELLOW = ''
        Colors.RED = ''
        Colors.ENDC = ''
        Colors.BOLD = ''


class Dependency:
    """Represents a system dependency."""
    
    def __init__(self, name: str, command: str, min_version: Optional[str] = None,
                 install_url: str = "", required: bool = True, 
                 version_command: Optional[str] = None,
                 platform_specific: Optional[List[str]] = None):
        self.name = name
        self.command = command
        self.min_version = min_version
        self.install_url = install_url
        self.required = required
        self.version_command = version_command or f"{command} --version"
        self.platform_specific = platform_specific or []
    
    def should_check(self) -> bool:
        """Check if this dependency should be validated on current platform."""
        if not self.platform_specific:
            return True
        
        current_platform = PlatformUtils.get_platform()
        return current_platform in self.platform_specific


class EnvironmentSetup:
    """Main environment setup class."""
    
    def __init__(self, args: argparse.Namespace):
        self.args = args
        self.project_root = Path(__file__).parent
        self.report = {
            'timestamp': datetime.now().isoformat(),
            'platform': PlatformUtils.get_platform(),
            'python_version': f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
            'checks': {},
            'installations': {},
            'errors': []
        }
        
        # Define dependencies
        self.dependencies = [
            Dependency('Python', 'python', '3.6', 'https://www.python.org/downloads/'),
            Dependency('Node.js', 'node', '16.0.0', 'https://nodejs.org/'),
            Dependency('npm', 'npm', '7.0.0', 'https://nodejs.org/'),
            Dependency('Git', 'git', '2.0.0', 'https://git-scm.com/downloads'),
            Dependency('VS Code', 'code', None, 'https://code.visualstudio.com/', required=False),
            Dependency('WSL', 'wsl', None, 'https://docs.microsoft.com/en-us/windows/wsl/install', 
                      required=True, platform_specific=['windows']),
        ]
        
        # NPM packages to install
        self.npm_packages = {
            'global': [
                {'name': 'vsce', 'required': False}  # VS Code Extension manager
            ]
        }
    
    def print_header(self):
        """Print the setup script header."""
        PlatformUtils.clear_terminal()
        print(f"{Colors.HEADER}{'='*60}{Colors.ENDC}")
        print(f"{Colors.HEADER}VSC WSL Manager - Environment Setup{Colors.ENDC}")
        print(f"{Colors.HEADER}{'='*60}{Colors.ENDC}")
        print(f"Platform: {Colors.CYAN}{PlatformUtils.get_platform()}{Colors.ENDC}")
        print(f"Python: {Colors.CYAN}{sys.version.split()[0]}{Colors.ENDC}")
        if is_wsl():
            print(f"Environment: {Colors.YELLOW}WSL Detected{Colors.ENDC}")
        print(f"{Colors.HEADER}{'='*60}{Colors.ENDC}\n")
    
    def check_dependency(self, dep: Dependency) -> Tuple[bool, str]:
        """
        Check if a dependency is installed and meets version requirements.
        
        Returns:
            Tuple[bool, str]: (is_valid, version_or_error)
        """
        if not dep.should_check():
            return True, "Not required on this platform"
        
        # Special handling for WSL on Windows
        if dep.name == 'WSL' and is_windows():
            return PlatformUtils.check_wsl_installed()
        
        # Find the executable
        executable = PlatformUtils.find_executable(dep.command)
        if not executable:
            return False, "Not found in PATH"
        
        # Check version if required
        if dep.min_version:
            try:
                result = PlatformUtils.run_command(
                    dep.version_command.split(),
                    capture_output=True,
                    check=False
                )
                
                if result.returncode == 0:
                    version_output = result.stdout.strip()
                    # Extract version number (basic pattern)
                    import re
                    version_match = re.search(r'(\d+\.\d+\.\d+)', version_output)
                    if version_match:
                        version = version_match.group(1)
                        if self._compare_versions(version, dep.min_version) >= 0:
                            return True, version
                        else:
                            return False, f"Version {version} < {dep.min_version}"
                    else:
                        return True, "Version check passed (could not parse version)"
                else:
                    return False, "Version check failed"
                    
            except Exception as e:
                return False, f"Version check error: {str(e)}"
        
        return True, "Installed"
    
    def _compare_versions(self, version1: str, version2: str) -> int:
        """
        Compare two version strings.
        
        Returns:
            int: -1 if version1 < version2, 0 if equal, 1 if version1 > version2
        """
        v1_parts = list(map(int, version1.split('.')))
        v2_parts = list(map(int, version2.split('.')))
        
        # Pad with zeros
        max_len = max(len(v1_parts), len(v2_parts))
        v1_parts.extend([0] * (max_len - len(v1_parts)))
        v2_parts.extend([0] * (max_len - len(v2_parts)))
        
        for i in range(max_len):
            if v1_parts[i] < v2_parts[i]:
                return -1
            elif v1_parts[i] > v2_parts[i]:
                return 1
        
        return 0
    
    def validate_dependencies(self) -> bool:
        """
        Validate all system dependencies.
        
        Returns:
            bool: True if all required dependencies are met
        """
        print(f"\n{Colors.BLUE}Checking system dependencies...{Colors.ENDC}\n")
        
        all_valid = True
        
        for dep in self.dependencies:
            if not dep.should_check():
                continue
                
            is_valid, message = self.check_dependency(dep)
            
            # Update report
            self.report['checks'][dep.name] = {
                'required': dep.required,
                'valid': is_valid,
                'message': message
            }
            
            # Display result
            if is_valid:
                status = f"{Colors.GREEN}✓{Colors.ENDC}"
                msg = f"{Colors.GREEN}{message}{Colors.ENDC}"
            else:
                status = f"{Colors.RED}✗{Colors.ENDC}"
                msg = f"{Colors.RED}{message}{Colors.ENDC}"
                if dep.required:
                    all_valid = False
            
            print(f"  {status} {dep.name:<15} {msg}")
            
            if not is_valid and dep.install_url:
                print(f"    {Colors.YELLOW}→ Install from: {dep.install_url}{Colors.ENDC}")
        
        return all_valid
    
    def check_npm_packages(self) -> Dict[str, bool]:
        """Check which npm packages are already installed."""
        print(f"\n{Colors.BLUE}Checking npm packages...{Colors.ENDC}\n")
        
        installed = {}
        
        # Check global packages
        try:
            result = PlatformUtils.run_command(
                [PlatformUtils.get_npm_command(), 'list', '-g', '--depth=0', '--json'],
                capture_output=True,
                check=False
            )
            
            if result.returncode == 0:
                global_packages = json.loads(result.stdout)
                dependencies = global_packages.get('dependencies', {})
                
                for package in self.npm_packages['global']:
                    is_installed = package['name'] in dependencies
                    installed[f"global:{package['name']}"] = is_installed
                    
                    status = f"{Colors.GREEN}✓{Colors.ENDC}" if is_installed else f"{Colors.YELLOW}○{Colors.ENDC}"
                    print(f"  {status} {package['name']} (global)")
            
        except Exception as e:
            print(f"  {Colors.RED}Error checking global packages: {e}{Colors.ENDC}")
        
        # Check local packages
        package_json = self.project_root / 'package.json'
        if package_json.exists():
            try:
                # Check if node_modules exists
                node_modules = self.project_root / 'node_modules'
                if node_modules.exists():
                    print(f"  {Colors.GREEN}✓{Colors.ENDC} Local dependencies (node_modules exists)")
                    installed['local'] = True
                else:
                    print(f"  {Colors.YELLOW}○{Colors.ENDC} Local dependencies (node_modules missing)")
                    installed['local'] = False
                    
            except Exception as e:
                print(f"  {Colors.RED}Error checking local packages: {e}{Colors.ENDC}")
                installed['local'] = False
        
        return installed
    
    def install_npm_packages(self) -> bool:
        """Install required npm packages."""
        print(f"\n{Colors.BLUE}Installing npm packages...{Colors.ENDC}\n")
        
        success = True
        
        # Install local dependencies first
        if not self.args.skip_optional or True:  # Local deps are always required
            print(f"  {Colors.CYAN}Installing local dependencies...{Colors.ENDC}")
            try:
                result = PlatformUtils.run_command(
                    [PlatformUtils.get_npm_command(), 'install'],
                    cwd=self.project_root,
                    check=False
                )
                
                if result.returncode == 0:
                    print(f"  {Colors.GREEN}✓ Local dependencies installed{Colors.ENDC}")
                    self.report['installations']['local_npm'] = 'success'
                else:
                    print(f"  {Colors.RED}✗ Failed to install local dependencies{Colors.ENDC}")
                    self.report['installations']['local_npm'] = 'failed'
                    success = False
                    
            except Exception as e:
                print(f"  {Colors.RED}✗ Error installing local dependencies: {e}{Colors.ENDC}")
                self.report['installations']['local_npm'] = f'error: {str(e)}'
                success = False
        
        # Install global packages
        for package in self.npm_packages['global']:
            if self.args.skip_optional and not package.get('required', True):
                continue
            
            key = f"global:{package['name']}"
            print(f"  {Colors.CYAN}Installing {package['name']} globally...{Colors.ENDC}")
            
            try:
                result = PlatformUtils.run_command(
                    [PlatformUtils.get_npm_command(), 'install', '-g', package['name']],
                    check=False
                )
                
                if result.returncode == 0:
                    print(f"  {Colors.GREEN}✓ {package['name']} installed{Colors.ENDC}")
                    self.report['installations'][key] = 'success'
                else:
                    print(f"  {Colors.YELLOW}⚠ Failed to install {package['name']} (may need sudo/admin){Colors.ENDC}")
                    self.report['installations'][key] = 'failed - may need elevated permissions'
                    if package.get('required', True):
                        success = False
                        
            except Exception as e:
                print(f"  {Colors.RED}✗ Error installing {package['name']}: {e}{Colors.ENDC}")
                self.report['installations'][key] = f'error: {str(e)}'
                if package.get('required', True):
                    success = False
        
        return success
    
    def update_package_json(self) -> bool:
        """Prompt for and update package.json configuration."""
        if self.args.ci:
            print(f"\n{Colors.YELLOW}Skipping package.json update in CI mode{Colors.ENDC}")
            return True
        
        print(f"\n{Colors.BLUE}Updating package.json configuration...{Colors.ENDC}\n")
        
        package_json_path = self.project_root / 'package.json'
        
        try:
            with open(package_json_path, 'r') as f:
                package_data = json.load(f)
            
            # Check if already configured
            if (package_data.get('publisher', '').startswith('your-') or 
                'your-username' in package_data.get('repository', {}).get('url', '')):
                
                print("Package.json contains placeholder values. Let's update them:")
                print("(Press Enter to skip any field)\n")
                
                # Get GitHub username
                github_user = input(f"  GitHub username [current: your-username]: ").strip()
                if not github_user:
                    github_user = 'your-username'
                
                # Get publisher name
                publisher = input(f"  VS Code publisher name [current: {package_data.get('publisher', '')}]: ").strip()
                if not publisher:
                    publisher = package_data.get('publisher', 'your-publisher-name')
                
                # Update values
                updates_made = False
                
                if github_user != 'your-username':
                    package_data['repository']['url'] = f"https://github.com/{github_user}/vsc-wsl-manager"
                    package_data['bugs']['url'] = f"https://github.com/{github_user}/vsc-wsl-manager/issues"
                    package_data['homepage'] = f"https://github.com/{github_user}/vsc-wsl-manager#readme"
                    updates_made = True
                
                if publisher != package_data.get('publisher', ''):
                    package_data['publisher'] = publisher
                    updates_made = True
                
                if updates_made:
                    # Save updated package.json
                    with open(package_json_path, 'w') as f:
                        json.dump(package_data, f, indent=2)
                        f.write('\n')  # Add trailing newline
                    
                    print(f"\n  {Colors.GREEN}✓ Updated package.json{Colors.ENDC}")
                    
                    # Save configuration for future use
                    config = {
                        'github_username': github_user,
                        'publisher': publisher
                    }
                    config_path = self.project_root / '.env.local'
                    with open(config_path, 'w') as f:
                        json.dump(config, f, indent=2)
                    
                    print(f"  {Colors.GREEN}✓ Saved configuration to .env.local{Colors.ENDC}")
                else:
                    print(f"\n  {Colors.YELLOW}No updates made{Colors.ENDC}")
            else:
                print(f"  {Colors.GREEN}✓ Package.json already configured{Colors.ENDC}")
            
            return True
            
        except Exception as e:
            print(f"  {Colors.RED}✗ Error updating package.json: {e}{Colors.ENDC}")
            self.report['errors'].append(f"package.json update: {str(e)}")
            return False
    
    def validate_compilation(self) -> bool:
        """Validate that the project compiles successfully."""
        print(f"\n{Colors.BLUE}Validating project compilation...{Colors.ENDC}\n")
        
        try:
            print(f"  {Colors.CYAN}Running TypeScript compilation...{Colors.ENDC}")
            result = PlatformUtils.run_command(
                [PlatformUtils.get_npm_command(), 'run', 'compile'],
                cwd=self.project_root,
                capture_output=True,
                check=False
            )
            
            if result.returncode == 0:
                print(f"  {Colors.GREEN}✓ TypeScript compilation successful{Colors.ENDC}")
                self.report['checks']['compilation'] = 'success'
                return True
            else:
                print(f"  {Colors.RED}✗ TypeScript compilation failed{Colors.ENDC}")
                if result.stderr:
                    print(f"    {Colors.RED}{result.stderr}{Colors.ENDC}")
                self.report['checks']['compilation'] = f'failed: {result.stderr}'
                return False
                
        except Exception as e:
            print(f"  {Colors.RED}✗ Error during compilation: {e}{Colors.ENDC}")
            self.report['checks']['compilation'] = f'error: {str(e)}'
            return False
    
    def create_development_icon(self) -> bool:
        """Create a temporary development icon if missing."""
        icon_path = self.project_root / 'resources' / 'icon.png'
        
        if icon_path.exists():
            print(f"\n{Colors.GREEN}✓ Icon file exists{Colors.ENDC}")
            return True
        
        print(f"\n{Colors.BLUE}Creating development icon...{Colors.ENDC}")
        
        try:
            # Try to use the create-dev-icon.py script if it exists
            dev_icon_script = self.project_root / 'scripts' / 'create-dev-icon.py'
            if dev_icon_script.exists():
                result = PlatformUtils.run_command(
                    [sys.executable, str(dev_icon_script)],
                    check=False
                )
                if result.returncode == 0:
                    print(f"  {Colors.GREEN}✓ Development icon created{Colors.ENDC}")
                    return True
            
            # Fallback: Create a simple placeholder file
            icon_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Create a minimal PNG (1x1 pixel, transparent)
            png_data = bytes([
                0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
                0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  # IHDR chunk
                0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
                0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
                0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,  # IDAT chunk
                0x54, 0x78, 0x9C, 0x62, 0x00, 0x00, 0x00, 0x02,
                0x00, 0x01, 0xE5, 0x27, 0xDE, 0xFC, 0x00, 0x00,  # IEND chunk
                0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42,
                0x60, 0x82
            ])
            
            with open(icon_path, 'wb') as f:
                f.write(png_data)
            
            print(f"  {Colors.YELLOW}⚠ Created placeholder icon (replace with actual 128x128 icon){Colors.ENDC}")
            return True
            
        except Exception as e:
            print(f"  {Colors.RED}✗ Error creating icon: {e}{Colors.ENDC}")
            self.report['errors'].append(f"icon creation: {str(e)}")
            return False
    
    def save_report(self):
        """Save the setup report to a file."""
        report_path = self.project_root / 'setup-report.json'
        
        try:
            with open(report_path, 'w') as f:
                json.dump(self.report, f, indent=2)
            
            if self.args.verbose:
                print(f"\n{Colors.CYAN}Setup report saved to: {report_path}{Colors.ENDC}")
                
        except Exception as e:
            print(f"\n{Colors.YELLOW}Warning: Could not save report: {e}{Colors.ENDC}")
    
    def print_summary(self, success: bool):
        """Print setup summary."""
        print(f"\n{Colors.HEADER}{'='*60}{Colors.ENDC}")
        print(f"{Colors.HEADER}Setup Summary{Colors.ENDC}")
        print(f"{Colors.HEADER}{'='*60}{Colors.ENDC}\n")
        
        if success:
            print(f"{Colors.GREEN}✓ Environment setup completed successfully!{Colors.ENDC}\n")
            print("Next steps:")
            print("1. Run 'npm run compile' to build the extension")
            print("2. Press F5 in VS Code to test the extension")
            print("3. Run 'python scripts/test-local.py' for automated testing")
        else:
            print(f"{Colors.RED}✗ Environment setup encountered issues{Colors.ENDC}\n")
            print("Please resolve the issues above and run setup again.")
            
            # List critical missing dependencies
            critical = []
            for dep_name, info in self.report['checks'].items():
                if isinstance(info, dict) and info.get('required') and not info.get('valid'):
                    critical.append(dep_name)
            
            if critical:
                print(f"\nCritical missing dependencies: {', '.join(critical)}")
        
        print(f"\nFor detailed information, see: setup-report.json")
        
        if not self.args.ci:
            print(f"\nPress Enter to exit...")
            input()
    
    def run(self) -> bool:
        """
        Run the complete environment setup.
        
        Returns:
            bool: True if setup completed successfully
        """
        self.print_header()
        
        # Phase 1: Validate system dependencies
        deps_valid = self.validate_dependencies()
        
        if not deps_valid:
            print(f"\n{Colors.RED}Cannot proceed: Required dependencies are missing{Colors.ENDC}")
            self.save_report()
            self.print_summary(False)
            return False
        
        # Phase 2: Check and install npm packages
        npm_status = self.check_npm_packages()
        
        # Install missing packages
        needs_install = not npm_status.get('local', False) or any(
            not installed for key, installed in npm_status.items() 
            if key.startswith('global:')
        )
        
        if needs_install:
            install_success = self.install_npm_packages()
            if not install_success and not self.args.skip_optional:
                print(f"\n{Colors.YELLOW}Warning: Some packages failed to install{Colors.ENDC}")
        
        # Phase 3: Update configuration
        if not self.args.ci:
            self.update_package_json()
        
        # Phase 4: Create development assets
        self.create_development_icon()
        
        # Phase 5: Validate compilation
        compile_success = self.validate_compilation()
        
        # Save report
        self.save_report()
        
        # Overall success
        success = deps_valid and compile_success
        self.print_summary(success)
        
        return success


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Setup development environment for VSC WSL Manager',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    parser.add_argument(
        '--skip-optional',
        action='store_true',
        help='Skip optional dependency installation'
    )
    
    parser.add_argument(
        '--ci',
        action='store_true',
        help='Run in CI mode (non-interactive)'
    )
    
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Show detailed output'
    )
    
    parser.add_argument(
        '--no-color',
        action='store_true',
        help='Disable colored output'
    )
    
    args = parser.parse_args()
    
    # Disable colors if requested or in CI
    if args.no_color or args.ci or not sys.stdout.isatty():
        Colors.disable()
    
    # Run setup
    setup = EnvironmentSetup(args)
    success = setup.run()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()