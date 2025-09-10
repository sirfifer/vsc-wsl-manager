#!/usr/bin/env node
/**
 * Log Analysis Tool
 * Parses debug logs to identify patterns, generate reports, and find crash causes
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

class LogAnalyzer {
    constructor(options = {}) {
        this.options = {
            logsDir: options.logsDir || path.join(__dirname, 'logs'),
            crashDir: options.crashDir || path.join(__dirname, 'crash-dumps'),
            pattern: options.pattern || null,
            sessionId: options.sessionId || null,
            file: options.file || null,
            ...options
        };

        this.stats = {
            totalLines: 0,
            levels: { DEBUG: 0, INFO: 0, WARN: 0, ERROR: 0, FATAL: 0 },
            errors: [],
            crashes: [],
            sessions: new Set(),
            events: [],
            patterns: {},
            timeline: []
        };
    }

    async analyze() {
        console.log('📊 Log Analyzer');
        console.log('='.repeat(60));

        // Get log files to analyze
        const logFiles = this.getLogFiles();
        
        if (logFiles.length === 0) {
            console.log('No log files found to analyze');
            return;
        }

        console.log(`Found ${logFiles.length} log file(s) to analyze\n`);

        // Analyze each log file
        for (const logFile of logFiles) {
            await this.analyzeLogFile(logFile);
        }

        // Analyze crash dumps
        this.analyzeCrashDumps();

        // Generate report
        return this.generateReport();
    }

    getLogFiles() {
        const files = [];

        if (this.options.file) {
            // Analyze specific file
            if (fs.existsSync(this.options.file)) {
                files.push(this.options.file);
            }
        } else {
            // Get all log files from directory
            try {
                const allFiles = fs.readdirSync(this.options.logsDir);
                const logFiles = allFiles
                    .filter(f => f.endsWith('.log'))
                    .map(f => path.join(this.options.logsDir, f))
                    .filter(f => fs.statSync(f).isFile());
                
                files.push(...logFiles);
            } catch (error) {
                console.error(`Error reading logs directory: ${error.message}`);
            }
        }

        return files;
    }

    async analyzeLogFile(filePath) {
        console.log(`Analyzing: ${path.basename(filePath)}`);

        const fileStream = fs.createReadStream(filePath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        for await (const line of rl) {
            this.stats.totalLines++;
            
            try {
                const entry = JSON.parse(line);
                this.processLogEntry(entry);
            } catch (error) {
                // Not JSON, might be plain text log
                this.processPlainTextLine(line);
            }
        }
    }

    processLogEntry(entry) {
        // Count by level
        if (entry.level && this.stats.levels[entry.level] !== undefined) {
            this.stats.levels[entry.level]++;
        }

        // Track sessions
        if (entry.sessionId) {
            this.stats.sessions.add(entry.sessionId);
        }

        // Filter by session if specified
        if (this.options.sessionId && entry.sessionId !== this.options.sessionId) {
            return;
        }

        // Apply pattern filter if specified
        if (this.options.pattern) {
            const regex = new RegExp(this.options.pattern, 'i');
            const matches = regex.test(entry.message) || 
                           regex.test(JSON.stringify(entry.data));
            if (!matches) return;
        }

        // Collect errors
        if (entry.level === 'ERROR' || entry.level === 'FATAL') {
            this.stats.errors.push({
                timestamp: entry.timestamp,
                level: entry.level,
                message: entry.message,
                data: entry.data,
                caller: entry.caller
            });
        }

        // Detect crashes
        if (entry.level === 'FATAL' || 
            (entry.message && entry.message.toLowerCase().includes('crash'))) {
            this.stats.crashes.push({
                timestamp: entry.timestamp,
                message: entry.message,
                data: entry.data
            });
        }

        // Track VS Code events
        if (entry.data && entry.data.vscode) {
            this.stats.events.push({
                timestamp: entry.timestamp,
                event: entry.data.event,
                data: entry.data
            });
        }

        // Track patterns
        this.detectPatterns(entry);

        // Build timeline
        if (entry.level === 'ERROR' || entry.level === 'FATAL' || entry.level === 'WARN') {
            this.stats.timeline.push({
                timestamp: entry.timestamp,
                level: entry.level,
                message: entry.message.substring(0, 100)
            });
        }
    }

    processPlainTextLine(line) {
        // Simple pattern matching for non-JSON logs
        const patterns = {
            error: /error|exception|failed/i,
            crash: /crash|segfault|abort|fatal/i,
            warning: /warn|warning/i
        };

        for (const [type, pattern] of Object.entries(patterns)) {
            if (pattern.test(line)) {
                if (!this.stats.patterns[type]) {
                    this.stats.patterns[type] = 0;
                }
                this.stats.patterns[type]++;
            }
        }
    }

    detectPatterns(entry) {
        const patterns = [
            { name: 'extension-load-failure', regex: /failed.*load.*extension/i },
            { name: 'permission-denied', regex: /permission.*denied|EPERM|EACCES/i },
            { name: 'file-not-found', regex: /ENOENT|not found/i },
            { name: 'timeout', regex: /timeout|timed out/i },
            { name: 'memory-issue', regex: /out of memory|heap/i },
            { name: 'process-exit', regex: /process.*exit|terminated/i },
            { name: 'connection-failed', regex: /connection.*failed|refused/i }
        ];

        const text = `${entry.message} ${JSON.stringify(entry.data)}`;

        patterns.forEach(({ name, regex }) => {
            if (regex.test(text)) {
                if (!this.stats.patterns[name]) {
                    this.stats.patterns[name] = [];
                }
                this.stats.patterns[name].push({
                    timestamp: entry.timestamp,
                    message: entry.message
                });
            }
        });
    }

    analyzeCrashDumps() {
        try {
            if (!fs.existsSync(this.options.crashDir)) {
                return;
            }

            const crashFiles = fs.readdirSync(this.options.crashDir)
                .filter(f => f.endsWith('.json'));

            crashFiles.forEach(file => {
                try {
                    const crashData = JSON.parse(
                        fs.readFileSync(path.join(this.options.crashDir, file), 'utf8')
                    );
                    
                    this.stats.crashes.push({
                        file,
                        timestamp: crashData.timestamp,
                        error: crashData.error,
                        exitCode: crashData.exitCode,
                        signal: crashData.signal,
                        test: crashData.test
                    });
                } catch (error) {
                    console.error(`Error reading crash dump ${file}: ${error.message}`);
                }
            });
        } catch (error) {
            console.error(`Error analyzing crash dumps: ${error.message}`);
        }
    }

    generateReport() {
        const report = {
            summary: {
                totalLines: this.stats.totalLines,
                sessions: this.stats.sessions.size,
                levels: this.stats.levels,
                totalErrors: this.stats.errors.length,
                totalCrashes: this.stats.crashes.length
            },
            patterns: this.getPatternSummary(),
            topErrors: this.getTopErrors(),
            crashAnalysis: this.getCrashAnalysis(),
            timeline: this.stats.timeline.slice(-20), // Last 20 events
            recommendations: this.getRecommendations()
        };

        // Print report
        this.printReport(report);

        // Save report if requested
        if (this.options.report) {
            this.saveReport(report);
        }

        return report;
    }

    getPatternSummary() {
        const summary = {};
        
        for (const [pattern, occurrences] of Object.entries(this.stats.patterns)) {
            if (Array.isArray(occurrences)) {
                summary[pattern] = {
                    count: occurrences.length,
                    firstOccurrence: occurrences[0]?.timestamp,
                    lastOccurrence: occurrences[occurrences.length - 1]?.timestamp
                };
            } else {
                summary[pattern] = occurrences;
            }
        }

        return summary;
    }

    getTopErrors() {
        // Group errors by message
        const errorGroups = {};
        
        this.stats.errors.forEach(error => {
            const key = error.message.substring(0, 50);
            if (!errorGroups[key]) {
                errorGroups[key] = {
                    message: error.message,
                    count: 0,
                    level: error.level,
                    firstSeen: error.timestamp,
                    lastSeen: error.timestamp
                };
            }
            
            errorGroups[key].count++;
            errorGroups[key].lastSeen = error.timestamp;
        });

        // Sort by frequency
        return Object.values(errorGroups)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }

    getCrashAnalysis() {
        if (this.stats.crashes.length === 0) {
            return { crashes: 0, analysis: 'No crashes detected' };
        }

        const analysis = {
            totalCrashes: this.stats.crashes.length,
            crashTypes: {},
            timeline: this.stats.crashes.map(c => ({
                timestamp: c.timestamp,
                message: c.message || c.error?.message || 'Unknown'
            }))
        };

        // Categorize crashes
        this.stats.crashes.forEach(crash => {
            const type = this.categorizeCrash(crash);
            if (!analysis.crashTypes[type]) {
                analysis.crashTypes[type] = 0;
            }
            analysis.crashTypes[type]++;
        });

        return analysis;
    }

    categorizeCrash(crash) {
        const message = (crash.message || crash.error?.message || '').toLowerCase();
        
        if (message.includes('segmentation') || crash.signal === 'SIGSEGV') {
            return 'segmentation-fault';
        }
        if (message.includes('permission') || message.includes('eperm')) {
            return 'permission-error';
        }
        if (message.includes('timeout')) {
            return 'timeout';
        }
        if (message.includes('memory')) {
            return 'memory-error';
        }
        if (crash.exitCode && crash.exitCode !== 0) {
            return `exit-code-${crash.exitCode}`;
        }
        
        return 'unknown';
    }

    getRecommendations() {
        const recommendations = [];

        // Based on error levels
        if (this.stats.levels.FATAL > 0) {
            recommendations.push('⚠️ Fatal errors detected - investigate crash dumps');
        }

        // Based on patterns
        if (this.stats.patterns['permission-denied']?.length > 0) {
            recommendations.push('🔒 Permission issues detected - check file/directory permissions');
        }

        if (this.stats.patterns['extension-load-failure']?.length > 0) {
            recommendations.push('📦 Extension loading failures - verify extension compilation and paths');
        }

        if (this.stats.patterns['timeout']?.length > 0) {
            recommendations.push('⏱️ Timeouts detected - consider increasing timeout values');
        }

        if (this.stats.patterns['memory-issue']?.length > 0) {
            recommendations.push('💾 Memory issues detected - check system resources');
        }

        // Based on crash analysis
        if (this.stats.crashes.length > 0) {
            const crashTypes = this.getCrashAnalysis().crashTypes;
            if (crashTypes['segmentation-fault'] > 0) {
                recommendations.push('💥 Segmentation faults detected - likely native module issue');
            }
        }

        if (recommendations.length === 0) {
            recommendations.push('✅ No critical issues detected');
        }

        return recommendations;
    }

    printReport(report) {
        console.log('\n' + '='.repeat(60));
        console.log('LOG ANALYSIS REPORT');
        console.log('='.repeat(60));

        // Summary
        console.log('\n📊 Summary:');
        console.log(`  Total lines analyzed: ${report.summary.totalLines}`);
        console.log(`  Sessions: ${report.summary.sessions}`);
        console.log(`  Log levels:`);
        Object.entries(report.summary.levels).forEach(([level, count]) => {
            if (count > 0) {
                console.log(`    ${level}: ${count}`);
            }
        });

        // Errors
        if (report.summary.totalErrors > 0) {
            console.log(`\n❌ Errors: ${report.summary.totalErrors} total`);
            console.log('  Top errors:');
            report.topErrors.slice(0, 5).forEach((error, i) => {
                console.log(`    ${i + 1}. ${error.message.substring(0, 60)}... (${error.count}x)`);
            });
        }

        // Crashes
        if (report.summary.totalCrashes > 0) {
            console.log(`\n💥 Crashes: ${report.summary.totalCrashes} detected`);
            const crashAnalysis = report.crashAnalysis;
            if (crashAnalysis.crashTypes) {
                console.log('  Crash types:');
                Object.entries(crashAnalysis.crashTypes).forEach(([type, count]) => {
                    console.log(`    ${type}: ${count}`);
                });
            }
        }

        // Patterns
        if (Object.keys(report.patterns).length > 0) {
            console.log('\n🔍 Patterns detected:');
            Object.entries(report.patterns).forEach(([pattern, data]) => {
                if (typeof data === 'object' && data.count) {
                    console.log(`  ${pattern}: ${data.count} occurrences`);
                } else if (typeof data === 'number') {
                    console.log(`  ${pattern}: ${data} occurrences`);
                }
            });
        }

        // Recommendations
        console.log('\n💡 Recommendations:');
        report.recommendations.forEach(rec => {
            console.log(`  ${rec}`);
        });

        console.log('\n' + '='.repeat(60));
    }

    saveReport(report) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportPath = path.join(this.options.logsDir, `analysis-report-${timestamp}.json`);
        
        try {
            fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
            console.log(`\n📁 Report saved to: ${reportPath}`);
        } catch (error) {
            console.error(`Failed to save report: ${error.message}`);
        }
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {};

    // Parse command line arguments
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg === '--file' && args[i + 1]) {
            options.file = args[++i];
        } else if (arg === '--pattern' && args[i + 1]) {
            options.pattern = args[++i];
        } else if (arg === '--session' && args[i + 1]) {
            options.sessionId = args[++i];
        } else if (arg === '--report') {
            options.report = true;
        } else if (arg === '--crash-report') {
            options.crashReport = true;
        } else if (arg === '--help') {
            console.log('Usage: node analyze-logs.js [options]');
            console.log('Options:');
            console.log('  --file <path>      Analyze specific log file');
            console.log('  --pattern <regex>  Filter by pattern');
            console.log('  --session <id>     Filter by session ID');
            console.log('  --report           Save analysis report');
            console.log('  --crash-report     Focus on crash analysis');
            console.log('  --help             Show this help');
            process.exit(0);
        }
    }

    const analyzer = new LogAnalyzer(options);
    analyzer.analyze().catch(error => {
        console.error('Analysis failed:', error);
        process.exit(1);
    });
}

module.exports = LogAnalyzer;