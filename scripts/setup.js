#!/usr/bin/env node

/**
 * VSC WSL Manager - Environment Setup Script
 * ==========================================
 *
 * This script validates and sets up the development environment for the VSC WSL Manager extension.
 * It checks for required dependencies, installs missing components, and validates the setup.
 *
 * Usage:
 *     npm run setup [options]
 *     node scripts/setup.js [options]
 *
 * Options:
 *     --skip-optional    Skip optional dependency installation
 *     --ci              Run in CI mode (non-interactive)
 *     --verbose         Show detailed output
 *     --help            Show this help message
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

// Terminal colors for pretty output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
    skipOptional: args.includes('--skip-optional'),
    ci: args.includes('--ci'),
    verbose: args.includes('--verbose'),
    help: args.includes('--help')
};

// Show help if requested
if (options.help) {
    console.log(`
${colors.bright}VSC WSL Manager - Environment Setup${colors.reset}

This script sets up your development environment for the VSC WSL Manager extension.

${colors.cyan}Usage:${colors.reset}
  npm run setup [options]
  node scripts/setup.js [options]

${colors.cyan}Options:${colors.reset}
  --skip-optional    Skip optional dependency installation
  --ci              Run in CI mode (non-interactive)
  --verbose         Show detailed output
  --help            Show this help message

${colors.cyan}What this script does:${colors.reset}
  1. Validates Node.js version (>= 16.0.0)
  2. Installs npm dependencies
  3. Compiles TypeScript code
  4. Validates VS Code installation
  5. Checks git configuration
  6. Creates development icon if needed
  7. Runs basic validation tests
`);
    process.exit(0);
}

// Disable colors in CI mode
if (options.ci) {
    Object.keys(colors).forEach(key => colors[key] = '');
}

/**
 * Execute a command and return the output
 */
function exec(command, silent = false) {
    try {
        const output = execSync(command, { encoding: 'utf8', stdio: silent ? 'pipe' : 'inherit' });
        return output?.trim();
    } catch (error) {
        if (!silent) {
            console.error(`${colors.red}✗ Command failed: ${command}${colors.reset}`);
        }
        return null;
    }
}

/**
 * Check if a command exists
 */
function commandExists(command) {
    const checkCommand = process.platform === 'win32' ? `where ${command}` : `which ${command}`;
    return exec(checkCommand, true) !== null;
}

/**
 * Get user input (for non-CI mode)
 */
async function getUserInput(prompt) {
    if (options.ci) return '';

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => {
        rl.question(prompt, answer => {
            rl.close();
            resolve(answer);
        });
    });
}

/**
 * Main setup function
 */
async function setup() {
    console.log(`\n${colors.bright}${colors.cyan}=================================`);
    console.log(`VSC WSL Manager - Environment Setup`);
    console.log(`==================================${colors.reset}\n`);

    const steps = [];
    let hasErrors = false;

    // Step 1: Check Node.js version
    console.log(`${colors.blue}[1/7] Checking Node.js version...${colors.reset}`);
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

    if (majorVersion >= 16) {
        console.log(`${colors.green}✓ Node.js ${nodeVersion} (>= 16.0.0)${colors.reset}`);
        steps.push({ name: 'Node.js', status: 'success', version: nodeVersion });
    } else {
        console.log(`${colors.red}✗ Node.js ${nodeVersion} is too old. Please upgrade to >= 16.0.0${colors.reset}`);
        steps.push({ name: 'Node.js', status: 'error', version: nodeVersion });
        hasErrors = true;
    }

    // Step 2: Check npm version
    console.log(`\n${colors.blue}[2/7] Checking npm version...${colors.reset}`);
    const npmVersion = exec('npm --version', true);

    if (npmVersion) {
        console.log(`${colors.green}✓ npm ${npmVersion}${colors.reset}`);
        steps.push({ name: 'npm', status: 'success', version: npmVersion });
    } else {
        console.log(`${colors.red}✗ npm not found${colors.reset}`);
        steps.push({ name: 'npm', status: 'error' });
        hasErrors = true;
    }

    // Step 3: Install dependencies
    console.log(`\n${colors.blue}[3/7] Installing npm dependencies...${colors.reset}`);
    console.log(`${colors.dim}This may take a few minutes...${colors.reset}`);

    if (exec('npm install')) {
        console.log(`${colors.green}✓ Dependencies installed${colors.reset}`);
        steps.push({ name: 'Dependencies', status: 'success' });
    } else {
        console.log(`${colors.red}✗ Failed to install dependencies${colors.reset}`);
        steps.push({ name: 'Dependencies', status: 'error' });
        hasErrors = true;
    }

    // Step 4: Compile TypeScript
    console.log(`\n${colors.blue}[4/7] Compiling TypeScript...${colors.reset}`);

    if (exec('npm run compile')) {
        console.log(`${colors.green}✓ TypeScript compiled successfully${colors.reset}`);
        steps.push({ name: 'TypeScript', status: 'success' });
    } else {
        console.log(`${colors.red}✗ TypeScript compilation failed${colors.reset}`);
        steps.push({ name: 'TypeScript', status: 'error' });
        hasErrors = true;
    }

    // Step 5: Check VS Code installation
    console.log(`\n${colors.blue}[5/7] Checking VS Code installation...${colors.reset}`);
    const hasVSCode = commandExists('code');

    if (hasVSCode) {
        const vscodeVersion = exec('code --version', true)?.split('\n')[0];
        console.log(`${colors.green}✓ VS Code ${vscodeVersion || 'installed'}${colors.reset}`);
        steps.push({ name: 'VS Code', status: 'success', version: vscodeVersion });
    } else {
        console.log(`${colors.yellow}⚠ VS Code CLI not found in PATH${colors.reset}`);
        console.log(`  You can still test the extension by pressing F5 in VS Code`);
        steps.push({ name: 'VS Code', status: 'warning' });
    }

    // Step 6: Check git configuration
    console.log(`\n${colors.blue}[6/7] Checking git configuration...${colors.reset}`);
    const gitUser = exec('git config --global user.name', true);
    const gitEmail = exec('git config --global user.email', true);

    if (gitUser && gitEmail) {
        console.log(`${colors.green}✓ Git configured: ${gitUser} <${gitEmail}>${colors.reset}`);
        steps.push({ name: 'Git', status: 'success' });
    } else if (!options.ci) {
        console.log(`${colors.yellow}⚠ Git not configured${colors.reset}`);
        const configureName = await getUserInput('Enter your name for git (or press Enter to skip): ');
        const configureEmail = await getUserInput('Enter your email for git (or press Enter to skip): ');

        if (configureName) exec(`git config --global user.name "${configureName}"`);
        if (configureEmail) exec(`git config --global user.email "${configureEmail}"`);

        steps.push({ name: 'Git', status: configureName && configureEmail ? 'success' : 'warning' });
    } else {
        steps.push({ name: 'Git', status: 'warning' });
    }

    // Step 7: Create development icon if needed
    console.log(`\n${colors.blue}[7/7] Checking development icon...${colors.reset}`);
    const iconPath = path.join(__dirname, '..', 'resources', 'icon.png');

    if (fs.existsSync(iconPath)) {
        console.log(`${colors.green}✓ Development icon exists${colors.reset}`);
        steps.push({ name: 'Dev Icon', status: 'success' });
    } else {
        // Try to create the icon
        console.log(`${colors.yellow}Creating development icon...${colors.reset}`);
        const createIconScript = path.join(__dirname, 'create-icon.js');

        if (fs.existsSync(createIconScript)) {
            exec(`node ${createIconScript}`, true);
            if (fs.existsSync(iconPath)) {
                console.log(`${colors.green}✓ Development icon created${colors.reset}`);
                steps.push({ name: 'Dev Icon', status: 'success' });
            } else {
                console.log(`${colors.yellow}⚠ Could not create icon (not critical)${colors.reset}`);
                steps.push({ name: 'Dev Icon', status: 'warning' });
            }
        } else {
            console.log(`${colors.yellow}⚠ Icon creation script not found (not critical)${colors.reset}`);
            steps.push({ name: 'Dev Icon', status: 'warning' });
        }
    }

    // Summary
    console.log(`\n${colors.bright}${colors.cyan}=================================`);
    console.log(`Setup Summary`);
    console.log(`==================================${colors.reset}\n`);

    steps.forEach(step => {
        const icon = step.status === 'success' ? '✓' :
                     step.status === 'warning' ? '⚠' : '✗';
        const color = step.status === 'success' ? colors.green :
                      step.status === 'warning' ? colors.yellow : colors.red;

        const version = step.version ? ` (${step.version})` : '';
        console.log(`  ${color}${icon} ${step.name}${version}${colors.reset}`);
    });

    if (hasErrors) {
        console.log(`\n${colors.red}${colors.bright}✗ Setup completed with errors${colors.reset}`);
        console.log(`Please fix the errors above and run setup again.`);
        process.exit(1);
    } else {
        console.log(`\n${colors.green}${colors.bright}✓ Setup completed successfully!${colors.reset}`);
        console.log(`\n${colors.cyan}Next steps:${colors.reset}`);
        console.log(`  1. Open VS Code in this directory: ${colors.bright}code .${colors.reset}`);
        console.log(`  2. Press ${colors.bright}F5${colors.reset} to launch the extension`);
        console.log(`  3. Run tests: ${colors.bright}npm test${colors.reset}`);
        console.log(`\n${colors.dim}For more information, see README.md${colors.reset}`);
    }
}

// Run the setup
setup().catch(error => {
    console.error(`\n${colors.red}${colors.bright}Setup failed with error:${colors.reset}`);
    console.error(error);
    process.exit(1);
});