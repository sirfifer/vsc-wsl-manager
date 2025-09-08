/**
 * Tests for Manifest System
 */

import { ManifestManager } from '../../src/manifest/ManifestManager';
import { 
    Manifest, 
    Layer,
    LayerType, 
    MANIFEST_VERSION 
} from '../../src/manifest/ManifestTypes';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');
jest.mock('../../src/utils/commandBuilder');

describe('ManifestManager', () => {
    let manifestManager: ManifestManager;
    const mockFs = fs as jest.Mocked<typeof fs>;
    
    beforeEach(() => {
        jest.clearAllMocks();
        manifestManager = new ManifestManager();
    });
    
    describe('createDistroManifest', () => {
        it('should create a valid manifest for a pristine distro', () => {
            const manifest = manifestManager.createDistroManifest(
                'ubuntu-22.04',
                'my-ubuntu-image',
                '22.04.3'
            );
            
            expect(manifest.version).toBe(MANIFEST_VERSION);
            expect(manifest.metadata.source).toBe('ubuntu-22.04');
            expect(manifest.metadata.lineage).toEqual(['ubuntu-22.04']);
            expect(manifest.metadata.name).toBe('my-ubuntu-image');
            expect(manifest.metadata.created_by).toBe('vscode-wsl-manager');
            expect(manifest.metadata.id).toBeDefined();
            
            expect(manifest.layers).toHaveLength(1);
            expect(manifest.layers[0].type).toBe(LayerType.DISTRO);
            expect(manifest.layers[0].name).toBe('ubuntu-22.04');
            
            expect(manifest.tags).toContain('pristine');
            expect(manifest.tags).toContain('ubuntu-22.04');
        });
    });
    
    describe('createCloneManifest', () => {
        it('should create manifest with correct lineage for cloned image', () => {
            const sourceManifest: Manifest = {
                version: MANIFEST_VERSION,
                metadata: {
                    source: 'ubuntu-22.04',
                    lineage: ['ubuntu-22.04', 'dev-base'],
                    created: '2024-01-01T00:00:00Z',
                    created_by: 'vscode-wsl-manager',
                    id: 'source-id',
                    name: 'dev-base'
                },
                layers: [{
                    type: LayerType.DISTRO,
                    name: 'ubuntu-22.04',
                    version: '22.04.3',
                    applied: '2024-01-01T00:00:00Z'
                }]
            };
            
            const cloneManifest = manifestManager.createCloneManifest(
                sourceManifest,
                'dev-base',
                'project-specific'
            );
            
            expect(cloneManifest.metadata.parent).toBe('dev-base');
            expect(cloneManifest.metadata.lineage).toEqual([
                'ubuntu-22.04',
                'dev-base',
                'dev-base'
            ]);
            expect(cloneManifest.metadata.name).toBe('project-specific');
            expect(cloneManifest.metadata.id).not.toBe(sourceManifest.metadata.id);
            expect(cloneManifest.layers).toEqual(sourceManifest.layers);
        });
    });
    
    describe('validateManifest', () => {
        it('should validate a correct manifest', () => {
            const manifest: Manifest = {
                version: MANIFEST_VERSION,
                metadata: {
                    lineage: ['ubuntu-22.04'],
                    created: '2024-01-01T00:00:00Z',
                    created_by: 'vscode-wsl-manager',
                    id: 'test-id',
                    name: 'test-image'
                },
                layers: [{
                    type: LayerType.DISTRO,
                    name: 'ubuntu-22.04',
                    version: '22.04.3',
                    applied: '2024-01-01T00:00:00Z'
                }]
            };
            
            const result = manifestManager.validateManifest(manifest);
            
            expect(result.valid).toBe(true);
            expect(result.errors).toBeUndefined();
        });
        
        it('should detect missing required fields', () => {
            const manifest: any = {
                version: MANIFEST_VERSION,
                metadata: {
                    // Missing required fields
                    name: 'test'
                },
                layers: []
            };
            
            const result = manifestManager.validateManifest(manifest);
            
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Missing metadata.id');
            expect(result.errors).toContain('Missing metadata.created');
            expect(result.errors).toContain('Missing or empty metadata.lineage');
        });
        
        it('should warn about missing distro layer', () => {
            const manifest: Manifest = {
                version: MANIFEST_VERSION,
                metadata: {
                    lineage: ['custom'],
                    created: '2024-01-01T00:00:00Z',
                    created_by: 'vscode-wsl-manager',
                    id: 'test-id',
                    name: 'test-image'
                },
                layers: [{
                    type: LayerType.CUSTOM,
                    name: 'custom-layer',
                    applied: '2024-01-01T00:00:00Z'
                }]
            };
            
            const result = manifestManager.validateManifest(manifest);
            
            expect(result.valid).toBe(true);
            expect(result.warnings).toContain(
                'No distro layer found - image may not have a base distribution recorded'
            );
        });
    });
    
    describe('addLayer', () => {
        it('should add a layer to existing manifest', () => {
            const manifest: Manifest = {
                version: MANIFEST_VERSION,
                metadata: {
                    lineage: ['ubuntu-22.04'],
                    created: '2024-01-01T00:00:00Z',
                    created_by: 'vscode-wsl-manager',
                    id: 'test-id',
                    name: 'test-image'
                },
                layers: [{
                    type: LayerType.DISTRO,
                    name: 'ubuntu-22.04',
                    version: '22.04.3',
                    applied: '2024-01-01T00:00:00Z'
                }]
            };
            
            const newLayer: Layer = {
                type: LayerType.ENVIRONMENT,
                name: 'node-development',
                applied: '2024-01-02T00:00:00Z',
                description: 'Node.js development environment',
                details: {
                    node_version: '20.11.0',
                    npm_version: '10.2.4'
                }
            } as Layer;
            
            const updatedManifest = manifestManager.addLayer(manifest, newLayer);
            
            expect(updatedManifest.layers).toHaveLength(2);
            expect(updatedManifest.layers[1]).toEqual(newLayer);
        });
    });
    
    describe('compareManifests', () => {
        it('should detect differences between manifests', () => {
            const oldManifest: Manifest = {
                version: MANIFEST_VERSION,
                metadata: {
                    lineage: ['ubuntu-22.04'],
                    created: '2024-01-01T00:00:00Z',
                    created_by: 'vscode-wsl-manager',
                    id: 'old-id',
                    name: 'test-image'
                },
                layers: [{
                    type: LayerType.DISTRO,
                    name: 'ubuntu-22.04',
                    version: '22.04.3',
                    applied: '2024-01-01T00:00:00Z'
                }],
                tags: ['old-tag'],
                environment_variables: {
                    'OLD_VAR': 'old-value'
                }
            };
            
            const newManifest: Manifest = {
                ...oldManifest,
                layers: [
                    ...oldManifest.layers,
                    {
                        type: LayerType.ENVIRONMENT,
                        name: 'node-dev',
                        applied: '2024-01-02T00:00:00Z'
                    }
                ],
                tags: ['new-tag'],
                environment_variables: {
                    'OLD_VAR': 'new-value',
                    'NEW_VAR': 'new-value'
                }
            };
            
            const diff = manifestManager.compareManifests(oldManifest, newManifest);
            
            expect(diff.added_layers).toHaveLength(1);
            expect(diff.added_layers[0].name).toBe('node-dev');
            
            expect(diff.env_changes!['OLD_VAR']).toEqual({
                old: 'old-value',
                new: 'new-value'
            });
            expect(diff.env_changes!['NEW_VAR']).toEqual({
                old: undefined,
                new: 'new-value'
            });
            
            expect(diff.tag_changes!.added).toEqual(['new-tag']);
            expect(diff.tag_changes!.removed).toEqual(['old-tag']);
        });
    });
    
    describe('generateLegacyManifest', () => {
        it('should generate manifest for existing WSL distribution', () => {
            const manifest = manifestManager.generateLegacyManifest('existing-ubuntu');
            
            expect(manifest.version).toBe(MANIFEST_VERSION);
            expect(manifest.metadata.name).toBe('existing-ubuntu');
            expect(manifest.metadata.created_by).toBe('legacy-import');
            expect(manifest.metadata.lineage).toEqual(['existing-ubuntu']);
            
            expect(manifest.layers[0].type).toBe(LayerType.DISTRO);
            expect(manifest.layers[0].name).toBe('unknown');
            const distroLayer = manifest.layers[0] as any;
            expect(distroLayer.version).toBe('unknown');
            
            expect(manifest.tags).toContain('legacy');
            expect(manifest.tags).toContain('imported');
        });
    });
});