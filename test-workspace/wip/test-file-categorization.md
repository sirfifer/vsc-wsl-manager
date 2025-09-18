# Test File Categorization for Refactoring

## Level 1: Pure Node.js Tests (NO vscode imports)
These can run with regular Node.js/Vitest:

### Source files that DON'T import vscode:
- `src/utils/inputValidator.ts` - Pure validation logic
- `src/utils/commandBuilder.ts` - Command construction
- `src/distributionRegistry.ts` - HTTP fetch operations
- `src/distributionDownloader.ts` - File downloads
- `src/distroManager.ts` - File operations
- `src/imageManager.ts` - TAR file operations
- `src/manifest/*` - JSON parsing

### Existing tests to REFACTOR (remove mocks only):
1. `test/unit/distributionRegistry.test.ts` - Replace mock fetch with real HTTP
2. `test/unit/distroCommands.test.ts` - Test command building logic
3. `test/unit/errorScenarios/errorScenarios.test.ts` - Already mock-free, keep as-is
4. `test/unit/treeProviders/treeItems.test.ts` - May have pure logic tests

## Level 2: VS Code Integration Tests (imports vscode)
These MUST run with @vscode/test-electron:

### Source files that DO import vscode:
- `src/wslManager.ts` - Uses vscode for notifications
- `src/security/securityValidator.ts` - Uses vscode configuration
- `src/errors/errorHandler.ts` - Uses vscode for UI display
- `src/views/DistroTreeProvider.ts` - Tree view UI
- `src/views/ImageTreeProvider.ts` - Tree view UI
- `src/terminal/wslTerminalProfileProvider.ts` - Terminal integration
- `src/extension.ts` - Extension entry point
- `src/utils/logger.ts` - VS Code output channel

### Tests that MUST be Level 2:
1. `test/integration/uiFlows.test.ts` - Tests VS Code UI flows
2. `test/ui-commands.test.ts` - Tests VS Code commands
3. `test/unit/wslManager.real.test.ts` - Move to integration/
4. `test/unit/security/securityValidator.real.test.ts` - Move to integration/
5. `test/unit/errors/errorHandler.real.test.ts` - Move to integration/
6. Any tree provider tests
7. Extension activation tests

## Level 3: E2E Tests (Windows UI)
These run with WebdriverIO on Windows:
- `test/e2e/*.test.ts` - Complete user workflows

## Files with Mocks to Address

Based on grep results, these 11 files contain mocks:
1. `/test/fixtures/distributions.ts` - Test data, not a test file
2. `/test/real-output-tests/simpleTestRunner.js` - Infrastructure
3. `/test/real-output-tests/runRealTests.js` - Infrastructure
4. `/test/integration/uiFlows.test.ts` - Needs Level 2 refactoring
5. `/test/ui-commands.test.ts` - Needs Level 2 refactoring
6. `/test/integration/distribution-download.test.ts` - Already looks real?
7. `/test/utils/testDataGenerators.ts` - Utility, not a test
8. `/test/unit/distributionRegistry.test.ts` - Needs Level 1 refactoring
9. `/test/setup.ts` - Infrastructure to remove
10. `/test/utils/testDataGenerators.js` - Duplicate utility
11. `/test/setup.js` - Duplicate infrastructure

## Refactoring Priority

### High Priority (Quick wins):
1. Remove setup files with mocks (`test/setup.ts`, `test/setup.js`)
2. Clean utilities (`test/utils/testDataGenerators.*`)
3. Refactor `distributionRegistry.test.ts` to use real fetch

### Medium Priority (More complex):
1. Refactor `uiFlows.test.ts` for Level 2 with real VS Code
2. Refactor `ui-commands.test.ts` for Level 2
3. Move misplaced real tests to correct folders

### Low Priority:
1. Review `distribution-download.test.ts` (may already be real)
2. Clean up test fixtures