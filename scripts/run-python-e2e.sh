#!/bin/bash

# WSL to Windows Python E2E Test Runner

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Python E2E Tests from WSL${NC}"
echo "=================================="

# Check if we're in WSL
if [[ ! -f /proc/sys/fs/binfmt_misc/WSLInterop ]]; then
    echo -e "${RED}❌ This script must be run from WSL${NC}"
    exit 1
fi

# Check if project is on Windows filesystem
if [[ ! "$PWD" =~ ^/mnt/ ]]; then
    echo -e "${RED}❌ Project must be on Windows filesystem (/mnt/c/...)${NC}"
    echo "Current location: $PWD"
    exit 1
fi

# Convert WSL path to Windows path
WSL_PATH="$PWD"
WIN_PATH=$(echo "$WSL_PATH" | sed 's|^/mnt/\([a-z]\)/|\1:/|' | sed 's|/|\\|g')

echo -e "${YELLOW}📁 Project path (WSL): $WSL_PATH${NC}"
echo -e "${YELLOW}📁 Project path (Windows): $WIN_PATH${NC}"

# Compile the extension first
echo -e "${GREEN}🔨 Compiling extension...${NC}"
npm run compile

# Install Python dependencies on Windows if needed
echo -e "${GREEN}📦 Checking Python dependencies...${NC}"
cmd.exe /c "pip install -q -r ${WIN_PATH}\\test\\e2e-python\\requirements.txt" 2>/dev/null || {
    echo -e "${YELLOW}Installing Python dependencies...${NC}"
    cmd.exe /c "pip install -r ${WIN_PATH}\\test\\e2e-python\\requirements.txt"
}

# Create reports directory
mkdir -p test/e2e-python/reports
mkdir -p test/e2e-python/screenshots

# Run tests on Windows
echo -e "${GREEN}🧪 Running Python E2E tests on Windows...${NC}"
echo "------------------------------------------"

# Build pytest command
PYTEST_CMD="cd ${WIN_PATH} && python -m pytest"
PYTEST_CMD="$PYTEST_CMD test\\e2e-python\\tests"
PYTEST_CMD="$PYTEST_CMD -v"
PYTEST_CMD="$PYTEST_CMD --tb=short"
PYTEST_CMD="$PYTEST_CMD --html=test\\e2e-python\\reports\\report.html"
PYTEST_CMD="$PYTEST_CMD --self-contained-html"
PYTEST_CMD="$PYTEST_CMD --timeout=60"

# Add specific test selection if provided
if [ -n "$1" ]; then
    PYTEST_CMD="$PYTEST_CMD -k \"$1\""
fi

# Add any additional arguments
shift
for arg in "$@"; do
    PYTEST_CMD="$PYTEST_CMD $arg"
done

echo "Running: cmd.exe /c \"$PYTEST_CMD\""
echo ""

# Run tests and capture output
if cmd.exe /c "$PYTEST_CMD"; then
    echo "------------------------------------------"
    echo -e "${GREEN}✅ All tests passed!${NC}"
    EXITCODE=0
else
    echo "------------------------------------------"
    echo -e "${RED}❌ Some tests failed${NC}"
    EXITCODE=1
fi

# Show report location
if [ -f "test/e2e-python/reports/report.html" ]; then
    echo -e "${YELLOW}📊 Test report: test/e2e-python/reports/report.html${NC}"
    
    # Convert to Windows path for opening
    REPORT_WIN="${WIN_PATH}\\test\\e2e-python\\reports\\report.html"
    echo -e "${YELLOW}   Windows path: $REPORT_WIN${NC}"
    echo -e "${YELLOW}   Open in browser: cmd.exe /c start \"$REPORT_WIN\"${NC}"
fi

# Show screenshots if any
if ls test/e2e-python/screenshots/*.png 1> /dev/null 2>&1; then
    echo -e "${YELLOW}📸 Screenshots saved in: test/e2e-python/screenshots/${NC}"
    SCREENSHOT_COUNT=$(ls -1 test/e2e-python/screenshots/*.png | wc -l)
    echo -e "${YELLOW}   Total screenshots: $SCREENSHOT_COUNT${NC}"
fi

# Clean up any lingering VS Code processes
echo -e "${GREEN}🧹 Cleaning up...${NC}"
cmd.exe /c "taskkill /F /IM Code.exe /T" 2>/dev/null || true

exit $EXITCODE