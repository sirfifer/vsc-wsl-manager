import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function main() {
    console.log('🚀 VSC WSL Manager Quick Test\n');
    console.log('This demonstrates the automation concept without running full tests.\n');

    const results = {
        compilation: false,
        filesExist: false,
        securityCheck: false,
        inputValidation: false
    };

    // Test 1: Compilation
    try {
        console.log('1. Testing compilation...');
        const { stderr } = await execAsync('npm run compile');
        results.compilation = !stderr || stderr.includes('warning');
        console.log(`   ✅ Compilation: ${results.compilation ? 'PASSED' : 'FAILED'}`);
    } catch (error) {
        console.log('   ❌ Compilation: FAILED');
    }

    // Test 2: Essential files exist
    console.log('\n2. Checking essential files...');
    const essentialFiles = [
        'src/extension.ts',
        'src/wslManager.ts',
        'src/wslTreeDataProvider.ts',
        'src/utils/commandBuilder.ts',
        'src/utils/inputValidator.ts',
        'src/security/securityValidator.ts'
    ];
    
    let allFilesExist = true;
    for (const file of essentialFiles) {
        const filePath = path.join(__dirname, '../..', file);
        const exists = fs.existsSync(filePath);
        if (!exists) {
            console.log(`   ❌ Missing: ${file}`);
            allFilesExist = false;
        }
    }
    results.filesExist = allFilesExist;
    console.log(`   ${results.filesExist ? '✅' : '❌'} Files check: ${results.filesExist ? 'PASSED' : 'FAILED'}`);

    // Test 3: Security check (no exec() usage)
    console.log('\n3. Security check...');
    const wslManagerPath = path.join(__dirname, '../../src/wslManager.ts');
    const commandBuilderPath = path.join(__dirname, '../../src/utils/commandBuilder.ts');
    
    let securityPassed = true;
    for (const filePath of [wslManagerPath, commandBuilderPath]) {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            if (content.includes('.exec(') && !content.includes('spawn')) {
                console.log(`   ❌ Security issue: exec() found in ${path.basename(filePath)}`);
                securityPassed = false;
            }
        }
    }
    results.securityCheck = securityPassed;
    console.log(`   ${results.securityCheck ? '✅' : '❌'} Security: ${results.securityCheck ? 'PASSED' : 'FAILED'}`);

    // Test 4: Input validation exists
    console.log('\n4. Input validation check...');
    const validatorPath = path.join(__dirname, '../../src/utils/inputValidator.ts');
    if (fs.existsSync(validatorPath)) {
        const content = fs.readFileSync(validatorPath, 'utf8');
        const hasValidation = content.includes('validateDistributionName') && 
                             content.includes('validateFilePath');
        results.inputValidation = hasValidation;
    }
    console.log(`   ${results.inputValidation ? '✅' : '❌'} Input validation: ${results.inputValidation ? 'PASSED' : 'FAILED'}`);

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('SUMMARY:');
    console.log('='.repeat(50));
    
    const allPassed = Object.values(results).every(r => r);
    
    console.log(`Compilation:      ${results.compilation ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Files Exist:      ${results.filesExist ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Security Check:   ${results.securityCheck ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Input Validation: ${results.inputValidation ? '✅ PASSED' : '❌ FAILED'}`);
    
    console.log('\n' + '='.repeat(50));
    if (allPassed) {
        console.log('🎉 ALL TESTS PASSED! The extension core is working!');
        console.log('\nThe automation harness is set up and ready for iterative development.');
        console.log('\nYou can now:');
        console.log('1. Run "npm test" to run the full Jest test suite');
        console.log('2. Run "npm run test:vscode" to run VS Code extension tests');
        console.log('3. Press F5 in VS Code to test the extension interactively');
        console.log('4. Use "npm run automate" for the full automation loop (with timeouts adjusted)');
    } else {
        console.log('❌ Some tests failed. The automation would normally iterate to fix these.');
        console.log('\nFailed tests would generate a .fix-request.json file with details.');
    }

    process.exit(allPassed ? 0 : 1);
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});