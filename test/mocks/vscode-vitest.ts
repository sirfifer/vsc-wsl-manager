/**
 * VS Code API mock for Vitest testing
 * Compatible with both Jest and Vitest syntax
 */

import { vi } from 'vitest';

// Create mock functions that work with both Jest and Vitest
const createMockFn = () => {
    // If vi is available (Vitest), use it. Otherwise fall back to jest
    if (typeof vi !== 'undefined') {
        return vi.fn();
    } else if (typeof jest !== 'undefined') {
        return jest.fn();
    }
    return () => {};
};

export const window = {
    showInformationMessage: createMockFn(),
    showErrorMessage: createMockFn(),
    showWarningMessage: createMockFn(),
    showInputBox: createMockFn(),
    showQuickPick: createMockFn(),
    createTreeView: createMockFn(() => ({
        dispose: createMockFn(),
        reveal: createMockFn(),
        onDidExpandElement: createMockFn(),
        onDidCollapseElement: createMockFn(),
        onDidChangeSelection: createMockFn(),
        onDidChangeVisibility: createMockFn()
    })),
    createTerminal: createMockFn(() => ({
        show: createMockFn(),
        sendText: createMockFn(),
        dispose: createMockFn(),
        processId: Promise.resolve(1234),
        name: 'Mock Terminal',
        exitStatus: undefined
    })),
    createOutputChannel: createMockFn(() => ({
        append: createMockFn(),
        appendLine: createMockFn(),
        clear: createMockFn(),
        dispose: createMockFn(),
        show: createMockFn(),
        hide: createMockFn()
    })),
    createStatusBarItem: createMockFn(() => ({
        show: createMockFn(),
        hide: createMockFn(),
        dispose: createMockFn(),
        text: '',
        tooltip: '',
        command: undefined
    })),
    withProgress: createMockFn((options, task) => task({ report: createMockFn() })),
    createWebviewPanel: createMockFn(),
    registerTreeDataProvider: createMockFn(),
    registerWebviewPanelSerializer: createMockFn(),
    setStatusBarMessage: createMockFn(),
    showTextDocument: createMockFn(),
    activeTextEditor: undefined,
    visibleTextEditors: [],
    terminals: [],
    activeTerminal: undefined
};

export const commands = {
    registerCommand: createMockFn((command, callback) => ({
        dispose: createMockFn()
    })),
    executeCommand: createMockFn(),
    getCommands: createMockFn(() => Promise.resolve([])),
    registerTextEditorCommand: createMockFn()
};

export const workspace = {
    getConfiguration: createMockFn((section) => ({
        get: createMockFn((key) => undefined),
        update: createMockFn(),
        has: createMockFn(() => false),
        inspect: createMockFn()
    })),
    workspaceFolders: undefined,
    rootPath: undefined,
    onDidChangeConfiguration: createMockFn(),
    onDidChangeWorkspaceFolders: createMockFn(),
    onDidOpenTextDocument: createMockFn(),
    onDidCloseTextDocument: createMockFn(),
    onDidChangeTextDocument: createMockFn(),
    onDidSaveTextDocument: createMockFn(),
    fs: {
        readFile: createMockFn(),
        writeFile: createMockFn(),
        delete: createMockFn(),
        rename: createMockFn(),
        copy: createMockFn(),
        createDirectory: createMockFn(),
        readDirectory: createMockFn(),
        stat: createMockFn()
    },
    openTextDocument: createMockFn(),
    findFiles: createMockFn(() => Promise.resolve([])),
    saveAll: createMockFn(() => Promise.resolve(true))
};

export const Uri = {
    parse: createMockFn((str) => ({
        scheme: 'file',
        authority: '',
        path: str,
        query: '',
        fragment: '',
        fsPath: str,
        with: createMockFn(),
        toString: () => str
    })),
    file: createMockFn((path) => ({
        scheme: 'file',
        authority: '',
        path,
        query: '',
        fragment: '',
        fsPath: path,
        with: createMockFn(),
        toString: () => path
    })),
    joinPath: createMockFn((base, ...paths) => ({
        ...base,
        path: [base.path, ...paths].join('/')
    }))
};

export class TreeItem {
    label: string | { label: string };
    collapsibleState?: number;
    command?: any;
    contextValue?: string;
    description?: string | boolean;
    iconPath?: any;
    id?: string;
    resourceUri?: any;
    tooltip?: string | any;

    constructor(label: string | { label: string }, collapsibleState?: number) {
        this.label = label;
        this.collapsibleState = collapsibleState;
    }
}

export const TreeItemCollapsibleState = {
    None: 0,
    Collapsed: 1,
    Expanded: 2
};

export class ThemeIcon {
    static File = new ThemeIcon('file');
    static Folder = new ThemeIcon('folder');

    constructor(public id: string, public color?: any) {}
}

export class EventEmitter {
    fire = createMockFn();
    event = createMockFn();
    dispose = createMockFn();
}

export class CancellationToken {
    isCancellationRequested = false;
    onCancellationRequested = createMockFn();
}

export const ProgressLocation = {
    SourceControl: 1,
    Window: 10,
    Notification: 15
};

export const ExtensionMode = {
    Production: 1,
    Development: 2,
    Test: 3
};

export const ConfigurationTarget = {
    Global: 1,
    Workspace: 2,
    WorkspaceFolder: 3
};

export const StatusBarAlignment = {
    Left: 1,
    Right: 2
};

export const ViewColumn = {
    Active: -1,
    Beside: -2,
    One: 1,
    Two: 2,
    Three: 3
};

export const QuickPickItemKind = {
    Separator: -1,
    Default: 0
};

export const env = {
    appName: 'Visual Studio Code',
    appRoot: '/usr/share/code',
    language: 'en',
    machineId: 'mock-machine-id',
    sessionId: 'mock-session-id',
    shell: '/bin/bash',
    uriScheme: 'vscode',
    clipboard: {
        readText: createMockFn(() => Promise.resolve('')),
        writeText: createMockFn(() => Promise.resolve())
    },
    openExternal: createMockFn(() => Promise.resolve(true)),
    asExternalUri: createMockFn((uri) => Promise.resolve(uri)),
    remoteName: undefined,
    uiKind: 1
};

export const languages = {
    registerCompletionItemProvider: createMockFn(),
    registerCodeActionsProvider: createMockFn(),
    registerCodeLensProvider: createMockFn(),
    registerDefinitionProvider: createMockFn(),
    registerDocumentFormattingEditProvider: createMockFn(),
    registerDocumentSymbolProvider: createMockFn(),
    registerHoverProvider: createMockFn(),
    registerReferenceProvider: createMockFn(),
    registerRenameProvider: createMockFn(),
    registerSignatureHelpProvider: createMockFn(),
    registerTypeDefinitionProvider: createMockFn(),
    createDiagnosticCollection: createMockFn((name) => ({
        name,
        set: createMockFn(),
        delete: createMockFn(),
        clear: createMockFn(),
        dispose: createMockFn(),
        forEach: createMockFn(),
        get: createMockFn(),
        has: createMockFn()
    })),
    getDiagnostics: createMockFn(() => []),
    getLanguages: createMockFn(() => Promise.resolve([]))
};

export const extensions = {
    getExtension: createMockFn((id) => ({
        id,
        extensionPath: '/mock/path',
        isActive: true,
        packageJSON: {},
        exports: undefined,
        activate: createMockFn(() => Promise.resolve()),
        extensionUri: Uri.file('/mock/path'),
        extensionKind: 1
    })),
    all: [],
    onDidChange: createMockFn()
};

export const tasks = {
    registerTaskProvider: createMockFn(),
    executeTask: createMockFn(),
    fetchTasks: createMockFn(() => Promise.resolve([])),
    taskExecutions: [],
    onDidStartTask: createMockFn(),
    onDidEndTask: createMockFn(),
    onDidStartTaskProcess: createMockFn(),
    onDidEndTaskProcess: createMockFn()
};

// Re-export for compatibility
export default {
    window,
    commands,
    workspace,
    Uri,
    TreeItem,
    TreeItemCollapsibleState,
    ThemeIcon,
    EventEmitter,
    CancellationToken,
    ProgressLocation,
    ExtensionMode,
    ConfigurationTarget,
    StatusBarAlignment,
    ViewColumn,
    QuickPickItemKind,
    env,
    languages,
    extensions,
    tasks
};