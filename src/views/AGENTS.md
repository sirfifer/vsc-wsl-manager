# Views Directory - Agent Instructions

## Overview
This directory contains all tree view providers and UI components for the VSC WSL Manager extension. Views follow the VS Code TreeDataProvider pattern and must handle async operations gracefully.

## Tree Data Provider Pattern

### Standard TreeDataProvider Implementation
```typescript
import * as vscode from 'vscode';
import * as path from 'path';

export class MyTreeProvider implements vscode.TreeDataProvider<MyTreeItem> {
  // Event emitter for refresh
  private _onDidChangeTreeData = new vscode.EventEmitter<MyTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private readonly manager: MyManager
  ) {}

  /**
   * Refresh the tree view
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Refresh a specific item
   */
  refreshItem(item: MyTreeItem): void {
    this._onDidChangeTreeData.fire(item);
  }

  /**
   * Get tree item for display
   */
  getTreeItem(element: MyTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get children for an element
   */
  async getChildren(element?: MyTreeItem): Promise<MyTreeItem[]> {
    try {
      if (!element) {
        // Root level
        return this.getRootElements();
      } else {
        // Child elements
        return this.getChildElements(element);
      }
    } catch (error) {
      // Always handle errors gracefully
      console.error('Failed to get children:', error);
      return [];
    }
  }

  private async getRootElements(): Promise<MyTreeItem[]> {
    const items = await this.manager.getItems();
    return items.map(item => new MyTreeItem(item));
  }

  private async getChildElements(element: MyTreeItem): Promise<MyTreeItem[]> {
    // Return children if any
    return element.children || [];
  }
}
```

## Tree Item Implementation

### Standard Tree Item Class
```typescript
export class MyTreeItem extends vscode.TreeItem {
  constructor(
    public readonly data: MyData,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
  ) {
    super(data.name, collapsibleState);

    // Set properties
    this.tooltip = this.makeTooltip();
    this.description = this.makeDescription();
    this.contextValue = this.getContextValue();
    this.iconPath = this.getIcon();
    this.command = this.getCommand();
  }

  private makeTooltip(): string {
    // Multi-line tooltip with details
    return [
      this.data.name,
      `Type: ${this.data.type}`,
      `Status: ${this.data.status}`,
      this.data.description
    ].join('\n');
  }

  private makeDescription(): string {
    // Short description shown next to label
    return `${this.data.status} • ${this.data.type}`;
  }

  private getContextValue(): string {
    // Used for command enablement
    return `${this.data.type}-${this.data.status}`;
  }

  private getIcon(): vscode.ThemeIcon | { light: string; dark: string } {
    // Theme-aware icons
    if (this.data.status === 'running') {
      return new vscode.ThemeIcon('play-circle', new vscode.ThemeColor('charts.green'));
    }

    // Or use custom icons
    return {
      light: path.join(__dirname, '../../resources/light/icon.svg'),
      dark: path.join(__dirname, '../../resources/dark/icon.svg')
    };
  }

  private getCommand(): vscode.Command | undefined {
    // Optional default click action
    return {
      command: 'myExtension.selectItem',
      title: 'Select',
      arguments: [this.data]
    };
  }
}
```

## View Registration

### Registering Tree Views
```typescript
// In extension.ts
export function activate(context: vscode.ExtensionContext) {
  // Create provider
  const provider = new MyTreeProvider(manager);

  // Register tree view
  const treeView = vscode.window.createTreeView('myExtension.myView', {
    treeDataProvider: provider,
    showCollapseAll: true,
    canSelectMany: false
  });

  // Add to subscriptions
  context.subscriptions.push(treeView);

  // Register refresh command
  vscode.commands.registerCommand('myExtension.refreshView', () => {
    provider.refresh();
  });

  // Auto-refresh on relevant events
  manager.onDidChange(() => {
    provider.refresh();
  });
}
```

## Distribution Tree View Specifics

### WSL Distribution Tree Item
```typescript
export class DistributionTreeItem extends vscode.TreeItem {
  constructor(
    public readonly distribution: WSLDistribution
  ) {
    super(
      distribution.name,
      vscode.TreeItemCollapsibleState.Collapsed
    );

    // Set status-based properties
    this.description = this.getStatusDescription();
    this.tooltip = this.getDetailedTooltip();
    this.iconPath = this.getStatusIcon();
    this.contextValue = `distribution-${distribution.state.toLowerCase()}`;
  }

  private getStatusDescription(): string {
    const parts = [`v${this.distribution.version}`];

    if (this.distribution.default) {
      parts.push('Default');
    }

    parts.push(this.distribution.state);

    return parts.join(' • ');
  }

  private getDetailedTooltip(): string {
    return [
      `Name: ${this.distribution.name}`,
      `State: ${this.distribution.state}`,
      `WSL Version: ${this.distribution.version}`,
      `Default: ${this.distribution.default ? 'Yes' : 'No'}`,
      '',
      'Right-click for options'
    ].join('\n');
  }

  private getStatusIcon(): vscode.ThemeIcon {
    if (this.distribution.state === 'Running') {
      return new vscode.ThemeIcon('vm-running', new vscode.ThemeColor('charts.green'));
    } else {
      return new vscode.ThemeIcon('vm', new vscode.ThemeColor('charts.gray'));
    }
  }
}
```

## Image Tree View Specifics

### WSL Image Tree Item
```typescript
export class ImageTreeItem extends vscode.TreeItem {
  constructor(
    public readonly image: WSLImage
  ) {
    super(
      image.displayName || image.name,
      vscode.TreeItemCollapsibleState.None
    );

    this.description = this.getImageDescription();
    this.tooltip = this.getImageTooltip();
    this.iconPath = this.getImageIcon();
    this.contextValue = `image-${image.enabled ? 'enabled' : 'disabled'}`;
  }

  private getImageDescription(): string {
    const parts = [];

    if (image.source) {
      parts.push(`from ${image.source}`);
    }

    if (image.size) {
      parts.push(this.formatSize(image.size));
    }

    if (!image.enabled) {
      parts.push('Disabled');
    }

    return parts.join(' • ');
  }

  private formatSize(bytes: number): string {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) {
      return `${gb.toFixed(1)} GB`;
    }

    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  }

  private getImageTooltip(): string {
    const lines = [
      image.displayName || image.name,
      `Source: ${image.source}`,
      `Created: ${new Date(image.created).toLocaleDateString()}`,
      `Size: ${this.formatSize(image.size)}`,
      `Enabled: ${image.enabled ? 'Yes' : 'No'}`
    ];

    if (image.description) {
      lines.push('', image.description);
    }

    return lines.join('\n');
  }

  private getImageIcon(): string {
    // Return path to distribution-specific icon
    const iconName = this.getDistributionIconName(image.source);
    return path.join(__dirname, '../../resources/icons', `${iconName}.svg`);
  }

  private getDistributionIconName(source: string): string {
    const lowerSource = source.toLowerCase();

    if (lowerSource.includes('ubuntu')) return 'ubuntu';
    if (lowerSource.includes('debian')) return 'debian';
    if (lowerSource.includes('alpine')) return 'alpine';
    if (lowerSource.includes('fedora')) return 'fedora';
    if (lowerSource.includes('centos')) return 'centos';
    if (lowerSource.includes('opensuse')) return 'opensuse';

    return 'linux'; // Default icon
  }
}
```

## Welcome Views

### Empty State View
```typescript
// In package.json
{
  "contributes": {
    "viewsWelcome": [
      {
        "view": "wslManager.distributions",
        "contents": "No WSL distributions found.\n\n[$(add) Create Distribution](command:wslManager.createDistribution)\n[$(cloud-download) Download Distribution](command:wslManager.downloadDistribution)\n[$(folder-opened) Import from TAR](command:wslManager.importDistribution)\n\n[Learn about WSL](https://aka.ms/wsl)"
      }
    ]
  }
}
```

## View Testing

### Testing TreeDataProvider
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MyTreeProvider } from '../../src/views/myTreeProvider';

describe('MyTreeProvider', () => {
  let provider: MyTreeProvider;
  let mockManager: any;

  beforeEach(() => {
    mockManager = {
      getItems: vi.fn().mockResolvedValue([]),
      onDidChange: vi.fn()
    };
    provider = new MyTreeProvider(mockManager);
  });

  describe('getChildren', () => {
    it('should return root elements when no parent', async () => {
      const mockItems = [
        { name: 'Item 1', type: 'type1' },
        { name: 'Item 2', type: 'type2' }
      ];
      mockManager.getItems.mockResolvedValue(mockItems);

      const children = await provider.getChildren();

      expect(children).toHaveLength(2);
      expect(children[0].data).toEqual(mockItems[0]);
    });

    it('should handle errors gracefully', async () => {
      mockManager.getItems.mockRejectedValue(new Error('Test error'));

      const children = await provider.getChildren();

      expect(children).toEqual([]);
    });

    it('should return empty array when no items', async () => {
      mockManager.getItems.mockResolvedValue([]);

      const children = await provider.getChildren();

      expect(children).toEqual([]);
    });
  });

  describe('refresh', () => {
    it('should fire change event', () => {
      const fireSpy = vi.spyOn(provider['_onDidChangeTreeData'], 'fire');

      provider.refresh();

      expect(fireSpy).toHaveBeenCalledWith(undefined);
    });

    it('should refresh specific item', () => {
      const fireSpy = vi.spyOn(provider['_onDidChangeTreeData'], 'fire');
      const item = new MyTreeItem({ name: 'Test' });

      provider.refreshItem(item);

      expect(fireSpy).toHaveBeenCalledWith(item);
    });
  });

  describe('getTreeItem', () => {
    it('should return the same item', () => {
      const item = new MyTreeItem({ name: 'Test' });

      const result = provider.getTreeItem(item);

      expect(result).toBe(item);
    });
  });
});
```

### Testing Tree Items
```typescript
describe('MyTreeItem', () => {
  it('should create item with correct properties', () => {
    const data = {
      name: 'Test Item',
      type: 'test',
      status: 'active'
    };

    const item = new MyTreeItem(data);

    expect(item.label).toBe('Test Item');
    expect(item.contextValue).toBe('test-active');
    expect(item.tooltip).toContain('Test Item');
    expect(item.description).toContain('active');
  });

  it('should set correct icon for status', () => {
    const runningItem = new MyTreeItem({ status: 'running' });
    const stoppedItem = new MyTreeItem({ status: 'stopped' });

    expect(runningItem.iconPath).toBeInstanceOf(vscode.ThemeIcon);
    expect((runningItem.iconPath as any).id).toBe('play-circle');
  });

  it('should handle missing optional data', () => {
    const minimalData = { name: 'Test' };

    const item = new MyTreeItem(minimalData);

    expect(item.label).toBe('Test');
    expect(item.description).toBeDefined();
    expect(item.tooltip).toBeDefined();
  });
});
```

## Performance Considerations

### Lazy Loading
```typescript
export class LazyTreeProvider implements vscode.TreeDataProvider<LazyItem> {
  async getChildren(element?: LazyItem): Promise<LazyItem[]> {
    if (!element) {
      // Only load root items initially
      return this.getRootItems();
    }

    // Load children on demand
    if (!element.childrenLoaded) {
      element.children = await this.loadChildren(element);
      element.childrenLoaded = true;
    }

    return element.children;
  }

  private async loadChildren(parent: LazyItem): Promise<LazyItem[]> {
    // Load children from backend
    const children = await this.manager.getChildrenFor(parent.id);
    return children.map(c => new LazyItem(c));
  }
}
```

### Virtual Tree for Large Lists
```typescript
export class VirtualTreeProvider implements vscode.TreeDataProvider<VirtualItem> {
  private readonly pageSize = 100;

  async getChildren(element?: VirtualItem): Promise<VirtualItem[]> {
    if (!element) {
      const totalCount = await this.manager.getTotalCount();

      if (totalCount > this.pageSize) {
        // Create page nodes
        const pages = Math.ceil(totalCount / this.pageSize);
        return Array.from({ length: pages }, (_, i) =>
          new PageItem(i, this.pageSize)
        );
      }

      // Load all if small dataset
      return this.loadItems(0, totalCount);
    }

    if (element instanceof PageItem) {
      // Load page contents
      const start = element.page * this.pageSize;
      return this.loadItems(start, this.pageSize);
    }

    return [];
  }

  private async loadItems(start: number, count: number): Promise<VirtualItem[]> {
    const items = await this.manager.getItems(start, count);
    return items.map(i => new VirtualItem(i));
  }
}
```

## Refresh Strategies

### Auto-refresh on Events
```typescript
export class AutoRefreshProvider implements vscode.TreeDataProvider<Item> {
  constructor(private manager: Manager) {
    // Subscribe to manager events
    manager.onDidCreate(() => this.refresh());
    manager.onDidDelete(() => this.refresh());
    manager.onDidUpdate((item) => this.refreshItem(item));

    // File system watcher
    const watcher = vscode.workspace.createFileSystemWatcher('**/config.json');
    watcher.onDidChange(() => this.refresh());
    watcher.onDidCreate(() => this.refresh());
    watcher.onDidDelete(() => this.refresh());

    // Timer-based refresh
    setInterval(() => this.refresh(), 30000); // Every 30 seconds
  }
}
```

### Manual Refresh Command
```typescript
// Register refresh command
vscode.commands.registerCommand('myExtension.refreshView', () => {
  provider.refresh();
  vscode.window.showInformationMessage('View refreshed');
});
```

## Drag and Drop Support

### Implementing Drag and Drop
```typescript
export class DragDropProvider implements vscode.TreeDataProvider<Item>, vscode.TreeDragAndDropController<Item> {
  dropMimeTypes = ['application/vnd.code.tree.myitems'];
  dragMimeTypes = ['application/vnd.code.tree.myitems'];

  async handleDrag(source: Item[], dataTransfer: vscode.DataTransfer): Promise<void> {
    const items = source.map(s => s.data);
    dataTransfer.set('application/vnd.code.tree.myitems',
      new vscode.DataTransferItem(items)
    );
  }

  async handleDrop(target: Item | undefined, dataTransfer: vscode.DataTransfer): Promise<void> {
    const transferItem = dataTransfer.get('application/vnd.code.tree.myitems');
    if (!transferItem) return;

    const items = transferItem.value;
    await this.manager.moveItems(items, target?.data);
    this.refresh();
  }
}
```

## Context Menu Actions

### Defining Context Menu Commands
```json
// In package.json
{
  "contributes": {
    "menus": {
      "view/item/context": [
        {
          "command": "myExtension.deleteItem",
          "when": "view == myExtension.myView && viewItem == item-deletable",
          "group": "2_destructive"
        },
        {
          "command": "myExtension.editItem",
          "when": "view == myExtension.myView && viewItem =~ /item-.*/",
          "group": "1_modification"
        }
      ]
    }
  }
}
```

## Accessibility

### Providing Accessible Labels
```typescript
export class AccessibleTreeItem extends vscode.TreeItem {
  constructor(data: Data) {
    super(data.name);

    // Accessible label for screen readers
    this.accessibilityInformation = {
      label: `${data.name}, ${data.type}, ${data.status}`,
      role: 'treeitem'
    };

    // Detailed tooltip
    this.tooltip = new vscode.MarkdownString();
    this.tooltip.appendMarkdown(`**${data.name}**\n\n`);
    this.tooltip.appendMarkdown(`- Type: ${data.type}\n`);
    this.tooltip.appendMarkdown(`- Status: ${data.status}\n`);
  }
}
```

## View State Persistence

### Saving and Restoring State
```typescript
export class StatefulTreeProvider implements vscode.TreeDataProvider<Item> {
  private expandedItems: Set<string>;

  constructor(
    private context: vscode.ExtensionContext,
    private manager: Manager
  ) {
    // Load saved state
    this.expandedItems = new Set(
      context.globalState.get('expandedItems', [])
    );
  }

  async saveState(): Promise<void> {
    await this.context.globalState.update(
      'expandedItems',
      Array.from(this.expandedItems)
    );
  }

  onDidExpandElement(element: Item): void {
    this.expandedItems.add(element.id);
    this.saveState();
  }

  onDidCollapseElement(element: Item): void {
    this.expandedItems.delete(element.id);
    this.saveState();
  }
}
```

## Error Handling in Views

### Graceful Error Display
```typescript
export class ErrorHandlingProvider implements vscode.TreeDataProvider<Item | ErrorItem> {
  async getChildren(element?: Item): Promise<(Item | ErrorItem)[]> {
    try {
      const items = await this.manager.getItems();
      return items.map(i => new Item(i));
    } catch (error) {
      // Show error in tree
      return [new ErrorItem(error)];
    }
  }
}

export class ErrorItem extends vscode.TreeItem {
  constructor(error: any) {
    super('Error loading items', vscode.TreeItemCollapsibleState.None);

    this.description = error.message;
    this.iconPath = new vscode.ThemeIcon('error');
    this.tooltip = `Error: ${error.message}\n\nClick to retry`;
    this.command = {
      command: 'myExtension.retry',
      title: 'Retry'
    };
  }
}
```

## Testing Checklist for Views

Before implementing any view:
- [ ] Write provider tests first
- [ ] Test getChildren with/without elements
- [ ] Test refresh functionality
- [ ] Test error handling
- [ ] Test tree item properties
- [ ] Test context values
- [ ] Test icon resolution
- [ ] Test tooltip generation
- [ ] Test command associations
- [ ] Verify 100% coverage

## Remember

- **Always handle errors** - Never let exceptions bubble to VS Code
- **Test async behavior** - Views are inherently async
- **Provide good tooltips** - Help users understand items
- **Use theme colors** - Respect light/dark themes
- **Cache when appropriate** - Don't reload unnecessarily
- **Clean up resources** - Dispose of watchers and timers

---

**Parent Document**: [/AGENTS.md](../../AGENTS.md)
**Pattern**: VS Code TreeDataProvider
**Testing**: 100% coverage required