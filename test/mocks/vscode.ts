/**
 * VS Code API mock for testing
 * Provides mock implementations of VS Code extension API
 */

export enum TreeItemCollapsibleState {
    None = 0,
    Collapsed = 1,
    Expanded = 2
}

export enum ProgressLocation {
    SourceControl = 1,
    Window = 10,
    Notification = 15
}

export enum ConfigurationTarget {
    Global = 1,
    Workspace = 2,
    WorkspaceFolder = 3
}

export class ThemeIcon {
    static readonly File = new ThemeIcon('file');
    static readonly Folder = new ThemeIcon('folder');
    
    constructor(
        public readonly id: string,
        public readonly color?: ThemeColor
    ) {}
}

export class ThemeColor {
    constructor(public readonly id: string) {}
}

export class TreeItem {
    label?: string;
    collapsibleState?: TreeItemCollapsibleState;
    contextValue?: string;
    tooltip?: string;
    description?: string;
    iconPath?: ThemeIcon | string;
    
    constructor(
        label: string,
        collapsibleState?: TreeItemCollapsibleState
    ) {
        this.label = label;
        this.collapsibleState = collapsibleState;
    }
}

export class EventEmitter<T> {
    private listeners: Array<(e: T) => void> = [];
    
    event = (listener: (e: T) => void) => {
        this.listeners.push(listener);
        return {
            dispose: () => {
                const index = this.listeners.indexOf(listener);
                if (index > -1) {
                    this.listeners.splice(index, 1);
                }
            }
        };
    };
    
    fire(data: T): void {
        this.listeners.forEach(listener => listener(data));
    }
    
    dispose(): void {
        this.listeners = [];
    }
}

export class Uri {
    constructor(
        public readonly scheme: string,
        public readonly authority: string,
        public readonly path: string,
        public readonly query: string,
        public readonly fragment: string
    ) {}
    
    static file(path: string): Uri {
        return new Uri('file', '', path, '', '');
    }
    
    static parse(value: string): Uri {
        // Simplified parsing
        return new Uri('file', '', value, '', '');
    }
    
    toString(): string {
        return this.path;
    }
    
    get fsPath(): string {
        return this.path;
    }
}

export class ExtensionContext {
    subscriptions: Array<{ dispose(): void }> = [];
    globalState = new MockMemento();
    workspaceState = new MockMemento();
    extensionPath = '/mock/extension/path';
    storagePath = '/mock/storage/path';
    globalStoragePath = '/mock/global/storage/path';
    logPath = '/mock/log/path';
    
    asAbsolutePath(relativePath: string): string {
        return `${this.extensionPath}/${relativePath}`;
    }
}

class MockMemento {
    private storage = new Map<string, any>();
    
    get<T>(key: string): T | undefined;
    get<T>(key: string, defaultValue: T): T;
    get<T>(key: string, defaultValue?: T): T | undefined {
        return this.storage.has(key) ? this.storage.get(key) : defaultValue;
    }
    
    async update(key: string, value: any): Promise<void> {
        if (value === undefined) {
            this.storage.delete(key);
        } else {
            this.storage.set(key, value);
        }
    }
}

export const window = {
    showInformationMessage: jest.fn().mockResolvedValue(undefined),
    showWarningMessage: jest.fn().mockResolvedValue(undefined),
    showErrorMessage: jest.fn().mockResolvedValue(undefined),
    showInputBox: jest.fn().mockResolvedValue(undefined),
    showQuickPick: jest.fn().mockResolvedValue(undefined),
    showOpenDialog: jest.fn().mockResolvedValue(undefined),
    showSaveDialog: jest.fn().mockResolvedValue(undefined),
    withProgress: jest.fn(async (options, task) => {
        const progress = {
            report: jest.fn()
        };
        const token = {
            isCancellationRequested: false,
            onCancellationRequested: jest.fn()
        };
        return await task(progress, token);
    }),
    createTreeView: jest.fn((viewId, options) => ({
        visible: true,
        onDidExpandElement: new EventEmitter().event,
        onDidCollapseElement: new EventEmitter().event,
        onDidChangeSelection: new EventEmitter().event,
        onDidChangeVisibility: new EventEmitter().event,
        selection: [],
        reveal: jest.fn(),
        dispose: jest.fn()
    })),
    createTerminal: jest.fn((options) => ({
        name: options?.name || 'Terminal',
        processId: Promise.resolve(12345),
        creationOptions: options,
        exitStatus: undefined,
        show: jest.fn(),
        hide: jest.fn(),
        dispose: jest.fn(),
        sendText: jest.fn()
    }))
};

export const workspace = {
    getConfiguration: jest.fn((section?: string) => ({
        get: jest.fn((key: string, defaultValue?: any) => defaultValue),
        has: jest.fn(() => false),
        inspect: jest.fn(() => undefined),
        update: jest.fn().mockResolvedValue(undefined)
    })),
    onDidChangeConfiguration: new EventEmitter().event,
    workspaceFolders: [],
    name: 'Test Workspace',
    onDidChangeWorkspaceFolders: new EventEmitter().event
};

export const commands = {
    registerCommand: jest.fn((command: string, callback: (...args: any[]) => any) => ({
        dispose: jest.fn()
    })),
    executeCommand: jest.fn().mockResolvedValue(undefined),
    getCommands: jest.fn().mockResolvedValue([])
};

export const languages = {
    createDiagnosticCollection: jest.fn(() => ({
        set: jest.fn(),
        delete: jest.fn(),
        clear: jest.fn(),
        dispose: jest.fn()
    }))
};

export const env = {
    appName: 'Visual Studio Code',
    appRoot: '/mock/app/root',
    language: 'en',
    machineId: 'mock-machine-id',
    sessionId: 'mock-session-id',
    shell: '/bin/bash',
    uriScheme: 'vscode',
    clipboard: {
        readText: jest.fn().mockResolvedValue(''),
        writeText: jest.fn().mockResolvedValue(undefined)
    },
    openExternal: jest.fn().mockResolvedValue(true),
    asExternalUri: jest.fn((uri: Uri) => Promise.resolve(uri))
};

// Export mock for entire vscode module
export default {
    TreeItem,
    TreeItemCollapsibleState,
    ThemeIcon,
    ThemeColor,
    EventEmitter,
    Uri,
    ExtensionContext,
    ProgressLocation,
    ConfigurationTarget,
    window,
    workspace,
    commands,
    languages,
    env
};