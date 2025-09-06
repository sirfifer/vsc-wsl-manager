#!/usr/bin/env node

/**
 * Smart test runner that only runs tests affected by changed files
 * Analyzes import dependencies to determine which tests to run
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class AffectedTestRunner {
    constructor() {
        this.srcDir = path.join(process.cwd(), 'src');
        this.testDir = path.join(process.cwd(), 'test');
        this.importMap = new Map();
        this.reverseMap = new Map();
    }

    run() {
        console.log('🔍 Analyzing changed files...\n');

        // Get changed files from git
        const changedFiles = this.getChangedFiles();
        
        if (changedFiles.length === 0) {
            console.log('✅ No changes detected. All tests up to date!');
            return;
        }

        console.log(`Found ${changedFiles.length} changed file(s):`);
        changedFiles.forEach(f => console.log(`  - ${f}`));
        console.log();

        // Build dependency graph
        console.log('🔗 Building dependency graph...');
        this.buildDependencyGraph();

        // Find affected test files
        const affectedTests = this.findAffectedTests(changedFiles);

        if (affectedTests.length === 0) {
            console.log('ℹ️ No tests affected by changes');
            return;
        }

        console.log(`\n📋 Running ${affectedTests.length} affected test(s):`);
        affectedTests.forEach(t => console.log(`  - ${t}`));
        console.log();

        // Run affected tests
        this.runTests(affectedTests);
    }

    getChangedFiles() {
        try {
            // Get uncommitted changes
            const statusOutput = execSync('git status --porcelain', { encoding: 'utf8' });
            const changedFiles = statusOutput
                .split('\n')
                .filter(line => line.trim())
                .map(line => {
                    const parts = line.trim().split(/\s+/);
                    return parts[parts.length - 1];
                })
                .filter(file => file.endsWith('.ts') || file.endsWith('.js'));

            // Also check for changes since last commit
            try {
                const diffOutput = execSync('git diff HEAD~1 --name-only', { encoding: 'utf8' });
                const committedChanges = diffOutput
                    .split('\n')
                    .filter(file => file && (file.endsWith('.ts') || file.endsWith('.js')));
                
                // Merge and deduplicate
                return [...new Set([...changedFiles, ...committedChanges])];
            } catch {
                return changedFiles;
            }
        } catch (error) {
            console.warn('⚠️ Could not get git status, checking all modified files...');
            return this.getRecentlyModifiedFiles();
        }
    }

    getRecentlyModifiedFiles() {
        const files = [];
        const cutoffTime = Date.now() - (60 * 60 * 1000); // Last hour

        const walkDir = (dir) => {
            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    
                    if (entry.isDirectory() && !entry.name.includes('node_modules')) {
                        walkDir(fullPath);
                    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
                        const stats = fs.statSync(fullPath);
                        if (stats.mtimeMs > cutoffTime) {
                            files.push(path.relative(process.cwd(), fullPath));
                        }
                    }
                }
            } catch (error) {
                // Ignore permission errors
            }
        };

        walkDir(this.srcDir);
        walkDir(this.testDir);
        
        return files;
    }

    buildDependencyGraph() {
        // Scan all TypeScript files for imports
        const scanFile = (filePath) => {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const imports = this.extractImports(content);
                
                const relativePath = path.relative(process.cwd(), filePath);
                this.importMap.set(relativePath, imports);

                // Build reverse map
                imports.forEach(imp => {
                    if (!this.reverseMap.has(imp)) {
                        this.reverseMap.set(imp, new Set());
                    }
                    this.reverseMap.get(imp).add(relativePath);
                });
            } catch (error) {
                // Ignore read errors
            }
        };

        // Scan source files
        this.walkDirectory(this.srcDir, scanFile);
        
        // Scan test files
        this.walkDirectory(this.testDir, scanFile);
    }

    walkDirectory(dir, callback) {
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory() && !entry.name.includes('node_modules')) {
                    this.walkDirectory(fullPath, callback);
                } else if (entry.isFile() && entry.name.endsWith('.ts')) {
                    callback(fullPath);
                }
            }
        } catch (error) {
            // Ignore permission errors
        }
    }

    extractImports(content) {
        const imports = [];
        
        // Match ES6 imports
        const importRegex = /import\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"]/g;
        let match;
        
        while ((match = importRegex.exec(content)) !== null) {
            const importPath = match[1];
            
            // Only track local imports
            if (importPath.startsWith('.') || importPath.startsWith('@/')) {
                imports.push(this.resolveImportPath(importPath));
            }
        }

        // Match require statements
        const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
        while ((match = requireRegex.exec(content)) !== null) {
            const importPath = match[1];
            if (importPath.startsWith('.')) {
                imports.push(this.resolveImportPath(importPath));
            }
        }

        return imports;
    }

    resolveImportPath(importPath) {
        // Convert relative imports to absolute paths
        if (importPath.startsWith('./') || importPath.startsWith('../')) {
            return importPath;
        }
        
        // Handle @ alias (assuming it maps to src)
        if (importPath.startsWith('@/')) {
            return 'src/' + importPath.substring(2);
        }
        
        return importPath;
    }

    findAffectedTests(changedFiles) {
        const affectedTests = new Set();
        const visited = new Set();

        const findDependents = (file) => {
            if (visited.has(file)) return;
            visited.add(file);

            // If this is a test file, add it
            if (file.includes('/test/') && file.endsWith('.test.ts')) {
                affectedTests.add(file);
            }

            // Find all files that import this file
            const dependents = this.reverseMap.get(file) || new Set();
            dependents.forEach(dep => findDependents(dep));

            // Also check for test files with matching names
            if (file.startsWith('src/')) {
                const baseName = path.basename(file, '.ts');
                const possibleTests = [
                    `test/unit/${baseName}.test.ts`,
                    `test/integration/${baseName}.test.ts`,
                    `test/security/${baseName}.test.ts`
                ];

                possibleTests.forEach(testFile => {
                    if (fs.existsSync(testFile)) {
                        affectedTests.add(testFile);
                    }
                });
            }
        };

        changedFiles.forEach(file => findDependents(file));

        return Array.from(affectedTests);
    }

    runTests(testFiles) {
        const testPaths = testFiles.join(' ');
        const command = `npx jest ${testPaths} --verbose`;

        console.log(`🚀 Running command: ${command}\n`);
        console.log('═'.repeat(50));

        try {
            execSync(command, { stdio: 'inherit' });
            console.log('\n' + '═'.repeat(50));
            console.log('✅ All affected tests passed!');
        } catch (error) {
            console.log('\n' + '═'.repeat(50));
            console.error('❌ Some tests failed');
            process.exit(1);
        }
    }
}

// Run the affected test runner
const runner = new AffectedTestRunner();
runner.run();