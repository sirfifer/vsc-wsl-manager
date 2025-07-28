# Development Environment Setup

This guide explains how to set up your development environment for the VSC WSL Manager extension.

## Quick Start

The easiest way to set up your environment is using our automated setup script:

```bash
# Clone the repository
git clone https://github.com/your-username/vsc-wsl-manager.git
cd vsc-wsl-manager

# Run the setup script
python setup-environment.py
```

The script will:
1. Check for required dependencies
2. Install missing npm packages
3. Configure your package.json
4. Create development assets
5. Validate the setup

## Prerequisites

### Required Dependencies

| Dependency | Minimum Version | Purpose | Installation |
|------------|----------------|---------|--------------|
| Python | 3.6+ | Running setup scripts | [python.org](https://www.python.org/downloads/) |
| Node.js | 16.0.0+ | VS Code extension development | [nodejs.org](https://nodejs.org/) |
| npm | 7.0.0+ | Package management | Comes with Node.js |
| Git | 2.0.0+ | Version control | [git-scm.com](https://git-scm.com/downloads) |
| WSL 2 | - | Windows only - for testing | [Microsoft Docs](https://docs.microsoft.com/en-us/windows/wsl/install) |

### Optional Dependencies

| Dependency | Purpose | Installation |
|------------|---------|--------------|
| VS Code | Development IDE | [code.visualstudio.com](https://code.visualstudio.com/) |
| vsce | Extension packaging | `npm install -g vsce` |

## Manual Setup

If you prefer to set up manually or the script fails:

### 1. Install System Dependencies

#### Windows
```powershell
# Install Node.js from https://nodejs.org/
# Install Git from https://git-scm.com/
# Install WSL 2:
wsl --install

# Verify installations
node --version
npm --version
git --version
wsl --version
```

#### macOS
```bash
# Using Homebrew
brew install node git

# Verify installations
node --version
npm --version
git --version
```

#### Linux
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nodejs npm git

# Fedora
sudo dnf install nodejs npm git

# Verify installations
node --version
npm --version
git --version
```

### 2. Install Project Dependencies

```bash
# Install local dependencies
npm install

# Install global tools (optional)
npm install -g vsce
```

### 3. Configure package.json

Update the placeholder values in `package.json`:

```json
{
  "publisher": "your-actual-publisher-name",
  "repository": {
    "url": "https://github.com/YOUR-USERNAME/vsc-wsl-manager"
  }
}
```

### 4. Create Development Icon

If the icon is missing:

```bash
# Run the icon creation script
python scripts/create-dev-icon.py

# Or manually place a 128x128 PNG at:
# resources/icon.png
```

### 5. Verify Setup

```bash
# Compile TypeScript
npm run compile

# Run tests
npm test

# Package extension locally
vsce package
```

## Platform-Specific Notes

### Windows

- **Administrator Rights**: Some npm global installations may require administrator privileges
- **Path Variables**: The setup script will attempt to add directories to PATH. Restart your terminal after setup.
- **WSL Testing**: Ensure you have at least one WSL distribution installed for testing

### macOS

- **Homebrew**: Recommended for installing Node.js and other dependencies
- **Permissions**: Global npm packages install to `/usr/local` by default

### Linux

- **Node.js Version**: System packages may be outdated. Consider using [nvm](https://github.com/nvm-sh/nvm) for newer versions
- **Permissions**: Use `sudo` for global npm installations or configure npm to use a user directory

### WSL

- The extension can be developed inside WSL, but testing requires access to Windows WSL commands
- Use VS Code's Remote-WSL extension for the best development experience

## Environment Variables

The setup script creates a `.env.local` file with your configuration. You can also set:

```bash
# Optional: Set default publisher
export VSCE_PUBLISHER=your-publisher-name

# Optional: Set GitHub token for releases
export GITHUB_TOKEN=your-token-here
```

## Troubleshooting

### "command not found" errors

**Problem**: Commands like `node`, `npm`, or `python` are not found

**Solution**: 
1. Ensure the software is installed
2. Check your PATH: `echo $PATH` (Linux/macOS) or `echo %PATH%` (Windows)
3. Restart your terminal after installation

### npm install fails

**Problem**: `npm install` fails with permission errors

**Solution**:
```bash
# Option 1: Fix npm permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH

# Option 2: Use npx instead of global installs
npx vsce package
```

### TypeScript compilation errors

**Problem**: `npm run compile` fails

**Solution**:
1. Ensure all dependencies are installed: `npm install`
2. Check Node.js version: `node --version` (must be 16+)
3. Delete node_modules and reinstall: `rm -rf node_modules && npm install`

### WSL not detected (Windows)

**Problem**: Extension can't find WSL

**Solution**:
1. Ensure WSL 2 is installed: `wsl --install`
2. Check WSL is in PATH: `where wsl`
3. Restart VS Code after WSL installation

## Setup Script Options

The `setup-environment.py` script supports several options:

```bash
# Skip optional dependencies
python setup-environment.py --skip-optional

# Run in CI/non-interactive mode
python setup-environment.py --ci

# Show detailed output
python setup-environment.py --verbose

# Disable colored output
python setup-environment.py --no-color

# Show help
python setup-environment.py --help
```

## Next Steps

After successful setup:

1. **Open in VS Code**: `code .`
2. **Run the extension**: Press `F5` to launch a new VS Code window with the extension
3. **Run tests**: `npm test`
4. **Package locally**: `vsce package`

For more information, see:
- [Getting Started Guide](guides/getting-started.md)
- [Contributing Guidelines](../CONTRIBUTING.md)
- [Architecture Overview](architecture/overview.md)