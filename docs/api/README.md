VSC WSL Manager API / [Modules](modules.md)

# WSL Image Manager for VS Code

A powerful VS Code extension for managing Windows Subsystem for Linux (WSL) distributions with seamless terminal integration.

## Features

- **Visual WSL Management**: View all your WSL distributions in a dedicated sidebar
- **Create New Distributions**: Clone existing distributions to create new isolated environments
- **Import/Export**: Import TAR files as new distributions or export existing ones
- **Terminal Integration**: Automatically registers WSL distributions as VS Code terminal profiles
- **Real-time Status**: See which distributions are running or stopped
- **Distribution Info**: View detailed information about each distribution (OS, kernel, memory)

## Requirements

- Windows 10/11 with WSL 2 installed
- VS Code 1.74.0 or higher
- At least one WSL distribution installed (for cloning)

## Installation

1. Clone this repository
2. Run `npm install` in the project directory
3. Open the project in VS Code
4. Press `F5` to run the extension in a new Extension Development Host window

## Usage

### Managing Distributions

1. **View Distributions**: Click the WSL Manager icon in the Activity Bar to see all distributions
2. **Create New**: Click the `+` button to create a new distribution by cloning an existing one
3. **Import**: Right-click in the view and select "Import Distribution from TAR"
4. **Export**: Right-click on a distribution and select "Export Distribution to TAR"
5. **Delete**: Right-click on a distribution and select "Delete Distribution"

### Terminal Integration

The extension automatically registers all WSL distributions as terminal profiles. To use them:

1. Open the terminal dropdown (click the `+` button dropdown in the terminal)
2. Look for profiles starting with "WSL-" followed by your distribution name
3. Select a profile to open a new terminal in that WSL environment

## Development

Press F5 in VS Code to launch the extension in a new Extension Development Host window.

## License

MIT
