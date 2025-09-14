/**
 * REAL Tree Provider Output Tests
 * Tests ACTUAL output, not mocks!
 * 
 * This test would have caught the bug where distro tree shows all 24 items
 * when it should show 0 (no downloaded distros)
 * 
 * @author Marcus Johnson, QA Manager
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DistroManager } from '../../src/distros/DistroManager';

// Mock only the vscode module since we're testing outside VS Code
const mockVscode = {
    TreeItem: class TreeItem {
        constructor(public label: string, public collapsibleState: any) {}
    },
    TreeItemCollapsibleState: {
        None: 0,
        Collapsed: 1,
        Expanded: 2
    },
    ThemeIcon: class ThemeIcon {
        constructor(public id: string) {}
    }
};

// Replace vscode import for testing
jest.mock('vscode', () => mockVscode);

import { DistroTreeProvider } from '../../src/views/DistroTreeProvider';
import { ImageTreeProvider } from '../../src/views/ImageTreeProvider';

describe('REAL Tree Provider Output Tests - No Mocks!', () => {
    let testDir: string;
    let distroManager: DistroManager;
    let distroProvider: DistroTreeProvider;

    beforeEach(() => {
        // Create a real temp directory for testing
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wsl-test-'));
        const distrosDir = path.join(testDir, 'distros');
        fs.mkdirSync(distrosDir, { recursive: true });
        
        // Create real DistroManager with test directory
        distroManager = new DistroManager(testDir);
        distroProvider = new DistroTreeProvider(distroManager);
    });

    afterEach(() => {
        // Clean up
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('DistroTreeProvider Output', () => {
        it('🔴 MUST return EMPTY array when NO distros are downloaded', async () => {
            // This is the test that would have caught your bug!
            // The catalog has 24 distros but NONE are downloaded
            
            const children = await distroProvider.getChildren();
            
            // This MUST be empty because no .tar files exist!
            expect(children).toHaveLength(0);
            expect(children).toEqual([]);
            
            // If this test fails, the UI is showing distros that don't exist!
        });

        it('should show ONLY downloaded distros (with .tar files)', async () => {
            // Create a dummy .tar file to simulate a downloaded distro
            const tarPath = path.join(testDir, 'distros', 'ubuntu-24.04.tar');
            fs.writeFileSync(tarPath, 'dummy tar content');
            
            // Now one distro is "downloaded"
            const children = await distroProvider.getChildren();
            
            // Should show exactly 1 distro
            expect(children).toHaveLength(1);
            expect(children[0].distro.name).toBe('ubuntu-24.04');
            expect(children[0].distro.available).toBe(true);
        });

        it('should NOT show distros that are in catalog but not downloaded', async () => {
            // The catalog will have many distros, but we only download one
            const tarPath = path.join(testDir, 'distros', 'debian-12.tar');
            fs.writeFileSync(tarPath, 'dummy tar content');
            
            const children = await distroProvider.getChildren();
            
            // Should ONLY show debian, not ubuntu, fedora, arch, etc.
            expect(children).toHaveLength(1);
            expect(children[0].distro.name).toBe('debian-12');
            
            // Verify ubuntu is NOT shown even though it's in catalog
            const hasUbuntu = children.some(item => item.distro.name.includes('ubuntu'));
            expect(hasUbuntu).toBe(false);
        });

        it('should show multiple downloaded distros', async () => {
            // Download 3 distros
            fs.writeFileSync(path.join(testDir, 'distros', 'ubuntu-24.04.tar'), 'dummy');
            fs.writeFileSync(path.join(testDir, 'distros', 'debian-12.tar'), 'dummy');
            fs.writeFileSync(path.join(testDir, 'distros', 'alpine-3.19.tar'), 'dummy');
            
            const children = await distroProvider.getChildren();
            
            // Should show exactly 3
            expect(children).toHaveLength(3);
            
            const names = children.map(c => c.distro.name).sort();
            expect(names).toEqual(['alpine-3.19', 'debian-12', 'ubuntu-24.04']);
        });

        it('should update when distro is deleted', async () => {
            // Start with 2 downloaded distros
            const ubuntu = path.join(testDir, 'distros', 'ubuntu-24.04.tar');
            const debian = path.join(testDir, 'distros', 'debian-12.tar');
            fs.writeFileSync(ubuntu, 'dummy');
            fs.writeFileSync(debian, 'dummy');
            
            let children = await distroProvider.getChildren();
            expect(children).toHaveLength(2);
            
            // Delete one
            fs.unlinkSync(ubuntu);
            
            // Refresh and check
            children = await distroProvider.getChildren();
            expect(children).toHaveLength(1);
            expect(children[0].distro.name).toBe('debian-12');
        });
    });

    describe('Critical Bug Prevention Tests', () => {
        it('🐛 BUG TEST: Empty distro folder MUST show empty tree', async () => {
            // This is EXACTLY the bug you found!
            // No .tar files = empty tree, NOT all catalog entries
            
            const distros = await distroManager.listDistros();
            const downloaded = distros.filter(d => d.available);
            const treeItems = await distroProvider.getChildren();
            
            // The catalog has items but none are downloaded
            expect(distros.length).toBeGreaterThan(0); // Catalog not empty
            expect(downloaded).toHaveLength(0); // Nothing downloaded
            expect(treeItems).toHaveLength(0); // Tree MUST be empty!
        });

        it('should match downloaded count exactly', async () => {
            // Download random number of distros
            const toDownload = ['ubuntu-24.04', 'debian-12', 'fedora-40'];
            const downloadCount = Math.floor(Math.random() * toDownload.length) + 1;
            
            for (let i = 0; i < downloadCount; i++) {
                const tarPath = path.join(testDir, 'distros', `${toDownload[i]}.tar`);
                fs.writeFileSync(tarPath, 'dummy');
            }
            
            const children = await distroProvider.getChildren();
            expect(children).toHaveLength(downloadCount);
        });
    });

    describe('DistroManager.listDistros() Output', () => {
        it('should mark distros as available only if .tar exists', async () => {
            // Create one tar file
            fs.writeFileSync(path.join(testDir, 'distros', 'ubuntu-24.04.tar'), 'dummy');
            
            const distros = await distroManager.listDistros();
            
            // Ubuntu should be available
            const ubuntu = distros.find(d => d.name === 'ubuntu-24.04');
            expect(ubuntu?.available).toBe(true);
            
            // Others should not be available
            const debian = distros.find(d => d.name === 'debian-12');
            expect(debian?.available).toBe(false);
        });

        it('should return consistent catalog with availability status', async () => {
            const distros1 = await distroManager.listDistros();
            const distros2 = await distroManager.listDistros();
            
            // Should be consistent
            expect(distros1.length).toBe(distros2.length);
            expect(distros1.map(d => d.name)).toEqual(distros2.map(d => d.name));
        });
    });
});

describe('ImageTreeProvider Output Tests', () => {
    // Similar tests for images...
    it('should return EMPTY when no images exist', async () => {
        // TODO: Implement when ImageManager is available
        // const provider = new ImageTreeProvider(imageManager);
        // const children = await provider.getChildren();
        // expect(children).toHaveLength(0);
    });
});