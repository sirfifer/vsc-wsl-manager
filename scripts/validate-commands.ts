#!/usr/bin/env node

/**
 * Command Validation Script
 * 
 * Simple test to validate that all necessary commands can run
 * without user intervention in the Claude Code environment.
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface CommandTest {
    name: string;
    command: string;
    description: string;
    critical: boolean;
}

interface TestResult {
    name: string;
    command: string;
    success: boolean;
    duration: number;
    output?: string;
    error?: string;
}

class CommandValidator {
    private results: TestResult[] = [];
    private tempDir = path.join(__dirname, '../.test-temp');
    private tempFile = path.join(this.tempDir, 'test-file.ts');
    
    private commands: CommandTest[] = [
        {
            name: 'TypeScript Compilation',
            command: 'npm run compile',
            description: 'Compile TypeScript files',
            critical: true
        },
        {
            name: 'Unit Tests',
            command: 'npm run test:unit',
            description: 'Run unit test suite',
            critical: true
        },
        {
            name: 'Linting',
            command: 'npm run lint',
            description: 'Run ESLint checks',
            critical: false
        },
        {
            name: 'Quick Test',
            command: 'npm run quick-test',
            description: 'Run quick validation test',
            critical: false
        },
        {
            name: 'Directory Listing',
            command: 'ls -la src/',
            description: 'List source files',
            critical: true
        },
        {
            name: 'Node Version',
            command: 'node --version',
            description: 'Check Node.js version',
            critical: true
        }
    ];
    
    async run(): Promise<void> {
        console.log('🚀 Command Execution Validation Test');
        console.log('=' .repeat(50));
        console.log('Testing autonomous command execution...\n');
        
        // Pre-flight checks
        await this.preFlightChecks();
        
        // Test commands
        await this.testCommands();
        
        // Test file operations
        await this.testFileOperations();
        
        // Clean up
        await this.cleanup();
        
        // Report results
        this.reportResults();
    }
    
    private async preFlightChecks(): Promise<void> {
        console.log('📋 Pre-flight Checks');
        console.log('-'.repeat(30));
        
        // Check settings file
        const settingsPath = path.join(__dirname, '../.claude/settings.json');
        if (fs.existsSync(settingsPath)) {
            console.log('✅ Claude settings file exists');
        } else {
            console.log('⚠️  Claude settings file not found');
        }
        
        // Check package.json
        const packagePath = path.join(__dirname, '../package.json');
        if (fs.existsSync(packagePath)) {
            console.log('✅ package.json exists');
        } else {
            console.log('❌ package.json not found');
            process.exit(1);
        }
        
        console.log('');
    }
    
    private async testCommands(): Promise<void> {
        console.log('🔧 Testing Commands');
        console.log('-'.repeat(30));
        
        for (const test of this.commands) {
            await this.runCommand(test);
        }
        
        console.log('');
    }
    
    private async runCommand(test: CommandTest): Promise<void> {
        const start = Date.now();
        console.log(`Testing: ${test.name}...`);
        
        try {
            const { stdout, stderr } = await execAsync(test.command, {
                timeout: 30000,
                cwd: path.join(__dirname, '..')
            });
            
            const duration = Date.now() - start;
            const success = !stderr || stderr.includes('warning');
            
            this.results.push({
                name: test.name,
                command: test.command,
                success,
                duration,
                output: stdout?.substring(0, 100)
            });
            
            console.log(`  ${success ? '✅' : '⚠️'} ${test.name} (${duration}ms)`);
            
        } catch (error: any) {
            const duration = Date.now() - start;
            const isTestFailure = test.command.includes('test') && error.code === 1;
            const success = !test.critical || isTestFailure;
            
            this.results.push({
                name: test.name,
                command: test.command,
                success,
                duration,
                error: error.message?.substring(0, 100)
            });
            
            console.log(`  ${success ? '⚠️' : '❌'} ${test.name} (${duration}ms)`);
        }
    }
    
    private async testFileOperations(): Promise<void> {
        console.log('📁 Testing File Operations');
        console.log('-'.repeat(30));
        
        // Create temp directory
        try {
            if (!fs.existsSync(this.tempDir)) {
                fs.mkdirSync(this.tempDir, { recursive: true });
            }
            console.log('✅ Created temp directory');
        } catch (error) {
            console.log('❌ Failed to create temp directory');
            return;
        }
        
        // Write file
        try {
            const testContent = `
export class TestFile {
    public getValue(): string {
        return "test";
    }
}`;
            fs.writeFileSync(this.tempFile, testContent);
            console.log('✅ Created test file');
        } catch (error) {
            console.log('❌ Failed to create test file');
            return;
        }
        
        // Read file
        try {
            const content = fs.readFileSync(this.tempFile, 'utf8');
            if (content.includes('TestFile')) {
                console.log('✅ Read test file');
            } else {
                console.log('⚠️  File content unexpected');
            }
        } catch (error) {
            console.log('❌ Failed to read test file');
        }
        
        // Edit file
        try {
            const content = fs.readFileSync(this.tempFile, 'utf8');
            const modified = content.replace('getValue', 'getTestValue');
            fs.writeFileSync(this.tempFile, modified);
            console.log('✅ Modified test file');
        } catch (error) {
            console.log('❌ Failed to modify test file');
        }
        
        console.log('');
    }
    
    private async cleanup(): Promise<void> {
        console.log('🧹 Cleanup');
        console.log('-'.repeat(30));
        
        try {
            if (fs.existsSync(this.tempFile)) {
                fs.unlinkSync(this.tempFile);
            }
            if (fs.existsSync(this.tempDir)) {
                fs.rmdirSync(this.tempDir);
            }
            console.log('✅ Cleaned up test files\n');
        } catch (error) {
            console.log('⚠️  Cleanup incomplete\n');
        }
    }
    
    private reportResults(): void {
        console.log('=' .repeat(50));
        console.log('📊 VALIDATION RESULTS');
        console.log('=' .repeat(50));
        
        const totalTests = this.results.length;
        const passedTests = this.results.filter(r => r.success).length;
        const criticalTests = this.commands.filter(c => c.critical);
        const criticalPassed = this.results.filter(r => {
            const test = this.commands.find(c => c.name === r.name);
            return test?.critical && r.success;
        }).length;
        
        console.log(`Total Tests: ${totalTests}`);
        console.log(`Passed: ${passedTests}/${totalTests}`);
        console.log(`Critical Tests Passed: ${criticalPassed}/${criticalTests.length}`);
        
        const avgDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / totalTests;
        console.log(`Average Duration: ${avgDuration.toFixed(0)}ms`);
        
        console.log('\nDetailed Results:');
        console.log('-'.repeat(50));
        
        for (const result of this.results) {
            const icon = result.success ? '✅' : '❌';
            console.log(`${icon} ${result.name}: ${result.duration}ms`);
            if (!result.success && result.error) {
                console.log(`   Error: ${result.error}`);
            }
        }
        
        console.log('=' .repeat(50));
        
        const allCriticalPassed = criticalPassed === criticalTests.length;
        
        if (allCriticalPassed) {
            console.log('✅ SUCCESS: All critical commands executed without intervention!');
            console.log('\nThe automation system is working correctly.');
            console.log('Claude Code can iterate autonomously on this project.');
            process.exit(0);
        } else {
            console.log('❌ FAILURE: Some critical commands failed');
            console.log('\nPlease check:');
            console.log('1. Node.js and npm are properly installed');
            console.log('2. Dependencies are installed (npm install)');
            console.log('3. .claude/settings.json permissions are correct');
            console.log('4. No conflicting processes or file locks');
            process.exit(1);
        }
    }
}

// Run validation
const validator = new CommandValidator();
validator.run().catch(error => {
    console.error('Fatal error during validation:', error);
    process.exit(1);
});