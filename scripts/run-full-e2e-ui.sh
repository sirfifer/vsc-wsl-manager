#!/bin/bash

# Master Test Runner for Complete E2E UI Testing
# Runs the full WSL Manager extension UI test suite with comprehensive logging

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test configuration
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_DIR="test/e2e-debug/logs"
SCREENSHOT_DIR="test-screenshots"
RESULTS_DIR="test-results"

# Header
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}     WSL MANAGER - COMPLETE E2E UI TEST SUITE${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Timestamp:${NC} $TIMESTAMP"
echo -e "${BLUE}Log Level:${NC} ${DEBUG_LEVEL:-INFO}"
echo -e "${BLUE}Debug Mode:${NC} ${DEBUG:-disabled}"
echo ""

# Step 1: Environment Setup
echo -e "${YELLOW}[1/8] Setting up environment...${NC}"

# Set debug environment variables for maximum observability
export DEBUG="${DEBUG:-*}"
export DEBUG_LEVEL="${DEBUG_LEVEL:-DEBUG}"
export NODE_ENV="test"
export FORCE_COLOR="1"

# Create necessary directories
mkdir -p "$LOG_DIR"
mkdir -p "$SCREENSHOT_DIR"
mkdir -p "$RESULTS_DIR"

echo -e "${GREEN}✓ Environment configured${NC}"

# Step 2: Clean Previous Artifacts
echo -e "${YELLOW}[2/8] Cleaning previous test artifacts...${NC}"

# Clean old screenshots (keep last 3 runs)
if [ -d "$SCREENSHOT_DIR" ]; then
    find "$SCREENSHOT_DIR" -name "*.png" -mtime +1 -delete 2>/dev/null || true
    echo -e "  Cleaned old screenshots"
fi

# Clean old logs (keep last 5 runs)
if [ -d "$LOG_DIR" ]; then
    ls -t "$LOG_DIR"/*.log 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
    echo -e "  Cleaned old logs"
fi

echo -e "${GREEN}✓ Cleanup complete${NC}"

# Step 3: Check Dependencies
echo -e "${YELLOW}[3/8] Checking dependencies...${NC}"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${RED}❌ node_modules not found. Run 'npm install' first${NC}"
    exit 1
fi

# Check for required packages
REQUIRED_PACKAGES=("wdio-vscode-service" "@wdio/cli" "chai")
for package in "${REQUIRED_PACKAGES[@]}"; do
    if [ ! -d "node_modules/$package" ]; then
        echo -e "${RED}❌ Missing package: $package${NC}"
        echo -e "Run: npm install --save-dev $package"
        exit 1
    fi
done

echo -e "${GREEN}✓ All dependencies found${NC}"

# Step 4: Compile Extension
echo -e "${YELLOW}[4/8] Compiling extension...${NC}"

npm run compile
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Compilation failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Extension compiled${NC}"

# Step 5: Verify Extension Files
echo -e "${YELLOW}[5/8] Verifying extension files...${NC}"

if [ ! -f "out/src/extension.js" ]; then
    echo -e "${RED}❌ Extension not compiled properly${NC}"
    exit 1
fi

if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Extension files verified${NC}"

# Step 6: Start Debug Logging
echo -e "${YELLOW}[6/8] Starting debug logging...${NC}"

# Create a marker in the log
echo "[${TIMESTAMP}] Starting E2E UI Test Suite" >> "$LOG_DIR/test-session.log"
echo "Environment: DEBUG=$DEBUG, DEBUG_LEVEL=$DEBUG_LEVEL" >> "$LOG_DIR/test-session.log"

echo -e "${GREEN}✓ Debug logging initialized${NC}"

# Step 7: Run E2E UI Tests
echo -e "${YELLOW}[7/8] Running E2E UI tests...${NC}"
echo ""
echo -e "${MAGENTA}════════════════════════════════════════════════════════════${NC}"

# Run the tests with our ESM configuration
npx wdio test/config/wdio.conf.ui.mjs

TEST_EXIT_CODE=$?

echo -e "${MAGENTA}════════════════════════════════════════════════════════════${NC}"
echo ""

# Step 8: Analyze Results
echo -e "${YELLOW}[8/8] Analyzing test results...${NC}"

# Count screenshots
SCREENSHOT_COUNT=$(find "$SCREENSHOT_DIR" -name "*.png" -newer "$LOG_DIR/test-session.log" 2>/dev/null | wc -l)
echo -e "  Screenshots captured: ${SCREENSHOT_COUNT}"

# Check for test report
if [ -f "$SCREENSHOT_DIR/test-report.json" ]; then
    echo -e "  Test report generated"
    
    # Extract summary from report
    if command -v jq &> /dev/null; then
        TOTAL_ACTIONS=$(jq '.totalActions' "$SCREENSHOT_DIR/test-report.json")
        ERRORS=$(jq '.errors | length' "$SCREENSHOT_DIR/test-report.json")
        echo -e "  Total UI actions: ${TOTAL_ACTIONS}"
        echo -e "  Errors encountered: ${ERRORS}"
    fi
fi

# Check for action log
if [ -f "$SCREENSHOT_DIR/ui-actions.json" ]; then
    ACTION_COUNT=$(grep -c '"action"' "$SCREENSHOT_DIR/ui-actions.json" || echo "0")
    echo -e "  UI actions logged: ${ACTION_COUNT}"
fi

echo -e "${GREEN}✓ Analysis complete${NC}"

# Run log analyzer if available
if [ -f "test/e2e-debug/analyze-logs.js" ]; then
    echo ""
    echo -e "${YELLOW}Running log analyzer...${NC}"
    node test/e2e-debug/analyze-logs.js --report || true
fi

# Final Summary
echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}                    TEST SUITE SUMMARY${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ ALL TESTS PASSED!${NC}"
else
    echo -e "${RED}❌ TESTS FAILED (Exit code: $TEST_EXIT_CODE)${NC}"
fi

echo ""
echo -e "${BLUE}📁 Artifacts:${NC}"
echo -e "  Screenshots: ${SCREENSHOT_DIR}/"
echo -e "  Debug logs: ${LOG_DIR}/"
echo -e "  Test results: ${RESULTS_DIR}/"
echo -e "  Action log: ${SCREENSHOT_DIR}/ui-actions.json"
echo -e "  Test report: ${SCREENSHOT_DIR}/test-report.json"

# Show recent screenshots
echo ""
echo -e "${BLUE}📸 Recent screenshots:${NC}"
ls -lt "$SCREENSHOT_DIR"/*.png 2>/dev/null | head -5 | awk '{print "  " $9}'

# Show any errors from logs
if [ $TEST_EXIT_CODE -ne 0 ]; then
    echo ""
    echo -e "${YELLOW}Recent errors from logs:${NC}"
    grep -i "error\|fail\|crash" "$LOG_DIR"/*.log 2>/dev/null | tail -5 | while read line; do
        echo -e "  ${line:0:120}..."
    done
fi

echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"

# Exit with test status
exit $TEST_EXIT_CODE