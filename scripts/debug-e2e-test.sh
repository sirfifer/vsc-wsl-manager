#!/bin/bash

# Debug E2E Test Runner
# Runs E2E tests with maximum debugging and crash detection

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Default values
TEST_MODE="normal"
SPEC=""
SAFE_MODE=false
MINIMAL_TEST=false
ANALYZE_ONLY=false
CLEAN_LOGS=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --spec)
            SPEC="$2"
            shift 2
            ;;
        --safe-mode)
            SAFE_MODE=true
            shift
            ;;
        --minimal)
            MINIMAL_TEST=true
            shift
            ;;
        --analyze)
            ANALYZE_ONLY=true
            shift
            ;;
        --clean)
            CLEAN_LOGS=true
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --spec <file>    Run specific test file"
            echo "  --safe-mode      Use safe test runner with crash recovery"
            echo "  --minimal        Run minimal crash reproduction test"
            echo "  --analyze        Only analyze existing logs"
            echo "  --clean          Clean all debug logs before running"
            echo "  --help           Show this help message"
            echo ""
            echo "Environment variables:"
            echo "  DEBUG=*          Enable all debug output"
            echo "  DEBUG_LEVEL=DEBUG Set minimum log level"
            echo "  MAX_RETRIES=3    Number of retry attempts"
            echo ""
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Header
echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}           🔍 Debug E2E Test Runner${NC}"
echo -e "${BLUE}=====================================================${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Must be run from project root${NC}"
    exit 1
fi

# Clean logs if requested
if [ "$CLEAN_LOGS" = true ]; then
    echo -e "${YELLOW}🧹 Cleaning debug logs...${NC}"
    rm -rf test/e2e-debug/logs/*
    rm -rf test/e2e-debug/crash-dumps/*
    rm -rf test/e2e-debug/process-logs/*
    rm -f test/wdio-error.log
    echo -e "${GREEN}✅ Logs cleaned${NC}"
    echo ""
fi

# Analyze only mode
if [ "$ANALYZE_ONLY" = true ]; then
    echo -e "${MAGENTA}📊 Analyzing existing logs...${NC}"
    node test/e2e-debug/analyze-logs.js --report
    exit $?
fi

# Set debug environment variables
export DEBUG="${DEBUG:-*}"
export DEBUG_LEVEL="${DEBUG_LEVEL:-DEBUG}"
export MAX_RETRIES="${MAX_RETRIES:-3}"
export TEST_TIMEOUT="${TEST_TIMEOUT:-120000}"
export SAFE_MODE="${SAFE_MODE}"

# Display configuration
echo -e "${YELLOW}📋 Configuration:${NC}"
echo "  Debug mode: $DEBUG"
echo "  Log level: $DEBUG_LEVEL"
echo "  Max retries: $MAX_RETRIES"
echo "  Timeout: ${TEST_TIMEOUT}ms"
echo "  Safe mode: $SAFE_MODE"
echo ""

# Ensure extension is compiled
echo -e "${YELLOW}🔨 Compiling extension...${NC}"
npm run compile
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Compilation failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Extension compiled${NC}"
echo ""

# Create debug directories
mkdir -p test/e2e-debug/logs
mkdir -p test/e2e-debug/crash-dumps
mkdir -p test/e2e-debug/process-logs

# Run appropriate test mode
if [ "$MINIMAL_TEST" = true ]; then
    # Run minimal crash reproduction test
    echo -e "${MAGENTA}🔬 Running minimal crash reproduction test...${NC}"
    echo "=" 
    node test/e2e-debug/minimal-crash-test.js
    EXIT_CODE=$?
    
elif [ "$SAFE_MODE" = true ]; then
    # Run with safe test runner
    echo -e "${MAGENTA}🛡️ Running tests in safe mode with crash recovery...${NC}"
    echo "="
    
    if [ -n "$SPEC" ]; then
        node test/e2e-debug/safe-test-runner.js "npm run test:e2e:windows -- --spec $SPEC"
    else
        node test/e2e-debug/safe-test-runner.js "npm run test:e2e:windows"
    fi
    EXIT_CODE=$?
    
else
    # Run normal test with debugging
    echo -e "${MAGENTA}🚀 Running E2E tests with debug logging...${NC}"
    echo "="
    
    if [ -n "$SPEC" ]; then
        npm run test:e2e:windows -- --spec "$SPEC"
    else
        npm run test:e2e:windows
    fi
    EXIT_CODE=$?
fi

echo ""
echo -e "${BLUE}=====================================================${NC}"

# Analyze results
if [ -d "test/e2e-debug/logs" ] && [ "$(ls -A test/e2e-debug/logs)" ]; then
    echo -e "${YELLOW}📊 Analyzing test results...${NC}"
    node test/e2e-debug/analyze-logs.js
    echo ""
fi

# Check for crash dumps
if [ -d "test/e2e-debug/crash-dumps" ] && [ "$(ls -A test/e2e-debug/crash-dumps)" ]; then
    echo -e "${RED}💥 Crash dumps found:${NC}"
    ls -la test/e2e-debug/crash-dumps/
    echo ""
fi

# Display log locations
echo -e "${BLUE}📁 Debug artifacts:${NC}"
echo "  Logs: test/e2e-debug/logs/"
echo "  Crash dumps: test/e2e-debug/crash-dumps/"
echo "  Process logs: test/e2e-debug/process-logs/"
echo ""

# Exit status
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Tests completed successfully${NC}"
else
    echo -e "${RED}❌ Tests failed with exit code: $EXIT_CODE${NC}"
    echo ""
    echo -e "${YELLOW}💡 Next steps:${NC}"
    echo "  1. Review the logs: cat test/e2e-debug/logs/debug-*.log | grep ERROR"
    echo "  2. Check crash dumps: ls test/e2e-debug/crash-dumps/"
    echo "  3. Run minimal test: $0 --minimal"
    echo "  4. Analyze patterns: $0 --analyze"
fi

echo -e "${BLUE}=====================================================${NC}"
exit $EXIT_CODE