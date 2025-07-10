# Advanced Usage Guide

This guide covers advanced features and workflows for power users of VSC WSL Manager.

## Advanced Distribution Management

### Batch Operations

#### Creating Multiple Development Environments

```javascript
// Example: Create specialized environments
const environments = [
    { name: "python-ml", base: "Ubuntu", purpose: "Machine Learning" },
    { name: "node-web", base: "Ubuntu", purpose: "Web Development" },
    { name: "rust-systems", base: "Debian", purpose: "Systems Programming" }
];

// Create each environment sequentially
for (const env of environments) {
    // 1. Create distribution
    // 2. Configure with specific tools
    // 3. Export as template
}
```

### Distribution Templates

Create reusable templates for your team:

1. **Set up a base distribution** with common tools:
   ```bash
   # In WSL
   sudo apt update && sudo apt upgrade -y
   sudo apt install -y git curl wget build-essential
   ```

2. **Export as template**:
   - Right-click the distribution
   - Export to `templates/base-dev.tar`

3. **Create specialized templates**:
   - Import base template
   - Add specific tools
   - Export with descriptive names

### Advanced Import/Export

#### Automated Backups

Create a backup script for your distributions:

```powershell
# backup-wsl.ps1
$backupPath = "D:\WSL-Backups\$(Get-Date -Format 'yyyy-MM-dd')"
New-Item -ItemType Directory -Path $backupPath -Force

# Get all distributions
$distros = wsl --list --quiet

foreach ($distro in $distros) {
    Write-Host "Backing up $distro..."
    wsl --export $distro "$backupPath\$distro.tar"
}
```

#### Migration Between Machines

1. **Export all distributions**:
   ```powershell
   # On source machine
   $distros = @("Ubuntu", "Debian", "Custom-Dev")
   foreach ($d in $distros) {
       wsl --export $d "\\network-share\wsl-backup\$d.tar"
   }
   ```

2. **Import on new machine** using VSC WSL Manager:
   - Use Import feature for each TAR file
   - Maintain same distribution names

## Security Configuration

### Implementing Zero-Trust Security

#### Configure Restricted Operations

```json
// settings.json
{
    "wsl-manager.security.restrictedOperations": [
        "create",
        "delete", 
        "import",
        "export"
    ],
    "wsl-manager.security.enableSecurityLogging": true,
    "wsl-manager.logging.level": "debug"
}
```

#### Security Audit Setup

1. **Enable comprehensive logging**:
   ```json
   {
       "wsl-manager.logging.enableFileLogging": true,
       "wsl-manager.logging.logDirectory": "C:\\Security\\WSL-Logs",
       "wsl-manager.security.enableSecurityLogging": true
   }
   ```

2. **Monitor security events**:
   - Check logs for rate limit violations
   - Review command execution patterns
   - Audit distribution access

### Rate Limiting Configuration

Understand the default rate limits:

| Operation | Limit | Window |
|-----------|-------|--------|
| Create | 10 | 1 minute |
| Import | 5 | 1 minute |
| Export | 20 | 1 minute |
| Delete | 5 | 1 minute |
| List | 60 | 1 minute |
| Command | 30 | 1 minute |

## Performance Optimization

### Distribution Optimization

#### Reduce Distribution Size

```bash
# Inside WSL distribution
# Clean package cache
sudo apt clean
sudo apt autoclean
sudo apt autoremove

# Clear temporary files
sudo rm -rf /tmp/*
sudo rm -rf /var/tmp/*

# Remove unnecessary packages
sudo apt purge -y \
    snapd \
    cloud-init \
    landscape-common
```

#### Memory Management

Configure WSL memory limits:

```ini
# Create %USERPROFILE%\.wslconfig
[wsl2]
memory=4GB
processors=2
swap=8GB
swapFile=C:\\temp\\wsl-swap.vhdx
```

### Import/Export Performance

#### Parallel Operations

For multiple distributions, use PowerShell jobs:

```powershell
# Parallel export
$distros = @("Ubuntu", "Debian", "Alpine")
$jobs = @()

foreach ($distro in $distros) {
    $jobs += Start-Job -ScriptBlock {
        param($d)
        wsl --export $d "D:\Backup\$d.tar"
    } -ArgumentList $distro
}

# Wait for all exports
$jobs | Wait-Job | Receive-Job
```

## Integration Workflows

### CI/CD Integration

#### Automated Testing Environments

```yaml
# .github/workflows/wsl-test.yml
name: WSL Testing
on: [push]

jobs:
  test:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup WSL
        run: |
          wsl --install -d Ubuntu
          wsl --set-default Ubuntu
      
      - name: Run tests in WSL
        run: |
          wsl bash -c "cd /mnt/c/project && npm test"
```

### Development Workflows

#### Project-Specific Distributions

1. **Create project distribution**:
   ```bash
   # Name format: project-name-env
   my-app-dev
   my-app-test
   my-app-prod
   ```

2. **Configure VS Code workspace**:
   ```json
   // .vscode/settings.json
   {
       "terminal.integrated.defaultProfile.windows": "WSL-my-app-dev",
       "remote.WSL.distro": "my-app-dev"
   }
   ```

#### Synchronized Development

Keep distributions in sync:

```bash
#!/bin/bash
# sync-distros.sh
SOURCE="ubuntu-base"
TARGETS=("dev-frontend" "dev-backend" "dev-testing")

for target in "${TARGETS[@]}"; do
    echo "Syncing $target..."
    # Export source
    wsl --export $SOURCE /tmp/source.tar
    # Terminate target
    wsl --terminate $target
    # Import over target
    wsl --unregister $target
    wsl --import $target "C:\\WSL\\$target" /tmp/source.tar
done
```

## Troubleshooting Advanced Issues

### Performance Diagnostics

#### Check Distribution Performance

```bash
# Inside WSL
# I/O performance
dd if=/dev/zero of=test.img bs=1G count=1 oflag=dsync

# Memory usage
free -h
vmstat 1 5

# Process monitoring
htop
```

#### Extension Performance

1. Enable performance logging:
   ```json
   {
       "wsl-manager.logging.level": "debug"
   }
   ```

2. Check operation timings in Output panel

### Recovery Procedures

#### Corrupted Distribution Recovery

1. **Export if possible**:
   ```powershell
   wsl --export corrupted-distro backup.tar
   ```

2. **Reset distribution**:
   ```powershell
   # Unregister
   wsl --unregister corrupted-distro
   
   # Re-import
   wsl --import corrupted-distro "C:\WSL\corrupted-distro" backup.tar
   ```

#### Extension Recovery

If the extension becomes unresponsive:

1. **Clear extension state**:
   - Command Palette: "Clear Editor History"
   - Restart VS Code

2. **Reset configuration**:
   ```json
   // Remove all wsl-manager settings
   // Restart VS Code
   ```

## Automation and Scripting

### Extension API Usage

```typescript
// Example: Programmatic distribution management
import * as vscode from 'vscode';

async function createProjectEnvironment(projectName: string) {
    // Execute WSL Manager commands
    await vscode.commands.executeCommand(
        'wsl-manager.createDistribution',
        `${projectName}-dev`
    );
}
```

### PowerShell Automation

```powershell
# Advanced WSL management script
function New-WSLDevEnvironment {
    param(
        [string]$Name,
        [string]$BaseDistro = "Ubuntu",
        [string[]]$Packages
    )
    
    # Create distribution
    Write-Host "Creating $Name from $BaseDistro..."
    
    # Import base
    wsl --import $Name "C:\WSL\$Name" "C:\WSL\Templates\$BaseDistro.tar"
    
    # Install packages
    $packageList = $Packages -join " "
    wsl -d $Name -- bash -c "sudo apt update && sudo apt install -y $packageList"
    
    # Export as new template
    wsl --export $Name "C:\WSL\Templates\$Name.tar"
}

# Usage
New-WSLDevEnvironment -Name "python-dev" -Packages @("python3", "pip", "virtualenv")
```

## Best Practices

### Distribution Naming Convention

```
Format: [project]-[environment]-[version]

Examples:
- myapp-dev-v1
- api-staging-2023
- ml-training-cuda11
```

### Resource Management

1. **Memory allocation strategy**:
   - Development: 4-8GB
   - Testing: 2-4GB
   - Production simulation: 8-16GB

2. **Disk space planning**:
   - Base distribution: 2-3GB
   - Development tools: +2-5GB
   - Project files: Variable
   - Keep 20% free space

### Security Hardening

1. **Minimal distributions**:
   - Start with Alpine for containers
   - Remove unnecessary packages
   - Disable unused services

2. **Access control**:
   - Use restricted operations
   - Enable audit logging
   - Regular security reviews

---

For more information, see the [FAQ](faq.md) or [API Documentation](../api/README.md).