import { WSLManager } from '../../src/wslManager';
import { CommandBuilder } from '../../src/utils/commandBuilder';
import * as child_process from 'child_process';
import { EventEmitter } from 'events';

jest.mock('child_process');

describe('UTF-16 WSL Output Parsing', () => {
    let wslManager: WSLManager;
    const mockSpawn = child_process.spawn as jest.MockedFunction<typeof child_process.spawn>;

    beforeEach(() => {
        jest.clearAllMocks();
        wslManager = new WSLManager();
    });

    it('should correctly parse UTF-16LE encoded WSL output', async () => {
        // Create mock process
        const mockProcess = new EventEmitter() as any;
        mockProcess.stdout = new EventEmitter();
        mockProcess.stderr = new EventEmitter();
        mockProcess.kill = jest.fn();

        mockSpawn.mockReturnValue(mockProcess);

        // Simulate UTF-16LE output from WSL
        const wslOutputText = `  NAME                             STATE           VERSION
* Ubuntu-24.04                     Running         2
  Alpine-Test-Manual               Stopped         2
  docker-desktop                   Stopped         2`;

        // Convert to UTF-16LE buffer
        const utf16Buffer = Buffer.from(wslOutputText, 'utf16le');

        // Start the async operation
        const resultPromise = wslManager.listDistributions();

        // Emit the UTF-16 data
        mockProcess.stdout.emit('data', utf16Buffer);
        
        // Signal process completion
        mockProcess.emit('close', 0, null);

        // Wait for result
        const distributions = await resultPromise;

        // Verify correct parsing
        expect(distributions).toHaveLength(3);
        expect(distributions[0]).toEqual({
            name: 'Ubuntu-24.04',
            state: 'Running',
            version: '2',
            default: true
        });
        expect(distributions[1]).toEqual({
            name: 'Alpine-Test-Manual',
            state: 'Stopped',
            version: '2',
            default: false
        });
        expect(distributions[2]).toEqual({
            name: 'docker-desktop',
            state: 'Stopped',
            version: '2',
            default: false
        });
    });

    it('should handle mixed UTF-8 and UTF-16 output', async () => {
        // Create mock process
        const mockProcess = new EventEmitter() as any;
        mockProcess.stdout = new EventEmitter();
        mockProcess.stderr = new EventEmitter();
        mockProcess.kill = jest.fn();

        mockSpawn.mockReturnValue(mockProcess);

        // Start the async operation
        const resultPromise = wslManager.listDistributions();

        // First chunk in UTF-16LE
        const header = '  NAME                             STATE           VERSION\n';
        const utf16Header = Buffer.from(header, 'utf16le');
        mockProcess.stdout.emit('data', utf16Header);

        // Second chunk in UTF-8 (fallback)
        const body = '* Ubuntu-24.04                     Running         2\n';
        const utf8Body = Buffer.from(body, 'utf8');
        mockProcess.stdout.emit('data', utf8Body);

        // Signal process completion
        mockProcess.emit('close', 0, null);

        // Wait for result
        const distributions = await resultPromise;

        // Should still parse correctly
        expect(distributions).toHaveLength(1);
        expect(distributions[0].name).toBe('Ubuntu-24.04');
    });

    it('should handle distributions with long names and spaces', async () => {
        // Create mock process
        const mockProcess = new EventEmitter() as any;
        mockProcess.stdout = new EventEmitter();
        mockProcess.stderr = new EventEmitter();
        mockProcess.kill = jest.fn();

        mockSpawn.mockReturnValue(mockProcess);

        // Simulate output with long distribution name
        const wslOutputText = `  NAME                             STATE           VERSION
  CC-CDB-graylog-cluster-39ac78    Stopped         2
  Alpine-Clone-1                   Stopped         2`;

        // Convert to UTF-16LE buffer
        const utf16Buffer = Buffer.from(wslOutputText, 'utf16le');

        // Start the async operation
        const resultPromise = wslManager.listDistributions();

        // Emit the UTF-16 data
        mockProcess.stdout.emit('data', utf16Buffer);
        
        // Signal process completion
        mockProcess.emit('close', 0, null);

        // Wait for result
        const distributions = await resultPromise;

        // Verify correct parsing of long names
        expect(distributions).toHaveLength(2);
        expect(distributions[0].name).toBe('CC-CDB-graylog-cluster-39ac78');
        expect(distributions[1].name).toBe('Alpine-Clone-1');
    });
});