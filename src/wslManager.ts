import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const execAsync = promisify(exec);

export interface WSLDistribution {
    name: string;
    state: 'Running' | 'Stopped';
    version: string;
    default: boolean;
}

export class WSLManager {
    private readonly wslCommand = 'wsl.exe';

    async listDistributions(): Promise<WSLDistribution[]> {
        try {
            const { stdout } = await execAsync(`${this.wslCommand} --list --verbose`);
            return this.parseDistributions(stdout);
        } catch (error) {
            console.error('Failed to list WSL distributions:', error);
            return [];
        }
    }

    private parseDistributions(output: string): WSLDistribution[] {
        const lines = output.split('\n').slice(1); // Skip header
        const distributions: WSLDistribution[] = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Parse WSL output format
            const isDefault = trimmed.startsWith('*');
            const parts = trimmed.replace('*', '').trim().split(/\s+/);
            
            if (parts.length >= 3) {
                distributions.push({
                    name: parts[0],
                    state: parts[1] as 'Running' | 'Stopped',
                    version: parts[2],
                    default: isDefault
                });
            }
        }

        return distributions;
    }

    async createDistribution(name: string, baseDistro: string): Promise<void> {
        // First, ensure the base distribution is installed
        await this.ensureBaseDistribution(baseDistro);

        // Export the base distribution
        const tempPath = path.join(process.env.TEMP || '/tmp', `${name}-base.tar`);
        await this.exportDistribution(baseDistro, tempPath);

        // Import as new distribution
        const installPath = this.getDefaultInstallPath(name);
        await this.importDistribution(name, tempPath, installPath);

        // Clean up temp file
        try {
            await fs.promises.unlink(tempPath);
        } catch (error) {
            console.error('Failed to clean up temp file:', error);
        }
    }

    async importDistribution(name: string, tarPath: string, installLocation?: string): Promise<void> {
        const location = installLocation || this.getDefaultInstallPath(name);
        
        // Ensure the directory exists
        await fs.promises.mkdir(location, { recursive: true });

        const command = `${this.wslCommand} --import "${name}" "${location}" "${tarPath}"`;
        await execAsync(command);
    }

    async exportDistribution(name: string, exportPath: string): Promise<void> {
        const command = `${this.wslCommand} --export "${name}" "${exportPath}"`;
        await execAsync(command);
    }

    async unregisterDistribution(name: string): Promise<void> {
        const command = `${this.wslCommand} --unregister "${name}"`;
        await execAsync(command);
    }

    async terminateDistribution(name: string): Promise<void> {
        const command = `${this.wslCommand} --terminate "${name}"`;
        await execAsync(command);
    }

    async setDefaultDistribution(name: string): Promise<void> {
        const command = `${this.wslCommand} --set-default "${name}"`;
        await execAsync(command);
    }

    private async ensureBaseDistribution(distroName: string): Promise<void> {
        const distributions = await this.listDistributions();
        const exists = distributions.some(d => d.name.toLowerCase() === distroName.toLowerCase());

        if (!exists) {
            throw new Error(`Base distribution '${distroName}' is not installed. Please install it from the Microsoft Store first.`);
        }
    }

    private getDefaultInstallPath(name: string): string {
        const config = vscode.workspace.getConfiguration('wsl-manager');
        const defaultPath = config.get<string>('defaultDistributionPath');
        
        if (defaultPath) {
            return path.join(defaultPath, name);
        }

        // Default to user's home directory
        const homeDir = process.env.USERPROFILE || process.env.HOME || '';
        return path.join(homeDir, 'WSL', 'Distributions', name);
    }

    async runCommand(distribution: string, command: string): Promise<string> {
        const { stdout } = await execAsync(`${this.wslCommand} -d "${distribution}" ${command}`);
        return stdout;
    }

    async getDistributionInfo(name: string): Promise<any> {
        try {
            const info: any = { name };

            // Get kernel version
            info.kernel = await this.runCommand(name, 'uname -r');
            
            // Get OS info
            try {
                info.os = await this.runCommand(name, 'cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2 | tr -d \\"');
            } catch {
                info.os = 'Unknown';
            }

            // Get memory info
            try {
                const memInfo = await this.runCommand(name, 'free -h | grep Mem | awk \'{print $2}\'');
                info.totalMemory = memInfo.trim();
            } catch {
                info.totalMemory = 'Unknown';
            }

            return info;
        } catch (error) {
            console.error(`Failed to get info for distribution ${name}:`, error);
            return { name, error: error.message };
        }
    }
}
