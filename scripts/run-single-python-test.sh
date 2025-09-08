#!/bin/bash

# Run a single Python E2E test to verify setup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Running Single Python E2E Test${NC}"
echo "=================================="

# Check if project is on Windows filesystem
if [[ ! "$PWD" =~ ^/mnt/ ]]; then
    echo -e "${RED}ERROR: Project must be on Windows filesystem (/mnt/c/...)${NC}"
    exit 1
fi

# Kill any existing VS Code processes first
echo -e "${YELLOW}Cleaning up any existing VS Code processes...${NC}"
cmd.exe /c "taskkill /F /IM Code.exe /T" 2>/dev/null || true
sleep 2

# Convert WSL path to Windows path
WSL_PATH="$PWD"
WIN_PATH=$(echo "$WSL_PATH" | sed 's|^/mnt/\([a-z]\)/|\1:/|' | sed 's|/|\\|g')

echo -e "${YELLOW}Project path: $WIN_PATH${NC}"

# Ensure extension is compiled
if [ ! -f "out/src/extension.js" ]; then
    echo -e "${YELLOW}Compiling extension...${NC}"
    npm run compile
fi

# Create directories
mkdir -p test/e2e-python/screenshots
mkdir -p test/e2e-python/reports

# Run the single test
echo -e "${GREEN}Running test...${NC}"
echo "------------------------------------------"

PYTEST_CMD="cd ${WIN_PATH} && python -m pytest"
PYTEST_CMD="$PYTEST_CMD test\\e2e-python\\tests\\test_single.py"
PYTEST_CMD="$PYTEST_CMD -v -s"  # Verbose and show print statements
PYTEST_CMD="$PYTEST_CMD --tb=short"
PYTEST_CMD="$PYTEST_CMD --timeout=60"

echo "Command: $PYTEST_CMD"
echo ""

# Run test
if cmd.exe /c "$PYTEST_CMD"; then
    echo "------------------------------------------"
    echo -e "${GREEN}Test PASSED!${NC}"
    EXITCODE=0
else
    echo "------------------------------------------"
    echo -e "${RED}Test FAILED${NC}"
    EXITCODE=1
fi

# Show screenshots if any
if ls test/e2e-python/screenshots/*.png 1> /dev/null 2>&1; then
    echo -e "${YELLOW}Screenshots saved in: test/e2e-python/screenshots/${NC}"
    ls -la test/e2e-python/screenshots/*.png
fi

# Final cleanup
echo -e "${YELLOW}Final cleanup...${NC}"
cmd.exe /c "taskkill /F /IM Code.exe /T" 2>/dev/null || true

exit $EXITCODE