# VSC WSL Manager - Marketplace Description

## Overview

VSC WSL Manager is a comprehensive VS Code extension that simplifies Windows Subsystem for Linux (WSL) distribution management with a security-first approach. Manage, create, import, export, and organize your WSL distributions directly from VS Code's interface.

## ✨ Key Features

### 🔍 Distribution Management
- **View All Distributions**: See all your WSL distributions in a dedicated sidebar with real-time status updates
- **Create New Distributions**: Clone existing distributions to create new development environments
- **Import/Export**: Backup and share distributions using TAR files
- **Safe Deletion**: Remove distributions with confirmation prompts to prevent accidents

### 🚀 Terminal Integration
- **Automatic Profile Registration**: Access your distributions instantly from VS Code's terminal
- **Quick Terminal Access**: Open terminals with a single click from the sidebar
- **Context Menu Actions**: Right-click any distribution for quick actions

### 🔒 Security First
- **Input Validation**: All user inputs are validated to prevent injection attacks
- **Rate Limiting**: Built-in protection against command abuse
- **Safe Command Execution**: Uses secure spawn() methods, never exec()
- **Path Protection**: Prevents directory traversal attacks
- **Error Sanitization**: No sensitive information exposed in error messages

### 📊 Distribution Information
- Operating System details
- Kernel version
- Memory usage statistics
- Real-time status updates (Running/Stopped)

## 📸 Screenshots

![Distribution List View](https://github.com/your-username/vsc-wsl-manager/raw/main/docs/images/screenshot-1.png)
*View all your WSL distributions in the sidebar*

![Create Distribution Dialog](https://github.com/your-username/vsc-wsl-manager/raw/main/docs/images/screenshot-2.png)
*Clone distributions with custom names*

![Terminal Integration](https://github.com/your-username/vsc-wsl-manager/raw/main/docs/images/screenshot-3.png)
*Quick access to WSL terminals*

![Context Menu](https://github.com/your-username/vsc-wsl-manager/raw/main/docs/images/screenshot-4.png)
*Right-click for distribution actions*

## 🚦 Getting Started

1. **Install the Extension**: Search for "VSC WSL Manager" in the VS Code Extensions marketplace
2. **Open WSL Manager**: Click the WSL icon in the Activity Bar
3. **View Distributions**: All your WSL distributions will appear in the sidebar
4. **Start Managing**: Use the toolbar buttons or right-click menus to manage distributions

## ⚙️ Configuration

Configure the extension through VS Code settings:

```json
{
  // Default path for storing new distributions
  "wsl-manager.defaultDistributionPath": "C:\\WSL\\Distributions",
  
  // Automatically register terminal profiles
  "wsl-manager.autoRegisterProfiles": true,
  
  // Operations requiring confirmation
  "wsl-manager.security.restrictedOperations": ["delete"],
  
  // Logging level
  "wsl-manager.logging.level": "info"
}
```

## 🛡️ Security Features

- **Command Injection Protection**: All commands use secure argument arrays
- **Path Traversal Prevention**: File paths are validated and normalized
- **Rate Limiting**: Prevents abuse with configurable limits
- **Audit Logging**: Optional security event logging
- **Permission System**: Destructive operations require confirmation

## 📋 Requirements

- Windows 10/11 with WSL 2 installed
- VS Code 1.74.0 or higher
- At least one WSL distribution installed

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](https://github.com/your-username/vsc-wsl-manager/blob/main/CONTRIBUTING.md) for details.

## 🐛 Known Issues

- TAR imports may take time for large distributions
- Some antivirus software may interfere with WSL operations

## 📝 Release Notes

### 1.0.0 - Initial Release
- Complete WSL distribution management
- Secure command execution
- Terminal profile integration
- Comprehensive error handling
- Full test coverage

See the [full changelog](https://github.com/your-username/vsc-wsl-manager/blob/main/CHANGELOG.md) for all changes.

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-username/vsc-wsl-manager/issues)
- **Security**: Report vulnerabilities to security@example.com
- **Documentation**: [Full Documentation](https://github.com/your-username/vsc-wsl-manager/tree/main/docs)

## 📄 License

MIT - See [LICENSE](https://github.com/your-username/vsc-wsl-manager/blob/main/LICENSE) for details.

---

**Enjoy managing your WSL distributions with confidence! 🚀**