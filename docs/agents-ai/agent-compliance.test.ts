/**
 * Agent Compliance Test Suite
 * 
 * This test file verifies that autonomous agents (Codex, Copilot, etc.)
 * are correctly following the instructions in AGENTS.md.
 * 
 * Run this before submitting any PR:
 * npm run test:agent-compliance
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

describe('AGENTS.md Compliance Verification', () => {
    const projectRoot = path.resolve(__dirname, '../..');
    
    describe('Repository Structure', () => {
        it('should have AGENTS.md in repository root', () => {
            const agentsMdPath = path.join(projectRoot, 'AGENTS.md');
            expect(fs.existsSync(agentsMdPath)).to.be.true;
        });
        
        it('should have valid Markdown syntax in AGENTS.md', () => {
            const agentsMdPath = path.join(projectRoot, 'AGENTS.md');
            const content = fs.readFileSync(agentsMdPath, 'utf8');
            
            // Check for basic Markdown structure
            expect(content).to.include('#');
            expect(content).to.include('## ');
            expect(content.length).to.be.greaterThan(1000); // Substantial content
        });
        
        it('should have test files for all source files', () => {
            const srcDir = path.join(projectRoot, 'src');
            const testDir = path.join(projectRoot, 'src/test');
            
            const sourceFiles = getTypeScriptFiles(srcDir, ['test']);
            const testFiles = getTypeScriptFiles(testDir);
            
            sourceFiles.forEach(srcFile => {
                const baseName = path.basename(srcFile, '.ts');
                const expectedTestFile = `${baseName}.test.ts`;
                const hasTest = testFiles.some(testFile => 
                    testFile.includes(expectedTestFile)
                );
                
                expect(hasTest, `Missing test for ${srcFile}`).to.be.true;
            });
        });
    });
    
    describe('Test-Driven Development Compliance', () => {
        it('should have tests as first commit in PR branch', function() {
            // Skip this test if not in a PR branch
            const currentBranch = execSync('git branch --show-current').toString().trim();
            
            if (!currentBranch.match(/^(codex|copilot|agent)\//)) {
                this.skip();
            }
            
            // Get first commit in this branch
            const firstCommitFiles = execSync(
                'git diff --name-only $(git merge-base main HEAD)..HEAD | head -5'
            ).toString().trim().split('\n');
            
            const hasTestInFirst = firstCommitFiles.some(file => 
                file.includes('.test.') || file.includes('.spec.')
            );
            
            expect(hasTestInFirst, 'TDD violation: Tests must be written first').to.be.true;
        });
        
        it('should have more test code than implementation code in initial commits', function() {
            const currentBranch = execSync('git branch --show-current').toString().trim();
            
            if (!currentBranch.match(/^(codex|copilot|agent)\//)) {
                this.skip();
            }
            
            const stats = execSync('git diff --stat $(git merge-base main HEAD)..HEAD').toString();
            // This is a simplified check - in practice you'd parse the stats more carefully
            expect(stats).to.include('.test.ts');
        });
    });
    
    describe('Code Coverage Requirements', () => {
        it('should have 100% test coverage', async function() {
            this.timeout(30000); // Coverage can take time
            
            try {
                execSync('npm run coverage', { cwd: projectRoot, stdio: 'pipe' });
                
                const coveragePath = path.join(projectRoot, 'coverage/coverage-summary.json');
                if (!fs.existsSync(coveragePath)) {
                    throw new Error('Coverage report not generated');
                }
                
                const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
                
                expect(coverage.total.lines.pct).to.equal(100);
                expect(coverage.total.statements.pct).to.equal(100);
                expect(coverage.total.functions.pct).to.equal(100);
                expect(coverage.total.branches.pct).to.equal(100);
            } catch (error) {
                throw new Error(`Coverage check failed: ${error.message}`);
            }
        });
    });
    
    describe('Security Compliance', () => {
        it('should not use exec() or execSync() in source code', () => {
            const srcDir = path.join(projectRoot, 'src');
            const sourceFiles = getTypeScriptFiles(srcDir, ['test']);
            
            sourceFiles.forEach(file => {
                const content = fs.readFileSync(file, 'utf8');
                
                // Check for forbidden exec usage (except in this test file)
                if (!file.includes('agent-compliance.test')) {
                    expect(content).to.not.match(/\.exec\(/);
                    expect(content).to.not.match(/\.execSync\(/);
                    
                    // Should use spawn instead
                    if (content.includes('child_process')) {
                        expect(content).to.match(/spawn/);
                    }
                }
            });
        });
        
        it('should validate all user inputs', () => {
            const srcDir = path.join(projectRoot, 'src');
            const sourceFiles = getTypeScriptFiles(srcDir, ['test']);
            
            sourceFiles.forEach(file => {
                const content = fs.readFileSync(file, 'utf8');
                
                // If file handles user input, it should have validation
                if (content.includes('request.body') || content.includes('args')) {
                    expect(content).to.match(/validate|sanitize|escape/i);
                }
            });
        });
    });
    
    describe('Documentation Compliance', () => {
        it('should have JSDoc for all exported functions', () => {
            const srcDir = path.join(projectRoot, 'src');
            const sourceFiles = getTypeScriptFiles(srcDir, ['test']);
            
            sourceFiles.forEach(file => {
                const content = fs.readFileSync(file, 'utf8');
                
                // Find all exported functions
                const exportedFunctions = content.match(/export\s+(async\s+)?function\s+\w+/g) || [];
                
                exportedFunctions.forEach(func => {
                    const funcName = func.match(/function\s+(\w+)/)?.[1];
                    const funcIndex = content.indexOf(func);
                    
                    // Check for JSDoc before the function
                    const beforeFunc = content.substring(Math.max(0, funcIndex - 500), funcIndex);
                    expect(beforeFunc, `Missing JSDoc for ${funcName} in ${file}`).to.match(/\/\*\*[\s\S]*?\*\//);
                });
            });
        });
        
        it('should have inline comments for complex logic', () => {
            const srcDir = path.join(projectRoot, 'src');
            const sourceFiles = getTypeScriptFiles(srcDir, ['test']);
            
            sourceFiles.forEach(file => {
                const content = fs.readFileSync(file, 'utf8');
                const lines = content.split('\n');
                
                // Check for comments in complex areas
                let complexityIndicators = 0;
                let comments = 0;
                
                lines.forEach(line => {
                    if (line.match(/if.*&&.*\|\|/)) complexityIndicators++;
                    if (line.match(/for.*for/)) complexityIndicators++;
                    if (line.match(/\?\s*.*\s*:/)) complexityIndicators++; // Ternary
                    if (line.match(/\/\//)) comments++;
                });
                
                if (complexityIndicators > 3) {
                    expect(comments).to.be.greaterThan(0, `Complex file ${file} needs inline comments`);
                }
            });
        });
    });
    
    describe('Code Quality Standards', () => {
        it('should pass linting', () => {
            try {
                execSync('npm run lint', { cwd: projectRoot, stdio: 'pipe' });
            } catch (error) {
                throw new Error(`Linting failed: ${error.message}`);
            }
        });
        
        it('should compile with TypeScript strict mode', () => {
            try {
                execSync('npx tsc --noEmit --strict', { cwd: projectRoot, stdio: 'pipe' });
            } catch (error) {
                throw new Error(`TypeScript strict mode failed: ${error.message}`);
            }
        });
        
        it('should not have console.log in production code', () => {
            const srcDir = path.join(projectRoot, 'src');
            const sourceFiles = getTypeScriptFiles(srcDir, ['test']);
            
            sourceFiles.forEach(file => {
                const content = fs.readFileSync(file, 'utf8');
                expect(content, `console.log found in ${file}`).to.not.include('console.log');
            });
        });
    });
    
    describe('Parallel Execution Safety', () => {
        it('should use unique identifiers for test resources', () => {
            const testDir = path.join(projectRoot, 'src/test');
            const testFiles = getTypeScriptFiles(testDir);
            
            testFiles.forEach(file => {
                const content = fs.readFileSync(file, 'utf8');
                
                // Check for unique identifiers in test setup
                if (content.includes('beforeEach') || content.includes('before(')) {
                    expect(content).to.match(/Date\.now\(\)|uuid|timestamp|Math\.random/);
                }
            });
        });
        
        it('should cleanup resources in afterEach/after hooks', () => {
            const testDir = path.join(projectRoot, 'src/test');
            const testFiles = getTypeScriptFiles(testDir);
            
            testFiles.forEach(file => {
                const content = fs.readFileSync(file, 'utf8');
                
                // If test creates resources, it should clean them up
                if (content.includes('mkdir') || content.includes('createTemp')) {
                    expect(content).to.match(/afterEach|after\(/);
                    expect(content).to.match(/rm|delete|cleanup/i);
                }
            });
        });
    });
    
    describe('PR Readiness', () => {
        it('should have all required files in the PR', function() {
            const currentBranch = execSync('git branch --show-current').toString().trim();
            
            if (!currentBranch.match(/^(codex|copilot|agent)\//)) {
                this.skip();
            }
            
            const changedFiles = execSync(
                'git diff --name-only $(git merge-base main HEAD)..HEAD'
            ).toString().trim().split('\n');
            
            // Check for completeness
            const hasImplementation = changedFiles.some(f => f.match(/\.ts$/) && !f.includes('.test.'));
            const hasTests = changedFiles.some(f => f.includes('.test.'));
            const hasDocs = changedFiles.some(f => f.match(/\.(md|txt)$/));
            
            expect(hasImplementation, 'PR missing implementation').to.be.true;
            expect(hasTests, 'PR missing tests').to.be.true;
            expect(hasDocs, 'PR missing documentation updates').to.be.true;
        });
        
        it('should have descriptive commit messages', function() {
            const currentBranch = execSync('git branch --show-current').toString().trim();
            
            if (!currentBranch.match(/^(codex|copilot|agent)\//)) {
                this.skip();
            }
            
            const commits = execSync(
                'git log --oneline $(git merge-base main HEAD)..HEAD'
            ).toString().trim().split('\n');
            
            commits.forEach(commit => {
                // Check commit message quality
                expect(commit.length).to.be.greaterThan(10);
                expect(commit).to.match(/\[(test|feat|fix|docs|refactor)\]/i);
            });
        });
    });
});

// Helper function to get TypeScript files
function getTypeScriptFiles(dir: string, exclude: string[] = []): string[] {
    const files: string[] = [];
    
    function walk(currentDir: string) {
        if (!fs.existsSync(currentDir)) return;
        
        const items = fs.readdirSync(currentDir);
        
        items.forEach(item => {
            const fullPath = path.join(currentDir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                if (!exclude.some(ex => item.includes(ex))) {
                    walk(fullPath);
                }
            } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
                files.push(fullPath);
            }
        });
    }
    
    walk(dir);
    return files;
}

// Export a summary function for agents to call
export async function getComplianceScore(): Promise<{
    score: number;
    details: Record<string, boolean>;
}> {
    const checks = {
        hasAgentsMd: fs.existsSync(path.join(process.cwd(), 'AGENTS.md')),
        hasTests: fs.existsSync(path.join(process.cwd(), 'src/test')),
        hasCoverage: fs.existsSync(path.join(process.cwd(), 'coverage')),
        hasCI: fs.existsSync(path.join(process.cwd(), '.github/workflows')),
    };
    
    const score = Object.values(checks).filter(Boolean).length / Object.keys(checks).length * 100;
    
    return { score, details: checks };
}
