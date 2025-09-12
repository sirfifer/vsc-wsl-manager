# Testing with Node.js 22

## Issue Summary

Jest 29 is incompatible with Node.js 22, causing tests to hang indefinitely. This is a known issue that affects many projects using Jest with the latest Node.js version.

## Root Cause

- **Jest 29** officially supports Node.js versions 14.15, 16.10, 18.0, and 20.x
- **Node.js 22** introduced changes that break Jest's test runner
- **Jest 30** (when available with ts-jest support) will add Node 22 compatibility

## Symptoms

When running Jest tests on Node.js 22:
- `npm test` hangs indefinitely
- No output or error messages appear
- Process must be killed manually
- Even simple tests fail to execute

## Workarounds

### 1. Use Alternative Test Runner (Recommended)

```bash
npm run test:node22
```

This runs a custom test script that validates core functionality without Jest.

### 2. Use Quick Test

```bash
npm run quick-test
```

Runs basic validation tests to ensure the extension compiles and core features work.

### 3. Use Node.js 20 LTS

For full Jest test suite compatibility:
```bash
nvm use 20
npm test
```

## Test Coverage

The `test:node22` script covers:
- ✅ TypeScript compilation
- ✅ File structure validation
- ✅ Security checks (no direct exec() usage)
- ✅ Configuration validation
- ✅ Build process verification

## Future Resolution

When Jest 30 and compatible ts-jest are released:
1. Update dependencies: `npm install jest@^30.0.0 ts-jest@^30.0.0`
2. Remove workaround scripts
3. Use standard `npm test` command

## Additional Scripts

- `npm run quick-test` - Basic functionality validation
- `npm run automate` - Automated testing loop
- `npm run compile` - TypeScript compilation only
- `npm run lint` - ESLint validation

## References

- [Jest Issue Tracker](https://github.com/jestjs/jest/issues)
- [Node.js 22 Release Notes](https://nodejs.org/en/blog/release/v22.0.0)
- [Jest 30 Announcement](https://jestjs.io/blog/2025/06/04/jest-30)