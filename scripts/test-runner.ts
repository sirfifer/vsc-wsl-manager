#!/usr/bin/env node

/**
 * Unified Test Runner for VSC WSL Manager
 *
 * Ensures identical test execution between local development and CI/CD.
 * This is the single source of truth for running tests.
 *
 * Author: Marcus Johnson, QA Manager
 *
 * Usage:
 *   npm run test:runner           # Run all tests
 *   npm run test:runner unit       # Run unit tests only
 *   npm run test:runner -- --ci    # Run in CI mode
 */

import { spawn, SpawnOptions } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { Command } from 'commander';

interface TestResult {
    name: string;
    passed: boolean;
    duration: number;
    coverage?: CoverageResult;
    error?: string;
}

interface CoverageResult {
    lines: number;
    branches: number;
    functions: number;
    statements: number;
}

interface TestConfig {
    type: 'unit' | 'integration' | 'e2e' | 'security' | 'all';
    coverage: boolean;
    watch: boolean;
    ci: boolean;
    threshold: number;
    verbose: boolean;
    parallel: boolean;
    failFast: boolean;
}

class TestRunner {
    private results: TestResult[] = [];
    private startTime: number = Date.now();
    private config: TestConfig;

    constructor(config: TestConfig) {
        this.config = config;
        this.printHeader();
    }

    private printHeader(): void {
        console.log(chalk.cyan('═'.repeat(60)));
        console.log(chalk.cyan.bold('   VSC WSL Manager - Unified Test Runner'));
        console.log(chalk.gray(`   Mode: ${this.config.ci ? 'CI/CD' : 'Local'} | Type: ${this.config.type}`));
        console.log(chalk.cyan('═'.repeat(60)));
        console.log();
    }

    /**
     * Run all test suites based on configuration
     */
    async run(): Promise<boolean> {
        try {
            // Pre-flight checks
            await this.preFlightChecks();

            // Run tests based on type
            if (this.config.type === 'all') {
                await this.runAllTests();
            } else {
                await this.runTestSuite(this.config.type);
            }

            // Generate reports
            if (this.config.coverage) {
                await this.generateCoverageReport();
            }

            // Print summary
            this.printSummary();

            // Check if all tests passed
            return this.allTestsPassed();
        } catch (error) {
            console.error(chalk.red('Test runner failed:'), error);
            return false;
        }
    }

    /**
     * Pre-flight checks before running tests
     */
    private async preFlightChecks(): Promise<void> {
        console.log(chalk.blue('🔍 Running pre-flight checks...'));

        // Check Node version
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
        if (majorVersion < 18) {
            throw new Error(`Node.js 18+ required. Current: ${nodeVersion}`);
        }

        // Check if compiled
        if (!fs.existsSync(path.join(process.cwd(), 'out'))) {
            console.log(chalk.yellow('⚠️  No compiled output found. Running compile...'));
            await this.execute('npm', ['run', 'compile']);
        }

        // Clean test cache if in CI mode
        if (this.config.ci) {
            console.log(chalk.blue('🧹 Clearing test cache (CI mode)...'));
            await this.execute('npx', ['jest', '--clearCache']);
        }

        console.log(chalk.green('✅ Pre-flight checks passed\n'));
    }

    /**
     * Run all test suites
     */
    private async runAllTests(): Promise<void> {
        const suites = ['unit', 'integration', 'security', 'e2e'];

        for (const suite of suites) {
            if (this.config.failFast && !this.allTestsPassed()) {
                console.log(chalk.yellow(`⏭️  Skipping ${suite} tests (fail-fast mode)`));
                continue;
            }
            await this.runTestSuite(suite as any);
        }
    }

    /**
     * Run a specific test suite
     */
    private async runTestSuite(type: string): Promise<void> {
        const startTime = Date.now();
        console.log(chalk.blue(`\n🧪 Running ${type} tests...`));

        let command: string;
        let args: string[] = [];

        switch (type) {
            case 'unit':
                command = 'npx';
                args = ['jest', 'test/unit'];
                break;

            case 'integration':
                command = 'npx';
                args = ['jest', 'test/integration'];
                break;

            case 'security':
                command = 'npx';
                args = ['jest', 'test/security'];
                break;

            case 'e2e':
                if (process.platform === 'win32') {
                    command = 'npm';
                    args = ['run', 'test:e2e:windows'];
                } else {
                    command = 'npx';
                    args = ['wdio', 'run', 'wdio.conf.ts'];
                }
                break;

            default:
                throw new Error(`Unknown test type: ${type}`);
        }

        // Add common Jest flags
        if (type !== 'e2e') {
            if (this.config.coverage) {
                args.push('--coverage');
            }
            if (this.config.verbose) {
                args.push('--verbose');
            }
            if (this.config.watch) {
                args.push('--watch');
            }
            if (this.config.ci) {
                args.push('--ci');
                args.push('--runInBand'); // Disable parallelization in CI
                args.push('--no-cache');
            }
        }

        try {
            await this.execute(command, args);

            this.results.push({
                name: type,
                passed: true,
                duration: Date.now() - startTime
            });

            console.log(chalk.green(`✅ ${type} tests passed`));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.results.push({
                name: type,
                passed: false,
                duration: Date.now() - startTime,
                error: errorMessage
            });

            console.log(chalk.red(`❌ ${type} tests failed`));

            if (this.config.failFast) {
                throw error;
            }
        }
    }

    /**
     * Generate coverage report
     */
    private async generateCoverageReport(): Promise<void> {
        console.log(chalk.blue('\n📊 Generating coverage report...'));

        const coverageFile = path.join(process.cwd(), 'coverage', 'coverage-summary.json');

        if (!fs.existsSync(coverageFile)) {
            console.log(chalk.yellow('⚠️  No coverage data found'));
            return;
        }

        const coverageData = JSON.parse(fs.readFileSync(coverageFile, 'utf-8'));
        const total = coverageData.total;

        // Display coverage
        console.log(chalk.cyan('\nCoverage Summary:'));
        console.log('─'.repeat(40));

        this.printCoverageMetric('Lines', total.lines.pct);
        this.printCoverageMetric('Branches', total.branches.pct);
        this.printCoverageMetric('Functions', total.functions.pct);
        this.printCoverageMetric('Statements', total.statements.pct);

        console.log('─'.repeat(40));

        // Check thresholds
        const failed = this.checkCoverageThresholds(total);

        if (failed.length > 0) {
            console.log(chalk.red('\n❌ Coverage thresholds not met:'));
            failed.forEach(metric => {
                console.log(chalk.red(`  - ${metric}`));
            });

            if (this.config.ci) {
                throw new Error('Coverage thresholds not met');
            }
        } else {
            console.log(chalk.green('\n✅ All coverage thresholds met'));
        }

        // Generate HTML report
        if (!this.config.ci) {
            console.log(chalk.gray('\n📄 HTML report: coverage/index.html'));
        }
    }

    /**
     * Print coverage metric with color coding
     */
    private printCoverageMetric(name: string, value: number): void {
        const color = value >= this.config.threshold ? chalk.green :
                      value >= this.config.threshold * 0.9 ? chalk.yellow :
                      chalk.red;

        const bar = this.createProgressBar(value);
        console.log(`  ${name.padEnd(12)} ${bar} ${color(value.toFixed(2) + '%')}`);
    }

    /**
     * Create a visual progress bar
     */
    private createProgressBar(percentage: number): string {
        const width = 20;
        const filled = Math.round((percentage / 100) * width);
        const empty = width - filled;

        return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    }

    /**
     * Check coverage thresholds
     */
    private checkCoverageThresholds(coverage: any): string[] {
        const failed: string[] = [];
        const threshold = this.config.threshold;

        if (coverage.lines.pct < threshold) {
            failed.push(`Lines: ${coverage.lines.pct}% < ${threshold}%`);
        }
        if (coverage.branches.pct < threshold) {
            failed.push(`Branches: ${coverage.branches.pct}% < ${threshold}%`);
        }
        if (coverage.functions.pct < threshold) {
            failed.push(`Functions: ${coverage.functions.pct}% < ${threshold}%`);
        }
        if (coverage.statements.pct < threshold) {
            failed.push(`Statements: ${coverage.statements.pct}% < ${threshold}%`);
        }

        return failed;
    }

    /**
     * Print test execution summary
     */
    private printSummary(): void {
        const duration = Date.now() - this.startTime;
        const passed = this.results.filter(r => r.passed).length;
        const failed = this.results.filter(r => !r.passed).length;
        const total = this.results.length;

        console.log(chalk.cyan('\n═'.repeat(60)));
        console.log(chalk.cyan.bold('   Test Execution Summary'));
        console.log(chalk.cyan('─'.repeat(60)));

        // Results
        console.log(`  Total Suites:  ${total}`);
        console.log(`  Passed:        ${chalk.green(passed)}`);
        console.log(`  Failed:        ${failed > 0 ? chalk.red(failed) : '0'}`);
        console.log(`  Duration:      ${this.formatDuration(duration)}`);

        // Suite details
        console.log(chalk.cyan('─'.repeat(60)));
        console.log('  Suite Results:');

        this.results.forEach(result => {
            const icon = result.passed ? '✅' : '❌';
            const name = result.name.padEnd(15);
            const time = this.formatDuration(result.duration).padStart(10);

            console.log(`    ${icon} ${name} ${chalk.gray(time)}`);

            if (result.error && this.config.verbose) {
                console.log(chalk.red(`       Error: ${result.error}`));
            }
        });

        console.log(chalk.cyan('═'.repeat(60)));

        // Final result
        if (this.allTestsPassed()) {
            console.log(chalk.green.bold('\n🎉 All tests passed!'));
        } else {
            console.log(chalk.red.bold('\n💥 Tests failed!'));

            if (this.config.ci) {
                process.exit(1);
            }
        }
    }

    /**
     * Check if all tests passed
     */
    private allTestsPassed(): boolean {
        return this.results.every(r => r.passed);
    }

    /**
     * Format duration for display
     */
    private formatDuration(ms: number): string {
        if (ms < 1000) {
            return `${ms}ms`;
        } else if (ms < 60000) {
            return `${(ms / 1000).toFixed(1)}s`;
        } else {
            const minutes = Math.floor(ms / 60000);
            const seconds = ((ms % 60000) / 1000).toFixed(0);
            return `${minutes}m ${seconds}s`;
        }
    }

    /**
     * Execute a command
     */
    private execute(command: string, args: string[]): Promise<void> {
        return new Promise((resolve, reject) => {
            const options: SpawnOptions = {
                stdio: 'inherit',
                shell: true,
                env: {
                    ...process.env,
                    FORCE_COLOR: '1'
                }
            };

            const proc = spawn(command, args, options);

            proc.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Command failed with code ${code}`));
                }
            });

            proc.on('error', (error) => {
                reject(error);
            });
        });
    }
}

/**
 * CLI Configuration
 */
const program = new Command();

program
    .name('test-runner')
    .description('Unified test runner for VSC WSL Manager')
    .version('1.0.0')
    .argument('[type]', 'Test type to run', 'all')
    .option('-c, --coverage', 'Generate coverage report', true)
    .option('-w, --watch', 'Run in watch mode', false)
    .option('--ci', 'Run in CI mode', false)
    .option('-t, --threshold <number>', 'Coverage threshold', '80')
    .option('-v, --verbose', 'Verbose output', false)
    .option('-p, --parallel', 'Run tests in parallel', true)
    .option('--fail-fast', 'Stop on first failure', false)
    .option('--no-coverage', 'Skip coverage reporting')
    .action(async (type, options) => {
        // Validate test type
        const validTypes = ['unit', 'integration', 'e2e', 'security', 'all'];
        if (!validTypes.includes(type)) {
            console.error(chalk.red(`Invalid test type: ${type}`));
            console.log(`Valid types: ${validTypes.join(', ')}`);
            process.exit(1);
        }

        // Create config
        const config: TestConfig = {
            type: type as any,
            coverage: options.coverage,
            watch: options.watch,
            ci: options.ci || process.env.CI === 'true',
            threshold: parseInt(options.threshold),
            verbose: options.verbose,
            parallel: options.parallel && !options.ci,
            failFast: options.failFast
        };

        // Run tests
        const runner = new TestRunner(config);
        const success = await runner.run();

        // Exit with appropriate code
        process.exit(success ? 0 : 1);
    });

// Parse arguments
program.parse();

// Export for use in other scripts
export { TestRunner, TestConfig };