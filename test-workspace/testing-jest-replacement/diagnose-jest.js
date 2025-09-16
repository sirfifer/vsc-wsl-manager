#!/usr/bin/env node

/**
 * Jest Timeout Diagnostic Tool
 * Identifies the root cause and recommends the best solution
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);

class JestDiagnostic {
  constructor() {
    this.issues = [];
    this.nodeVersion = process.version;
    this.platform = process.platform;
    this.isWSL = this.detectWSL();
  }

  detectWSL() {
    try {
      return fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft');
    } catch {
      return false;
    }
  }

  log(emoji, message) {
    console.log(`${emoji} ${message}`);
  }

  async diagnose() {
    console.log('🔍 Jest Timeout Diagnostic Tool');
    console.log('================================\n');

    // 1. Check Node version
    await this.checkNodeVersion();

    // 2. Check Jest installation
    await this.checkJestInstallation();

    // 3. Check for conflicting configurations
    await this.checkConfigurations();

    // 4. Test basic Jest functionality
    await this.testJestFunctionality();

    // 5. Check WSL-specific issues
    if (this.isWSL) {
      await this.checkWSLIssues();
    }

    // 6. Analyze and recommend
    this.recommend();
  }

  async checkNodeVersion() {
    this.log('📌', `Node Version: ${this.nodeVersion}`);
    
    const major = parseInt(this.nodeVersion.split('.')[0].substring(1));
    
    if (major === 22) {
      this.issues.push({
        severity: 'critical',
        issue: 'Node v22 incompatibility',
        details: 'Jest 29.x has known issues with Node v22',
        solution: 'Switch to Node v20 LTS'
      });
      this.log('❌', 'Node v22 detected - Known Jest compatibility issues');
    } else if (major < 16) {
      this.issues.push({
        severity: 'critical',
        issue: 'Node version too old',
        details: `Node ${this.nodeVersion} is below minimum requirement`,
        solution: 'Upgrade to Node v18 or v20'
      });
      this.log('❌', 'Node version too old for Jest');
    } else {
      this.log('✅', `Node version compatible (v${major})`);
    }
  }

  async checkJestInstallation() {
    this.log('📌', 'Checking Jest Installation...');
    
    try {
      const jestPath = path.join(process.cwd(), 'node_modules', 'jest', 'package.json');
      const jestPkg = JSON.parse(fs.readFileSync(jestPath, 'utf8'));
      const version = jestPkg.version;
      
      this.log('✅', `Jest v${version} installed`);
      
      // Check for known problematic versions
      if (version.startsWith('29.')) {
        const { stdout } = await execAsync('npm ls jest', { encoding: 'utf8' });
        if (stdout.includes('UNMET')) {
          this.issues.push({
            severity: 'high',
            issue: 'Unmet Jest dependencies',
            details: 'Some Jest dependencies are not properly installed',
            solution: 'Run: rm -rf node_modules package-lock.json && npm install'
          });
          this.log('⚠️', 'Unmet dependencies detected');
        }
      }
    } catch (error) {
      this.issues.push({
        severity: 'critical',
        issue: 'Jest not installed',
        details: 'Jest is not found in node_modules',
        solution: 'Run: npm install --save-dev jest @types/jest ts-jest'
      });
      this.log('❌', 'Jest not installed');
    }
  }

  async checkConfigurations() {
    this.log('📌', 'Checking Configurations...');
    
    const configs = [
      'jest.config.js',
      'jest.config.ts',
      'jest.config.json'
    ];
    
    let configFound = false;
    for (const config of configs) {
      if (fs.existsSync(config)) {
        configFound = true;
        this.log('✅', `Found ${config}`);
        
        // Check for problematic settings
        const content = fs.readFileSync(config, 'utf8');
        if (content.includes('detectOpenHandles')) {
          this.issues.push({
            severity: 'medium',
            issue: 'detectOpenHandles can cause hangs',
            details: 'The detectOpenHandles option may cause Jest to hang',
            solution: 'Remove detectOpenHandles from Jest config'
          });
        }
      }
    }
    
    if (!configFound) {
      // Check package.json
      const pkgPath = path.join(process.cwd(), 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.jest) {
        this.log('✅', 'Jest config found in package.json');
      } else {
        this.log('⚠️', 'No Jest configuration found');
      }
    }
  }

  async testJestFunctionality() {
    this.log('📌', 'Testing Jest Functionality...');
    
    try {
      // Test 1: Jest version
      const versionResult = await this.execWithTimeout('npx jest --version', 5000);
      if (versionResult.success) {
        this.log('✅', 'Jest --version works');
      } else {
        this.issues.push({
          severity: 'critical',
          issue: 'Jest hangs on --version',
          details: 'Jest cannot even report its version',
          solution: 'Node version incompatibility - switch to Node v20'
        });
        this.log('❌', 'Jest --version hangs');
      }
      
      // Test 2: List tests
      const listResult = await this.execWithTimeout('npx jest --listTests', 5000);
      if (listResult.success) {
        this.log('✅', 'Jest --listTests works');
      } else {
        this.log('❌', 'Jest --listTests hangs');
      }
      
    } catch (error) {
      this.log('❌', `Jest test failed: ${error.message}`);
    }
  }

  async checkWSLIssues() {
    this.log('📌', 'Checking WSL-specific issues...');
    
    // Check if running in Windows filesystem
    const cwd = process.cwd();
    if (cwd.startsWith('/mnt/')) {
      this.issues.push({
        severity: 'high',
        issue: 'Running in Windows filesystem',
        details: 'WSL performance is degraded in /mnt paths',
        solution: 'Move project to Linux filesystem (e.g., ~/projects/)'
      });
      this.log('⚠️', 'Project in Windows filesystem - performance impact');
    }
    
    // Check WSL version
    try {
      const { stdout } = await execAsync('wsl.exe --list --verbose', { encoding: 'utf8' });
      if (stdout.includes('VERSION 1')) {
        this.issues.push({
          severity: 'medium',
          issue: 'WSL 1 detected',
          details: 'WSL 1 has known performance issues',
          solution: 'Upgrade to WSL 2: wsl --set-version <distro> 2'
        });
        this.log('⚠️', 'WSL 1 detected - consider upgrading to WSL 2');
      }
    } catch {
      // Not critical if we can't check
    }
  }

  async execWithTimeout(command, timeout) {
    return new Promise((resolve) => {
      const proc = exec(command, (error, stdout, stderr) => {
        clearTimeout(timer);
        resolve({ success: !error, stdout, stderr });
      });
      
      const timer = setTimeout(() => {
        proc.kill();
        resolve({ success: false, timeout: true });
      }, timeout);
    });
  }

  recommend() {
    console.log('\n📊 Diagnostic Results');
    console.log('====================\n');
    
    if (this.issues.length === 0) {
      this.log('✅', 'No issues detected!');
      this.log('💡', 'Try running: npm test');
      return;
    }
    
    // Sort issues by severity
    const criticalIssues = this.issues.filter(i => i.severity === 'critical');
    const highIssues = this.issues.filter(i => i.severity === 'high');
    const mediumIssues = this.issues.filter(i => i.severity === 'medium');
    
    if (criticalIssues.length > 0) {
      console.log('🚨 Critical Issues:');
      criticalIssues.forEach(issue => {
        console.log(`  • ${issue.issue}`);
        console.log(`    ${issue.details}`);
      });
    }
    
    if (highIssues.length > 0) {
      console.log('\n⚠️  High Priority Issues:');
      highIssues.forEach(issue => {
        console.log(`  • ${issue.issue}`);
        console.log(`    ${issue.details}`);
      });
    }
    
    if (mediumIssues.length > 0) {
      console.log('\n📌 Medium Priority Issues:');
      mediumIssues.forEach(issue => {
        console.log(`  • ${issue.issue}`);
      });
    }
    
    console.log('\n💡 Recommended Solutions');
    console.log('========================\n');
    
    // Determine primary recommendation
    const hasNodeV22Issue = this.issues.some(i => 
      i.issue.includes('Node v22')
    );
    
    if (hasNodeV22Issue) {
      console.log('🎯 PRIMARY SOLUTION: Switch to Node v20');
      console.log('   Run: ./fix-jest-timeout.sh');
      console.log('   Time: 5 minutes\n');
      
      console.log('🔄 ALTERNATIVE: Migrate to Vitest');
      console.log('   See: vitest-migration.md');
      console.log('   Time: 1 hour');
    } else {
      // Other recommendations based on issues
      const solutions = [...new Set(this.issues.map(i => i.solution))];
      solutions.forEach((solution, index) => {
        console.log(`${index + 1}. ${solution}`);
      });
    }
    
    console.log('\n📚 Additional Resources:');
    console.log('  • Quick Fix Script: ./fix-jest-timeout.sh');
    console.log('  • Solution Comparison: jest-solution-comparison.md');
    console.log('  • Vitest Migration: vitest-migration.md');
  }
}

// Run diagnostic
const diagnostic = new JestDiagnostic();
diagnostic.diagnose().catch(error => {
  console.error('❌ Diagnostic failed:', error.message);
  process.exit(1);
});