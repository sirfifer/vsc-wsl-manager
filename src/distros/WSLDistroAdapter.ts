/**
 * WSL Distribution Adapter
 * 
 * Allows using existing WSL distributions as sources for creating images
 * This bridges the gap between pristine distro templates and actual WSL distributions
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { DistroInfo } from './DistroManager';
import { Logger } from '../utils/logger';

const logger = Logger.getInstance();

export interface WSLDistribution {
    name: string;
    state: 'Running' | 'Stopped';
    version: string;
    default: boolean;
}

/**
 * Adapter to use WSL distributions as distro sources
 */
export class WSLDistroAdapter {
    /**
     * List available WSL distributions that can be used as sources
     */
    async listWSLDistributions(): Promise<WSLDistribution[]> {
        return new Promise((resolve, reject) => {
            const child = spawn('wsl.exe', ['--list', '--verbose'], {
                shell: true
            });

            let output = '';
            let errorOutput = '';

            child.stdout.on('data', (data) => {
                output += data.toString();
            });

            child.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            child.on('close', (code) => {
                if (code !== 0) {
                    logger.error(`WSL list failed: ${errorOutput}`);
                    resolve([]);
                    return;
                }

                try {
                    const distributions = this.parseWSLOutput(output);
                    resolve(distributions);
                } catch (error) {
                    logger.error('Failed to parse WSL output:', error);
                    resolve([]);
                }
            });

            child.on('error', (error) => {
                logger.error('Failed to execute wsl.exe:', error);
                resolve([]);
            });
        });
    }

    /**
     * Parse WSL --list --verbose output
     */
    private parseWSLOutput(output: string): WSLDistribution[] {
        const lines = output.split('\n').filter(line => line.trim());
        const distributions: WSLDistribution[] = [];

        // Skip header line
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Parse each line (handle UTF-16 encoded output)
            const cleanLine = line.replace(/\0/g, '').replace(/[^\x20-\x7E]/g, ' ');
            const parts = cleanLine.split(/\s+/).filter(p => p);
            
            if (parts.length >= 3) {
                const isDefault = parts[0] === '*';
                const name = isDefault ? parts[1] : parts[0];
                const stateIndex = isDefault ? 2 : 1;
                const versionIndex = isDefault ? 3 : 2;
                
                distributions.push({
                    name: name,
                    state: parts[stateIndex] as 'Running' | 'Stopped',
                    version: parts[versionIndex] || '2',
                    default: isDefault
                });
            }
        }

        return distributions;
    }

    /**
     * Convert WSL distributions to DistroInfo format
     */
    async getWSLDistributionsAsDistros(): Promise<DistroInfo[]> {
        const wslDistros = await this.listWSLDistributions();
        
        return wslDistros.map(wsl => ({
            name: wsl.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
            displayName: wsl.name,
            description: `WSL ${wsl.version} Distribution (${wsl.state})`,
            version: wsl.version,
            architecture: 'x64' as const,
            available: true, // WSL distributions are always "available"
            tags: ['wsl', 'existing'],
            // Use export path as the "file path"
            filePath: `wsl://${wsl.name}`
        }));
    }

    /**
     * Export a WSL distribution to a tar file
     */
    async exportDistribution(distroName: string, targetPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            logger.info(`Exporting WSL distribution '${distroName}' to '${targetPath}'`);
            
            const child = spawn('wsl.exe', ['--export', distroName, targetPath], {
                shell: true
            });

            let errorOutput = '';

            child.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            child.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Failed to export distribution: ${errorOutput}`));
                    return;
                }
                
                logger.info(`Successfully exported '${distroName}' to '${targetPath}'`);
                resolve();
            });

            child.on('error', (error) => {
                reject(error);
            });
        });
    }

    /**
     * Check if a name refers to an existing WSL distribution
     */
    async isWSLDistribution(name: string): Promise<boolean> {
        const distros = await this.listWSLDistributions();
        return distros.some(d => d.name === name);
    }
}