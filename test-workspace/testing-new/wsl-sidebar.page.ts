/**
 * WSL Manager Sidebar Page Object
 * Encapsulates interactions with the WSL Manager sidebar in VS Code
 * Designed to be AI-friendly with clear method names and documentation
 */

import { ChainablePromiseElement } from 'webdriverio';

export class WslManagerSidebar {
  // Selectors for WSL Manager elements
  private readonly selectors = {
    // Activity bar
    activityBarIcon: '[id="workbench.parts.activitybar"] [aria-label*="WSL Manager"]',
    
    // Tree views
    distributionsTree: '[aria-label="Distributions (Templates)"]',
    imagesTree: '[aria-label="Images (Instances)"]',
    
    // Tree items
    treeItem: (label: string) => `[aria-label*="${label}"]`,
    treeItemExpanded: (label: string) => `[aria-label*="${label}"][aria-expanded="true"]`,
    treeItemCollapsed: (label: string) => `[aria-label*="${label}"][aria-expanded="false"]`,
    
    // Buttons
    refreshButton: '[aria-label="WSL: Refresh Distributions"]',
    createDistroButton: '[aria-label="WSL: Create Distribution"]',
    deleteDistroButton: '[aria-label="WSL: Delete Distribution"]',
    importButton: '[aria-label="WSL: Import Distribution"]',
    exportButton: '[aria-label="WSL: Export Distribution"]',
    
    // Context menu
    contextMenu: '.context-view.monaco-menu-container',
    contextMenuItem: (label: string) => `.monaco-menu .action-label:has-text("${label}")`,
    
    // Quick pick
    quickPick: '.quick-input-widget',
    quickPickInput: '.quick-input-widget input',
    quickPickItem: (label: string) => `.quick-input-list .monaco-list-row[aria-label*="${label}"]`,
    
    // Notifications
    notification: '.notification-toast',
    notificationMessage: '.notification-toast .message',
    notificationClose: '.notification-toast .codicon-close'
  };
  
  /**
   * Open the WSL Manager sidebar
   */
  async open(): Promise<void> {
    // Click on the activity bar icon
    const icon = await $(this.selectors.activityBarIcon);
    await icon.click();
    
    // Wait for sidebar to be visible
    await this.waitForSidebar();
  }
  
  /**
   * Wait for the sidebar to be visible
   */
  async waitForSidebar(): Promise<void> {
    await browser.waitUntil(
      async () => {
        const distroTree = await $(this.selectors.distributionsTree);
        return await distroTree.isDisplayed();
      },
      {
        timeout: 5000,
        timeoutMsg: 'WSL Manager sidebar did not appear'
      }
    );
  }
  
  /**
   * Get all distribution items from the tree
   */
  async getDistributionItems(): Promise<Array<{ label: string; state: string }>> {
    const items: Array<{ label: string; state: string }> = [];
    const treeItems = await $$(this.selectors.distributionsTree + ' [role="treeitem"]');
    
    for (const item of treeItems) {
      const label = await item.getAttribute('aria-label');
      const expanded = await item.getAttribute('aria-expanded');
      
      if (label) {
        // Parse state from label (e.g., "Ubuntu-22.04 (Running)")
        const match = label.match(/(.+)\s+\((\w+)\)/);
        if (match) {
          items.push({
            label: match[1].trim(),
            state: match[2]
          });
        } else {
          items.push({
            label: label.trim(),
            state: 'Unknown'
          });
        }
      }
    }
    
    return items;
  }
  
  /**
   * Click the create distribution button
   */
  async clickCreateDistro(): Promise<void> {
    const button = await $(this.selectors.createDistroButton);
    await button.click();
    await this.waitForQuickPick();
  }
  
  /**
   * Click the refresh button
   */
  async clickRefresh(): Promise<void> {
    const button = await $(this.selectors.refreshButton);
    await button.click();
    
    // Wait for refresh to complete
    await browser.pause(1000);
  }
  
  /**
   * Right-click on a distribution
   */
  async rightClickDistribution(name: string): Promise<void> {
    const item = await $(this.selectors.treeItem(name));
    await item.click({ button: 'right' });
    await this.waitForContextMenu();
  }
  
  /**
   * Select an item from the context menu
   */
  async selectContextMenuItem(label: string): Promise<void> {
    const menuItem = await $(this.selectors.contextMenuItem(label));
    await menuItem.click();
  }
  
  /**
   * Wait for context menu to appear
   */
  async waitForContextMenu(): Promise<void> {
    await browser.waitUntil(
      async () => {
        const menu = await $(this.selectors.contextMenu);
        return await menu.isDisplayed();
      },
      {
        timeout: 3000,
        timeoutMsg: 'Context menu did not appear'
      }
    );
  }
  
  /**
   * Wait for quick pick to appear
   */
  async waitForQuickPick(): Promise<void> {
    await browser.waitUntil(
      async () => {
        const quickPick = await $(this.selectors.quickPick);
        return await quickPick.isDisplayed();
      },
      {
        timeout: 3000,
        timeoutMsg: 'Quick pick did not appear'
      }
    );
  }
  
  /**
   * Type text in quick pick input
   */
  async typeInQuickPick(text: string): Promise<void> {
    const input = await $(this.selectors.quickPickInput);
    await input.setValue(text);
  }
  
  /**
   * Select a quick pick item
   */
  async selectQuickPickItem(label: string): Promise<void> {
    const item = await $(this.selectors.quickPickItem(label));
    await item.click();
  }
  
  /**
   * Confirm quick pick selection
   */
  async confirmQuickPick(): Promise<void> {
    await browser.keys(['Enter']);
  }
  
  /**
   * Cancel quick pick
   */
  async cancelQuickPick(): Promise<void> {
    await browser.keys(['Escape']);
  }
  
  /**
   * Wait for a notification with specific message
   */
  async waitForNotification(expectedMessage: string, timeout = 10000): Promise<void> {
    await browser.waitUntil(
      async () => {
        const notifications = await $$(this.selectors.notificationMessage);
        for (const notification of notifications) {
          const text = await notification.getText();
          if (text.includes(expectedMessage)) {
            return true;
          }
        }
        return false;
      },
      {
        timeout,
        timeoutMsg: `Notification with message "${expectedMessage}" did not appear`
      }
    );
  }
  
  /**
   * Close all notifications
   */
  async closeAllNotifications(): Promise<void> {
    const closeButtons = await $$(this.selectors.notificationClose);
    for (const button of closeButtons) {
      if (await button.isDisplayed()) {
        await button.click();
      }
    }
  }
  
  /**
   * Expand a tree item
   */
  async expandTreeItem(label: string): Promise<void> {
    const item = await $(this.selectors.treeItemCollapsed(label));
    if (await item.isExisting()) {
      await item.click();
      
      // Wait for expansion
      await browser.waitUntil(
        async () => {
          const expanded = await $(this.selectors.treeItemExpanded(label));
          return await expanded.isExisting();
        },
        {
          timeout: 3000,
          timeoutMsg: `Tree item "${label}" did not expand`
        }
      );
    }
  }
  
  /**
   * Collapse a tree item
   */
  async collapseTreeItem(label: string): Promise<void> {
    const item = await $(this.selectors.treeItemExpanded(label));
    if (await item.isExisting()) {
      await item.click();
      
      // Wait for collapse
      await browser.waitUntil(
        async () => {
          const collapsed = await $(this.selectors.treeItemCollapsed(label));
          return await collapsed.isExisting();
        },
        {
          timeout: 3000,
          timeoutMsg: `Tree item "${label}" did not collapse`
        }
      );
    }
  }
  
  /**
   * Check if a distribution exists in the tree
   */
  async hasDistribution(name: string): Promise<boolean> {
    const items = await this.getDistributionItems();
    return items.some(item => item.label === name);
  }
  
  /**
   * Get the state of a specific distribution
   */
  async getDistributionState(name: string): Promise<string | undefined> {
    const items = await this.getDistributionItems();
    const item = items.find(i => i.label === name);
    return item?.state;
  }
  
  /**
   * Delete a distribution (with confirmation)
   */
  async deleteDistribution(name: string): Promise<void> {
    // Right-click on the distribution
    await this.rightClickDistribution(name);
    
    // Select delete from context menu
    await this.selectContextMenuItem('Delete');
    
    // Wait for confirmation dialog
    await browser.pause(500);
    
    // Confirm deletion
    await browser.keys(['Enter']);
    
    // Wait for deletion to complete
    await this.waitForNotification('deleted successfully');
  }
  
  /**
   * Create a new distribution from template
   */
  async createDistributionFromTemplate(
    templateName: string,
    newName: string
  ): Promise<void> {
    // Click create button
    await this.clickCreateDistro();
    
    // Select template
    await this.selectQuickPickItem(templateName);
    
    // Enter new name
    await this.typeInQuickPick(newName);
    await this.confirmQuickPick();
    
    // Wait for creation to complete
    await this.waitForNotification('created successfully', 30000);
  }
  
  /**
   * Open terminal for a distribution
   */
  async openTerminalForDistribution(name: string): Promise<void> {
    // Right-click on the distribution
    await this.rightClickDistribution(name);
    
    // Select "Open Terminal"
    await this.selectContextMenuItem('Open Terminal');
    
    // Wait for terminal to open
    await browser.pause(2000);
  }
}

/**
 * VS Code Workbench Page Object
 * General interactions with VS Code UI
 */
export class VSCodeWorkbench {
  private readonly selectors = {
    commandPalette: '.quick-input-widget',
    commandPaletteInput: '.quick-input-widget input',
    terminal: '.terminal',
    terminalTab: (name: string) => `.terminal-tab[title*="${name}"]`,
    notification: '.notification-toast',
    activityBar: '#workbench\\.parts\\.activitybar',
    sideBar: '#workbench\\.parts\\.sidebar',
    editor: '.editor-container',
    statusBar: '#workbench\\.parts\\.statusbar'
  };
  
  /**
   * Open VS Code with the extension
   */
  async open(): Promise<void> {
    // This would be handled by WebdriverIO VS Code service
    await browser.url('vscode://');
    await this.waitForWorkbench();
  }
  
  /**
   * Wait for workbench to be ready
   */
  async waitForWorkbench(): Promise<void> {
    await browser.waitUntil(
      async () => {
        const activityBar = await $(this.selectors.activityBar);
        return await activityBar.isDisplayed();
      },
      {
        timeout: 10000,
        timeoutMsg: 'VS Code workbench did not load'
      }
    );
  }
  
  /**
   * Open command palette
   */
  async openCommandPalette(): Promise<void> {
    await browser.keys(['F1']);
    await browser.waitUntil(
      async () => {
        const palette = await $(this.selectors.commandPalette);
        return await palette.isDisplayed();
      },
      {
        timeout: 3000,
        timeoutMsg: 'Command palette did not open'
      }
    );
  }
  
  /**
   * Execute a command via command palette
   */
  async executeCommand(command: string): Promise<void> {
    await this.openCommandPalette();
    const input = await $(this.selectors.commandPaletteInput);
    await input.setValue(command);
    await browser.keys(['Enter']);
  }
  
  /**
   * Wait for extension to be activated
   */
  async waitForExtensionActivation(extensionId: string): Promise<void> {
    await browser.executeWorkbench(async (vscode, id) => {
      const ext = vscode.extensions.getExtension(id);
      if (ext && !ext.isActive) {
        await ext.activate();
      }
    }, extensionId);
  }
  
  /**
   * Get all notifications
   */
  async getNotifications(): Promise<Array<{ message: string; type: string }>> {
    const notifications: Array<{ message: string; type: string }> = [];
    const elements = await $$(this.selectors.notification);
    
    for (const element of elements) {
      const message = await element.$('.message').getText();
      const classes = await element.getAttribute('class');
      
      let type = 'info';
      if (classes?.includes('error')) type = 'error';
      else if (classes?.includes('warning')) type = 'warning';
      
      notifications.push({ message, type });
    }
    
    return notifications;
  }
  
  /**
   * Get the active terminal
   */
  async getActiveTerminal(): Promise<{ getTitle: () => Promise<string> }> {
    const terminal = await $(this.selectors.terminal);
    
    return {
      getTitle: async () => {
        const activeTab = await $('.terminal-tab.active');
        return await activeTab.getAttribute('title') || '';
      }
    };
  }
  
  /**
   * Open activity bar item
   */
  async openActivityBar(label: string): Promise<void> {
    const item = await $(`${this.selectors.activityBar} [aria-label*="${label}"]`);
    await item.click();
  }
  
  /**
   * Get quick pick handler
   */
  async getQuickPick() {
    return {
      selectItem: async (label: string) => {
        const item = await $(`.quick-input-list .monaco-list-row[aria-label*="${label}"]`);
        await item.click();
      },
      setText: async (text: string) => {
        const input = await $(this.selectors.commandPaletteInput);
        await input.setValue(text);
      },
      confirm: async () => {
        await browser.keys(['Enter']);
      }
    };
  }
}
