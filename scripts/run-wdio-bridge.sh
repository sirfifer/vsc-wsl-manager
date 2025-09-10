#!/bin/bash

# WebdriverIO Bridge Runner - Executes WebdriverIO tests on Windows from WSL

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🌉 WebdriverIO Bridge - WSL to Windows Test Runner${NC}"
echo "=================================================="

# Check if we're in WSL
if [[ ! -f /proc/sys/fs/binfmt_misc/WSLInterop ]]; then
    echo -e "${RED}❌ This script must be run from WSL${NC}"
    exit 1
fi

# Check Python 3
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is required but not installed${NC}"
    echo "Install with: sudo apt-get install python3"
    exit 1
fi

# Pass all arguments to the Python bridge
echo -e "${GREEN}🚀 Launching WebdriverIO tests via Python bridge...${NC}"
echo ""

# Run the Python bridge script
python3 test/e2e-python/run_wdio_bridge.py "$@"

# Capture exit code
EXIT_CODE=$?

# Show appropriate message based on exit code
echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Test execution completed successfully!${NC}"
else
    echo -e "${YELLOW}⚠️ Test execution completed with exit code: $EXIT_CODE${NC}"
fi

exit $EXIT_CODE