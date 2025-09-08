/**
 * Manifest Types for WSL Manager
 * 
 * Defines the structure and types for the manifest system that tracks
 * the complete history and composition of WSL images.
 */

/**
 * Version of the manifest format
 */
export const MANIFEST_VERSION = '1.0.0';

/**
 * Metadata about the image origin and lineage
 */
export interface ManifestMetadata {
    /** Source distro if created from pristine template */
    source?: string;
    
    /** Parent image if cloned from another image */
    parent?: string;
    
    /** Complete lineage chain from origin to current */
    lineage: string[];
    
    /** ISO 8601 timestamp of creation */
    created: string;
    
    /** Tool that created this image */
    created_by: string;
    
    /** Unique identifier for this image */
    id: string;
    
    /** Human-readable name */
    name: string;
    
    /** Optional description */
    description?: string;
}

/**
 * Types of layers that can be applied to an image
 */
export enum LayerType {
    DISTRO = 'distro',
    ENVIRONMENT = 'environment',
    BOOTSTRAP_SCRIPT = 'bootstrap_script',
    SETTINGS = 'settings',
    CUSTOM = 'custom'
}

/**
 * Base layer information
 */
export interface LayerBase {
    /** Type of layer */
    type: LayerType;
    
    /** Name of the layer */
    name: string;
    
    /** When this layer was applied */
    applied: string;
    
    /** Optional description */
    description?: string;
}

/**
 * Distro layer - the base distribution
 */
export interface DistroLayer extends LayerBase {
    type: LayerType.DISTRO;
    
    /** Version of the distribution */
    version: string;
    
    /** Architecture */
    architecture?: 'x64' | 'arm64';
    
    /** Source URL or path */
    source?: string;
}

/**
 * Environment layer - development environment setup
 */
export interface EnvironmentLayer extends LayerBase {
    type: LayerType.ENVIRONMENT;
    
    /** Detailed environment information */
    details?: Record<string, any>;
    
    /** Installed packages */
    packages?: string[];
    
    /** Environment variables set */
    variables?: Record<string, string>;
}

/**
 * Bootstrap script layer
 */
export interface BootstrapScriptLayer extends LayerBase {
    type: LayerType.BOOTSTRAP_SCRIPT;
    
    /** Path to the script inside the image */
    path: string;
    
    /** SHA256 hash of the script for verification */
    sha256?: string;
    
    /** Exit code of the script execution */
    exitCode?: number;
    
    /** Script parameters if any */
    parameters?: string[];
}

/**
 * Settings layer - configuration changes
 */
export interface SettingsLayer extends LayerBase {
    type: LayerType.SETTINGS;
    
    /** Map of file paths to their changes */
    changes: Record<string, Record<string, any>>;
    
    /** Files that were created */
    created_files?: string[];
    
    /** Files that were modified */
    modified_files?: string[];
}

/**
 * Custom layer for user-defined changes
 */
export interface CustomLayer extends LayerBase {
    type: LayerType.CUSTOM;
    
    /** Custom data */
    data?: any;
}

/**
 * Union type for all layer types
 */
export type Layer = DistroLayer | EnvironmentLayer | BootstrapScriptLayer | SettingsLayer | CustomLayer;

/**
 * Complete manifest structure
 */
export interface Manifest {
    /** Version of the manifest format */
    version: string;
    
    /** Metadata about the image */
    metadata: ManifestMetadata;
    
    /** Layers applied to this image in order */
    layers: Layer[];
    
    /** Environment variables set in the image */
    environment_variables?: Record<string, string>;
    
    /** Features installed in the image */
    installed_features?: Record<string, boolean | string>;
    
    /** Bootstrap scripts available in the image */
    bootstrap_scripts?: string[];
    
    /** Tags for categorization */
    tags?: string[];
    
    /** Free-form notes */
    notes?: string;
    
    /** WSL specific configuration */
    wsl_config?: {
        /** WSL version (1 or 2) */
        version?: number;
        
        /** Default user */
        default_user?: string;
        
        /** Memory limit */
        memory?: string;
        
        /** Processor count */
        processors?: number;
        
        /** Swap size */
        swap?: string;
        
        /** Whether systemd is enabled */
        systemd?: boolean;
    };
    
    /** Custom user data */
    custom?: Record<string, any>;
}

/**
 * Options for manifest operations
 */
export interface ManifestOptions {
    /** Whether to validate the manifest */
    validate?: boolean;
    
    /** Whether to backup existing manifest */
    backup?: boolean;
    
    /** Whether to merge with existing manifest */
    merge?: boolean;
}

/**
 * Result of manifest validation
 */
export interface ManifestValidationResult {
    /** Whether the manifest is valid */
    valid: boolean;
    
    /** Validation errors if any */
    errors?: string[];
    
    /** Validation warnings if any */
    warnings?: string[];
    
    /** Suggested fixes */
    suggestions?: string[];
}

/**
 * Manifest comparison result
 */
export interface ManifestDiff {
    /** Layers added */
    added_layers: Layer[];
    
    /** Layers removed (shouldn't happen in normal flow) */
    removed_layers?: Layer[];
    
    /** Environment variables changed */
    env_changes?: Record<string, { old?: string; new?: string }>;
    
    /** Features changed */
    feature_changes?: Record<string, { old?: boolean | string; new?: boolean | string }>;
    
    /** Tags changed */
    tag_changes?: { added: string[]; removed: string[] };
    
    /** Metadata changes */
    metadata_changes?: Partial<ManifestMetadata>;
}