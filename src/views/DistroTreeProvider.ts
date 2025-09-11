/**
 * Tree Provider for Pristine Distros
 * 
 * Shows available distro templates that can be used to create new images
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { DistroManager, DistroInfo } from '../distros/DistroManager';
import { Logger } from '../utils/logger';

const logger = Logger.getInstance();

/**
 * Tree item for a distro
 */
export class DistroTreeItem extends vscode.TreeItem {
    constructor(
        public readonly distro: DistroInfo,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(distro.displayName, collapsibleState);
        
        this.tooltip = this.makeTooltip();
        this.description = this.makeDescription();
        this.contextValue = 'distribution';
        this.iconPath = this.getIcon();
    }
    
    private makeTooltip(): string {
        const lines = [
            this.distro.displayName,
            `Version: ${this.distro.version}`,
            `Architecture: ${this.distro.architecture}`,
            this.distro.description
        ];
        
        if (this.distro.size) {
            lines.push(`Size: ${this.formatSize(this.distro.size)}`);
        }
        
        if (this.distro.available) {
            lines.push('✓ Downloaded');
        } else {
            lines.push('⬇ Not downloaded');
        }
        
        return lines.join('\n');
    }
    
    private makeDescription(): string {
        const parts = [this.distro.version];
        
        if (this.distro.available) {
            parts.push('✓');
        } else if (this.distro.size) {
            parts.push(this.formatSize(this.distro.size));
        }
        
        return parts.join(' • ');
    }
    
    private getIcon(): vscode.ThemeIcon {
        if (this.distro.available) {
            return new vscode.ThemeIcon('package');
        } else {
            return new vscode.ThemeIcon('cloud-download');
        }
    }
    
    private formatSize(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
}

/**
 * Tree provider for distros
 */
export class DistroTreeProvider implements vscode.TreeDataProvider<DistroTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<DistroTreeItem | undefined | null | void> = 
        new vscode.EventEmitter<DistroTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<DistroTreeItem | undefined | null | void> = 
        this._onDidChangeTreeData.event;
    
    private distroManager: DistroManager;
    
    constructor(distroManager?: DistroManager) {
        this.distroManager = distroManager || new DistroManager();
    }
    
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
    
    getTreeItem(element: DistroTreeItem): vscode.TreeItem {
        return element;
    }
    
    async getChildren(element?: DistroTreeItem): Promise<DistroTreeItem[]> {
        if (element) {
            // No children for distro items
            return [];
        }
        
        try {
            const distros = await this.distroManager.listDistros();
            
            // Sort: available first, then by name
            distros.sort((a, b) => {
                if (a.available !== b.available) {
                    return a.available ? -1 : 1;
                }
                return a.displayName.localeCompare(b.displayName);
            });
            
            return distros.map(distro => 
                new DistroTreeItem(distro, vscode.TreeItemCollapsibleState.None)
            );
        } catch (error) {
            logger.error('Failed to get distros:', error);
            vscode.window.showErrorMessage('Failed to load distro list');
            return [];
        }
    }
    
    /**
     * Get parent of an element (for reveal functionality)
     */
    getParent(element: DistroTreeItem): vscode.ProviderResult<DistroTreeItem> {
        // Distros have no parent
        return undefined;
    }
}