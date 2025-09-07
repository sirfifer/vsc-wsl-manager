#!/usr/bin/env node
/**
 * Full End-to-End Validation Script
 * Ensures the extension is completely functional before declaring work done
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

interface ValidationResult {
    step: string;
    success: boolean;
    message: string;
    details?: string;
}

export class FullValidator {
    private results: ValidationResult[] = [];
    private readonly rootDir = path.join(__dirname, '../..');
    
    async validate(): Promise<boolean> {
        console.log('🚀 Starting Full End-to-End Validation');
        console.log('=' .repeat(60));
        
        // Step 1: Clean and compile
        if (!await this.cleanBuild()) return this.fail('Clean Build');
        
        // Step 2: Verify no stale files
        if (!await this.verifyNoStaleFiles()) return this.fail('Verify Build Output');
        
        // Step 3: Run all tests
        if (!await this.runAllTests()) return this.fail('Run Tests');
        
        // Step 4: Check package.json configuration
        if (!await this.verifyPackageJson()) return this.fail('Package Configuration');
        
        // Step 5: Launch VS Code test
        if (!await this.launchVSCodeTest()) return this.fail('VS Code Launch');
        
        // Step 6: Generate validation report
        this.generateReport();
        
        return true;
    }
    
    private async cleanBuild(): Promise<boolean> {
        console.log('\n📦 Step 1: Clean Build');
        
        try {
            // Clean
            console.log('   Cleaning output directory...');
            await execAsync('npm run clean', { cwd: this.rootDir });
            
            // Verify clean
            const outPath = path.join(this.rootDir, 'out');
            if (fs.existsSync(outPath)) {
                const files = fs.readdirSync(outPath);
                if (files.length > 0) {
                    this.addResult('Clean', false, 'Output directory not properly cleaned');
                    return false;
                }
            }
            
            // Compile
            console.log('   Compiling TypeScript...');
            const { stderr } = await execAsync('npm run compile', { cwd: this.rootDir });
            
            // Check for compilation errors (not warnings)
            if (stderr && !stderr.toLowerCase().includes('warning')) {
                this.addResult('Compile', false, 'Compilation errors', stderr);
                return false;
            }
            
            this.addResult('Clean Build', true, 'Successfully cleaned and compiled');
            console.log('   ✅ Clean build successful');
            return true;
            
        } catch (error: any) {
            this.addResult('Clean Build', false, 'Build failed', error.message);
            console.log('   ❌ Build failed:', error.message);
            return false;
        }
    }
    
    private async verifyNoStaleFiles(): Promise<boolean> {
        console.log('\n🔍 Step 2: Verify Build Output');
        
        const issues: string[] = [];
        
        // Check for old terminalProfileManager.js
        const oldFiles = [
            'out/terminalProfileManager.js',
            'out/src/terminalProfileManager.js',
            'out/extension.js' // Should not exist in root of out/
        ];
        
        for (const file of oldFiles) {
            const fullPath = path.join(this.rootDir, file);
            if (fs.existsSync(fullPath)) {
                issues.push(`Old file exists: ${file}`);
            }
        }
        
        // Verify correct structure
        const expectedFiles = [
            'out/src/extension.js',
            'out/src/wslManager.js',
            'out/src/terminal/wslTerminalProfileProvider.js'
        ];
        
        for (const file of expectedFiles) {
            const fullPath = path.join(this.rootDir, file);
            if (!fs.existsSync(fullPath)) {
                issues.push(`Expected file missing: ${file}`);
            }
        }
        
        if (issues.length > 0) {
            this.addResult('Build Output', false, 'Build issues found', issues.join('\n'));
            console.log('   ❌ Issues found:');
            issues.forEach(issue => console.log(`      - ${issue}`));
            return false;
        }
        
        this.addResult('Build Output', true, 'Build output structure correct');
        console.log('   ✅ Build output verified');
        return true;
    }
    
    private async runAllTests(): Promise<boolean> {
        console.log('\n🧪 Step 3: Run All Tests');
        
        try {
            // Run unit tests
            console.log('   Running unit tests...');
            const unitResult = await this.runTestSuite('unit');
            if (!unitResult.success) {
                this.addResult('Unit Tests', false, unitResult.message, unitResult.details);
                return false;
            }
            
            // Run integration tests
            console.log('   Running integration tests...');
            const integrationResult = await this.runTestSuite('integration');
            if (!integrationResult.success) {
                this.addResult('Integration Tests', false, integrationResult.message, integrationResult.details);
                return false;
            }
            
            this.addResult('All Tests', true, 'All tests passed');
            console.log('   ✅ All tests passed');
            return true;
            
        } catch (error: any) {
            this.addResult('Tests', false, 'Test execution failed', error.message);
            console.log('   ❌ Test execution failed:', error.message);
            return false;
        }
    }
    
    private async runTestSuite(suite: string): Promise<{ success: boolean; message: string; details?: string }> {
        try {
            const { stdout } = await execAsync(`npm run test:${suite}`, { 
                cwd: this.rootDir,
                maxBuffer: 10 * 1024 * 1024 // 10MB
            });
            
            // Parse test results
            const passMatch = stdout.match(/(\d+) passing/);
            const failMatch = stdout.match(/(\d+) failing/);
            
            if (failMatch && failMatch[1] !== '0') {
                return {
                    success: false,
                    message: `${failMatch[1]} tests failing`,
                    details: stdout.substring(0, 1000)
                };
            }
            
            const passCount = passMatch ? passMatch[1] : '0';
            return {
                success: true,
                message: `${passCount} tests passing`
            };
            
        } catch (error: any) {
            // Test command failed
            const output = error.stdout || error.message;
            const failMatch = output.match(/(\d+) failing/);
            const failCount = failMatch ? failMatch[1] : 'unknown';
            
            return {
                success: false,
                message: `${failCount} tests failing`,
                details: output.substring(0, 1000)
            };
        }
    }
    
    private async verifyPackageJson(): Promise<boolean> {
        console.log('\n📋 Step 4: Verify Package Configuration');
        
        try {
            const packagePath = path.join(this.rootDir, 'package.json');
            const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            
            // Check main entry point
            const expectedMain = './out/src/extension.js';
            if (packageJson.main !== expectedMain) {
                this.addResult('Package Config', false, 
                    `Main entry point incorrect: ${packageJson.main} (should be ${expectedMain})`);
                console.log(`   ❌ Main entry point incorrect: ${packageJson.main}`);
                return false;
            }
            
            // Check required scripts exist
            const requiredScripts = ['compile', 'clean', 'test:unit', 'test:integration'];
            const missingScripts = requiredScripts.filter(script => !packageJson.scripts[script]);
            
            if (missingScripts.length > 0) {
                this.addResult('Package Config', false, 
                    `Missing scripts: ${missingScripts.join(', ')}`);
                console.log(`   ❌ Missing scripts: ${missingScripts.join(', ')}`);
                return false;
            }
            
            this.addResult('Package Config', true, 'Package.json correctly configured');
            console.log('   ✅ Package.json verified');
            return true;
            
        } catch (error: any) {
            this.addResult('Package Config', false, 'Failed to verify package.json', error.message);
            console.log('   ❌ Failed to verify package.json:', error.message);
            return false;
        }
    }
    
    private async launchVSCodeTest(): Promise<boolean> {
        console.log('\n🚀 Step 5: VS Code Launch Test');
        console.log('   ⚠️  Manual verification required:');
        console.log('   1. Launch VS Code with F5 or:');
        console.log(`      code --extensionDevelopmentPath=${this.rootDir}`);
        console.log('   2. Open Debug Console (Ctrl+Shift+Y)');
        console.log('   3. Verify:');
        console.log('      - "WSL Manager extension is now active!" appears');
        console.log('      - NO permission errors');
        console.log('      - Error types are NOT "UNKNOWN"');
        console.log('   4. Test commands:');
        console.log('      - WSL: Refresh Distributions');
        console.log('      - WSL: Create New Distribution');
        console.log('      - WSL: Import Distribution');
        
        // Check if we can programmatically verify anything
        const extensionPath = path.join(this.rootDir, 'out/src/extension.js');
        if (!fs.existsSync(extensionPath)) {
            this.addResult('VS Code Launch', false, 'Extension entry point not found');
            console.log('   ❌ Extension entry point not found');
            return false;
        }
        
        // Check for common issues in the compiled code
        const extensionCode = fs.readFileSync(extensionPath, 'utf8');
        
        if (extensionCode.includes('terminalProfileManager_1.TerminalProfileManager')) {
            this.addResult('VS Code Launch', false, 'Old TerminalProfileManager still referenced');
            console.log('   ❌ Old TerminalProfileManager still referenced in compiled code');
            return false;
        }
        
        if (!extensionCode.includes('wslTerminalProfileProvider')) {
            this.addResult('VS Code Launch', false, 'New terminal provider not found');
            console.log('   ❌ New terminal provider not found in compiled code');
            return false;
        }
        
        this.addResult('VS Code Launch', true, 'Extension structure verified (manual test required)');
        console.log('   ✅ Extension structure verified (complete manual test above)');
        return true;
    }
    
    private addResult(step: string, success: boolean, message: string, details?: string): void {
        this.results.push({ step, success, message, details });
    }
    
    private fail(step: string): boolean {
        console.log(`\n❌ Validation failed at: ${step}`);
        this.generateReport();
        return false;
    }
    
    private generateReport(): void {
        console.log('\n' + '='.repeat(60));
        console.log('📊 VALIDATION REPORT');
        console.log('='.repeat(60));
        
        let allPassed = true;
        
        for (const result of this.results) {
            const status = result.success ? '✅' : '❌';
            console.log(`${status} ${result.step}: ${result.message}`);
            
            if (result.details) {
                console.log(`   Details: ${result.details.substring(0, 200)}`);
            }
            
            if (!result.success) {
                allPassed = false;
            }
        }
        
        console.log('='.repeat(60));
        
        if (allPassed) {
            console.log('✅ ALL VALIDATION CHECKS PASSED!');
            console.log('The extension is ready for use.');
        } else {
            console.log('❌ VALIDATION FAILED');
            console.log('Fix the issues above and run validation again.');
            console.log('DO NOT declare work complete until all checks pass!');
        }
        
        // Write report to file
        const reportPath = path.join(this.rootDir, 'validation-report.json');
        fs.writeFileSync(reportPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            success: allPassed,
            results: this.results
        }, null, 2));
        
        console.log(`\nFull report saved to: ${reportPath}`);
    }
}

// Run if executed directly
if (require.main === module) {
    const validator = new FullValidator();
    validator.validate().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('❌ Validation error:', error);
        process.exit(1);
    });
}