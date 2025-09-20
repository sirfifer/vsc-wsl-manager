#!/usr/bin/env node

/**
 * Distribution URL Health Check Script
 *
 * Checks all distribution URLs for availability and generates a report.
 * This script can be run periodically to monitor the health of distribution URLs.
 *
 * Usage:
 *   npm run check:distros
 *   node scripts/check-distro-urls.js [--json] [--verbose]
 *
 * Options:
 *   --json     Output results as JSON
 *   --verbose  Show detailed progress
 *   --help     Show this help message
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
    json: args.includes('--json'),
    verbose: args.includes('--verbose'),
    help: args.includes('--help')
};

if (options.help) {
    console.log(`
Distribution URL Health Check

This script validates all WSL distribution download URLs and generates a report.

Usage:
  npm run check:distros
  node scripts/check-distro-urls.js [options]

Options:
  --json     Output results as JSON instead of markdown
  --verbose  Show detailed progress for each URL check
  --help     Show this help message

The script will:
  1. Fetch the latest distribution list from Microsoft Registry
  2. Validate each distribution URL with a HEAD request
  3. Generate a report showing which URLs are accessible
  4. Save the report to the reports directory
`);
    process.exit(0);
}

/**
 * Fetch distribution list from Microsoft Registry
 */
async function fetchDistributions() {
    return new Promise((resolve, reject) => {
        const url = 'https://raw.githubusercontent.com/microsoft/WSL/main/distributions/DistributionInfo.json';

        https.get(url, (res) => {
            let data = '';

            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json.Distributions || []);
                } catch (error) {
                    reject(new Error('Failed to parse distribution JSON'));
                }
            });
        }).on('error', reject);
    });
}

/**
 * Validate a single URL
 */
async function validateUrl(url, name) {
    if (!url) {
        return {
            name,
            url: 'N/A',
            valid: false,
            error: 'No URL provided'
        };
    }

    if (options.verbose) {
        console.log(`Checking ${name}...`);
    }

    return new Promise((resolve) => {
        const startTime = Date.now();

        try {
            const parsedUrl = new URL(url);
            const client = parsedUrl.protocol === 'https:' ? https : http;

            const req = client.request({
                hostname: parsedUrl.hostname,
                port: parsedUrl.port,
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'HEAD',
                timeout: 10000,
                headers: {
                    'User-Agent': 'VSC-WSL-Manager/1.0'
                }
            }, (res) => {
                const duration = Date.now() - startTime;

                // Handle redirects
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    validateUrl(res.headers.location, name).then(resolve);
                    return;
                }

                const result = {
                    name,
                    url,
                    valid: res.statusCode === 200,
                    statusCode: res.statusCode,
                    contentType: res.headers['content-type'],
                    contentLength: res.headers['content-length'],
                    duration
                };

                if (options.verbose) {
                    const status = result.valid ? '✓' : '✗';
                    console.log(`  ${status} ${name}: ${res.statusCode} (${duration}ms)`);
                }

                resolve(result);
            });

            req.on('error', (error) => {
                const result = {
                    name,
                    url,
                    valid: false,
                    error: error.message,
                    duration: Date.now() - startTime
                };

                if (options.verbose) {
                    console.log(`  ✗ ${name}: ${error.message}`);
                }

                resolve(result);
            });

            req.on('timeout', () => {
                req.destroy();
                const result = {
                    name,
                    url,
                    valid: false,
                    error: 'Request timeout',
                    duration: Date.now() - startTime
                };

                if (options.verbose) {
                    console.log(`  ✗ ${name}: Timeout`);
                }

                resolve(result);
            });

            req.end();
        } catch (error) {
            resolve({
                name,
                url,
                valid: false,
                error: error.message,
                duration: Date.now() - startTime
            });
        }
    });
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
    if (!bytes) return 'Unknown';
    const mb = bytes / 1048576;
    return mb.toFixed(1) + ' MB';
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(results, summary) {
    const lines = [
        '# WSL Distribution URL Health Check Report',
        '',
        `**Generated:** ${new Date().toISOString()}`,
        `**Total Distributions:** ${summary.total}`,
        `**Reachable:** ${summary.reachable} (${summary.successRate.toFixed(1)}%)`,
        `**Unreachable:** ${summary.unreachable}`,
        `**Average Response Time:** ${summary.avgResponseTime}ms`,
        '',
        '## Distribution Status',
        '',
        '| Distribution | Status | Response | Size | Time |',
        '|-------------|--------|----------|------|------|'
    ];

    results.forEach(result => {
        const status = result.valid ? '✅ OK' : '❌ Failed';
        const response = result.statusCode || result.error || 'N/A';
        const size = formatBytes(result.contentLength);
        const time = result.duration ? `${result.duration}ms` : 'N/A';

        lines.push(`| ${result.name} | ${status} | ${response} | ${size} | ${time} |`);
    });

    if (summary.problems.length > 0) {
        lines.push('', '## Problem Distributions', '');
        summary.problems.forEach(problem => {
            lines.push(`- **${problem.name}**: ${problem.error || `HTTP ${problem.statusCode}`}`);
            if (problem.url !== 'N/A') {
                lines.push(`  - URL: \`${problem.url}\``);
            }
        });
    }

    lines.push('', '## Summary', '');
    lines.push(`- Success Rate: **${summary.successRate.toFixed(1)}%**`);
    lines.push(`- Average Response Time: **${summary.avgResponseTime}ms**`);
    lines.push(`- Tested at: ${new Date().toISOString()}`);

    return lines.join('\n');
}

/**
 * Main function
 */
async function main() {
    try {
        if (!options.json) {
            console.log('WSL Distribution URL Health Check');
            console.log('==================================');
            console.log('');
        }

        // Fetch distributions
        if (!options.json) {
            console.log('Fetching distribution list from Microsoft Registry...');
        }

        const distributions = await fetchDistributions();

        if (!options.json) {
            console.log(`Found ${distributions.length} distributions`);
            console.log('');
            console.log('Validating URLs...');
            console.log('');
        }

        // Validate all URLs
        const results = [];
        for (const distro of distributions) {
            const url = distro.Amd64PackageUrl || distro.Amd64WslUrl || '';
            const result = await validateUrl(url, distro.Name);
            results.push(result);
        }

        // Calculate summary
        const summary = {
            total: results.length,
            reachable: results.filter(r => r.valid).length,
            unreachable: results.filter(r => !r.valid).length,
            problems: results.filter(r => !r.valid),
            successRate: (results.filter(r => r.valid).length / results.length) * 100,
            avgResponseTime: Math.round(
                results
                    .filter(r => r.duration)
                    .reduce((sum, r) => sum + r.duration, 0) /
                results.filter(r => r.duration).length || 0
            )
        };

        // Output results
        if (options.json) {
            console.log(JSON.stringify({
                timestamp: new Date().toISOString(),
                summary,
                results
            }, null, 2));
        } else {
            // Generate report
            const report = generateMarkdownReport(results, summary);

            // Save report to file
            const reportsDir = path.join(__dirname, '..', 'reports');
            if (!fs.existsSync(reportsDir)) {
                fs.mkdirSync(reportsDir, { recursive: true });
            }

            const reportPath = path.join(
                reportsDir,
                `distro-health-${new Date().toISOString().split('T')[0]}.md`
            );

            fs.writeFileSync(reportPath, report);

            // Print summary
            console.log('');
            console.log('Summary');
            console.log('-------');
            console.log(`Total: ${summary.total}`);
            console.log(`Reachable: ${summary.reachable} (${summary.successRate.toFixed(1)}%)`);
            console.log(`Unreachable: ${summary.unreachable}`);
            console.log(`Average Response: ${summary.avgResponseTime}ms`);

            if (summary.problems.length > 0) {
                console.log('');
                console.log('Problems:');
                summary.problems.forEach(p => {
                    console.log(`  - ${p.name}: ${p.error || `HTTP ${p.statusCode}`}`);
                });
            }

            console.log('');
            console.log(`Full report saved to: ${reportPath}`);
        }

        // Exit with error if success rate is too low
        if (summary.successRate < 50) {
            console.error('');
            console.error('ERROR: Less than 50% of distributions are reachable!');
            process.exit(1);
        }

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main();
}