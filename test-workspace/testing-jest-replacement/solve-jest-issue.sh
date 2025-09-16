#!/bin/bash

# VSC WSL Manager - Jest Timeout Solution Center
# Interactive script to diagnose and fix Jest timeout issues

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_color() {
    color=$1
    message=$2
    echo -e "${color}${message}${NC}"
}

# Header
clear
print_color "$BLUE" "╔══════════════════════════════════════════════════════╗"
print_color "$BLUE" "║     VSC WSL Manager - Jest Timeout Solution Center    ║"
print_color "$BLUE" "╚══════════════════════════════════════════════════════╝"
echo ""

# Quick system check
print_color "$YELLOW" "System Information:"
echo "  • Node Version: $(node -v)"
echo "  • NPM Version: $(npm -v)"
echo "  • Platform: $(uname -s)"
echo "  • Current Directory: $(pwd)"
echo ""

# Main menu
show_menu() {
    print_color "$GREEN" "Available Solutions:"
    echo ""
    echo "  1) 🔍 Run Diagnostic (Recommended first step)"
    echo "  2) ⚡ Quick Fix - Switch to Node v20"
    echo "  3) 🚀 Migrate to Vitest (Modern alternative)"
    echo "  4) 📖 View Solution Comparison"
    echo "  5) 🛠️  Manual Fix Instructions"
    echo "  6) 🔄 Clean Reinstall (Reset everything)"
    echo "  7) ❌ Exit"
    echo ""
    print_color "$YELLOW" "Enter your choice (1-7): "
}

# Function implementations
run_diagnostic() {
    print_color "$BLUE" "\n🔍 Running Diagnostic..."
    echo "========================"
    node /home/claude/diagnose-jest.js
    echo ""
    read -p "Press Enter to continue..."
}

quick_fix_node() {
    print_color "$BLUE" "\n⚡ Quick Fix - Switching to Node v20..."
    echo "======================================"
    
    if command -v nvm >/dev/null 2>&1; then
        print_color "$GREEN" "✅ NVM detected"
        nvm install 20
        nvm use 20
        nvm alias default 20
        
        # Clean reinstall
        rm -rf node_modules package-lock.json
        npm install
        
        # Clear Jest cache
        if [ -f "node_modules/.bin/jest" ]; then
            npx jest --clearCache
        fi
        
        print_color "$GREEN" "✅ Switched to Node v20 and reinstalled dependencies"
        
        # Test
        print_color "$YELLOW" "\nTesting Jest..."
        if npx jest --version >/dev/null 2>&1; then
            print_color "$GREEN" "✅ Jest is working!"
            npx jest --version
        else
            print_color "$RED" "❌ Jest still not working"
            echo "Consider using Vitest instead (option 3)"
        fi
    else
        print_color "$RED" "❌ NVM not found"
        echo ""
        echo "Install NVM first:"
        echo "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
        echo "source ~/.bashrc"
        echo ""
        echo "Then run this option again."
    fi
    
    echo ""
    read -p "Press Enter to continue..."
}

migrate_to_vitest() {
    print_color "$BLUE" "\n🚀 Migrating to Vitest..."
    echo "========================"
    
    echo "This will:"
    echo "  1. Install Vitest dependencies"
    echo "  2. Create Vitest configuration"
    echo "  3. Show migration instructions"
    echo ""
    read -p "Continue? (y/n) " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Install Vitest
        print_color "$YELLOW" "Installing Vitest..."
        npm install -D vitest @vitest/ui c8
        
        # Create basic config
        cat > vitest.config.ts << 'EOF'
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'html']
    }
  }
});
EOF
        
        # Update package.json scripts
        print_color "$YELLOW" "Updating package.json scripts..."
        node -e "
        const fs = require('fs');
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        pkg.scripts = pkg.scripts || {};
        pkg.scripts['test'] = 'vitest';
        pkg.scripts['test:ui'] = 'vitest --ui';
        pkg.scripts['test:run'] = 'vitest run';
        pkg.scripts['coverage'] = 'vitest run --coverage';
        fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
        console.log('✅ Scripts updated');
        "
        
        print_color "$GREEN" "✅ Vitest installed and configured!"
        echo ""
        echo "Next steps:"
        echo "  1. Update your test imports: import { describe, it, expect } from 'vitest'"
        echo "  2. Run tests: npm test"
        echo "  3. See full guide: vitest-migration.md"
    fi
    
    echo ""
    read -p "Press Enter to continue..."
}

view_comparison() {
    print_color "$BLUE" "\n📖 Solution Comparison"
    echo "====================="
    
    if [ -f "/home/claude/jest-solution-comparison.md" ]; then
        # Show summary
        echo ""
        print_color "$GREEN" "Quick Summary:"
        echo ""
        echo "┌─────────────────┬──────────────┬──────────────┬──────────────┐"
        echo "│ Criteria        │ Node v20     │ Direct Exec  │ Vitest       │"
        echo "├─────────────────┼──────────────┼──────────────┼──────────────┤"
        echo "│ Effort          │ 5 minutes    │ 30 minutes   │ 1 hour       │"
        echo "│ Risk            │ Low          │ Medium       │ Low          │"
        echo "│ Performance     │ Standard     │ Slow         │ 2-5x Faster  │"
        echo "│ Node v22        │ No           │ Maybe        │ Yes          │"
        echo "│ Long-term       │ Good         │ Poor         │ Excellent    │"
        echo "└─────────────────┴──────────────┴──────────────┴──────────────┘"
        echo ""
        echo "Full comparison available in: jest-solution-comparison.md"
    else
        print_color "$RED" "Comparison file not found"
    fi
    
    echo ""
    read -p "Press Enter to continue..."
}

manual_fix() {
    print_color "$BLUE" "\n🛠️ Manual Fix Instructions"
    echo "=========================="
    
    echo ""
    print_color "$YELLOW" "Option 1: Node Version Switch"
    echo "------------------------------"
    echo "1. Check current Node: node -v"
    echo "2. If v22, install v20:"
    echo "   • With nvm: nvm install 20 && nvm use 20"
    echo "   • With n: n 20"
    echo "3. Clean install: rm -rf node_modules package-lock.json && npm install"
    echo "4. Clear cache: npx jest --clearCache"
    echo "5. Test: npm test"
    
    echo ""
    print_color "$YELLOW" "Option 2: Compile TypeScript First"
    echo "-----------------------------------"
    echo "1. Compile: npx tsc"
    echo "2. Run compiled tests: node out/test/*.test.js"
    
    echo ""
    print_color "$YELLOW" "Option 3: Use Different Test Runner"
    echo "------------------------------------"
    echo "1. Vitest: npm install -D vitest"
    echo "2. Mocha: npm install -D mocha @types/mocha"
    echo "3. Node test runner: Use Node's built-in test runner (Node 20+)"
    
    echo ""
    read -p "Press Enter to continue..."
}

clean_reinstall() {
    print_color "$BLUE" "\n🔄 Clean Reinstall"
    echo "=================="
    
    echo "This will:"
    echo "  • Remove node_modules"
    echo "  • Remove package-lock.json"
    echo "  • Clear all caches"
    echo "  • Reinstall everything"
    echo ""
    read -p "Continue? (y/n) " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_color "$YELLOW" "Cleaning..."
        rm -rf node_modules package-lock.json
        rm -rf .jest-cache
        npm cache clean --force
        
        print_color "$YELLOW" "Reinstalling..."
        npm install
        
        if [ -f "node_modules/.bin/jest" ]; then
            npx jest --clearCache
        fi
        
        print_color "$GREEN" "✅ Clean reinstall complete!"
        
        # Test
        print_color "$YELLOW" "\nTesting..."
        if npx jest --version >/dev/null 2>&1; then
            print_color "$GREEN" "✅ Jest is working!"
        else
            print_color "$RED" "❌ Jest still not working - try option 1 or 3"
        fi
    fi
    
    echo ""
    read -p "Press Enter to continue..."
}

# Main loop
while true; do
    show_menu
    read -r choice
    
    case $choice in
        1) run_diagnostic ;;
        2) quick_fix_node ;;
        3) migrate_to_vitest ;;
        4) view_comparison ;;
        5) manual_fix ;;
        6) clean_reinstall ;;
        7) 
            print_color "$GREEN" "Goodbye!"
            exit 0 
            ;;
        *)
            print_color "$RED" "Invalid option. Please try again."
            sleep 2
            ;;
    esac
    
    clear
    print_color "$BLUE" "╔══════════════════════════════════════════════════════╗"
    print_color "$BLUE" "║     VSC WSL Manager - Jest Timeout Solution Center    ║"
    print_color "$BLUE" "╚══════════════════════════════════════════════════════╝"
    echo ""
done