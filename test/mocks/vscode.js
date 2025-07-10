"use strict";
/**
 * VS Code API mock for testing
 * Provides mock implementations of VS Code extension API
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = exports.languages = exports.commands = exports.workspace = exports.window = exports.ExtensionContext = exports.Uri = exports.EventEmitter = exports.TreeItem = exports.ThemeColor = exports.ThemeIcon = exports.ConfigurationTarget = exports.ProgressLocation = exports.TreeItemCollapsibleState = void 0;
var TreeItemCollapsibleState;
(function (TreeItemCollapsibleState) {
    TreeItemCollapsibleState[TreeItemCollapsibleState["None"] = 0] = "None";
    TreeItemCollapsibleState[TreeItemCollapsibleState["Collapsed"] = 1] = "Collapsed";
    TreeItemCollapsibleState[TreeItemCollapsibleState["Expanded"] = 2] = "Expanded";
})(TreeItemCollapsibleState = exports.TreeItemCollapsibleState || (exports.TreeItemCollapsibleState = {}));
var ProgressLocation;
(function (ProgressLocation) {
    ProgressLocation[ProgressLocation["SourceControl"] = 1] = "SourceControl";
    ProgressLocation[ProgressLocation["Window"] = 10] = "Window";
    ProgressLocation[ProgressLocation["Notification"] = 15] = "Notification";
})(ProgressLocation = exports.ProgressLocation || (exports.ProgressLocation = {}));
var ConfigurationTarget;
(function (ConfigurationTarget) {
    ConfigurationTarget[ConfigurationTarget["Global"] = 1] = "Global";
    ConfigurationTarget[ConfigurationTarget["Workspace"] = 2] = "Workspace";
    ConfigurationTarget[ConfigurationTarget["WorkspaceFolder"] = 3] = "WorkspaceFolder";
})(ConfigurationTarget = exports.ConfigurationTarget || (exports.ConfigurationTarget = {}));
class ThemeIcon {
    constructor(id, color) {
        this.id = id;
        this.color = color;
    }
}
exports.ThemeIcon = ThemeIcon;
ThemeIcon.File = new ThemeIcon('file');
ThemeIcon.Folder = new ThemeIcon('folder');
class ThemeColor {
    constructor(id) {
        this.id = id;
    }
}
exports.ThemeColor = ThemeColor;
class TreeItem {
    constructor(label, collapsibleState) {
        this.label = label;
        this.collapsibleState = collapsibleState;
    }
}
exports.TreeItem = TreeItem;
class EventEmitter {
    constructor() {
        this.listeners = [];
        this.event = (listener) => {
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
    }
    fire(data) {
        this.listeners.forEach(listener => listener(data));
    }
    dispose() {
        this.listeners = [];
    }
}
exports.EventEmitter = EventEmitter;
class Uri {
    constructor(scheme, authority, path, query, fragment) {
        this.scheme = scheme;
        this.authority = authority;
        this.path = path;
        this.query = query;
        this.fragment = fragment;
    }
    static file(path) {
        return new Uri('file', '', path, '', '');
    }
    static parse(value) {
        // Simplified parsing
        return new Uri('file', '', value, '', '');
    }
    toString() {
        return this.path;
    }
    get fsPath() {
        return this.path;
    }
}
exports.Uri = Uri;
class ExtensionContext {
    constructor() {
        this.subscriptions = [];
        this.globalState = new MockMemento();
        this.workspaceState = new MockMemento();
        this.extensionPath = '/mock/extension/path';
        this.storagePath = '/mock/storage/path';
        this.globalStoragePath = '/mock/global/storage/path';
        this.logPath = '/mock/log/path';
    }
    asAbsolutePath(relativePath) {
        return `${this.extensionPath}/${relativePath}`;
    }
}
exports.ExtensionContext = ExtensionContext;
class MockMemento {
    constructor() {
        this.storage = new Map();
    }
    get(key, defaultValue) {
        return this.storage.has(key) ? this.storage.get(key) : defaultValue;
    }
    async update(key, value) {
        if (value === undefined) {
            this.storage.delete(key);
        }
        else {
            this.storage.set(key, value);
        }
    }
}
exports.window = {
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
exports.workspace = {
    getConfiguration: jest.fn((section) => ({
        get: jest.fn((key, defaultValue) => defaultValue),
        has: jest.fn(() => false),
        inspect: jest.fn(() => undefined),
        update: jest.fn().mockResolvedValue(undefined)
    })),
    onDidChangeConfiguration: new EventEmitter().event,
    workspaceFolders: [],
    name: 'Test Workspace',
    onDidChangeWorkspaceFolders: new EventEmitter().event
};
exports.commands = {
    registerCommand: jest.fn((command, callback) => ({
        dispose: jest.fn()
    })),
    executeCommand: jest.fn().mockResolvedValue(undefined),
    getCommands: jest.fn().mockResolvedValue([])
};
exports.languages = {
    createDiagnosticCollection: jest.fn(() => ({
        set: jest.fn(),
        delete: jest.fn(),
        clear: jest.fn(),
        dispose: jest.fn()
    }))
};
exports.env = {
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
    asExternalUri: jest.fn((uri) => Promise.resolve(uri))
};
// Export mock for entire vscode module
exports.default = {
    TreeItem,
    TreeItemCollapsibleState,
    ThemeIcon,
    ThemeColor,
    EventEmitter,
    Uri,
    ExtensionContext,
    ProgressLocation,
    ConfigurationTarget,
    window: exports.window,
    workspace: exports.workspace,
    commands: exports.commands,
    languages: exports.languages,
    env: exports.env
};
//# sourceMappingURL=vscode.js.map