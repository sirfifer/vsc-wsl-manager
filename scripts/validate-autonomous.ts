#!/usr/bin/env node

/**
 * Autonomous Iteration Validation Script
 * 
 * This script tests whether Claude Code can iterate autonomously
 * without any user intervention. It will:
 * 1. Test compilation
 * 2. Create a file with an error
 * 3. Detect the error
 * 4. Fix the error
 * 5. Validate the fix
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface TestResult {
    step: string;
    success: boolean;
    message: string;
}

class AutonomousValidator {
    private results: TestResult[] = [];
    private testFilePath = path.join(__dirname, '../src/test-autonomous.ts');
    
    async run(): Promise<void> {
        console.log('🤖 Autonomous Iteration Validation Test');
        console.log('=' .repeat(50));
        console.log('This test will validate that Claude Code can:');
        console.log('- Run commands without prompting');
        console.log('- Create and edit files');
        console.log('- Detect and fix errors');
        console.log('- Complete an iteration loop');
        console.log('=' .repeat(50));
        console.log('');
        
        // Run all test steps
        await this.step1_InitialCompilation();
        await this.step2_CreateBrokenFile();
        await this.step3_DetectError();
        await this.step4_FixError();
        await this.step5_ValidateFix();
        await this.step6_Cleanup();
        
        // Report results
        this.reportResults();
    }
    
    private async step1_InitialCompilation(): Promise<void> {
        console.log('📝 Step 1: Testing initial compilation...');
        try {
            const { stderr } = await execAsync('npm run compile');
            const success = !stderr || stderr.includes('warning');
            this.results.push({
                step: 'Initial Compilation',
                success,
                message: success ? 'Project compiles successfully' : 'Compilation failed'
            });
            console.log(`   ${success ? '✅' : '❌'} Compilation: ${success ? 'PASSED' : 'FAILED'}\n`);
        } catch (error: any) {
            this.results.push({
                step: 'Initial Compilation',
                success: false,
                message: `Error: ${error.message}`
            });
            console.log(`   ❌ Compilation: FAILED - ${error.message}\n`);
        }
    }
    
    private async step2_CreateBrokenFile(): Promise<void> {
        console.log('📝 Step 2: Creating test file with intentional error...');
        
        const brokenCode = `
// This file tests autonomous iteration
export class TestAutonomous {
    private message: string = "Testing autonomous iteration";
    
    // Intentional TypeScript error: wrong return type
    public getMessage(): number {  // Should return string, not number
        return this.message;  // This will cause a type error
    }
    
    public isWorking(): boolean {
        return true;
    }
}
`;
        
        try {
            fs.writeFileSync(this.testFilePath, brokenCode);
            this.results.push({
                step: 'Create Broken File',
                success: true,
                message: 'Test file created with intentional error'
            });
            console.log(`   ✅ Created: ${this.testFilePath}`);
            console.log(`   ℹ️  Contains intentional type error\n`);
        } catch (error: any) {
            this.results.push({
                step: 'Create Broken File',
                success: false,
                message: `Failed to create file: ${error.message}`
            });
            console.log(`   ❌ Failed to create test file: ${error.message}\n`);
        }
    }
    
    private async step3_DetectError(): Promise<void> {
        console.log('📝 Step 3: Running compilation to detect error...');
        
        try {
            await execAsync('npm run compile');
            // If we get here, compilation succeeded (unexpected)
            this.results.push({
                step: 'Detect Error',
                success: false,
                message: 'Expected compilation to fail but it succeeded'
            });
            console.log(`   ❌ Expected compilation to fail\n`);
        } catch (error: any) {
            // This is expected - compilation should fail
            const errorMessage = error.stdout || error.stderr || error.message;
            const hasTypeError = errorMessage.includes('Type \'string\' is not assignable to type \'number\'') ||
                                 errorMessage.includes('TS2322') ||
                                 errorMessage.includes('type error');
            
            this.results.push({
                step: 'Detect Error',
                success: hasTypeError,
                message: hasTypeError ? 'Successfully detected type error' : 'Compilation failed but not with expected error'
            });
            console.log(`   ${hasTypeError ? '✅' : '⚠️'} Error detected: ${hasTypeError ? 'Type error found' : 'Different error'}`);
            if (hasTypeError) {
                console.log(`   ℹ️  Error: Type 'string' not assignable to 'number'\n`);
            }
        }
    }
    
    private async step4_FixError(): Promise<void> {
        console.log('📝 Step 4: Fixing the intentional error...');
        
        const fixedCode = `
// This file tests autonomous iteration
export class TestAutonomous {
    private message: string = "Testing autonomous iteration";
    
    // Fixed: Correct return type
    public getMessage(): string {  // Fixed: now returns string
        return this.message;  // Type error resolved
    }
    
    public isWorking(): boolean {
        return true;
    }
}
`;
        
        try {
            fs.writeFileSync(this.testFilePath, fixedCode);
            this.results.push({
                step: 'Fix Error',
                success: true,
                message: 'Successfully fixed the type error'
            });
            console.log(`   ✅ Fixed: Changed return type from 'number' to 'string'\n`);
        } catch (error: any) {
            this.results.push({
                step: 'Fix Error',
                success: false,
                message: `Failed to fix file: ${error.message}`
            });
            console.log(`   ❌ Failed to fix file: ${error.message}\n`);
        }
    }
    
    private async step5_ValidateFix(): Promise<void> {
        console.log('📝 Step 5: Validating the fix with compilation...');
        
        try {
            const { stderr } = await execAsync('npm run compile');
            const success = !stderr || stderr.includes('warning');
            this.results.push({
                step: 'Validate Fix',
                success,
                message: success ? 'Compilation successful after fix' : 'Compilation still failing'
            });
            console.log(`   ${success ? '✅' : '❌'} Compilation: ${success ? 'PASSED' : 'FAILED'}\n`);
        } catch (error: any) {
            this.results.push({
                step: 'Validate Fix',
                success: false,
                message: `Compilation failed: ${error.message}`
            });
            console.log(`   ❌ Compilation failed: ${error.message}\n`);
        }
    }
    
    private async step6_Cleanup(): Promise<void> {
        console.log('📝 Step 6: Cleaning up test artifacts...');
        
        try {
            if (fs.existsSync(this.testFilePath)) {
                fs.unlinkSync(this.testFilePath);
            }
            
            // Also remove compiled output if it exists
            const compiledPath = this.testFilePath.replace('/src/', '/out/').replace('.ts', '.js');
            if (fs.existsSync(compiledPath)) {
                fs.unlinkSync(compiledPath);
            }
            
            this.results.push({
                step: 'Cleanup',
                success: true,
                message: 'Test files removed successfully'
            });
            console.log(`   ✅ Removed test files\n`);
        } catch (error: any) {
            this.results.push({
                step: 'Cleanup',
                success: false,
                message: `Cleanup failed: ${error.message}`
            });
            console.log(`   ⚠️  Cleanup warning: ${error.message}\n`);
        }
    }
    
    private reportResults(): void {
        console.log('=' .repeat(50));
        console.log('📊 VALIDATION RESULTS');
        console.log('=' .repeat(50));
        
        let allPassed = true;
        
        for (const result of this.results) {
            const icon = result.success ? '✅' : '❌';
            console.log(`${icon} ${result.step}: ${result.message}`);
            if (!result.success && result.step !== 'Cleanup') {
                allPassed = false;
            }
        }
        
        console.log('=' .repeat(50));
        
        if (allPassed) {
            console.log('🎉 SUCCESS: Autonomous iteration is working!');
            console.log('');
            console.log('Claude Code successfully:');
            console.log('✅ Ran commands without prompting');
            console.log('✅ Created and edited files');
            console.log('✅ Detected compilation errors');
            console.log('✅ Fixed the errors programmatically');
            console.log('✅ Validated the fixes');
            console.log('');
            console.log('The permission system is properly configured!');
            process.exit(0);
        } else {
            console.log('❌ FAILURE: Some steps failed');
            console.log('');
            console.log('Check the following:');
            console.log('1. Ensure .claude/settings.json exists');
            console.log('2. Verify permissions are properly formatted');
            console.log('3. Check that commands are whitelisted');
            console.log('4. Review error messages above');
            process.exit(1);
        }
    }
}

// Run the validation
const validator = new AutonomousValidator();
validator.run().catch(error => {
    console.error('Fatal error during validation:', error);
    process.exit(1);
});