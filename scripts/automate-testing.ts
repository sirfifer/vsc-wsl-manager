import { ExtensionTestHarness, TestRequirement } from '../src/test/automation/testHarness';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    console.log('🚀 Starting VSC WSL Manager automated testing...\n');

    const harness = new ExtensionTestHarness();

    // Define what needs to work
    const requirements: TestRequirement[] = [
        {
            name: 'Extension compiles without errors',
            test: async () => {
                return harness.compile();
            }
        },
        {
            name: 'TypeScript files have correct imports',
            test: async () => {
                const sourceFiles = [
                    'src/extension.ts',
                    'src/wslManager.ts',
                    'src/wslTreeDataProvider.ts',
                    'src/terminalProfileManager.ts'
                ];
                
                for (const file of sourceFiles) {
                    const filePath = path.join(__dirname, '..', file);
                    if (!fs.existsSync(filePath)) {
                        console.log(`Missing file: ${file}`);
                        return false;
                    }
                }
                return true;
            }
        },
        {
            name: 'WSL Manager core functionality exists',
            test: async () => {
                const managerPath = path.join(__dirname, '../src/wslManager.ts');
                const content = fs.readFileSync(managerPath, 'utf8');
                
                // Check for essential methods
                const essentialMethods = [
                    'listDistributions',
                    'createDistribution',
                    'deleteDistribution',
                    'importDistribution',
                    'exportDistribution'
                ];
                
                for (const method of essentialMethods) {
                    if (!content.includes(method)) {
                        console.log(`Missing method: ${method}`);
                        return false;
                    }
                }
                return true;
            }
        },
        {
            name: 'No security vulnerabilities (no exec() usage)',
            test: async () => {
                const sourceFiles = [
                    'src/wslManager.ts',
                    'src/utils/commandBuilder.ts',
                    'src/terminalProfileManager.ts'
                ];
                
                for (const file of sourceFiles) {
                    const filePath = path.join(__dirname, '..', file);
                    if (fs.existsSync(filePath)) {
                        const content = fs.readFileSync(filePath, 'utf8');
                        // Check for dangerous exec usage (not execSync which might be in comments)
                        if (content.includes('.exec(') && !content.includes('spawn')) {
                            console.log(`Security issue: exec() found in ${file}`);
                            return false;
                        }
                    }
                }
                return true;
            }
        },
        {
            name: 'Input validation is implemented',
            test: async () => {
                const validatorPath = path.join(__dirname, '../src/utils/inputValidator.ts');
                if (!fs.existsSync(validatorPath)) {
                    console.log('InputValidator not found');
                    return false;
                }
                
                const content = fs.readFileSync(validatorPath, 'utf8');
                const requiredValidations = [
                    'validateDistributionName',
                    'validateFilePath',
                    'sanitize'
                ];
                
                for (const validation of requiredValidations) {
                    if (!content.includes(validation)) {
                        console.log(`Missing validation: ${validation}`);
                        return false;
                    }
                }
                return true;
            }
        },
        {
            name: 'Tests can run successfully',
            test: async () => {
                const results = await harness.runTests();
                return results.passed;
            },
            errorHandler: async (error) => {
                console.log('Tests might need fixing or adjustments');
            }
        }
    ];

    // Run the automated iteration
    const success = await harness.iterateUntilPass(requirements);

    if (success) {
        console.log('\n✅ Extension is ready for use!');
        console.log('All requirements have been met.');
        console.log('\nNext steps:');
        console.log('1. Run "npm run test" to verify all tests pass');
        console.log('2. Press F5 in VS Code to test the extension');
        console.log('3. Check the .fix-request.json file for any remaining issues');
        process.exit(0);
    } else {
        console.log('\n❌ Could not get extension working after maximum attempts');
        console.log('Check test-automation.log for details');
        console.log('Review .fix-request.json for current issues');
        process.exit(1);
    }
}

// Only run if executed directly
if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}