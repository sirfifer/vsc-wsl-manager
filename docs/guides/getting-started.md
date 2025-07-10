# Getting Started with VSC WSL Manager

Welcome to VSC WSL Manager! This guide will help you get up and running with the extension in just a few minutes.

## Prerequisites

Before you begin, make sure you have:

1. **Windows 10 or 11** (64-bit)
2. **WSL 2 installed** - Check by running `wsl --version` in PowerShell
3. **At least one WSL distribution** - Install Ubuntu from Microsoft Store if needed
4. **VS Code 1.74.0 or later**

### Installing WSL (if needed)

If you don't have WSL installed:

```powershell
# Run in elevated PowerShell
wsl --install

# Restart your computer after installation
```

## Installation

### Method 1: VS Code Marketplace (Recommended)

1. Open VS Code
2. Click the Extensions icon in the Activity Bar (or press `Ctrl+Shift+X`)
3. Search for "WSL Manager"
4. Click the Install button
5. Reload VS Code when prompted

### Method 2: Manual Installation

If you're installing from source:

```bash
# Clone the repository
git clone https://github.com/your-username/vsc-wsl-manager.git
cd vsc-wsl-manager

# Install dependencies
npm install

# Build the extension
npm run compile

# Open in VS Code
code .

# Press F5 to run the extension in a new window
```

## First Steps

### 1. Open the WSL Manager View

After installation, you'll see a new WSL icon in the Activity Bar on the left side of VS Code. Click it to open the WSL Manager view.

### 2. View Your Distributions

The WSL Manager will automatically detect and display all your WSL distributions. Each distribution shows:
- **Name** - The distribution identifier
- **Status** - Running (green) or Stopped (gray)
- **Version** - WSL 1 or WSL 2
- **Default** - Marked if it's the default distribution

### 3. Explore Distribution Details

Click on any distribution to expand it and see:
- Operating System version
- Linux kernel version
- Total available memory
- Current state

## Basic Operations

### Opening a Terminal

**Quick Method:**
1. Right-click on any distribution
2. Select "Open Terminal"

**Alternative:**
1. Use the terminal dropdown in VS Code
2. Select profiles starting with "WSL-"

### Creating Your First Clone

Let's create a development environment by cloning an existing distribution:

1. Click the **+** button in the WSL Manager toolbar
2. Enter a name (e.g., "dev-environment")
3. Select your base distribution (e.g., "Ubuntu")
4. Wait for the cloning to complete (usually 1-2 minutes)

### Refreshing the View

If you make changes outside VS Code:
- Click the refresh button in the toolbar
- Or press `Ctrl+Shift+R`

## Terminal Integration

VSC WSL Manager automatically creates terminal profiles for each distribution:

1. Open a new terminal (`Ctrl+`` ` ``)
2. Click the dropdown arrow next to the + button
3. You'll see profiles like:
   - WSL-Ubuntu
   - WSL-Debian
   - WSL-your-custom-distro

## Configuration Basics

### Setting a Default Installation Path

1. Open Settings (`Ctrl+,`)
2. Search for "wsl manager"
3. Set `Default Distribution Path` to your preferred location
   - Example: `C:\WSL\Distributions`

### Adjusting Logging

For troubleshooting, you might want to enable debug logging:

1. In Settings, search for "wsl manager logging"
2. Change `Level` from "info" to "debug"
3. View logs in the Output panel (`Ctrl+Shift+U`)
4. Select "WSL Manager" from the dropdown

## Common First-Time Issues

### "WSL is not installed"
- Run `wsl --install` in an elevated PowerShell
- Restart your computer
- Restart VS Code

### No distributions appear
- Ensure you have at least one WSL distribution installed
- Try running `wsl --list` in PowerShell to verify
- Click the refresh button in WSL Manager

### Terminal profiles not showing
- Refresh the distribution list
- Check that `Auto Register Profiles` is enabled in settings
- Reload the VS Code window (`Ctrl+Shift+P` > "Reload Window")

## Next Steps

Now that you're set up, explore these features:

1. **Import a Distribution** - Restore from a backup TAR file
2. **Export for Backup** - Save your configured environment
3. **Manage Multiple Environments** - Create specialized distributions for different projects
4. **Configure Security Settings** - Set up restricted operations and logging

## Getting Help

- **Documentation**: Check the [README](../../README.md) for detailed information
- **API Reference**: See [API Documentation](../api/README.md)
- **Issues**: Report problems on [GitHub Issues](https://github.com/your-username/vsc-wsl-manager/issues)
- **Logs**: Check the Output panel for diagnostic information

## Tips for Success

1. **Name distributions clearly** - Use descriptive names like "python-dev" or "node-project"
2. **Regular backups** - Export important distributions periodically
3. **Keep base distribution clean** - Use it only as a template for cloning
4. **Monitor resources** - Check memory usage in distribution details
5. **Use consistent paths** - Set a default distribution path for organization

---

Ready to dive deeper? Check out the [Advanced Usage Guide](advanced-usage.md) for power user features!