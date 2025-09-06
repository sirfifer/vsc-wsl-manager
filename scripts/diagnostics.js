#!/usr/bin/env node

/**
 * Diagnostic tool for VSC WSL Manager
 * Generates comprehensive diagnostic reports for debugging
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

class DiagnosticsCollector {
    constructor() {
        this.report = [];
        this.timestamp = new Date().toISOString();
        this.outputDir = path.join(process.cwd(), 'diagnostics');
    }

    async run() {
        console.log('🔍 VSC WSL Manager Diagnostics');
        console.log('═'.repeat(50));
        console.log(`Timestamp: ${this.timestamp}\n`);

        // Create diagnostics directory
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }

        // Collect all diagnostics
        await this.collectSystemInfo();
        await this.collectExtensionInfo();
        await this.collectWSLInfo();
        await this.collectLogInfo();
        await this.collectTestInfo();
        await this.collectPerformanceInfo();
        await this.collectErrorInfo();

        // Save report
        const reportPath = this.saveReport();
        
        console.log('\n' + '═'.repeat(50));
        console.log(`✅ Diagnostic report saved to: ${reportPath}`);
        console.log('\nSummary:');
        this.printSummary();
    }

    async collectSystemInfo() {
        console.log('📊 Collecting system information...');
        
        this.addSection('System Information');
        this.addData('Platform', process.platform);
        this.addData('Architecture', process.arch);
        this.addData('Node Version', process.version);
        this.addData('NPM Version', this.getCommandOutput('npm --version'));
        this.addData('OS Release', os.release());
        this.addData('Total Memory', `${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`);
        this.addData('Free Memory', `${Math.round(os.freemem() / 1024 / 1024 / 1024)}GB`);
        this.addData('CPU Count', os.cpus().length);
        this.addData('Home Directory', os.homedir());
        this.addData('Temp Directory', os.tmpdir());
    }

    async collectExtensionInfo() {
        console.log('🧩 Collecting extension information...');
        
        this.addSection('Extension Information');
        
        // Read package.json
        try {
            const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            this.addData('Extension Name', packageJson.name);
            this.addData('Version', packageJson.version);
            this.addData('Display Name', packageJson.displayName);
            this.addData('VS Code Engine', packageJson.engines.vscode);
        } catch (error) {
            this.addData('Package Info', `Error: ${error.message}`);
        }

        // Check compiled output
        const outDir = path.join(process.cwd(), 'out');
        if (fs.existsSync(outDir)) {
            const files = fs.readdirSync(outDir);
            this.addData('Compiled Files', files.length);
            this.addData('Last Compilation', this.getFileModTime(path.join(outDir, 'extension.js')));
        } else {
            this.addData('Compiled Output', 'Not found - run "npm run compile"');
        }

        // Check TypeScript config
        if (fs.existsSync('tsconfig.json')) {
            const tsConfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8'));
            this.addData('TypeScript Target', tsConfig.compilerOptions.target);
            this.addData('TypeScript Module', tsConfig.compilerOptions.module);
            this.addData('Source Map', tsConfig.compilerOptions.sourceMap);
        }
    }

    async collectWSLInfo() {
        console.log('🐧 Collecting WSL information...');
        
        this.addSection('WSL Information');
        
        if (process.platform === 'win32') {
            try {
                // Check WSL version
                const wslVersion = this.getCommandOutput('wsl --version');
                this.addData('WSL Version', wslVersion);

                // List distributions
                const distributions = this.getCommandOutput('wsl --list --verbose');
                this.addData('Distributions', distributions);

                // Check default distribution
                const defaultDist = this.getCommandOutput('wsl --list --verbose | findstr "*"');
                this.addData('Default Distribution', defaultDist);
            } catch (error) {
                this.addData('WSL Status', 'Not available or not installed');
            }
        } else {
            this.addData('WSL Status', 'Not applicable (not Windows)');
        }
    }

    async collectLogInfo() {
        console.log('📝 Collecting log information...');
        
        this.addSection('Logging Information');
        
        const logDir = path.join(os.homedir(), 'vsc-wsl-manager', 'logs');
        
        if (fs.existsSync(logDir)) {
            const logFiles = fs.readdirSync(logDir)
                .filter(f => f.endsWith('.log'))
                .sort((a, b) => {
                    const statA = fs.statSync(path.join(logDir, a));
                    const statB = fs.statSync(path.join(logDir, b));
                    return statB.mtime - statA.mtime;
                });

            this.addData('Log Directory', logDir);
            this.addData('Log Files', logFiles.length);
            
            if (logFiles.length > 0) {
                const recentLog = logFiles[0];
                const logPath = path.join(logDir, recentLog);
                const stats = fs.statSync(logPath);
                
                this.addData('Most Recent Log', recentLog);
                this.addData('Log Size', `${Math.round(stats.size / 1024)}KB`);
                
                // Count log levels in recent log
                const content = fs.readFileSync(logPath, 'utf8');
                const lines = content.split('\n');
                const errorCount = lines.filter(l => l.includes('[ERROR]')).length;
                const warnCount = lines.filter(l => l.includes('[WARN]')).length;
                
                this.addData('Recent Errors', errorCount);
                this.addData('Recent Warnings', warnCount);
                
                // Get last few errors
                if (errorCount > 0) {
                    const errors = lines
                        .filter(l => l.includes('[ERROR]'))
                        .slice(-3)
                        .map(l => l.substring(l.indexOf('[ERROR]') + 7).trim());
                    
                    this.addSubSection('Recent Error Messages');
                    errors.forEach(err => this.addData('', err));
                }
            }
        } else {
            this.addData('Log Directory', 'Not found');
        }
    }

    async collectTestInfo() {
        console.log('🧪 Collecting test information...');
        
        this.addSection('Test Information');
        
        try {
            // Get test statistics
            const testOutput = this.getCommandOutput('npm test -- --listTests --json', true);
            const testFiles = testOutput.split('\n').filter(l => l.trim());
            
            this.addData('Total Test Files', testFiles.length);
            this.addData('Unit Tests', testFiles.filter(f => f.includes('/unit/')).length);
            this.addData('Integration Tests', testFiles.filter(f => f.includes('/integration/')).length);
            this.addData('Security Tests', testFiles.filter(f => f.includes('/security/')).length);
        } catch (error) {
            this.addData('Test Status', 'Unable to collect test information');
        }

        // Check coverage
        const coverageDir = path.join(process.cwd(), 'coverage');
        if (fs.existsSync(coverageDir)) {
            const summaryPath = path.join(coverageDir, 'coverage-summary.json');
            if (fs.existsSync(summaryPath)) {
                try {
                    const coverage = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
                    const total = coverage.total;
                    
                    this.addSubSection('Test Coverage');
                    this.addData('Lines', `${total.lines.pct}%`);
                    this.addData('Statements', `${total.statements.pct}%`);
                    this.addData('Functions', `${total.functions.pct}%`);
                    this.addData('Branches', `${total.branches.pct}%`);
                } catch (error) {
                    this.addData('Coverage', 'Error reading coverage data');
                }
            }
        }
    }

    async collectPerformanceInfo() {
        console.log('⚡ Collecting performance information...');
        
        this.addSection('Performance Metrics');
        
        // Memory usage
        const memUsage = process.memoryUsage();
        this.addData('Heap Used', `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
        this.addData('Heap Total', `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`);
        this.addData('RSS', `${Math.round(memUsage.rss / 1024 / 1024)}MB`);
        
        // Build performance
        console.log('  Testing compilation speed...');
        const compileStart = Date.now();
        try {
            execSync('npm run compile', { stdio: 'ignore' });
            const compileTime = Date.now() - compileStart;
            this.addData('Compile Time', `${compileTime}ms`);
        } catch (error) {
            this.addData('Compile Time', 'Failed to compile');
        }
    }

    async collectErrorInfo() {
        console.log('❌ Collecting error information...');
        
        this.addSection('Error Analysis');
        
        // Check for TypeScript errors
        try {
            const tscOutput = execSync('npx tsc --noEmit', { encoding: 'utf8', stdio: 'pipe' });
            this.addData('TypeScript Errors', 'None');
        } catch (error) {
            const errors = error.stdout || error.message;
            const errorCount = (errors.match(/error TS/g) || []).length;
            this.addData('TypeScript Errors', errorCount);
            
            if (errorCount > 0 && errorCount <= 5) {
                this.addSubSection('TypeScript Error Details');
                const errorLines = errors.split('\n').filter(l => l.includes('error TS'));
                errorLines.slice(0, 5).forEach(err => this.addData('', err.trim()));
            }
        }

        // Check for ESLint issues
        try {
            const eslintOutput = execSync('npm run lint', { encoding: 'utf8', stdio: 'pipe' });
            this.addData('ESLint Issues', 'None');
        } catch (error) {
            const output = error.stdout || '';
            const problems = output.match(/(\d+) problems?/);
            if (problems) {
                this.addData('ESLint Issues', problems[1]);
            }
        }
    }

    getCommandOutput(command, silent = false) {
        try {
            return execSync(command, { encoding: 'utf8', stdio: silent ? 'pipe' : undefined }).trim();
        } catch (error) {
            return 'N/A';
        }
    }

    getFileModTime(filePath) {
        try {
            const stats = fs.statSync(filePath);
            return stats.mtime.toISOString();
        } catch {
            return 'File not found';
        }
    }

    addSection(title) {
        this.report.push(`\n## ${title}`);
        this.report.push('');
    }

    addSubSection(title) {
        this.report.push(`\n### ${title}`);
        this.report.push('');
    }

    addData(key, value) {
        if (key) {
            this.report.push(`- **${key}**: ${value}`);
        } else {
            this.report.push(`  - ${value}`);
        }
    }

    saveReport() {
        const filename = `diagnostic-report-${this.timestamp.replace(/[:.]/g, '-')}.md`;
        const filepath = path.join(this.outputDir, filename);
        
        const content = [
            '# VSC WSL Manager Diagnostic Report',
            `Generated: ${this.timestamp}`,
            ...this.report
        ].join('\n');

        fs.writeFileSync(filepath, content);
        
        // Also save as latest.md for easy access
        const latestPath = path.join(this.outputDir, 'latest.md');
        fs.writeFileSync(latestPath, content);
        
        return filepath;
    }

    printSummary() {
        // Print a quick summary to console
        const issues = [];
        
        if (this.report.includes('TypeScript Errors: 0') === false) {
            issues.push('⚠️ TypeScript errors detected');
        }
        
        if (this.report.includes('ESLint Issues: None') === false) {
            issues.push('⚠️ ESLint issues found');
        }
        
        if (!fs.existsSync('out/extension.js')) {
            issues.push('❌ Extension not compiled');
        }
        
        if (issues.length === 0) {
            console.log('✅ No critical issues detected');
        } else {
            console.log('Issues found:');
            issues.forEach(issue => console.log(`  ${issue}`));
        }
    }
}

// Run diagnostics
const collector = new DiagnosticsCollector();
collector.run().catch(error => {
    console.error('❌ Diagnostics failed:', error.message);
    process.exit(1);
});