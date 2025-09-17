/**
 * Feature: WSL_SERVICE_CORE
 * Coverage Target: Core WSL service functionality including distribution management
 * Status: 🟡 In Progress
 * 
 * This test file demonstrates the TDD approach:
 * 1. Tests are written FIRST before implementation
 * 2. Tests define the expected behavior
 * 3. Implementation is done to make tests pass
 * 4. Code is refactored with confidence
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { WslService } from '@/services/wslService';
import { Distribution, WslCommand, CommandResult } from '@/types';
import { SecurityValidator } from '@/security/validator';
import { exec } from 'child_process';
import { promisify } from 'util';

// Mock external dependencies
jest.mock('child_process');
jest.mock('util', () => ({
  ...jest.requireActual('util'),
  promisify: jest.fn((fn) => fn)
}));

describe('WslService - Core Functionality', () => {
  let wslService: WslService;
  let mockExec: jest.MockedFunction<typeof exec>;
  
  beforeEach(() => {
    // Initialize service
    wslService = new WslService();
    
    // Setup mocks
    mockExec = exec as jest.MockedFunction<typeof exec>;
    mockExec.mockClear();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('listDistributions', () => {
    it('should return all WSL distributions with their states', async () => {
      // Given - Mock WSL output
      const wslOutput = `
        NAME            STATE           VERSION
        Ubuntu-22.04    Running         2
        Debian          Stopped         2
        TestProject     Running         2
      `;
      
      mockExec.mockImplementation((cmd, callback: any) => {
        callback(null, { stdout: wslOutput, stderr: '' });
      });
      
      // When
      const distributions = await wslService.listDistributions();
      
      // Then
      expect(distributions).toHaveLength(3);
      expect(distributions[0]).toEqual({
        name: 'Ubuntu-22.04',
        state: 'Running',
        version: 2,
        isDefault: false
      });
      expect(distributions[1]).toEqual({
        name: 'Debian',
        state: 'Stopped',
        version: 2,
        isDefault: false
      });
    });
    
    it('should identify the default distribution', async () => {
      // Given
      const wslOutput = `
        NAME            STATE           VERSION
        * Ubuntu-22.04  Running         2
        Debian          Stopped         2
      `;
      
      mockExec.mockImplementation((cmd, callback: any) => {
        callback(null, { stdout: wslOutput, stderr: '' });
      });
      
      // When
      const distributions = await wslService.listDistributions();
      
      // Then
      const defaultDistro = distributions.find(d => d.isDefault);
      expect(defaultDistro?.name).toBe('Ubuntu-22.04');
    });
    
    it('should handle when WSL is not installed', async () => {
      // Given
      mockExec.mockImplementation((cmd, callback: any) => {
        callback(new Error('wsl: command not found'), null);
      });
      
      // When/Then
      await expect(wslService.listDistributions()).rejects.toThrow(
        'WSL is not installed or not available'
      );
    });
    
    it('should handle empty distribution list', async () => {
      // Given
      mockExec.mockImplementation((cmd, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
      });
      
      // When
      const distributions = await wslService.listDistributions();
      
      // Then
      expect(distributions).toEqual([]);
    });
  });
  
  describe('cloneDistribution', () => {
    it('should clone an existing distribution with a new name', async () => {
      // Given
      const sourceDistro = 'Ubuntu-22.04';
      const targetDistro = 'ProjectA-Dev';
      const installPath = '/home/user/.wsl/ProjectA-Dev';
      
      let commandSequence = 0;
      mockExec.mockImplementation((cmd: string, callback: any) => {
        commandSequence++;
        
        if (commandSequence === 1) {
          // First call: export source
          expect(cmd).toContain(`wsl --export ${sourceDistro}`);
          callback(null, { stdout: '', stderr: '' });
        } else if (commandSequence === 2) {
          // Second call: import to target
          expect(cmd).toContain(`wsl --import ${targetDistro}`);
          callback(null, { stdout: '', stderr: '' });
        }
      });
      
      // When
      const result = await wslService.cloneDistribution(
        sourceDistro,
        targetDistro,
        installPath
      );
      
      // Then
      expect(result).toEqual({
        success: true,
        distribution: {
          name: targetDistro,
          state: 'Stopped',
          version: 2,
          isDefault: false
        }
      });
      expect(mockExec).toHaveBeenCalledTimes(2);
    });
    
    it('should validate distribution names for security', async () => {
      // Given - Malicious input attempts
      const maliciousInputs = [
        'test; rm -rf /',
        'test && curl evil.com',
        'test`whoami`',
        'test$(whoami)',
        '../../../etc/passwd',
        'test|cat /etc/passwd'
      ];
      
      // When/Then - Each should be rejected
      for (const input of maliciousInputs) {
        await expect(
          wslService.cloneDistribution('Ubuntu', input)
        ).rejects.toThrow('Invalid distribution name');
      }
      
      // Verify no commands were executed
      expect(mockExec).not.toHaveBeenCalled();
    });
    
    it('should handle source distribution not found', async () => {
      // Given
      mockExec.mockImplementation((cmd, callback: any) => {
        callback(new Error('Distribution not found'), null);
      });
      
      // When/Then
      await expect(
        wslService.cloneDistribution('NonExistent', 'NewDistro')
      ).rejects.toThrow('Source distribution not found: NonExistent');
    });
    
    it('should handle duplicate target distribution name', async () => {
      // Given - Mock list showing target already exists
      const existingDistros = ['Ubuntu-22.04', 'ProjectA-Dev'];
      jest.spyOn(wslService, 'listDistributions').mockResolvedValue(
        existingDistros.map(name => ({
          name,
          state: 'Stopped',
          version: 2,
          isDefault: false
        }))
      );
      
      // When/Then
      await expect(
        wslService.cloneDistribution('Ubuntu-22.04', 'ProjectA-Dev')
      ).rejects.toThrow('Distribution already exists: ProjectA-Dev');
    });
    
    it('should use streaming for large distributions', async () => {
      // Given
      const sourceDistro = 'LargeDistro';
      const targetDistro = 'LargeDistro-Clone';
      
      mockExec.mockImplementation((cmd: string, callback: any) => {
        // Verify piping is used for efficiency
        expect(cmd).toMatch(/wsl --export .+ - \| wsl --import/);
        callback(null, { stdout: '', stderr: '' });
      });
      
      // When
      await wslService.cloneDistribution(sourceDistro, targetDistro);
      
      // Then
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('|'),
        expect.any(Function)
      );
    });
  });
  
  describe('deleteDistribution', () => {
    it('should delete a distribution after confirmation', async () => {
      // Given
      const distroName = 'TestProject';
      
      mockExec.mockImplementation((cmd, callback: any) => {
        expect(cmd).toBe(`wsl --unregister ${distroName}`);
        callback(null, { stdout: 'Unregistering...', stderr: '' });
      });
      
      // When
      const result = await wslService.deleteDistribution(distroName, true);
      
      // Then
      expect(result.success).toBe(true);
      expect(mockExec).toHaveBeenCalledTimes(1);
    });
    
    it('should not delete without confirmation', async () => {
      // When
      const result = await wslService.deleteDistribution('TestProject', false);
      
      // Then
      expect(result.success).toBe(false);
      expect(result.error).toBe('Deletion cancelled by user');
      expect(mockExec).not.toHaveBeenCalled();
    });
    
    it('should prevent deletion of default distribution without force flag', async () => {
      // Given - Mock that TestProject is default
      jest.spyOn(wslService, 'listDistributions').mockResolvedValue([
        {
          name: 'TestProject',
          state: 'Running',
          version: 2,
          isDefault: true
        }
      ]);
      
      // When/Then
      await expect(
        wslService.deleteDistribution('TestProject', true)
      ).rejects.toThrow('Cannot delete default distribution without force flag');
    });
  });
  
  describe('openTerminal', () => {
    it('should create terminal profile for distribution', async () => {
      // Given
      const distroName = 'Ubuntu-22.04';
      
      // When
      const profile = await wslService.createTerminalProfile(distroName);
      
      // Then
      expect(profile).toEqual({
        profileName: `WSL: ${distroName}`,
        path: 'wsl.exe',
        args: ['-d', distroName],
        icon: 'terminal-linux',
        color: 'terminal.ansiGreen',
        env: {
          WSLENV: 'VSCODE_WSL_EXT:WT_SESSION'
        }
      });
    });
    
    it('should validate distribution exists before creating profile', async () => {
      // Given
      jest.spyOn(wslService, 'listDistributions').mockResolvedValue([
        { name: 'Ubuntu', state: 'Running', version: 2, isDefault: false }
      ]);
      
      // When/Then
      await expect(
        wslService.createTerminalProfile('NonExistent')
      ).rejects.toThrow('Distribution not found: NonExistent');
    });
  });
  
  describe('importDistribution', () => {
    it('should import distribution from TAR file', async () => {
      // Given
      const tarPath = '/downloads/ubuntu-backup.tar';
      const distroName = 'Ubuntu-Restored';
      const installPath = '/home/user/.wsl/Ubuntu-Restored';
      
      mockExec.mockImplementation((cmd, callback: any) => {
        expect(cmd).toBe(
          `wsl --import ${distroName} "${installPath}" "${tarPath}"`
        );
        callback(null, { stdout: 'Import successful', stderr: '' });
      });
      
      // When
      const result = await wslService.importDistribution(
        tarPath,
        distroName,
        installPath
      );
      
      // Then
      expect(result.success).toBe(true);
      expect(result.distribution?.name).toBe(distroName);
    });
    
    it('should validate TAR file exists before import', async () => {
      // Given
      const nonExistentTar = '/invalid/path.tar';
      
      // Mock file system check
      jest.spyOn(require('fs'), 'existsSync').mockReturnValue(false);
      
      // When/Then
      await expect(
        wslService.importDistribution(nonExistentTar, 'TestDistro')
      ).rejects.toThrow('TAR file not found');
    });
  });
  
  describe('exportDistribution', () => {
    it('should export distribution to TAR file', async () => {
      // Given
      const distroName = 'Ubuntu-22.04';
      const exportPath = '/backups/ubuntu-backup.tar';
      
      mockExec.mockImplementation((cmd, callback: any) => {
        expect(cmd).toBe(`wsl --export ${distroName} "${exportPath}"`);
        callback(null, { stdout: 'Export successful', stderr: '' });
      });
      
      // When
      const result = await wslService.exportDistribution(distroName, exportPath);
      
      // Then
      expect(result.success).toBe(true);
      expect(result.filePath).toBe(exportPath);
    });
    
    it('should handle export of running distribution', async () => {
      // Note: WSL automatically handles this, but we should notify user
      // that the distribution will be in a saved state
      
      // Given
      jest.spyOn(wslService, 'listDistributions').mockResolvedValue([
        { name: 'Ubuntu', state: 'Running', version: 2, isDefault: false }
      ]);
      
      // When
      const result = await wslService.exportDistribution('Ubuntu', '/backup.tar');
      
      // Then
      expect(result.warning).toContain('Distribution will be saved in current state');
    });
  });
  
  describe('Rate Limiting', () => {
    it('should enforce rate limiting on operations', async () => {
      // Given - Configure rate limit
      wslService.setRateLimit(3, 1000); // 3 operations per second
      
      // When - Attempt 4 operations quickly
      const operations = [
        wslService.listDistributions(),
        wslService.listDistributions(),
        wslService.listDistributions(),
        wslService.listDistributions() // This should be rate limited
      ];
      
      // Then
      await expect(Promise.all(operations)).rejects.toThrow('Rate limit exceeded');
    });
  });
  
  describe('Audit Logging', () => {
    it('should log all WSL operations for security audit', async () => {
      // Given
      const auditLogger = jest.spyOn(wslService['auditLogger'], 'log');
      
      mockExec.mockImplementation((cmd, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
      });
      
      // When
      await wslService.deleteDistribution('TestDistro', true);
      
      // Then
      expect(auditLogger).toHaveBeenCalledWith({
        action: 'DELETE_DISTRIBUTION',
        distribution: 'TestDistro',
        timestamp: expect.any(Date),
        user: expect.any(String),
        success: true
      });
    });
  });
});

// Custom matchers are defined in test-setup.ts
describe('Custom Matchers', () => {
  it('should validate distribution names', () => {
    expect('Ubuntu-22.04').toBeValidDistributionName();
    expect('Project_Dev').toBeValidDistributionName();
    expect('test.distro').toBeValidDistributionName();
    
    expect('test; rm -rf').not.toBeValidDistributionName();
    expect('-invalid').not.toBeValidDistributionName();
    expect('test..traversal').not.toBeValidDistributionName();
  });
  
  it('should validate command safety', () => {
    expect('wsl --list').toBeSafeCommand();
    expect('wsl --export Ubuntu /backup.tar').toBeSafeCommand();
    
    expect('wsl; rm -rf /').not.toBeSafeCommand();
    expect('wsl && curl evil.com').not.toBeSafeCommand();
    expect('wsl | cat /etc/passwd').not.toBeSafeCommand();
  });
});
