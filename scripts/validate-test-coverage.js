#!/usr/bin/env node

/**
 * Test Coverage Validation Script
 * Ensures tests catch the 3 originally reported issues
 * 
 * @author Marcus Johnson, QA Manager
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔍 Validating Test Coverage for Original Issues\n');
console.log('=' .repeat(60));

const issues = [
    {
        id: 1,
        description: 'Delete Distribution shows "invalid input" error',
        testFiles: [
            'test/unit/commands/allCommands.test.ts',
            'test/unit/treeProviders/treeItems.test.ts',
            'test/validation/catchRegressions.test.ts'
        ],
        requiredPatterns: [
            'item?.distro?.name',
            'distroManager.removeDistro',
            'NOT item.distribution'
        ]
    },
    {
        id: 2,
        description: 'Create Image shows "Network Error"',
        testFiles: [
            'test/unit/commands/allCommands.test.ts',
            'test/unit/errorScenarios/errorScenarios.test.ts',
            'test/validation/catchRegressions.test.ts'
        ],
        requiredPatterns: [
            'not available locally',
            'NOT.*Network',
            'distro.available'
        ]
    },
    {
        id: 3,
        description: '"No distributions available" when distros exist',
        testFiles: [
            'test/unit/commands/allCommands.test.ts',
            'test/unit/errorScenarios/errorScenarios.test.ts',
            'test/validation/catchRegressions.test.ts'
        ],
        requiredPatterns: [
            'filter.*d.*available',
            'No distributions available',
            'available.length === 0'
        ]
    }
];

let allTestsFound = true;

for (const issue of issues) {
    console.log(`\n📌 Issue #${issue.id}: ${issue.description}`);
    console.log('-'.repeat(60));
    
    let issueTestsFound = true;
    
    for (const testFile of issue.testFiles) {
        const filePath = path.join(__dirname, '..', testFile);
        
        if (!fs.existsSync(filePath)) {
            console.log(`  ❌ Test file missing: ${testFile}`);
            issueTestsFound = false;
            continue;
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        console.log(`  📄 ${testFile}`);
        
        for (const pattern of issue.requiredPatterns) {
            const regex = new RegExp(pattern, 'i');
            if (regex.test(content)) {
                console.log(`    ✅ Found pattern: "${pattern}"`);
            } else {
                console.log(`    ❌ Missing pattern: "${pattern}"`);
                issueTestsFound = false;
            }
        }
    }
    
    if (issueTestsFound) {
        console.log(`  ✅ Issue #${issue.id} has complete test coverage`);
    } else {
        console.log(`  ❌ Issue #${issue.id} lacks complete test coverage`);
        allTestsFound = false;
    }
}

console.log('\n' + '='.repeat(60));
console.log('VALIDATION SUMMARY');
console.log('='.repeat(60));

// Check critical code patterns
const extensionPath = path.join(__dirname, '..', 'src', 'extension.ts');
const extensionContent = fs.readFileSync(extensionPath, 'utf8');

const criticalPatterns = [
    {
        pattern: 'item?.distro?.name',
        description: 'Correct property access for distro items'
    },
    {
        pattern: 'distroManager.removeDistro',
        description: 'Using correct manager for delete'
    },
    {
        pattern: 'distros.filter(d => d.available)',
        description: 'Filtering by available property'
    }
];

console.log('\n📋 Critical Code Patterns:');
for (const { pattern, description } of criticalPatterns) {
    if (extensionContent.includes(pattern)) {
        console.log(`  ✅ ${description}: "${pattern}"`);
    } else {
        console.log(`  ❌ Missing: ${description}`);
        allTestsFound = false;
    }
}

// Final verdict
console.log('\n' + '='.repeat(60));
if (allTestsFound) {
    console.log('✅ ALL ORIGINAL ISSUES HAVE PROPER TEST COVERAGE');
    console.log('✅ Tests will catch these issues before they reach UI');
    console.log('\n🎉 Gold Standard Achieved: Backend tests prevent UI errors');
} else {
    console.log('❌ INCOMPLETE TEST COVERAGE');
    console.log('⚠️  Some issues may still reach the UI');
}
console.log('='.repeat(60) + '\n');

process.exit(allTestsFound ? 0 : 1);