/**
 * Cross-Platform Detection Module
 * Based on cross-platform-dev-guide.md
 *
 * Provides platform detection and information for cross-platform compatibility
 */

export interface PlatformInfo {
    isWindows: boolean;
    isMac: boolean;
    isLinux: boolean;
    isWSL: boolean;
    arch: string;
    shell: string;
    pathSeparator: string;
}

export function getPlatformInfo(): PlatformInfo {
    const platform = process.platform;
    const isWSL = platform === 'linux' && (
        process.env.WSL_DISTRO_NAME !== undefined ||
        process.env.WSLENV !== undefined ||
        process.env.WSL_INTEROP !== undefined
    );

    return {
        isWindows: platform === 'win32',
        isMac: platform === 'darwin',
        isLinux: platform === 'linux' && !isWSL,
        isWSL,
        arch: process.arch,
        shell: getDefaultShell(),
        pathSeparator: platform === 'win32' ? '\\' : '/'
    };
}

function getDefaultShell(): string {
    const platform = process.platform;

    if (platform === 'win32') {
        return process.env.ComSpec || 'cmd.exe';
    } else {
        return process.env.SHELL || '/bin/bash';
    }
}

// Export singleton instance
export const PLATFORM = getPlatformInfo();