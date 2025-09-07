#!/bin/bash

# Safe Command Runner for VSC WSL Manager
# This script only allows pre-approved npm commands to run
# Used for autonomous iteration during development

# Define allowed commands
ALLOWED_COMMANDS=(
    "compile"
    "quick-test"
    "automate"
    "test"
    "test:unit"
    "test:integration"
    "test:vscode"
    "lint"
    "lint:fix"
    "watch"
    "dev"
    "diagnostics"
)

# Check if command is provided
if [ $# -eq 0 ]; then
    echo "Usage: ./safe-runner.sh <command> [args...]"
    echo "Allowed commands:"
    for cmd in "${ALLOWED_COMMANDS[@]}"; do
        echo "  - $cmd"
    done
    exit 1
fi

# Get the command
COMMAND=$1
shift  # Remove first argument to pass remaining to npm

# Check if command is allowed
if [[ " ${ALLOWED_COMMANDS[@]} " =~ " ${COMMAND} " ]]; then
    echo "✅ Running: npm run ${COMMAND} $@"
    npm run "${COMMAND}" "$@"
    EXIT_CODE=$?
    
    if [ $EXIT_CODE -eq 0 ]; then
        echo "✅ Command completed successfully"
    else
        echo "❌ Command failed with exit code: $EXIT_CODE"
    fi
    
    exit $EXIT_CODE
else
    echo "❌ Command not allowed: ${COMMAND}"
    echo "Allowed commands:"
    for cmd in "${ALLOWED_COMMANDS[@]}"; do
        echo "  - $cmd"
    done
    exit 1
fi