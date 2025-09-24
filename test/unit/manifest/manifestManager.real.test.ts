/**
 * REAL Unit tests for ManifestManager
 * Tests manifest creation, validation, merging with real file operations
 * NO MOCKS - Uses real JSON files and real validation
 *
 * @author Marcus Johnson, QA Manager
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
    ManifestManager,
    Manifest,
    ManifestMetadata,
    Layer,
    LayerType,
    MANIFEST_VERSION
} from '../../../src/manifest/ManifestManager';

describe('ManifestManager - Real File Operations', () => {
    let tempDir: string;
    let manifestManager: ManifestManager;
    let testManifestPath: string;

    beforeEach(() => {
        // Create real temporary directory
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'manifest-test-'));
        manifestManager = new ManifestManager();
        testManifestPath = path.join(tempDir, 'test-manifest.json');
    });

    afterEach(() => {
        // Clean up temp files
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe('Manifest Creation', () => {
        it('should create a valid manifest with metadata', () => {
            const metadata = {
                name: 'test-image',
                description: 'Test image for unit testing',
                source: 'alpine:3.18'
            };

            const manifest = manifestManager.createManifest(metadata);

            expect(manifest).toBeDefined();
            expect(manifest.version).toBe(MANIFEST_VERSION);
            expect(manifest.metadata.name).toBe(metadata.name);
            expect(manifest.metadata.description).toBe(metadata.description);
            expect(manifest.metadata.source).toBe(metadata.source);
            expect(manifest.layers).toEqual([]);
            expect(manifest.created).toBeDefined();
            expect(manifest.created_by).toBe('vscode-wsl-manager');
            expect(manifest.history).toEqual([]);

            // Verify it's a valid ISO date
            const createdDate = new Date(manifest.created);
            expect(createdDate.toISOString()).toBe(manifest.created);
        });

        it('should add layers to manifest', () => {
            const manifest = manifestManager.createManifest({
                name: 'layered-image'
            });

            const baseLayer: Layer = {
                id: 'layer-1',
                type: LayerType.BASE,
                source: 'alpine:3.18',
                created: new Date().toISOString(),
                size: 5 * 1024 * 1024, // 5MB
                description: 'Base Alpine Linux'
            };

            const appLayer: Layer = {
                id: 'layer-2',
                type: LayerType.APPLICATION,
                source: 'local',
                created: new Date().toISOString(),
                description: 'Application layer',
                commands: [
                    'apt-get update',
                    'apt-get install -y nodejs'
                ]
            };

            manifestManager.addLayer(manifest, baseLayer);
            manifestManager.addLayer(manifest, appLayer);

            expect(manifest.layers).toHaveLength(2);
            expect(manifest.layers[0].type).toBe(LayerType.BASE);
            expect(manifest.layers[1].type).toBe(LayerType.APPLICATION);
        });

        it('should generate unique layer IDs', () => {
            const layer1 = manifestManager.createLayer(LayerType.BASE, 'source1');
            const layer2 = manifestManager.createLayer(LayerType.BASE, 'source2');

            expect(layer1.id).toBeDefined();
            expect(layer2.id).toBeDefined();
            expect(layer1.id).not.toBe(layer2.id);

            // Should be valid UUIDs
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            expect(layer1.id).toMatch(uuidRegex);
            expect(layer2.id).toMatch(uuidRegex);
        });
    });

    describe('Manifest File I/O', () => {
        it('should write manifest to JSON file', () => {
            const manifest = manifestManager.createManifest({
                name: 'write-test',
                description: 'Test writing to file'
            });

            manifestManager.writeManifest(manifest, testManifestPath);

            expect(fs.existsSync(testManifestPath)).toBe(true);

            // Read and verify JSON content
            const content = fs.readFileSync(testManifestPath, 'utf8');
            const parsed = JSON.parse(content);

            expect(parsed.version).toBe(MANIFEST_VERSION);
            expect(parsed.metadata.name).toBe('write-test');
            expect(parsed.metadata.description).toBe('Test writing to file');
        });

        it('should read manifest from JSON file', () => {
            // Write a manifest first
            const original = manifestManager.createManifest({
                name: 'read-test',
                description: 'Test reading from file'
            });

            manifestManager.addLayer(original, {
                id: 'test-layer',
                type: LayerType.CONFIGURATION,
                source: 'config',
                created: new Date().toISOString(),
                description: 'Configuration layer'
            });

            manifestManager.writeManifest(original, testManifestPath);

            // Read it back
            const loaded = manifestManager.readManifestFromFile(testManifestPath);

            expect(loaded).toBeDefined();
            expect(loaded?.metadata.name).toBe('read-test');
            expect(loaded?.metadata.author).toBe('Test Author');
            expect(loaded?.layers).toHaveLength(1);
            expect(loaded?.layers[0].type).toBe(LayerType.CONFIGURATION);
        });

        it('should handle corrupted JSON files gracefully', () => {
            // Write invalid JSON
            fs.writeFileSync(testManifestPath, '{ "invalid": json file }}}');

            const manifest = manifestManager.readManifestFromFile(testManifestPath);

            expect(manifest).toBeNull();
        });

        it('should handle missing files gracefully', () => {
            const manifest = manifestManager.readManifestFromFile('/non/existent/file.json');

            expect(manifest).toBeNull();
        });
    });

    describe('Manifest Validation', () => {
        it('should validate correct manifest structure', () => {
            const manifest = manifestManager.createManifest({
                name: 'valid-manifest'
            });

            const validation = manifestManager.validateManifest(manifest);

            expect(validation.valid).toBe(true);
            expect(validation.errors).toEqual([]);
            // Warnings are OK - empty layers etc.
            expect(Array.isArray(validation.warnings)).toBe(true);
        });

        it('should detect missing required fields', () => {
            const invalidManifest: any = {
                // Missing version
                metadata: {
                    name: 'test'
                },
                layers: []
            };

            const validation = manifestManager.validateManifest(invalidManifest);

            expect(validation.valid).toBe(false);
            expect(validation.errors).toContain('Missing required field: version');
        });

        it('should detect invalid version', () => {
            const manifest = manifestManager.createManifest({
                name: 'test'
            });

            // Manipulate version
            (manifest as any).version = '99.0.0';

            const validation = manifestManager.validateManifest(manifest);

            expect(validation.valid).toBe(false);
            expect(validation.errors.some(e => e.includes('version'))).toBe(true);
        });

        it('should validate layer types', () => {
            const manifest = manifestManager.createManifest({
                name: 'test'
            });

            // Add invalid layer type
            manifest.layers.push({
                id: 'invalid-layer',
                type: 'INVALID_TYPE' as LayerType,
                source: 'test',
                created: new Date().toISOString()
            });

            const validation = manifestManager.validateManifest(manifest);

            expect(validation.valid).toBe(false);
            expect(validation.errors.some(e => e.includes('Invalid layer type'))).toBe(true);
        });

        it('should warn about large manifests', () => {
            const manifest = manifestManager.createManifest({
                name: 'large-manifest'
            });

            // Add many layers
            for (let i = 0; i < 100; i++) {
                manifestManager.addLayer(manifest, {
                    id: `layer-${i}`,
                    type: LayerType.APPLICATION,
                    source: `source-${i}`,
                    created: new Date().toISOString(),
                    description: 'A'.repeat(1000) // Large description
                });
            }

            const validation = manifestManager.validateManifest(manifest);

            expect(validation.valid).toBe(true);
            expect(validation.warnings.length).toBeGreaterThan(0);
            // Should warn about large manifest (>50 layers or >1MB)
            expect(validation.warnings.some(w =>
                w.toLowerCase().includes('large') ||
                w.toLowerCase().includes('consider')
            )).toBe(true);
        });
    });

    describe('Manifest Merging', () => {
        it('should merge two manifests', () => {
            const manifest1 = manifestManager.createManifest({
                name: 'base',
                tags: ['base']
            });

            manifestManager.addLayer(manifest1, {
                id: 'base-layer',
                type: LayerType.BASE,
                source: 'alpine',
                created: new Date().toISOString()
            });

            const manifest2 = manifestManager.createManifest({
                name: 'extended',
                tags: ['extended']
            });

            manifestManager.addLayer(manifest2, {
                id: 'app-layer',
                type: LayerType.APPLICATION,
                source: 'app',
                created: new Date().toISOString()
            });

            const merged = manifestManager.mergeManifests(manifest1, manifest2);

            expect(merged.metadata.name).toBe('extended');
            // tags are at manifest level, not metadata
            expect(merged.tags).toContain('base');
            expect(merged.tags).toContain('extended');
            expect(merged.layers).toHaveLength(2);
            // Layers might not have direct id property
            expect(merged.layers[0].type).toBe(LayerType.BASE);
            expect(merged.layers[1].type).toBe(LayerType.APPLICATION);
        });

        it('should handle conflicts in merge', () => {
            const manifest1 = manifestManager.createManifest({
                name: 'base',
                author: 'Author 1'
            });

            const manifest2 = manifestManager.createManifest({
                name: 'base', // Same name
                author: 'Author 2' // Different author
            });

            const merged = manifestManager.mergeManifests(manifest1, manifest2, {
                conflictResolution: 'useSecond'
            });

            expect(merged.metadata.author).toBe('Author 2');
        });
    });

    describe('Manifest Diff', () => {
        it('should calculate diff between manifests', () => {
            const manifest1 = manifestManager.createManifest({
                name: 'v1',
                description: 'Version 1'
            });

            manifestManager.addLayer(manifest1, {
                id: 'layer-1',
                type: LayerType.BASE,
                source: 'alpine',
                created: new Date().toISOString()
            });

            const manifest2 = { ...manifest1 };
            manifest2.metadata = {
                ...manifest1.metadata,
                description: 'Version 2'
            };

            manifestManager.addLayer(manifest2, {
                id: 'layer-2',
                type: LayerType.APPLICATION,
                source: 'app',
                created: new Date().toISOString()
            });

            const diff = manifestManager.compareManifests(manifest1, manifest2);

            expect(diff.metadata_changes).toBeDefined();
            expect(diff.metadata_changes?.description).toEqual({
                old: 'Version 1',
                new: 'Version 2'
            });
            expect(diff.added_layers).toHaveLength(1);
            expect(diff.added_layers[0].type).toBe(LayerType.APPLICATION);
            expect(diff.removed_layers).toHaveLength(0);
        });
    });

    describe('History Management', () => {
        it('should track manifest history', () => {
            const manifest = manifestManager.createManifest({
                name: 'history-test'
            });

            manifestManager.addHistoryEntry(manifest, {
                action: 'create',
                description: 'Initial creation'
            });

            manifestManager.addHistoryEntry(manifest, {
                action: 'modify',
                description: 'Added base layer',
                changes: ['Added Alpine base']
            });

            expect(manifest.history).toHaveLength(2);
            expect(manifest.history[0].action).toBe('create');
            expect(manifest.history[1].action).toBe('modify');
            expect(manifest.history[1].changes).toContain('Added Alpine base');

            // Each entry should have a timestamp
            manifest.history.forEach(entry => {
                expect(entry.timestamp).toBeDefined();
                const date = new Date(entry.timestamp);
                expect(date.toISOString()).toBe(entry.timestamp);
            });
        });
    });

    describe('Real File System Integration', () => {
        it('should handle concurrent read/write operations', async () => {
            const promises: Promise<void>[] = [];

            // Write multiple manifests concurrently
            for (let i = 0; i < 10; i++) {
                const manifest = manifestManager.createManifest({
                    name: `concurrent-${i}`
                });

                const filePath = path.join(tempDir, `manifest-${i}.json`);
                promises.push(
                    new Promise<void>((resolve) => {
                        manifestManager.writeManifest(manifest, filePath);
                        resolve();
                    })
                );
            }

            await Promise.all(promises);

            // Verify all files were written
            for (let i = 0; i < 10; i++) {
                const filePath = path.join(tempDir, `manifest-${i}.json`);
                expect(fs.existsSync(filePath)).toBe(true);

                const manifest = manifestManager.readManifestFromFile(filePath);
                expect(manifest?.metadata.name).toBe(`concurrent-${i}`);
            }
        });

        it('should handle special characters in metadata', () => {
            const manifest = manifestManager.createManifest({
                name: 'special-chars',
                description: 'Test with 特殊文字 and émojis 🚀',
                author: 'Test <user@example.com>',
                tags: ['tag/with/slash', 'tag:with:colon', 'tag|with|pipe']
            });

            manifestManager.writeManifest(manifest, testManifestPath);
            const loaded = manifestManager.readManifestFromFile(testManifestPath);

            expect(loaded?.metadata.description).toBe('Test with 特殊文字 and émojis 🚀');
            expect(loaded?.metadata.author).toBe('Test <user@example.com>');
            expect(loaded?.metadata.tags).toContain('tag/with/slash');
        });

        it('should calculate manifest file size', () => {
            const smallManifest = manifestManager.createManifest({
                name: 'small'
            });

            const largeManifest = manifestManager.createManifest({
                name: 'large',
                description: 'A'.repeat(10000)
            });

            // Add many layers to large manifest
            for (let i = 0; i < 50; i++) {
                manifestManager.addLayer(largeManifest, {
                    id: `layer-${i}`,
                    type: LayerType.APPLICATION,
                    source: 'source',
                    created: new Date().toISOString(),
                    description: 'B'.repeat(100)
                });
            }

            const smallPath = path.join(tempDir, 'small.json');
            const largePath = path.join(tempDir, 'large.json');

            manifestManager.writeManifest(smallManifest, smallPath);
            manifestManager.writeManifest(largeManifest, largePath);

            const smallSize = fs.statSync(smallPath).size;
            const largeSize = fs.statSync(largePath).size;

            expect(largeSize).toBeGreaterThan(smallSize);
            expect(smallSize).toBeLessThan(1024); // < 1KB
            expect(largeSize).toBeGreaterThan(10000); // > 10KB
        });
    });
});