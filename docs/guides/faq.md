# Frequently Asked Questions (FAQ)

## General Questions

### What is VSC WSL Manager?

VSC WSL Manager is a Visual Studio Code extension that provides a graphical interface for managing Windows Subsystem for Linux (WSL) distributions. It allows you to create, import, export, and manage WSL distributions directly from VS Code.

### What are the system requirements?

- Windows 10 version 1903 or later (64-bit)
- Windows 11 (any version)
- WSL 2 installed
- VS Code 1.74.0 or later
- At least one WSL distribution installed

### Is this extension free?

Yes, VSC WSL Manager is completely free and open source under the MIT license.

### Does it work with WSL 1?

Yes, the extension works with both WSL 1 and WSL 2 distributions. However, WSL 2 is recommended for better performance.

## Installation Issues

### Why does the extension show "WSL is not installed"?

This error appears when WSL is not properly installed or not in your system PATH. To fix:

1. Open PowerShell as Administrator
2. Run: `wsl --install`
3. Restart your computer
4. Restart VS Code

### The extension installed but no icon appears

1. Check if the extension is enabled: Extensions > WSL Manager > Enable
2. Restart VS Code
3. Check the Activity Bar visibility: View > Appearance > Activity Bar

### Can I use this without admin rights?

The extension itself doesn't require admin rights, but some WSL operations might. You may need admin rights to:
- Install WSL initially
- Import distributions to system directories
- Modify certain WSL settings

## Usage Questions

### How do I create a new distribution?

1. Click the + button in the WSL Manager view
2. Enter a name for your new distribution
3. Select a base distribution to clone
4. Wait for the process to complete

### What's the difference between cloning and importing?

- **Cloning**: Creates a copy of an existing WSL distribution on your system
- **Importing**: Creates a new distribution from a TAR file (backup or downloaded)

### Can I rename a distribution?

WSL doesn't support renaming distributions directly. Workaround:
1. Export the distribution to a TAR file
2. Delete the original distribution
3. Import the TAR file with a new name

### How large are distribution backups?

Typical sizes:
- Minimal Alpine: ~150MB
- Basic Ubuntu: ~1-2GB
- Development environment: 3-10GB
- Full environment with tools: 10-20GB+

### Where are distributions stored?

By default, WSL stores distributions in:
- `%LOCALAPPDATA%\Packages\` (for Store distributions)
- Custom locations when imported via WSL Manager

You can set a default location in the extension settings.

## Terminal Integration

### Why don't I see WSL profiles in my terminal?

1. Ensure "Auto Register Profiles" is enabled in settings
2. Refresh the distribution list (Ctrl+Shift+R)
3. Reload VS Code window
4. Check terminal profile settings manually

### Can I set a WSL distribution as my default terminal?

Yes! Right-click on a distribution and it will prompt you to set it as default, or:
1. Open Settings (Ctrl+,)
2. Search for "terminal default profile"
3. Select a WSL profile starting with "WSL-"

### Terminal opens but immediately closes

This usually means the distribution is corrupted or not properly installed:
1. Try opening the distribution directly: `wsl -d distribution-name`
2. If that fails, you may need to reinstall the distribution

## Performance Questions

### Why is creating/importing distributions slow?

Several factors affect speed:
- Disk I/O speed (SSD vs HDD)
- Distribution size
- Antivirus scanning
- Available system resources

Tips for better performance:
- Use SSD storage
- Temporarily disable antivirus for WSL directories
- Close unnecessary applications

### Import/export operations timeout

For large distributions:
1. The default timeout is 5 minutes
2. Use smaller distributions when possible
3. Export from WSL command line for very large distributions

### High memory usage

WSL 2 dynamically manages memory, but you can limit it:

Create `%USERPROFILE%\.wslconfig`:
```ini
[wsl2]
memory=4GB
```

## Security Questions

### Is it safe to import TAR files from the internet?

**Be cautious!** Only import TAR files from trusted sources:
- Official distribution images
- Your own backups
- Verified community sources

The extension validates paths but cannot verify TAR content safety.

### What security features are included?

- Input validation prevents command injection
- Path traversal protection
- Rate limiting prevents abuse
- Optional security audit logging
- Permission prompts for destructive operations

### Can I restrict certain operations?

Yes, in settings configure:
```json
"wsl-manager.security.restrictedOperations": ["delete", "import", "export"]
```

### Is my data encrypted?

The extension doesn't handle encryption. For secure backups:
1. Export the distribution
2. Encrypt the TAR file using your preferred method
3. Store securely

## Troubleshooting

### "Rate limit exceeded" error

You've hit the operation limit. Default limits:
- Create: 10 per minute
- Delete: 5 per minute
- Import/Export: 5/20 per minute

Wait a minute and try again.

### "Permission denied" errors

1. Check file/directory permissions
2. Try running VS Code as Administrator
3. Ensure your user account has WSL access
4. Check if antivirus is blocking operations

### Distribution appears corrupted

Try recovery:
1. Export if possible: `wsl --export distro-name backup.tar`
2. Unregister: `wsl --unregister distro-name`
3. Re-import from backup

### Extension commands not working

1. Check Output panel for errors
2. Enable debug logging in settings
3. Restart VS Code
4. Reinstall the extension if needed

## Advanced Questions

### Can I use this in WSL remote sessions?

No, this extension must run in Windows VS Code, not in WSL remote. It manages WSL from the Windows side.

### API access for automation?

While there's no public API, you can:
- Use VS Code command execution
- Automate with PowerShell/WSL commands
- Create custom VS Code extensions

### Can I manage WSL on remote machines?

No, the extension only manages local WSL installations. For remote management, use SSH and command-line tools.

### Integration with Docker Desktop?

The extension manages WSL distributions independently. Docker Desktop's WSL integration is separate and won't interfere.

## Feature Requests

### How do I request a new feature?

1. Check existing issues on GitHub
2. Create a new issue with the "enhancement" label
3. Provide detailed use case and examples

### Can I contribute to development?

We're currently accepting **ideas and feedback only** while we establish core functionality. See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details. We welcome:
- Feature suggestions and ideas
- Bug reports
- Feedback on architecture and design
- Use case discussions

Once we reach a stable foundation, we'll open up for code contributions!

## Getting Help

### Where can I get support?

1. **Documentation**: Read the guides in this folder
2. **GitHub Issues**: Report bugs and request features
3. **Discussions**: GitHub Discussions for general questions
4. **Output Panel**: Check logs for diagnostic info

### How do I report a bug?

1. Check if it's already reported on GitHub
2. Collect:
   - VS Code version
   - Extension version
   - WSL version (`wsl --version`)
   - Error messages from Output panel
3. Create a detailed issue on GitHub

### Is there a community?

Join the discussion:
- GitHub Discussions
- VS Code WSL community
- Windows Insider WSL forums

---

Didn't find your answer? Check the [documentation](../../README.md) or [create an issue](https://github.com/your-username/vsc-wsl-manager/issues).