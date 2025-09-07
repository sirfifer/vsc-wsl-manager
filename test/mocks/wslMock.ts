/**
 * Mock infrastructure for WSL commands
 * Provides realistic mocks for testing without actual WSL
 */

import { CommandResult } from '../../src/utils/commandBuilder';

/**
 * Mock WSL command responses
 */
export const mockWslResponses = {
    // wsl --list --online response
    '--list --online': {
        stdout: `The following is a list of valid distributions that can be installed.
Install using 'wsl --install -d <Distro>'.

NAME                                   FRIENDLY NAME
Ubuntu                                 Ubuntu
Debian                                 Debian GNU/Linux
kali-linux                             Kali Linux Rolling
Ubuntu-18.04                           Ubuntu 18.04 LTS
Ubuntu-20.04                           Ubuntu 20.04 LTS
Ubuntu-22.04                           Ubuntu 22.04 LTS
Ubuntu-24.04                           Ubuntu 24.04 LTS
OracleLinux_7_9                        Oracle Linux 7.9
OracleLinux_8_7                        Oracle Linux 8.7
OracleLinux_9_1                        Oracle Linux 9.1
openSUSE-Leap-15.5                     openSUSE Leap 15.5
SUSE-Linux-Enterprise-Server-15-SP4    SUSE Linux Enterprise Server 15 SP4
openSUSE-Tumbleweed                    openSUSE Tumbleweed`,
        stderr: '',
        exitCode: 0
    },
    
    // wsl --list --verbose response
    '--list --verbose': {
        stdout: `  NAME                   STATE           VERSION
* Ubuntu                 Running         2
  Debian                 Stopped         2
  Alpine                 Running         2`,
        stderr: '',
        exitCode: 0
    },
    
    // wsl --install -d <name> response
    '--install -d Ubuntu': {
        stdout: `Installing: Ubuntu
Ubuntu has been installed.
Launching Ubuntu...`,
        stderr: '',
        exitCode: 0
    },
    
    // wsl --export response
    '--export': {
        stdout: '',
        stderr: '',
        exitCode: 0
    },
    
    // wsl --import response
    '--import': {
        stdout: '',
        stderr: '',
        exitCode: 0
    },
    
    // wsl --unregister response
    '--unregister': {
        stdout: 'Unregistering...\nThe operation completed successfully.',
        stderr: '',
        exitCode: 0
    },
    
    // wsl --terminate response
    '--terminate': {
        stdout: 'The operation completed successfully.',
        stderr: '',
        exitCode: 0
    },
    
    // wsl --set-default response
    '--set-default': {
        stdout: 'The operation completed successfully.',
        stderr: '',
        exitCode: 0
    },
    
    // wsl --version response
    '--version': {
        stdout: `WSL version: 2.0.0.0
Kernel version: 5.15.133.1-1
WSLg version: 1.0.59
MSRDC version: 1.2.4677
Direct3D version: 1.611.1-81528511
DXCore version: 10.0.25131.1002-220531-1700.rs-onecore-base2-hyp
Windows version: 10.0.22631.3155`,
        stderr: '',
        exitCode: 0
    }
};

/**
 * Mock error responses for testing error handling
 */
export const mockWslErrors = {
    distributionNotFound: {
        stdout: '',
        stderr: 'There is no distribution with the supplied name.',
        exitCode: 1
    },
    
    wslNotInstalled: {
        stdout: '',
        stderr: "'wsl' is not recognized as an internal or external command",
        exitCode: 1
    },
    
    permissionDenied: {
        stdout: '',
        stderr: 'Access is denied.',
        exitCode: 5
    },
    
    alreadyExists: {
        stdout: '',
        stderr: 'A distribution with the supplied name already exists.',
        exitCode: 1
    },
    
    networkError: {
        stdout: '',
        stderr: 'Failed to fetch the list distribution. WININET_E_CANNOT_CONNECT',
        exitCode: 1
    },
    
    diskSpaceError: {
        stdout: '',
        stderr: 'There is not enough space on the disk.',
        exitCode: 1
    }
};

/**
 * Mock WSL command executor
 */
export class MockWSLExecutor {
    private responses: Map<string, CommandResult> = new Map();
    private callHistory: Array<{ command: string; args: string[] }> = [];
    
    constructor() {
        this.setupDefaultResponses();
    }
    
    /**
     * Set up default responses for common commands
     */
    private setupDefaultResponses(): void {
        // Add default responses
        Object.entries(mockWslResponses).forEach(([key, response]) => {
            this.responses.set(key, response);
        });
    }
    
    /**
     * Execute a mock WSL command
     */
    async execute(args: string[]): Promise<CommandResult> {
        const commandKey = this.getCommandKey(args);
        this.callHistory.push({ command: 'wsl.exe', args });
        
        // Check for specific response
        if (this.responses.has(commandKey)) {
            return this.simulateDelay(this.responses.get(commandKey)!);
        }
        
        // Check for pattern matches
        for (const [pattern, response] of this.responses.entries()) {
            if (this.matchesPattern(args, pattern)) {
                return this.simulateDelay(response);
            }
        }
        
        // Default success response
        return this.simulateDelay({
            stdout: '',
            stderr: '',
            exitCode: 0
        });
    }
    
    /**
     * Add a custom response for testing
     */
    addResponse(pattern: string, response: CommandResult): void {
        this.responses.set(pattern, response);
    }
    
    /**
     * Get call history for assertions
     */
    getCallHistory(): Array<{ command: string; args: string[] }> {
        return this.callHistory;
    }
    
    /**
     * Clear call history
     */
    clearHistory(): void {
        this.callHistory = [];
    }
    
    /**
     * Reset to default state
     */
    reset(): void {
        this.responses.clear();
        this.callHistory = [];
        this.setupDefaultResponses();
    }
    
    /**
     * Get command key from arguments
     */
    private getCommandKey(args: string[]): string {
        // Handle specific command patterns
        if (args.includes('--install') && args.includes('-d')) {
            const distIndex = args.indexOf('-d') + 1;
            if (distIndex < args.length) {
                return `--install -d ${args[distIndex]}`;
            }
        }
        
        if (args.includes('--export')) {
            return '--export';
        }
        
        if (args.includes('--import')) {
            return '--import';
        }
        
        return args.join(' ');
    }
    
    /**
     * Check if args match a pattern
     */
    private matchesPattern(args: string[], pattern: string): boolean {
        const patternParts = pattern.split(' ');
        return patternParts.every(part => args.includes(part));
    }
    
    /**
     * Simulate async delay for realism
     */
    private async simulateDelay(response: CommandResult): Promise<CommandResult> {
        await new Promise(resolve => setTimeout(resolve, 10));
        return response;
    }
}

/**
 * Mock distribution data for testing
 */
export const mockDistributions = [
    {
        name: 'Ubuntu',
        state: 'Running',
        version: '2',
        default: true
    },
    {
        name: 'Debian',
        state: 'Stopped',
        version: '2',
        default: false
    },
    {
        name: 'Alpine',
        state: 'Running',
        version: '2',
        default: false
    }
];

/**
 * Mock image data for testing
 */
export const mockImages = [
    {
        name: 'ubuntu-base',
        baseDistribution: 'Ubuntu',
        created: '2024-01-01T00:00:00Z',
        size: 524288000, // 500MB
        architecture: 'x64',
        wslVersion: '2.0.0',
        tags: ['base', 'stable']
    },
    {
        name: 'dev-environment',
        baseDistribution: 'Ubuntu',
        created: '2024-01-02T00:00:00Z',
        size: 1073741824, // 1GB
        architecture: 'x64',
        wslVersion: '2.0.0',
        tags: ['development', 'nodejs', 'python'],
        description: 'Development environment with Node.js and Python'
    },
    {
        name: 'alpine-minimal',
        baseDistribution: 'Alpine',
        created: '2024-01-03T00:00:00Z',
        size: 52428800, // 50MB
        architecture: 'x64',
        wslVersion: '2.0.0',
        tags: ['minimal', 'lightweight']
    }
];

/**
 * Helper to create mock file system structure for images
 */
export function createMockImageFileSystem(basePath: string): void {
    const fs = require('fs');
    const path = require('path');
    
    mockImages.forEach(image => {
        const imageDir = path.join(basePath, image.name);
        fs.mkdirSync(imageDir, { recursive: true });
        
        // Write metadata
        fs.writeFileSync(
            path.join(imageDir, 'metadata.json'),
            JSON.stringify(image, null, 2)
        );
        
        // Create mock TAR file
        const tarContent = Buffer.alloc(1024); // Small mock content
        fs.writeFileSync(path.join(imageDir, 'rootfs.tar'), tarContent);
    });
}

/**
 * Mock progress reporter for download tests
 */
export class MockProgressReporter {
    private events: Array<{ type: string; data: any }> = [];
    
    report(progress: { percent: number; downloaded: number; total: number }): void {
        this.events.push({ type: 'progress', data: progress });
    }
    
    start(message: string): void {
        this.events.push({ type: 'start', data: message });
    }
    
    complete(message: string): void {
        this.events.push({ type: 'complete', data: message });
    }
    
    error(error: Error): void {
        this.events.push({ type: 'error', data: error.message });
    }
    
    getEvents(): Array<{ type: string; data: any }> {
        return this.events;
    }
    
    clear(): void {
        this.events = [];
    }
}