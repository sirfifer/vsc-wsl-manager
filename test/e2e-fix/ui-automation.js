/**
 * VS Code UI Automation Framework
 * Complete UI interaction capabilities with full debug logging integration
 */

const fs = require('fs');
const path = require('path');
const { DebugLogger } = require('../e2e-debug/debug-logger');
const pathUtils = require('./path-utils');

class VSCodeUIAutomation {
    constructor(browser) {
        this.browser = browser;
        this.logger = new DebugLogger({
            prefix: 'ui-automation',
            logLevel: process.env.DEBUG_LEVEL || 'DEBUG'
        });
        
        this.screenshotDir = path.join(process.cwd(), 'test-screenshots');
        this.actionLog = [];
        this.screenshotCount = 0;
        
        // Ensure screenshot directory exists
        if (!fs.existsSync(this.screenshotDir)) {
            fs.mkdirSync(this.screenshotDir, { recursive: true });
            this.logger.info('Created screenshot directory', { path: this.screenshotDir });
        }
        
        this.logger.info('UI Automation initialized', {
            screenshotDir: this.screenshotDir
        });
    }

    // ============= Screenshot Management =============
    
    async captureScreenshot(name, category = 'general') {
        const timestamp = Date.now();
        const sanitizedName = name.replace(/[^a-z0-9-_]/gi, '-');
        const filename = `${timestamp}-${category}-${sanitizedName}.png`;
        const filepath = path.join(this.screenshotDir, filename);
        
        try {
            await this.browser.saveScreenshot(filepath);
            this.screenshotCount++;
            
            this.logger.info('Screenshot captured', {
                name,
                category,
                filename,
                path: filepath,
                count: this.screenshotCount
            });
            
            this.logAction('screenshot', name, { 
                path: filepath, 
                category,
                timestamp 
            });
            
            return filepath;
        } catch (error) {
            this.logger.error('Failed to capture screenshot', {
                name,
                error: error.message
            });
            return null;
        }
    }

    // ============= Basic Element Interactions =============
    
    async clickElement(selector, description = '') {
        const actionDesc = description || selector;
        this.logger.info('Clicking element', { selector, description: actionDesc });
        
        try {
            await this.captureScreenshot(`before-click-${actionDesc}`, 'click');
            
            const element = await this.browser.$(selector);
            await element.waitForExist({ 
                timeout: 5000,
                timeoutMsg: `Element not found: ${selector}`
            });
            
            await element.waitForClickable({
                timeout: 5000,
                timeoutMsg: `Element not clickable: ${selector}`
            });
            
            await element.click();
            await this.browser.pause(500);
            
            await this.captureScreenshot(`after-click-${actionDesc}`, 'click');
            
            this.logAction('click', actionDesc, { selector, success: true });
            this.logger.debug('Click successful', { selector });
            
            return true;
        } catch (error) {
            this.logger.error('Click failed', {
                selector,
                description: actionDesc,
                error: error.message
            });
            
            await this.captureScreenshot(`error-click-${actionDesc}`, 'error');
            this.logAction('click', actionDesc, { selector, success: false, error: error.message });
            
            throw error;
        }
    }

    async rightClick(selector, description = '') {
        const actionDesc = description || selector;
        this.logger.info('Right-clicking element', { selector, description: actionDesc });
        
        try {
            const element = await this.browser.$(selector);
            await element.waitForExist({ timeout: 5000 });
            
            await this.captureScreenshot(`before-rightclick-${actionDesc}`, 'rightclick');
            await element.click({ button: 'right' });
            await this.browser.pause(500);
            await this.captureScreenshot(`after-rightclick-${actionDesc}`, 'rightclick');
            
            this.logAction('rightclick', actionDesc, { selector, success: true });
            return true;
        } catch (error) {
            this.logger.error('Right-click failed', {
                selector,
                error: error.message
            });
            throw error;
        }
    }

    // ============= Tree View Operations =============
    
    async expandTreeItem(treeSelector, itemText) {
        this.logger.info('Expanding tree item', { treeSelector, itemText });
        
        try {
            await this.captureScreenshot(`before-expand-${itemText}`, 'tree');
            
            // Find tree item by text
            const itemSelector = `${treeSelector} [title*="${itemText}"], ${treeSelector} [aria-label*="${itemText}"]`;
            const treeItem = await this.browser.$(itemSelector);
            
            const exists = await treeItem.isExisting();
            if (!exists) {
                this.logger.warn('Tree item not found', { itemText });
                return false;
            }
            
            // Look for expand/collapse arrow
            const twistieSelector = `${itemSelector} .codicon-tree-item-expanded, ${itemSelector} .codicon-chevron-right, ${itemSelector} .monaco-tl-twistie`;
            const twistie = await this.browser.$(twistieSelector);
            
            if (await twistie.isExisting()) {
                await twistie.click();
                await this.browser.pause(500);
                this.logger.debug('Clicked tree expand arrow', { itemText });
            } else {
                // Try clicking the item itself
                await treeItem.click();
                await this.browser.pause(500);
                this.logger.debug('Clicked tree item directly', { itemText });
            }
            
            await this.captureScreenshot(`after-expand-${itemText}`, 'tree');
            this.logAction('expand-tree', itemText, { treeSelector, success: true });
            
            return true;
        } catch (error) {
            this.logger.error('Failed to expand tree item', {
                itemText,
                error: error.message
            });
            return false;
        }
    }

    async getTreeItems(treeSelector) {
        this.logger.info('Getting tree items', { treeSelector });
        
        try {
            const items = await this.browser.$$(
                `${treeSelector} .monaco-list-row, ${treeSelector} .monaco-tl-row`
            );
            
            const itemTexts = [];
            for (const item of items) {
                const text = await item.getText();
                if (text) {
                    itemTexts.push(text.trim());
                }
            }
            
            this.logger.debug('Found tree items', { 
                count: itemTexts.length,
                items: itemTexts 
            });
            
            await this.captureScreenshot('tree-items', 'tree');
            this.logAction('get-tree-items', treeSelector, { count: itemTexts.length });
            
            return itemTexts;
        } catch (error) {
            this.logger.error('Failed to get tree items', {
                treeSelector,
                error: error.message
            });
            return [];
        }
    }

    // ============= VS Code Specific UI Elements =============
    
    async clickActivityBarItem(name) {
        this.logger.info('Clicking activity bar item', { name });
        
        const iconMap = {
            'explorer': 'codicon-files',
            'search': 'codicon-search',
            'source-control': 'codicon-source-control',
            'debug': 'codicon-debug-alt',
            'extensions': 'codicon-extensions',
            'wsl': 'codicon-vm'  // Custom WSL icon if present
        };
        
        const iconClass = iconMap[name.toLowerCase()] || name;
        const selector = `.activitybar .action-item .${iconClass}, .activitybar [aria-label*="${name}"]`;
        
        return await this.clickElement(selector, `activitybar-${name}`);
    }

    async clickSidebarItem(text) {
        this.logger.info('Clicking sidebar item', { text });
        
        const selector = `//div[contains(@class, 'sidebar')]//span[contains(text(), '${text}')] | //div[contains(@class, 'sidebar')]//*[contains(@aria-label, '${text}')]`;
        return await this.clickElement(selector, `sidebar-${text}`);
    }

    async clickStatusBarItem(text) {
        this.logger.info('Clicking status bar item', { text });
        
        const selector = `//div[@id='workbench.parts.statusbar']//a[contains(text(), '${text}')] | //div[@class='statusbar-item']//*[contains(text(), '${text}')]`;
        return await this.clickElement(selector, `statusbar-${text}`);
    }

    // ============= Command Palette =============
    
    async openCommandPalette() {
        this.logger.info('Opening command palette');
        
        try {
            await this.captureScreenshot('before-command-palette', 'command');
            await this.browser.keys(['Control', 'Shift', 'p']);
            await this.browser.pause(1000);
            await this.captureScreenshot('command-palette-open', 'command');
            
            this.logAction('open-command-palette', '', { success: true });
            return true;
        } catch (error) {
            this.logger.error('Failed to open command palette', { error: error.message });
            return false;
        }
    }

    async executeCommand(commandName) {
        this.logger.info('Executing command', { commandName });
        
        try {
            await this.openCommandPalette();
            await this.typeInActiveElement(commandName);
            await this.browser.pause(500);
            
            await this.captureScreenshot(`command-typed-${commandName}`, 'command');
            await this.browser.keys(['Enter']);
            await this.browser.pause(1000);
            
            await this.captureScreenshot(`command-executed-${commandName}`, 'command');
            
            this.logAction('execute-command', commandName, { success: true });
            this.logger.debug('Command executed', { commandName });
            
            return true;
        } catch (error) {
            this.logger.error('Failed to execute command', {
                commandName,
                error: error.message
            });
            return false;
        }
    }

    // ============= Input Operations =============
    
    async typeInActiveElement(text) {
        this.logger.info('Typing in active element', { text: text.substring(0, 20) + '...' });
        
        try {
            await this.captureScreenshot('before-type', 'input');
            const activeElement = await this.browser.getActiveElement();
            await activeElement.setValue(text);
            await this.captureScreenshot('after-type', 'input');
            
            this.logAction('type', text, { success: true });
            return true;
        } catch (error) {
            this.logger.error('Failed to type', { error: error.message });
            return false;
        }
    }

    async typeInInputBox(selector, text) {
        this.logger.info('Typing in input box', { selector, text: text.substring(0, 20) + '...' });
        
        try {
            const input = await this.browser.$(selector);
            await input.waitForExist({ timeout: 5000 });
            await input.click();
            await input.clearValue();
            await input.setValue(text);
            
            await this.captureScreenshot('after-input', 'input');
            this.logAction('type-in-input', `${selector}: ${text}`, { success: true });
            
            return true;
        } catch (error) {
            this.logger.error('Failed to type in input', {
                selector,
                error: error.message
            });
            return false;
        }
    }

    // ============= Notifications and Dialogs =============
    
    async waitForNotification(timeout = 5000) {
        this.logger.info('Waiting for notification', { timeout });
        
        try {
            const notification = await this.browser.$('.notifications-toasts, .notification-toast');
            await notification.waitForExist({ timeout });
            
            const text = await notification.getText();
            await this.captureScreenshot('notification', 'notification');
            
            this.logger.debug('Notification found', { text });
            this.logAction('wait-notification', text, { success: true });
            
            return text;
        } catch (error) {
            this.logger.debug('No notification found', { error: error.message });
            return null;
        }
    }

    async clickNotificationButton(buttonText) {
        const selector = `//div[contains(@class, 'notification')]//a[contains(text(), '${buttonText}')]`;
        return await this.clickElement(selector, `notification-${buttonText}`);
    }

    async handleDialog(action = 'accept') {
        this.logger.info('Handling dialog', { action });
        
        try {
            await this.captureScreenshot('dialog-visible', 'dialog');
            
            if (action === 'accept') {
                await this.browser.keys(['Enter']);
            } else {
                await this.browser.keys(['Escape']);
            }
            
            await this.browser.pause(500);
            await this.captureScreenshot('dialog-handled', 'dialog');
            
            this.logAction('handle-dialog', action, { success: true });
            return true;
        } catch (error) {
            this.logger.error('Failed to handle dialog', { error: error.message });
            return false;
        }
    }

    // ============= Terminal Operations =============
    
    async typeInTerminal(text) {
        this.logger.info('Typing in terminal', { text });
        
        try {
            const terminal = await this.browser.$('.terminal-wrapper, .xterm');
            await terminal.click();
            await this.browser.keys(text);
            await this.browser.keys(['Enter']);
            
            await this.captureScreenshot('terminal-command', 'terminal');
            this.logAction('terminal-type', text, { success: true });
            
            return true;
        } catch (error) {
            this.logger.error('Failed to type in terminal', { error: error.message });
            return false;
        }
    }

    async getTerminalOutput() {
        try {
            const terminal = await this.browser.$('.xterm-screen, .terminal-wrapper');
            const text = await terminal.getText();
            
            this.logger.debug('Got terminal output', { 
                length: text.length,
                preview: text.substring(0, 100) 
            });
            
            return text;
        } catch (error) {
            this.logger.error('Failed to get terminal output', { error: error.message });
            return '';
        }
    }

    // ============= Context Menu =============
    
    async clickContextMenuItem(text) {
        const selector = `//div[contains(@class, 'context-view')]//span[contains(text(), '${text}')] | //ul[@class='actions-container']//span[contains(text(), '${text}')]`;
        return await this.clickElement(selector, `context-menu-${text}`);
    }

    // ============= Observation Methods =============
    
    async isElementVisible(selector) {
        try {
            const element = await this.browser.$(selector);
            const exists = await element.isExisting();
            const displayed = exists ? await element.isDisplayed() : false;
            
            this.logger.debug('Element visibility check', {
                selector,
                exists,
                displayed
            });
            
            return displayed;
        } catch (error) {
            this.logger.debug('Element not visible', { selector });
            return false;
        }
    }

    async getElementText(selector) {
        try {
            const element = await this.browser.$(selector);
            await element.waitForExist({ timeout: 5000 });
            const text = await element.getText();
            
            this.logger.debug('Got element text', {
                selector,
                text: text.substring(0, 100)
            });
            
            return text;
        } catch (error) {
            this.logger.error('Failed to get element text', {
                selector,
                error: error.message
            });
            return '';
        }
    }

    async getAllText(selector) {
        try {
            const elements = await this.browser.$$(selector);
            const texts = [];
            
            for (const element of elements) {
                const text = await element.getText();
                if (text) {
                    texts.push(text.trim());
                }
            }
            
            this.logger.debug('Got all text', {
                selector,
                count: texts.length
            });
            
            return texts;
        } catch (error) {
            this.logger.error('Failed to get all text', {
                selector,
                error: error.message
            });
            return [];
        }
    }

    // ============= Logging and Reporting =============
    
    logAction(action, details, data = {}) {
        const entry = {
            timestamp: new Date().toISOString(),
            action,
            details,
            data
        };
        
        this.actionLog.push(entry);
        this.logger.logVSCodeEvent(`UI-${action}`, { details, ...data });
        
        // Save log periodically
        if (this.actionLog.length % 10 === 0) {
            this.saveActionLog();
        }
    }

    saveActionLog() {
        const logFile = path.join(this.screenshotDir, 'ui-actions.json');
        
        try {
            fs.writeFileSync(logFile, JSON.stringify(this.actionLog, null, 2));
            this.logger.debug('Action log saved', { 
                path: logFile,
                actions: this.actionLog.length 
            });
        } catch (error) {
            this.logger.error('Failed to save action log', { error: error.message });
        }
    }

    async getActionLog() {
        return this.actionLog;
    }

    async generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            totalActions: this.actionLog.length,
            screenshots: this.screenshotCount,
            actionsByType: {},
            errors: []
        };
        
        // Analyze actions
        for (const action of this.actionLog) {
            report.actionsByType[action.action] = (report.actionsByType[action.action] || 0) + 1;
            
            if (action.data && action.data.success === false) {
                report.errors.push({
                    action: action.action,
                    details: action.details,
                    error: action.data.error
                });
            }
        }
        
        // Save report
        const reportPath = path.join(this.screenshotDir, 'test-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        this.logger.info('Test report generated', {
            path: reportPath,
            totalActions: report.totalActions,
            screenshots: report.screenshots,
            errors: report.errors.length
        });
        
        return report;
    }
}

module.exports = VSCodeUIAutomation;