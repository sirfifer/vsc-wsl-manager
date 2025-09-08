import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Converts WSL path to Windows path
 * Ensures the project is on a Windows-mounted filesystem
 */
export function ensureWindowsPath(wslPath: string): string {
    if (!wslPath.startsWith('/mnt/')) {
        throw new Error(
            `Project must be on a Windows-mounted path (/mnt/<drive>/...). ` +
            `Current path: ${wslPath}\n` +
            `Please move your project to /mnt/c/... or similar.`
        );
    }
    return wslPath
        .replace(/^\/mnt\/([a-z])/, '$1:')
        .replace(/\//g, '\\');
}

/**
 * Finds VS Code executable on Windows
 * Tries multiple strategies to locate Code.exe
 */
export function findCodeExe(): string {
    // Strategy 1: Try to find via Windows PATH
    try {
        const out = cp.execSync('cmd.exe /c "where Code.exe"', { 
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'ignore']
        });
        const lines = out.split(/\r?\n/).filter(Boolean);
        const candidate = lines.find(l => l.toLowerCase().endsWith('code.exe'));
        if (candidate) {
            const winPath = candidate.trim();
            console.log(`Found VS Code via PATH: ${winPath}`);
            return winPath;
        }
    } catch {
        // PATH lookup failed, try other strategies
    }

    // Strategy 2: Check common installation locations
    const username = cp.execSync('cmd.exe /c "echo %USERNAME%"', { 
        encoding: 'utf8' 
    }).trim();
    
    const candidates = [
        `C:\\Users\\${username}\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe`,
        `C:\\Program Files\\Microsoft VS Code\\Code.exe`,
        `C:\\Program Files (x86)\\Microsoft VS Code\\Code.exe`,
        `C:\\Users\\${username}\\AppData\\Local\\Programs\\Microsoft VS Code Insiders\\Code - Insiders.exe`,
    ];

    for (const candidate of candidates) {
        // Check via cmd.exe if file exists
        try {
            cp.execSync(`cmd.exe /c "if exist \\"${candidate}\\" exit 0"`, {
                stdio: 'ignore'
            });
            console.log(`Found VS Code at: ${candidate}`);
            return candidate;
        } catch {
            // File doesn't exist, try next
        }
    }

    // Strategy 3: Try to use the wdio-vscode-service downloaded version
    // but launch it through Windows
    const wdioVSCodePath = path.join(
        process.cwd(),
        '.wdio-vscode-service'
    );
    
    if (fs.existsSync(wdioVSCodePath)) {
        const dirs = fs.readdirSync(wdioVSCodePath);
        const vscodeDir = dirs.find(d => d.startsWith('vscode-'));
        if (vscodeDir) {
            // This is a Linux binary, but we can try to download Windows version
            console.log('Found wdio-vscode-service directory, but need Windows version');
            console.log('Please install VS Code on Windows or use the download-vscode-win script');
        }
    }

    throw new Error(
        'Cannot locate Code.exe. Please ensure VS Code is installed on Windows.\n' +
        'Install from: https://code.visualstudio.com/download\n' +
        'Or add to PATH: setx PATH "%PATH%;C:\\Path\\To\\VSCode"'
    );
}

/**
 * Finds ChromeDriver executable for Windows
 */
export function findChromeDriverWin(repoRootWin: string): string {
    // First check if chromedriver package is installed
    const chromedriverPath = path.join(
        repoRootWin,
        'node_modules',
        'chromedriver',
        'lib',
        'chromedriver',
        'chromedriver.exe'
    );

    // Verify it exists
    try {
        cp.execSync(`cmd.exe /c "if exist \\"${chromedriverPath}\\" exit 0"`, {
            stdio: 'ignore'
        });
        return chromedriverPath;
    } catch {
        // ChromeDriver not found, try alternate location
        const altPath = path.join(
            repoRootWin,
            'node_modules',
            '.bin',
            'chromedriver.exe'
        );
        
        try {
            cp.execSync(`cmd.exe /c "if exist \\"${altPath}\\" exit 0"`, {
                stdio: 'ignore'
            });
            return altPath;
        } catch {
            throw new Error(
                `chromedriver.exe not found at ${chromedriverPath}\n` +
                `Ensure:\n` +
                `1. Your project is under /mnt/c/...\n` +
                `2. You've run npm install chromedriver\n` +
                `3. ChromeDriver version matches VS Code's Chromium`
            );
        }
    }
}

/**
 * Gets VS Code's Chromium version for ChromeDriver matching
 */
export function getVSCodeChromiumVersion(): string {
    try {
        // Try to get VS Code version first
        const codeExe = findCodeExe();
        const versionOutput = cp.execSync(`cmd.exe /c "${codeExe} --version"`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'ignore']
        });
        
        console.log('VS Code version info:', versionOutput.trim());
        
        // Try to get Chromium version from VS Code
        const match = versionOutput.match(/Chromium: ([\d.]+)/);
        if (match) {
            return match[1].split('.')[0]; // Return major version
        }

        // Fallback: use a known mapping (update this based on VS Code releases)
        const electronVersionMap: Record<string, string> = {
            '1.85': '118',
            '1.86': '120',
            '1.87': '122',
            '1.88': '124',
            '1.89': '126',
            '1.90': '128',
            '1.91': '128',
            '1.92': '130',
            '1.93': '130',
            '1.94': '132',
            '1.95': '132',
        };

        const vsCodeVersion = versionOutput.split('\n')[0];
        const majorMinor = vsCodeVersion.match(/(\d+\.\d+)/)?.[1];
        
        if (majorMinor && electronVersionMap[majorMinor]) {
            console.log(`Using Chromium ${electronVersionMap[majorMinor]} for VS Code ${majorMinor}`);
            return electronVersionMap[majorMinor];
        }

        // Default to a recent version
        console.warn('Could not determine exact Chromium version, using default');
        return '128';
    } catch (error) {
        console.error('Error getting VS Code Chromium version:', error);
        return '128'; // Fallback to recent version
    }
}

/**
 * Helper to download VS Code for Windows if not found
 */
export function getVSCodeDownloadUrl(): string {
    return 'https://code.visualstudio.com/sha/download?build=stable&os=win32-x64';
}