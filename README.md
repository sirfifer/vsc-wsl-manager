# VSC WSL Manager

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/your-publisher.vsc-wsl-manager)](https://marketplace.visualstudio.com/items?itemName=your-publisher.vsc-wsl-manager)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/your-publisher.vsc-wsl-manager)](https://marketplace.visualstudio.com/items?itemName=your-publisher.vsc-wsl-manager)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/your-publisher.vsc-wsl-manager)](https://marketplace.visualstudio.com/items?itemName=your-publisher.vsc-wsl-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9+-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://github.com/your-username/vsc-wsl-manager/actions/workflows/test.yml/badge.svg)](https://github.com/your-username/vsc-wsl-manager/actions/workflows/test.yml)
[![Security](https://github.com/your-username/vsc-wsl-manager/actions/workflows/security.yml/badge.svg)](https://github.com/your-username/vsc-wsl-manager/actions/workflows/security.yml)

A powerful VS Code extension for managing Windows Subsystem for Linux (WSL) distributions with enterprise-grade security, comprehensive error handling, and seamless terminal integration.

## 🚀 Features

### Core Functionality
- **🖥️ Visual WSL Management**: View and manage all WSL distributions in a dedicated sidebar
- **➕ Create Distributions**: Clone existing distributions to create isolated development environments
- **📦 Import/Export**: Import TAR files as new distributions or export existing ones for backup
- **🔌 Terminal Integration**: Automatically registers WSL distributions as VS Code terminal profiles
- **📊 Real-time Status**: Monitor distribution states (Running/Stopped) with live updates
- **ℹ️ Distribution Info**: View detailed information (OS, kernel version, memory usage)

### Security Features
- **🛡️ Input Validation**: Comprehensive protection against command injection and path traversal
- **🔐 Rate Limiting**: Prevents abuse with configurable per-operation limits
- **✅ Permission Controls**: Destructive operations require explicit user confirmation
- **📝 Security Logging**: Optional audit logging for all security-relevant events

### Developer Experience
- **🔍 Comprehensive Error Handling**: User-friendly error messages with recovery suggestions
- **📊 Performance Monitoring**: Built-in performance metrics and logging
- **♻️ Automatic Rollback**: Configuration changes are rolled back on failure
- **⏱️ Timeout Protection**: Long operations have configurable timeouts

## 📋 Requirements

- **Windows 10/11** with WSL 2 installed
- **VS Code 1.74.0** or higher
- At least one WSL distribution installed (for cloning functionality)

## 📥 Installation

### From VS Code Marketplace (Recommended)
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "VSC WSL Manager"
4. Click Install

### Manual Installation
```bash
# Clone the repository
git clone https://github.com/your-username/vsc-wsl-manager.git
cd vsc-wsl-manager

# Install dependencies
npm install

# Build the extension
npm run compile

# Package the extension
vsce package

# Install the generated .vsix file
code --install-extension wsl-image-manager-*.vsix
```

## 🎯 Usage

### Managing Distributions

#### View Distributions
Click the WSL Manager icon in the Activity Bar to see all distributions with their current status.

#### Create New Distribution
1. Click the **+** button in the WSL Manager view
2. Enter a name for the new distribution
3. Select a base distribution to clone
4. Wait for the cloning process to complete

#### Import Distribution
1. Right-click in the WSL Manager view
2. Select "Import Distribution from TAR"
3. Choose the TAR file to import
4. Specify an installation location (optional)

#### Export Distribution
1. Right-click on a distribution
2. Select "Export Distribution to TAR"
3. Choose where to save the TAR file

#### Delete Distribution
1. Right-click on a distribution
2. Select "Delete Distribution"
3. Confirm the deletion (this action cannot be undone)

### Terminal Integration

The extension automatically creates terminal profiles for each WSL distribution:

1. Open the terminal dropdown (click the **˅** next to the **+** button)
2. Look for profiles starting with "WSL-"
3. Select a profile to open a terminal in that distribution

### Keyboard Shortcuts

| Command | Shortcut | Description |
|---------|----------|-------------|
| Refresh Distributions | `Ctrl+Shift+R` | Update the distribution list |
| Create Distribution | `Ctrl+Shift+N` | Create a new distribution |
| Open Terminal | `Ctrl+Shift+T` | Open terminal for selected distribution |

## ⚙️ Configuration

Access settings through File > Preferences > Settings > Extensions > WSL Manager

### General Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `wsl-manager.defaultDistributionPath` | `""` | Default path for storing new distributions |
| `wsl-manager.autoRegisterProfiles` | `true` | Automatically register terminal profiles |

### Logging Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `wsl-manager.logging.level` | `"info"` | Logging level (debug, info, warn, error, none) |
| `wsl-manager.logging.enableFileLogging` | `false` | Enable logging to file |
| `wsl-manager.logging.logDirectory` | `""` | Custom directory for log files |

### Security Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `wsl-manager.security.restrictedOperations` | `["delete"]` | Operations requiring confirmation |
| `wsl-manager.security.enableSecurityLogging` | `false` | Enable security event logging |

## 🔧 Troubleshooting

### WSL Not Detected
**Problem**: Extension shows "WSL is not installed"
- **Solution 1**: Install WSL by running `wsl --install` in an elevated PowerShell
- **Solution 2**: Ensure WSL is in your system PATH
- **Solution 3**: Restart VS Code after installing WSL

### Distribution Creation Fails
**Problem**: "Failed to create distribution" error
- **Solution 1**: Ensure the base distribution is installed and running
- **Solution 2**: Check available disk space
- **Solution 3**: Try running VS Code as Administrator

### Terminal Profile Not Appearing
**Problem**: WSL distributions don't appear in terminal dropdown
- **Solution 1**: Refresh distributions (Ctrl+Shift+R)
- **Solution 2**: Check if `autoRegisterProfiles` is enabled in settings
- **Solution 3**: Manually reload VS Code window

### Import/Export Issues
**Problem**: Import or export operations fail
- **Solution 1**: Verify file permissions on the TAR file
- **Solution 2**: Ensure the target directory exists and is writable
- **Solution 3**: Check that the file path doesn't contain special characters

### Rate Limiting
**Problem**: "Rate limit exceeded" errors
- **Solution 1**: Wait a minute before retrying the operation
- **Solution 2**: Check the Output panel for rate limit status
- **Solution 3**: Adjust operation frequency

## 🔒 Security

This extension implements multiple security layers:

1. **Input Sanitization**: All user inputs are validated and sanitized
2. **Command Injection Prevention**: Uses `spawn()` instead of `exec()` with proper argument separation
3. **Path Traversal Protection**: File paths are validated and normalized
4. **Rate Limiting**: Prevents abuse through operation limits
5. **Audit Logging**: Security events can be logged for monitoring

For security concerns, please see [SECURITY.md](SECURITY.md).

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup
```bash
# Clone and install
git clone https://github.com/your-username/vsc-wsl-manager.git
cd vsc-wsl-manager
npm install

# Run tests
npm test

# Run with coverage
npm run test:coverage

# Build
npm run compile

# Generate documentation
npm run docs
```

## 📚 Documentation

- [API Documentation](docs/api/README.md)
- [Architecture Overview](docs/architecture/overview.md)
- [Security Architecture](docs/architecture/security.md)
- [Contributing Guide](CONTRIBUTING.md)

## 🐛 Known Issues

- Terminal profiles may not update immediately after distribution changes
- Large TAR files (>2GB) may timeout during import/export
- Some antivirus software may interfere with WSL operations

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- **Your Name** - Initial work - [GitHub](https://github.com/your-username)

## 🙏 Acknowledgments

- Microsoft for creating WSL and VS Code
- The VS Code extension development community
- All contributors and testers

---

**Note**: This extension is not affiliated with Microsoft Corporation.