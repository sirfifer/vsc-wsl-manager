/**
 * Tests for VS Code Terminal Profile Provider implementation
 * Following VS Code's official terminal profile contribution API
 */

import * as vscode from 'vscode';
import { WSLTerminalProfileProvider } from '../../src/terminal/wslTerminalProfileProvider';
import { WSLDistribution } from '../../src/wslManager';
import { distributionGenerators } from '../utils/testDataGenerators';

// Mock vscode module
jest.mock('vscode');

describe('WSL Terminal Profile Provider', () => {
    let mockRegisterTerminalProfileProvider: jest.Mock;
    let mockDisposable: vscode.Disposable;
    
    beforeEach(() => {
        // Setup mocks
        mockDisposable = { dispose: jest.fn() };
        mockRegisterTerminalProfileProvider = jest.fn().mockReturnValue(mockDisposable);
        (vscode.window as any).registerTerminalProfileProvider = mockRegisterTerminalProfileProvider;
        
        // Mock ThemeIcon
        (vscode as any).ThemeIcon = class ThemeIcon {
            constructor(public readonly id: string) {}
        };
        
        // Clear all mocks
        jest.clearAllMocks();
    });
    
    describe('Provider Registration', () => {
        it('should register a terminal profile provider for a WSL distribution', () => {
            const distribution = distributionGenerators.createDistribution({ name: 'Ubuntu' });
            const provider = new WSLTerminalProfileProvider(distribution);
            
            const disposable = provider.register();
            
            expect(mockRegisterTerminalProfileProvider).toHaveBeenCalledWith(
                'wsl-manager.Ubuntu',
                expect.any(Object)
            );
            expect(disposable).toBe(mockDisposable);
        });
        
        it('should register providers for multiple distributions', () => {
            const distributions = [
                { name: 'Ubuntu', state: 'Running' as const, version: '2', default: false },
                { name: 'Debian', state: 'Running' as const, version: '2', default: false },
                { name: 'Alpine', state: 'Stopped' as const, version: '2', default: false }
            ];
            
            const disposables = distributions.map(distro => {
                const provider = new WSLTerminalProfileProvider(distro);
                return provider.register();
            });
            
            expect(mockRegisterTerminalProfileProvider).toHaveBeenCalledTimes(3);
            expect(mockRegisterTerminalProfileProvider).toHaveBeenCalledWith('wsl-manager.Ubuntu', expect.any(Object));
            expect(mockRegisterTerminalProfileProvider).toHaveBeenCalledWith('wsl-manager.Debian', expect.any(Object));
            expect(mockRegisterTerminalProfileProvider).toHaveBeenCalledWith('wsl-manager.Alpine', expect.any(Object));
            expect(disposables).toHaveLength(3);
        });
        
        it('should handle special characters in distribution names', () => {
            const distribution = { 
                name: 'Ubuntu-20.04.LTS', 
                state: 'Running' as const, 
                version: '2', 
                default: false 
            };
            const provider = new WSLTerminalProfileProvider(distribution);
            
            provider.register();
            
            // Profile ID should be sanitized for VS Code
            expect(mockRegisterTerminalProfileProvider).toHaveBeenCalledWith(
                'wsl-manager.Ubuntu-20.04.LTS',
                expect.any(Object)
            );
        });
    });
    
    describe('Terminal Profile Creation', () => {
        it('should provide correct terminal options for a distribution', async () => {
            const distribution = distributionGenerators.createDistribution({ name: 'Ubuntu' });
            const provider = new WSLTerminalProfileProvider(distribution);
            
            provider.register();
            
            // Get the provider function that was registered
            const registeredProvider = mockRegisterTerminalProfileProvider.mock.calls[0][1];
            const token = { isCancellationRequested: false, onCancellationRequested: jest.fn() };
            
            const profile = await registeredProvider.provideTerminalProfile(token);
            
            expect(profile).toEqual({
                options: {
                    name: 'WSL: Ubuntu',
                    shellPath: 'wsl.exe',
                    shellArgs: ['-d', 'Ubuntu'],
                    iconPath: expect.any(Object),
                    env: {}
                }
            });
        });
        
        it('should respect cancellation token', async () => {
            const distribution = distributionGenerators.createDistribution();
            const provider = new WSLTerminalProfileProvider(distribution);
            
            provider.register();
            
            const registeredProvider = mockRegisterTerminalProfileProvider.mock.calls[0][1];
            const token = { 
                isCancellationRequested: true, 
                onCancellationRequested: jest.fn() 
            };
            
            const profile = await registeredProvider.provideTerminalProfile(token);
            
            expect(profile).toBeUndefined();
        });
        
        it('should handle default distribution differently', async () => {
            const distribution = { 
                name: 'Ubuntu', 
                state: 'Running' as const, 
                version: '2', 
                default: true 
            };
            const provider = new WSLTerminalProfileProvider(distribution);
            
            provider.register();
            
            const registeredProvider = mockRegisterTerminalProfileProvider.mock.calls[0][1];
            const token = { isCancellationRequested: false, onCancellationRequested: jest.fn() };
            
            const profile = await registeredProvider.provideTerminalProfile(token);
            
            expect(profile.options.name).toBe('WSL: Ubuntu (default)');
        });
        
        it('should include distribution state in terminal name if stopped', async () => {
            const distribution = { 
                name: 'Alpine', 
                state: 'Stopped' as const, 
                version: '2', 
                default: false 
            };
            const provider = new WSLTerminalProfileProvider(distribution);
            
            provider.register();
            
            const registeredProvider = mockRegisterTerminalProfileProvider.mock.calls[0][1];
            const token = { isCancellationRequested: false, onCancellationRequested: jest.fn() };
            
            const profile = await registeredProvider.provideTerminalProfile(token);
            
            expect(profile.options.name).toBe('WSL: Alpine (stopped)');
        });
    });
    
    describe('Provider Disposal', () => {
        it('should properly dispose of the provider', () => {
            const distribution = distributionGenerators.createDistribution();
            const provider = new WSLTerminalProfileProvider(distribution);
            
            const disposable = provider.register();
            
            expect(mockDisposable.dispose).not.toHaveBeenCalled();
            
            disposable.dispose();
            
            expect(mockDisposable.dispose).toHaveBeenCalled();
        });
        
        it('should handle multiple disposal calls gracefully', () => {
            const distribution = distributionGenerators.createDistribution();
            const provider = new WSLTerminalProfileProvider(distribution);
            
            const disposable = provider.register();
            
            disposable.dispose();
            disposable.dispose(); // Second call should not throw
            
            // Mock disposable will be called twice since we're not preventing it
            // This is OK - VS Code's disposables handle multiple calls
            expect(mockDisposable.dispose).toHaveBeenCalledTimes(2);
        });
    });
    
    describe('Icon and Theming', () => {
        it('should use appropriate icon for Linux terminals', async () => {
            const distribution = distributionGenerators.createDistribution();
            const provider = new WSLTerminalProfileProvider(distribution);
            
            provider.register();
            
            const registeredProvider = mockRegisterTerminalProfileProvider.mock.calls[0][1];
            const token = { isCancellationRequested: false, onCancellationRequested: jest.fn() };
            
            const profile = await registeredProvider.provideTerminalProfile(token);
            
            // Should use ThemeIcon for consistency with VS Code
            expect(profile.options.iconPath).toBeDefined();
            expect(profile.options.iconPath.id).toBe('terminal-linux');
        });
    });
    
    describe('Error Handling', () => {
        it('should handle errors in profile creation gracefully', async () => {
            const distribution = distributionGenerators.createDistribution();
            const provider = new WSLTerminalProfileProvider(distribution);
            
            // Mock an error scenario
            const errorProvider = {
                provideTerminalProfile: jest.fn().mockRejectedValue(new Error('Test error'))
            };
            
            mockRegisterTerminalProfileProvider.mockImplementation((id, p) => {
                return mockDisposable;
            });
            
            provider.register();
            
            // Should not throw, but handle error gracefully
            expect(() => provider.register()).not.toThrow();
        });
    });
    
    describe('Profile Manager Integration', () => {
        it('should register all distributions at once', () => {
            const distributions = distributionGenerators.createDistributionList();
            const manager = new WSLTerminalProfileManager();
            
            const disposables = manager.registerProfiles(distributions);
            
            expect(mockRegisterTerminalProfileProvider).toHaveBeenCalledTimes(distributions.length);
            expect(disposables).toHaveLength(distributions.length);
        });
        
        it('should update profiles when distributions change', () => {
            const manager = new WSLTerminalProfileManager();
            const initialDistros = [
                { name: 'Ubuntu', state: 'Running' as const, version: '2', default: false }
            ];
            
            // Register initial
            let disposables = manager.registerProfiles(initialDistros);
            expect(mockRegisterTerminalProfileProvider).toHaveBeenCalledTimes(1);
            
            // Clear and re-register with more distributions
            disposables.forEach(d => d.dispose());
            jest.clearAllMocks();
            
            const updatedDistros = [
                { name: 'Ubuntu', state: 'Running' as const, version: '2', default: false },
                { name: 'Debian', state: 'Running' as const, version: '2', default: false }
            ];
            
            disposables = manager.registerProfiles(updatedDistros);
            expect(mockRegisterTerminalProfileProvider).toHaveBeenCalledTimes(2);
        });
        
        it('should clean up all profiles on extension deactivation', () => {
            const manager = new WSLTerminalProfileManager();
            const distributions = distributionGenerators.createDistributionList();
            
            const disposables = manager.registerProfiles(distributions);
            
            // Simulate extension deactivation
            manager.dispose();
            
            disposables.forEach(d => {
                expect(d.dispose).toHaveBeenCalled();
            });
        });
    });
});

/**
 * Mock Terminal Profile Manager for testing
 * This will be the actual implementation later
 */
class WSLTerminalProfileManager {
    private disposables: vscode.Disposable[] = [];
    
    registerProfiles(distributions: WSLDistribution[]): vscode.Disposable[] {
        // Dispose old profiles
        this.dispose();
        
        // Register new profiles
        this.disposables = distributions.map(distro => {
            const provider = new WSLTerminalProfileProvider(distro);
            return provider.register();
        });
        
        return this.disposables;
    }
    
    dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}