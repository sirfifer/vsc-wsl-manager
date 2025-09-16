/**
 * VS Code API Mock
 * Provides mock implementations of VS Code API for unit testing
 */

// Mock Event implementation
class EventEmitter<T> {
  private listeners: ((e: T) => void)[] = [];
  
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
  
  fire(data: T) {
    this.listeners.forEach(listener => listener(data));
  }
}

// VS Code namespace mock
export const vscode = {
  // Commands
  commands: {
    registerCommand: jest.fn((command: string, callback: (...args: any[]) => any) => ({
      dispose: jest.fn()
    })),
    executeCommand: jest.fn(),
    getCommands: jest.fn(() => Promise.resolve([])),
  },
  
  // Window
  window: {
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showQuickPick: jest.fn(),
    showInputBox: jest.fn(),
    createTreeView: jest.fn((viewId: string, options: any) => ({
      visible: true,
      onDidChangeVisibility: new EventEmitter().event,
      onDidChangeSelection: new EventEmitter().event,
      onDidExpandElement: new EventEmitter().event,
      onDidCollapseElement: new EventEmitter().event,
      selection: [],
      reveal: jest.fn(),
      dispose: jest.fn()
    })),
    createOutputChannel: jest.fn((name: string) => ({
      append: jest.fn(),
      appendLine: jest.fn(),
      clear: jest.fn(),
      dispose: jest.fn(),
      hide: jest.fn(),
      show: jest.fn()
    })),
    createTerminal: jest.fn((options: any) => ({
      name: options.name || 'Terminal',
      processId: Promise.resolve(12345),
      creationOptions: options,
      exitStatus: undefined,
      sendText: jest.fn(),
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn()
    })),
    createStatusBarItem: jest.fn(() => ({
      alignment: 1,
      priority: 0,
      text: '',
      tooltip: '',
      color: '',
      backgroundColor: undefined,
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn()
    })),
    activeTextEditor: undefined,
    visibleTextEditors: [],
    onDidChangeActiveTextEditor: new EventEmitter().event,
    terminals: [],
    activeTerminal: undefined,
    onDidOpenTerminal: new EventEmitter().event,
    onDidCloseTerminal: new EventEmitter().event,
    state: {
      focused: true
    },
    showTextDocument: jest.fn(),
    withProgress: jest.fn((options, task) => task({ report: jest.fn() }))
  },
  
  // Workspace
  workspace: {
    getConfiguration: jest.fn((section?: string) => ({
      get: jest.fn((key: string, defaultValue?: any) => defaultValue),
      has: jest.fn(() => false),
      inspect: jest.fn(),
      update: jest.fn(() => Promise.resolve()),
    })),
    onDidChangeConfiguration: new EventEmitter().event,
    workspaceFolders: undefined,
    name: undefined,
    onDidChangeWorkspaceFolders: new EventEmitter().event,
    fs: {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      delete: jest.fn(),
      createDirectory: jest.fn(),
      readDirectory: jest.fn(),
      stat: jest.fn(),
      rename: jest.fn(),
      copy: jest.fn()
    },
    findFiles: jest.fn(() => Promise.resolve([])),
    saveAll: jest.fn(() => Promise.resolve(true)),
    applyEdit: jest.fn(() => Promise.resolve(true)),
    openTextDocument: jest.fn(),
    registerTextDocumentContentProvider: jest.fn(),
    onDidOpenTextDocument: new EventEmitter().event,
    onDidCloseTextDocument: new EventEmitter().event,
    onDidChangeTextDocument: new EventEmitter().event,
    onDidSaveTextDocument: new EventEmitter().event,
    onWillSaveTextDocument: new EventEmitter().event
  },
  
  // Extensions
  extensions: {
    getExtension: jest.fn((extensionId: string) => ({
      id: extensionId,
      extensionPath: '/mock/extension/path',
      isActive: true,
      packageJSON: {
        name: extensionId,
        version: '1.0.0'
      },
      extensionUri: {
        fsPath: '/mock/extension/path',
        path: '/mock/extension/path',
        scheme: 'file'
      },
      exports: {},
      activate: jest.fn(() => Promise.resolve()),
      extensionKind: 1
    })),
    all: [],
    onDidChange: new EventEmitter().event
  },
  
  // Uri
  Uri: {
    file: jest.fn((path: string) => ({
      fsPath: path,
      path: path,
      scheme: 'file',
      authority: '',
      query: '',
      fragment: '',
      with: jest.fn(),
      toString: jest.fn(() => `file://${path}`)
    })),
    parse: jest.fn((value: string) => ({
      fsPath: value.replace('file://', ''),
      path: value.replace('file://', ''),
      scheme: 'file',
      authority: '',
      query: '',
      fragment: '',
      with: jest.fn(),
      toString: jest.fn(() => value)
    })),
    joinPath: jest.fn((base: any, ...paths: string[]) => ({
      fsPath: [base.fsPath, ...paths].join('/'),
      path: [base.path, ...paths].join('/'),
      scheme: 'file',
      authority: '',
      query: '',
      fragment: '',
      with: jest.fn(),
      toString: jest.fn(() => `file://${[base.path, ...paths].join('/')}`)
    }))
  },
  
  // TreeItem
  TreeItem: class {
    label: string;
    collapsibleState: number;
    
    constructor(label: string, collapsibleState?: number) {
      this.label = label;
      this.collapsibleState = collapsibleState || 0;
    }
  },
  
  // TreeItemCollapsibleState enum
  TreeItemCollapsibleState: {
    None: 0,
    Collapsed: 1,
    Expanded: 2
  },
  
  // ThemeIcon
  ThemeIcon: class {
    id: string;
    color?: any;
    
    constructor(id: string, color?: any) {
      this.id = id;
      this.color = color;
    }
    
    static File = new (vscode.ThemeIcon as any)('file');
    static Folder = new (vscode.ThemeIcon as any)('folder');
  },
  
  // EventEmitter
  EventEmitter: EventEmitter,
  
  // Disposable
  Disposable: class {
    static from(...disposables: { dispose(): any }[]): { dispose(): any } {
      return {
        dispose: () => disposables.forEach(d => d.dispose())
      };
    }
  },
  
  // StatusBarAlignment
  StatusBarAlignment: {
    Left: 1,
    Right: 2
  },
  
  // ViewColumn
  ViewColumn: {
    Active: -1,
    Beside: -2,
    One: 1,
    Two: 2,
    Three: 3,
    Four: 4,
    Five: 5,
    Six: 6,
    Seven: 7,
    Eight: 8,
    Nine: 9
  },
  
  // DiagnosticSeverity
  DiagnosticSeverity: {
    Error: 0,
    Warning: 1,
    Information: 2,
    Hint: 3
  },
  
  // ConfigurationTarget
  ConfigurationTarget: {
    Global: 1,
    Workspace: 2,
    WorkspaceFolder: 3
  },
  
  // ProgressLocation
  ProgressLocation: {
    SourceControl: 1,
    Window: 10,
    Notification: 15
  },
  
  // ExtensionMode
  ExtensionMode: {
    Production: 1,
    Development: 2,
    Test: 3
  },
  
  // ExtensionKind
  ExtensionKind: {
    UI: 1,
    Workspace: 2
  },
  
  // FileType
  FileType: {
    Unknown: 0,
    File: 1,
    Directory: 2,
    SymbolicLink: 64
  },
  
  // Tasks
  tasks: {
    registerTaskProvider: jest.fn(),
    fetchTasks: jest.fn(() => Promise.resolve([])),
    executeTask: jest.fn(),
    onDidStartTask: new EventEmitter().event,
    onDidEndTask: new EventEmitter().event,
    onDidStartTaskProcess: new EventEmitter().event,
    onDidEndTaskProcess: new EventEmitter().event
  },
  
  // Debug
  debug: {
    activeDebugSession: undefined,
    activeDebugConsole: {
      append: jest.fn(),
      appendLine: jest.fn()
    },
    breakpoints: [],
    onDidChangeActiveDebugSession: new EventEmitter().event,
    onDidStartDebugSession: new EventEmitter().event,
    onDidTerminateDebugSession: new EventEmitter().event,
    onDidChangeBreakpoints: new EventEmitter().event,
    registerDebugAdapterDescriptorFactory: jest.fn(),
    registerDebugAdapterTrackerFactory: jest.fn(),
    registerDebugConfigurationProvider: jest.fn(),
    startDebugging: jest.fn(() => Promise.resolve(true)),
    stopDebugging: jest.fn(() => Promise.resolve()),
    addBreakpoints: jest.fn(),
    removeBreakpoints: jest.fn()
  },
  
  // Languages
  languages: {
    registerCompletionItemProvider: jest.fn(),
    registerCodeActionsProvider: jest.fn(),
    registerCodeLensProvider: jest.fn(),
    registerDefinitionProvider: jest.fn(),
    registerDocumentFormattingEditProvider: jest.fn(),
    registerDocumentSymbolProvider: jest.fn(),
    registerHoverProvider: jest.fn(),
    registerReferenceProvider: jest.fn(),
    registerRenameProvider: jest.fn(),
    registerSignatureHelpProvider: jest.fn(),
    registerTypeDefinitionProvider: jest.fn(),
    registerImplementationProvider: jest.fn(),
    registerDocumentHighlightProvider: jest.fn(),
    registerDocumentLinkProvider: jest.fn(),
    registerColorProvider: jest.fn(),
    registerFoldingRangeProvider: jest.fn(),
    registerDeclarationProvider: jest.fn(),
    registerWorkspaceSymbolProvider: jest.fn(),
    registerDocumentSemanticTokensProvider: jest.fn(),
    registerDocumentRangeSemanticTokensProvider: jest.fn(),
    getDiagnostics: jest.fn(() => []),
    createDiagnosticCollection: jest.fn((name?: string) => ({
      name: name || 'diagnostics',
      clear: jest.fn(),
      dispose: jest.fn(),
      delete: jest.fn(),
      forEach: jest.fn(),
      get: jest.fn(),
      has: jest.fn(),
      set: jest.fn()
    })),
    getLanguages: jest.fn(() => Promise.resolve([])),
    match: jest.fn(() => 0),
    onDidChangeDiagnostics: new EventEmitter().event,
    setTextDocumentLanguage: jest.fn(),
    setLanguageConfiguration: jest.fn()
  }
};

// Export default
export default vscode;
