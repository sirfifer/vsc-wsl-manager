#!/usr/bin/env node

/**
 * VSC WSL Manager - Development Icon Generator
 * ============================================
 *
 * Creates a simple development icon for the extension if one doesn't exist.
 * This is a placeholder icon for development purposes only.
 *
 * Usage:
 *     node scripts/create-icon.js
 *     npm run create-icon
 */

const fs = require('fs');
const path = require('path');

/**
 * Creates a simple SVG icon and saves it as both SVG and a data URL PNG
 */
function createDevelopmentIcon() {
    const resourcesDir = path.join(__dirname, '..', 'resources');
    const iconPath = path.join(resourcesDir, 'icon.png');

    // Create resources directory if it doesn't exist
    if (!fs.existsSync(resourcesDir)) {
        fs.mkdirSync(resourcesDir, { recursive: true });
    }

    // Check if icon already exists
    if (fs.existsSync(iconPath)) {
        console.log('✓ Icon already exists at resources/icon.png');
        return true;
    }

    // Create a simple SVG icon
    const svg = `
<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="128" height="128" fill="#0066CC" rx="16"/>

  <!-- WSL Terminal Symbol -->
  <g transform="translate(20, 30)">
    <!-- Terminal Window -->
    <rect x="0" y="0" width="88" height="68" fill="none" stroke="#FFFFFF" stroke-width="3" rx="4"/>

    <!-- Terminal Header -->
    <rect x="0" y="0" width="88" height="12" fill="#FFFFFF" rx="4"/>

    <!-- Terminal Buttons -->
    <circle cx="8" cy="6" r="2" fill="#FF5F57"/>
    <circle cx="16" cy="6" r="2" fill="#FFBD2E"/>
    <circle cx="24" cy="6" r="2" fill="#28CA42"/>

    <!-- Terminal Text Lines -->
    <rect x="8" y="20" width="40" height="2" fill="#00FF00"/>
    <rect x="8" y="28" width="30" height="2" fill="#00FF00"/>
    <rect x="8" y="36" width="45" height="2" fill="#00FF00"/>
    <rect x="8" y="44" width="25" height="2" fill="#00FF00"/>

    <!-- Cursor -->
    <rect x="35" y="44" width="8" height="2" fill="#FFFFFF">
      <animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite"/>
    </rect>
  </g>

  <!-- WSL Text -->
  <text x="64" y="115" font-family="Arial, sans-serif" font-size="14" font-weight="bold"
        text-anchor="middle" fill="#FFFFFF">WSL Manager</text>
</svg>
    `.trim();

    // For development, we'll save the SVG and create instructions for a proper PNG
    const svgPath = path.join(resourcesDir, 'icon.svg');
    fs.writeFileSync(svgPath, svg, 'utf8');

    // Create a simple base64 PNG placeholder
    // This is a 1x1 transparent PNG that VS Code will accept
    const placeholderPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        'base64'
    );

    // For now, save the placeholder PNG
    // In production, you would convert the SVG to PNG using a library like sharp or puppeteer
    fs.writeFileSync(iconPath, placeholderPng);

    console.log('✓ Created development icon at resources/icon.png');
    console.log('✓ Created SVG source at resources/icon.svg');
    console.log('\nNote: The PNG is a placeholder. For production, convert the SVG to a proper 128x128 PNG.');
    console.log('You can use an online converter or install a package like sharp to do this automatically.');

    return true;
}

// Alternative: Create a simple Canvas-based icon (if canvas is available)
function createCanvasIcon() {
    try {
        // Try to use canvas if available (requires canvas package)
        const { createCanvas } = require('canvas');

        const canvas = createCanvas(128, 128);
        const ctx = canvas.getContext('2d');

        // Background
        ctx.fillStyle = '#0066CC';
        ctx.fillRect(0, 0, 128, 128);

        // Terminal window
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.strokeRect(20, 30, 88, 68);

        // Terminal header
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(20, 30, 88, 12);

        // Terminal dots
        ctx.fillStyle = '#FF5F57';
        ctx.beginPath();
        ctx.arc(28, 36, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFBD2E';
        ctx.beginPath();
        ctx.arc(36, 36, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#28CA42';
        ctx.beginPath();
        ctx.arc(44, 36, 2, 0, Math.PI * 2);
        ctx.fill();

        // Terminal text
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(28, 50, 40, 2);
        ctx.fillRect(28, 58, 30, 2);
        ctx.fillRect(28, 66, 45, 2);
        ctx.fillRect(28, 74, 25, 2);

        // Cursor
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(55, 74, 8, 2);

        // WSL Text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('WSL Manager', 64, 115);

        // Save as PNG
        const resourcesDir = path.join(__dirname, '..', 'resources');
        const iconPath = path.join(resourcesDir, 'icon.png');

        if (!fs.existsSync(resourcesDir)) {
            fs.mkdirSync(resourcesDir, { recursive: true });
        }

        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(iconPath, buffer);

        console.log('✓ Created development icon using Canvas at resources/icon.png');
        return true;
    } catch (error) {
        // Canvas not available, fall back to SVG method
        return false;
    }
}

// Main execution
function main() {
    console.log('Creating development icon for VSC WSL Manager...\n');

    // Try Canvas first (if available), otherwise use SVG
    if (!createCanvasIcon()) {
        createDevelopmentIcon();
    }

    console.log('\nDone! The icon is ready for development use.');
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { createDevelopmentIcon, createCanvasIcon };