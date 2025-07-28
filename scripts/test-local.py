#!/usr/bin/env python3
"""
Local testing helper for VSC WSL Manager extension.

This script automates the local testing workflow:
1. Compiles the TypeScript code
2. Runs unit tests
3. Packages the extension
4. Provides installation instructions
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional, Dict, Any

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))

from utils.platform import PlatformUtils


class Colors:
    """Terminal colors for output."""
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
        """Disable colors."""
        for attr in dir(Colors):
            if not attr.startswith('_') and attr != 'disable':
                setattr(Colors, attr, '')


class LocalTester:
    """Handles local testing workflow."""
    
    def __init__(self, args: argparse.Namespace):
        self.args = args
        self.project_root = Path(__file__).parent.parent
        self.results = {
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
            'platform': PlatformUtils.get_platform(),
            'steps': {}
        }
    
    def print_header(self):
        """Print test header."""
        print(f"\n{Colors.HEADER}{'='*60}{Colors.ENDC}")
        print(f"{Colors.HEADER}VSC WSL Manager - Local Testing{Colors.ENDC}")
        print(f"{Colors.HEADER}{'='*60}{Colors.ENDC}\n")
    
    def run_command(self, command: list, description: str, cwd: Optional[Path] = None) -> bool:
        """
        Run a command and track results.
        
        Returns:
            bool: True if successful
        """
        if cwd is None:
            cwd = self.project_root
        
        print(f"{Colors.BLUE}→ {description}...{Colors.ENDC}")
        
        start_time = time.time()
        
        try:
            if self.args.verbose:
                # Show output in real-time
                process = subprocess.Popen(
                    command,
                    cwd=cwd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1
                )
                
                output_lines = []
                for line in process.stdout:
                    print(f"  {Colors.CYAN}{line.rstrip()}{Colors.ENDC}")
                    output_lines.append(line)
                
                process.wait()
                result = process.returncode
                output = ''.join(output_lines)
            else:
                # Capture output silently
                result = PlatformUtils.run_command(
                    command,
                    check=False,
                    capture_output=True
                )
                output = result.stdout + result.stderr if hasattr(result, 'stdout') else str(result)
                result = result.returncode if hasattr(result, 'returncode') else 1
            
            duration = time.time() - start_time
            
            # Track results
            self.results['steps'][description] = {
                'success': result == 0,
                'duration': duration,
                'command': ' '.join(command)
            }
            
            if result == 0:
                print(f"  {Colors.GREEN}✓ {description} completed ({duration:.1f}s){Colors.ENDC}")
                return True
            else:
                print(f"  {Colors.RED}✗ {description} failed{Colors.ENDC}")
                if not self.args.verbose and output:
                    # Show error output if not already shown
                    print(f"  {Colors.RED}Error output:{Colors.ENDC}")
                    for line in output.strip().split('\n')[-10:]:  # Last 10 lines
                        print(f"    {line}")
                return False
                
        except Exception as e:
            print(f"  {Colors.RED}✗ {description} error: {e}{Colors.ENDC}")
            self.results['steps'][description] = {
                'success': False,
                'error': str(e)
            }
            return False
    
    def check_environment(self) -> bool:
        """Check if environment is properly set up."""
        print(f"{Colors.BLUE}Checking environment...{Colors.ENDC}\n")
        
        checks = []
        
        # Check Node.js
        node = PlatformUtils.find_executable('node')
        if node:
            print(f"  {Colors.GREEN}✓ Node.js found: {node}{Colors.ENDC}")
            checks.append(True)
        else:
            print(f"  {Colors.RED}✗ Node.js not found{Colors.ENDC}")
            checks.append(False)
        
        # Check npm
        npm = PlatformUtils.find_executable('npm')
        if npm:
            print(f"  {Colors.GREEN}✓ npm found: {npm}{Colors.ENDC}")
            checks.append(True)
        else:
            print(f"  {Colors.RED}✗ npm not found{Colors.ENDC}")
            checks.append(False)
        
        # Check node_modules
        node_modules = self.project_root / 'node_modules'
        if node_modules.exists():
            print(f"  {Colors.GREEN}✓ Dependencies installed{Colors.ENDC}")
            checks.append(True)
        else:
            print(f"  {Colors.RED}✗ Dependencies not installed (run: npm install){Colors.ENDC}")
            checks.append(False)
        
        # Check TypeScript
        tsc = node_modules / '.bin' / ('tsc.cmd' if PlatformUtils.is_windows() else 'tsc')
        if tsc.exists():
            print(f"  {Colors.GREEN}✓ TypeScript compiler available{Colors.ENDC}")
            checks.append(True)
        else:
            print(f"  {Colors.RED}✗ TypeScript compiler not found{Colors.ENDC}")
            checks.append(False)
        
        return all(checks)
    
    def clean_build(self) -> bool:
        """Clean build artifacts."""
        if not self.args.skip_clean:
            print(f"\n{Colors.BLUE}Cleaning build artifacts...{Colors.ENDC}")
            
            # Remove out directory
            out_dir = self.project_root / 'out'
            if out_dir.exists():
                shutil.rmtree(out_dir)
                print(f"  {Colors.GREEN}✓ Removed out directory{Colors.ENDC}")
            
            # Remove old VSIX files
            for vsix in self.project_root.glob('*.vsix'):
                vsix.unlink()
                print(f"  {Colors.GREEN}✓ Removed {vsix.name}{Colors.ENDC}")
        
        return True
    
    def compile_typescript(self) -> bool:
        """Compile TypeScript code."""
        print(f"\n{Colors.BLUE}Compiling TypeScript...{Colors.ENDC}")
        
        return self.run_command(
            [PlatformUtils.get_npm_command(), 'run', 'compile'],
            'TypeScript compilation'
        )
    
    def run_tests(self) -> bool:
        """Run unit tests."""
        if self.args.skip_tests:
            print(f"\n{Colors.YELLOW}Skipping tests (--skip-tests){Colors.ENDC}")
            return True
        
        print(f"\n{Colors.BLUE}Running tests...{Colors.ENDC}")
        
        # Run different test suites
        test_commands = [
            (['npm', 'run', 'test:unit'], 'Unit tests'),
        ]
        
        if not self.args.quick:
            test_commands.extend([
                (['npm', 'run', 'test:integration'], 'Integration tests'),
                (['npm', 'run', 'lint'], 'Linting'),
            ])
        
        all_passed = True
        for command, description in test_commands:
            if not self.run_command(command, description):
                all_passed = False
                if self.args.fail_fast:
                    break
        
        return all_passed
    
    def package_extension(self) -> Optional[Path]:
        """Package the extension into a VSIX file."""
        print(f"\n{Colors.BLUE}Packaging extension...{Colors.ENDC}")
        
        # Check if vsce is available
        vsce = PlatformUtils.find_executable('vsce')
        if not vsce:
            print(f"  {Colors.YELLOW}⚠ vsce not found globally, trying npx...{Colors.ENDC}")
            
            # Try using npx
            if self.run_command(
                ['npx', 'vsce', 'package', '--no-dependencies'],
                'Extension packaging'
            ):
                # Find the generated VSIX file
                vsix_files = list(self.project_root.glob('*.vsix'))
                if vsix_files:
                    return vsix_files[-1]  # Return most recent
            
            print(f"  {Colors.RED}Failed to package extension{Colors.ENDC}")
            print(f"  {Colors.YELLOW}Install vsce globally: npm install -g vsce{Colors.ENDC}")
            return None
        
        # Package with vsce
        if self.run_command(
            ['vsce', 'package', '--no-dependencies'],
            'Extension packaging'
        ):
            # Find the generated VSIX file
            vsix_files = list(self.project_root.glob('*.vsix'))
            if vsix_files:
                return vsix_files[-1]  # Return most recent
        
        return None
    
    def show_installation_instructions(self, vsix_path: Path):
        """Show instructions for installing the extension."""
        print(f"\n{Colors.GREEN}{'='*60}{Colors.ENDC}")
        print(f"{Colors.GREEN}Extension packaged successfully!{Colors.ENDC}")
        print(f"{Colors.GREEN}{'='*60}{Colors.ENDC}\n")
        
        print(f"Package location: {Colors.CYAN}{vsix_path}{Colors.ENDC}")
        print(f"Package size: {Colors.CYAN}{vsix_path.stat().st_size / 1024:.1f} KB{Colors.ENDC}\n")
        
        print(f"{Colors.HEADER}Installation Instructions:{Colors.ENDC}\n")
        
        print("Option 1: Install from Command Line")
        print(f"  {Colors.CYAN}code --install-extension {vsix_path.name}{Colors.ENDC}\n")
        
        print("Option 2: Install from VS Code")
        print("  1. Open VS Code")
        print("  2. Go to Extensions (Ctrl+Shift+X)")
        print("  3. Click the '...' menu → 'Install from VSIX...'")
        print(f"  4. Select: {vsix_path}\n")
        
        print("Option 3: Development Testing")
        print("  1. Open this project in VS Code")
        print("  2. Press F5 to launch a new VS Code window")
        print("  3. The extension will be loaded automatically\n")
        
        if PlatformUtils.is_windows() or PlatformUtils.is_wsl():
            print(f"{Colors.YELLOW}Note: Ensure you have WSL 2 installed for testing{Colors.ENDC}")
            print(f"      Run 'wsl --install' if needed\n")
    
    def save_results(self):
        """Save test results to file."""
        if self.args.output:
            output_path = Path(self.args.output)
            try:
                with open(output_path, 'w') as f:
                    json.dump(self.results, f, indent=2)
                print(f"\n{Colors.CYAN}Test results saved to: {output_path}{Colors.ENDC}")
            except Exception as e:
                print(f"\n{Colors.YELLOW}Warning: Could not save results: {e}{Colors.ENDC}")
    
    def run(self) -> bool:
        """Run the complete local testing workflow."""
        self.print_header()
        
        # Check environment
        if not self.check_environment():
            print(f"\n{Colors.RED}Environment check failed!{Colors.ENDC}")
            print("Run 'python setup-environment.py' to set up your environment")
            return False
        
        # Clean build artifacts
        self.clean_build()
        
        # Compile TypeScript
        if not self.compile_typescript():
            print(f"\n{Colors.RED}Compilation failed!{Colors.ENDC}")
            return False
        
        # Run tests
        if not self.run_tests():
            print(f"\n{Colors.YELLOW}Tests failed!{Colors.ENDC}")
            if not self.args.force:
                print("Use --force to package anyway")
                return False
        
        # Package extension
        vsix_path = self.package_extension()
        if not vsix_path:
            print(f"\n{Colors.RED}Packaging failed!{Colors.ENDC}")
            return False
        
        # Show installation instructions
        self.show_installation_instructions(vsix_path)
        
        # Save results
        self.save_results()
        
        return True


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Local testing helper for VSC WSL Manager',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    parser.add_argument(
        '--skip-tests',
        action='store_true',
        help='Skip running tests'
    )
    
    parser.add_argument(
        '--skip-clean',
        action='store_true',
        help='Skip cleaning build artifacts'
    )
    
    parser.add_argument(
        '--quick',
        action='store_true',
        help='Quick mode: only run unit tests'
    )
    
    parser.add_argument(
        '--fail-fast',
        action='store_true',
        help='Stop on first test failure'
    )
    
    parser.add_argument(
        '--force',
        action='store_true',
        help='Package even if tests fail'
    )
    
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Show detailed command output'
    )
    
    parser.add_argument(
        '--no-color',
        action='store_true',
        help='Disable colored output'
    )
    
    parser.add_argument(
        '--output', '-o',
        help='Save test results to JSON file'
    )
    
    args = parser.parse_args()
    
    # Disable colors if requested
    if args.no_color or not sys.stdout.isatty():
        Colors.disable()
    
    # Run tester
    tester = LocalTester(args)
    success = tester.run()
    
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()