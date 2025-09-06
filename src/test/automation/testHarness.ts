import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface TestRequirement {
    name: string;
    test: () => Promise<boolean>;
    errorHandler?: (error: any) => Promise<void>;
}

export class ExtensionTestHarness {
    private attempts = 0;
    private maxAttempts = 50;
    private logFile: string;

    constructor() {
        this.logFile = path.join(__dirname, '../../../test-automation.log');
    }

    private log(message: string) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}\n`;
        fs.appendFileSync(this.logFile, logMessage);
        console.log(message);
    }

    async compile(): Promise<boolean> {
        try {
            this.log('Compiling TypeScript...');
            const { stdout, stderr } = await execAsync('npm run compile');
            if (stderr && !stderr.includes('warning')) {
                this.log(`Compilation errors: ${stderr}`);
                return false;
            }
            this.log('Compilation successful');
            return true;
        } catch (error) {
            this.log(`Compilation failed: ${error}`);
            return false;
        }
    }

    async runTests(): Promise<{ passed: boolean; errors: string[] }> {
        try {
            this.log('Running tests...');
            const { stdout, stderr } = await execAsync('npm test');
            const passed = !stderr && stdout.includes('passing');
            
            return {
                passed,
                errors: stderr ? [stderr] : []
            };
        } catch (error: any) {
            return {
                passed: false,
                errors: [error.message]
            };
        }
    }

    async testRequirement(req: TestRequirement): Promise<boolean> {
        try {
            this.log(`Testing requirement: ${req.name}`);
            const result = await req.test();
            if (result) {
                this.log(`✓ ${req.name} passed`);
            } else {
                this.log(`✗ ${req.name} failed`);
            }
            return result;
        } catch (error: any) {
            this.log(`✗ ${req.name} error: ${error.message}`);
            if (req.errorHandler) {
                await req.errorHandler(error);
            }
            return false;
        }
    }

    async iterateUntilPass(requirements: TestRequirement[]): Promise<boolean> {
        this.log('Starting automated iteration process...');
        
        while (this.attempts < this.maxAttempts) {
            this.attempts++;
            this.log(`\n=== Iteration ${this.attempts} ===`);

            // Step 1: Compile
            const compiled = await this.compile();
            if (!compiled) {
                this.log('Compilation failed, need to fix syntax errors');
                // Claude Code would fix compilation errors here
                await this.sleep(2000);
                continue;
            }

            // Step 2: Run tests
            const testResults = await this.runTests();
            
            // Step 3: Check requirements
            let allPassed = true;
            for (const req of requirements) {
                const passed = await this.testRequirement(req);
                if (!passed) {
                    allPassed = false;
                }
            }

            if (allPassed) {
                this.log('\n🎉 All requirements met! Extension is working!');
                return true;
            }

            // Step 4: Analyze failures and prompt for fixes
            this.log('\nSome requirements not met. Analyzing failures...');
            await this.analyzeFailures(testResults.errors);

            // Give Claude Code time to make fixes
            await this.sleep(3000);
        }

        this.log(`\nMax attempts (${this.maxAttempts}) reached without success`);
        return false;
    }

    private async analyzeFailures(errors: string[]) {
        this.log('\nError Analysis:');
        errors.forEach((error, i) => {
            this.log(`Error ${i + 1}: ${error}`);
        });
        
        // Create a fix request file for Claude Code
        const fixRequest = {
            iteration: this.attempts,
            errors: errors,
            timestamp: new Date().toISOString(),
            suggestions: this.generateFixSuggestions(errors)
        };
        
        fs.writeFileSync(
            path.join(__dirname, '../../../.fix-request.json'),
            JSON.stringify(fixRequest, null, 2)
        );
        
        this.log('Fix request written to .fix-request.json');
    }

    private generateFixSuggestions(errors: string[]): string[] {
        const suggestions: string[] = [];
        
        for (const error of errors) {
            if (error.includes('Cannot find module')) {
                suggestions.push('Check import statements and file paths');
            }
            if (error.includes('spawn') || error.includes('exec')) {
                suggestions.push('Ensure CommandBuilder is using spawn() not exec()');
            }
            if (error.includes('undefined') || error.includes('null')) {
                suggestions.push('Add null checks and initialization');
            }
            if (error.includes('timeout')) {
                suggestions.push('Increase timeout values or optimize async operations');
            }
        }
        
        return suggestions;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}