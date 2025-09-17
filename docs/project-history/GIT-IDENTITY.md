# Git Identity Management

## Current Setup

This repository is configured with automatic identity checking to ensure commits are properly attributed to **sirfifer**.

## Features Implemented

### 1. Identity Switcher Script
Location: `~/bin/git-switch-identity.sh`

**Commands:**
- `git-switch sirfifer` - Switch to sirfifer identity
- `git-switch ramermancdb` - Switch to work identity  
- `git-who` - Show current identity
- `git-auto` - Auto-detect based on directory

### 2. Pre-commit Hook
Location: `.githooks/pre-commit`

This hook:
- ✅ Prevents commits with generic "User <user@example.com>"
- ✅ Prevents commits from wrong identity (e.g., ramermancdb in sirfifer's repo)
- ✅ Shows current identity before each commit

### 3. Repository Identity File
Location: `.git/current-identity`

Stores the expected identity for this repository (sirfifer).

## Quick Setup

### First Time Setup
```bash
# Run the setup script
~/bin/setup-git-identity.sh

# Update your email in the script
nano ~/bin/git-switch-identity.sh
# Change: IDENTITIES[sirfifer.email]="your-actual-email@example.com"

# Reload your shell
source ~/.bashrc
```

### Switching Identities
```bash
# For this project (sirfifer)
git-switch sirfifer

# For work projects
git-switch ramermancdb

# Check current identity
git-who
```

## How It Works

When you run `git-switch <identity>`, it:
1. Switches GitHub CLI authentication (`gh auth switch`)
2. Updates git config for the current repository
3. Sets environment variables for the session
4. Saves the identity to `.git/current-identity`

## Troubleshooting

### "Wrong identity" error when committing
```bash
git-switch sirfifer
```

### GitHub CLI not logged in
```bash
gh auth login
# Then switch to correct account
gh auth switch -u sirfifer
```

### Generic user configuration
If you see commits as "User <user@example.com>":
```bash
git config user.name "sirfifer"
git config user.email "your-actual-email@example.com"
```

## Important Notes

1. **Update the email address** in `~/bin/git-switch-identity.sh` to your actual email
2. **The pre-commit hook** will block commits with wrong identity
3. **GitHub matches by email** - use the same email as your GitHub account
4. All future commits will be properly attributed to sirfifer

## Directory-Based Auto-Switching (Optional)

The script can auto-detect identity based on directory patterns:
- `/personal/` or `/sirfifer/` → Uses sirfifer identity
- `/work/` or `/cdbaby/` → Uses ramermancdb identity

Run `git-auto` in any repository to auto-detect.