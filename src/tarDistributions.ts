/**
 * TAR-based distributions for no-admin downloads
 * These distributions can be downloaded and imported without administrator privileges
 */

export interface TarDistribution {
    name: string;
    friendlyName: string;
    description: string;
    tarUrl: string;
    size?: string; // Approximate size for user information
    architecture: 'x64' | 'arm64' | 'both';
}

/**
 * List of distributions available as TAR files
 * These can be downloaded and imported without admin privileges
 */
export const TAR_DISTRIBUTIONS: TarDistribution[] = [
    {
        name: 'Alpine',
        friendlyName: 'Alpine Linux',
        description: 'Lightweight Linux distribution based on musl libc and BusyBox',
        tarUrl: 'https://dl-cdn.alpinelinux.org/alpine/v3.19/releases/x86_64/alpine-minirootfs-3.19.0-x86_64.tar.gz',
        size: '~3MB',
        architecture: 'x64'
    },
    {
        name: 'Ubuntu',
        friendlyName: 'Ubuntu 22.04 LTS',
        description: 'Popular Linux distribution based on Debian',
        tarUrl: 'https://cloud-images.ubuntu.com/wsl/jammy/current/ubuntu-jammy-wsl-amd64-wsl.rootfs.tar.gz',
        size: '~650MB',
        architecture: 'x64'
    },
    {
        name: 'Ubuntu-24.04',
        friendlyName: 'Ubuntu 24.04 LTS',
        description: 'Latest LTS release of Ubuntu',
        tarUrl: 'https://releases.ubuntu.com/24.04.3/ubuntu-24.04.3-wsl-amd64.wsl',
        size: '~667MB',
        architecture: 'x64'
    },
    {
        name: 'Debian',
        friendlyName: 'Debian 12 (Bookworm)',
        description: 'Stable and reliable Linux distribution',
        tarUrl: 'https://github.com/debuerreotype/docker-debian-artifacts/raw/dist-amd64/bookworm/rootfs.tar.xz',
        size: '~50MB',
        architecture: 'x64'
    },
    {
        name: 'Fedora',
        friendlyName: 'Fedora 39',
        description: 'Community-driven Linux distribution sponsored by Red Hat',
        tarUrl: 'https://github.com/fedora-cloud/docker-brew-fedora/raw/39/x86_64/fedora-39-x86_64.tar.xz',
        size: '~70MB',
        architecture: 'x64'
    },
    {
        name: 'ArchLinux',
        friendlyName: 'Arch Linux',
        description: 'Rolling release distribution for experienced users',
        tarUrl: 'https://mirror.rackspace.com/archlinux/iso/latest/archlinux-bootstrap-x86_64.tar.gz',
        size: '~150MB',
        architecture: 'x64'
    },
    {
        name: 'openSUSE-Leap',
        friendlyName: 'openSUSE Leap 15.5',
        description: 'Stable release of openSUSE',
        tarUrl: 'https://download.opensuse.org/repositories/Cloud:/Images:/Leap_15.5/images/openSUSE-Leap-15.5-WSL.x86_64-rootfs.tar.xz',
        size: '~100MB',
        architecture: 'x64'
    },
    {
        name: 'openSUSE-Tumbleweed',
        friendlyName: 'openSUSE Tumbleweed',
        description: 'Rolling release of openSUSE',
        tarUrl: 'https://download.opensuse.org/tumbleweed/appliances/openSUSE-Tumbleweed-WSL.x86_64-rootfs.tar.xz',
        size: '~120MB',
        architecture: 'x64'
    }
];

/**
 * Get a TAR distribution by name
 */
export function getTarDistribution(name: string): TarDistribution | undefined {
    return TAR_DISTRIBUTIONS.find(d => 
        d.name.toLowerCase() === name.toLowerCase() ||
        d.friendlyName.toLowerCase() === name.toLowerCase()
    );
}

/**
 * Get TAR URL for a distribution
 */
export function getTarUrl(name: string): string | undefined {
    const distro = getTarDistribution(name);
    return distro?.tarUrl;
}