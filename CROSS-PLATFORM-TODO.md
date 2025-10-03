# Cross-Platform Development TODO

## Current Status (2025-10-02)

### ✅ Windows (WSL) - COMPLETE
- [x] WSL distribution management
- [x] APPX/AppxBundle extraction (PowerShell Expand-Archive)
- [x] Terminal profile integration
- [x] Download and import functionality
- [x] Unit tests: 221/244 passing (23 skipped, 2 flaky network tests)
- [x] Integration tests: Platform-specific, skip on non-Windows

### ⚠️ Critical Issues to Fix IMMEDIATELY

#### **BLOCKER: Network-Dependent Test Failures**
- [ ] Fix `should timeout on slow downloads` test - uses external httpbin.org (502 errors)
- [ ] Fix `should skip download if file exists with correct checksum` - uses httpbin.org (502 errors)
- **Action**: Replace httpbin.org with Microsoft or GitHub URLs that are more reliable
- **File**: `test/unit/distros/distroDownloader.real.test.ts:182-197, 389-410`

#### **BLOCKER: Skipped Tests Audit**
- [ ] Review ALL 23 skipped unit tests - determine if they should be fixed or removed
- [ ] Review ALL skipped integration tests
- [ ] Document WHY each test is skipped if it must remain skipped

Current Skipped Tests:
```
- test/unit/utils/commandBuilder.real.test.ts: 1 skipped
- test/unit/distros/catalogConcurrency.real.test.ts: 4 skipped
- test/unit/distros/enhancedDistroManager.real.test.ts: 5 skipped
- test/unit/distros/distroDownloader.real.test.ts: 4 skipped
- test/unit/images/imageManager.real.test.ts: 8 skipped (4 entire describe blocks!)
- test/unit/images/wslImageManager.real.test.ts: 1 skipped
```

**ALL SKIPPED TESTS MUST BE:**
1. Fixed and unskipped, OR
2. Documented with clear reason and removal plan

#### **BLOCKER: File Existence Check Bug**
- [ ] Fix APPX extraction error when file doesn't exist
- **Error**: `ENOENT: no such file or directory, copyfile 'non-existent.appx' -> 'non-existent.appx.zip'`
- **Location**: `DistroDownloader.ts:324` - need to check if file exists before copying
- **Test**: `distroDownloader.appx.real.test.ts:152` - "should handle non-existent APPX file"

---

## Platform Support Roadmap

### 🚧 macOS - PLANNED (Next Platform)

**Reference Document**: [mac-containers-image-management-proposal.md](docs/references/mac-containers-image-management-proposal.md)

#### Phase 1: Container Runtime Detection (4 weeks)
- [ ] Detect Docker Desktop installation
- [ ] Detect OrbStack installation
- [ ] Detect Podman installation
- [ ] Detect Colima installation
- [ ] Create container runtime abstraction layer
- [ ] Implement runtime selection UI

#### Phase 2: Container Management (3 weeks)
- [ ] List Docker containers
- [ ] List Docker images
- [ ] Start/stop containers
- [ ] Create containers from images
- [ ] Remove containers
- [ ] Container status monitoring

#### Phase 3: Terminal Integration (3 weeks)
- [ ] Terminal profile generation for containers
- [ ] One-click container terminal access
- [ ] Multi-session support
- [ ] Shell detection (bash/zsh/fish)
- [ ] Working directory persistence

#### Phase 4: Image Management (2 weeks)
- [ ] Pull images from registries
- [ ] Build images from Dockerfiles
- [ ] Tag and push images
- [ ] Image cleanup utilities
- [ ] Template management

#### Phase 5: Advanced Features (2 weeks)
- [ ] Docker Compose integration
- [ ] Volume management
- [ ] Network management
- [ ] Resource monitoring (CPU/memory)
- [ ] Container export/import

#### Phase 6: Testing & Documentation (2 weeks)
- [ ] Unit tests for all container operations
- [ ] Integration tests with real Docker
- [ ] Cross-platform test runner
- [ ] User documentation
- [ ] Migration guide from WSL Manager

**Total Timeline: 16 weeks**

---

### 🔮 Linux - FUTURE

#### Container-Based Approach (Similar to macOS)
- [ ] Docker support
- [ ] Podman support (rootless preferred)
- [ ] LXC/LXD support (system containers)
- [ ] Terminal integration
- [ ] Image management

#### Native Package Manager Integration
- [ ] apt/dpkg support (Debian/Ubuntu)
- [ ] dnf/rpm support (Fedora/RHEL)
- [ ] pacman support (Arch)
- [ ] Environment switching via chroot/systemd-nspawn

---

## Testing Strategy

### Immediate Actions Required

#### 1. Fix Flaky Network Tests
**Priority: CRITICAL**

```typescript
// BEFORE (unreliable):
const testUrl = 'https://httpbin.org/bytes/256';

// AFTER (reliable):
const testUrl = 'https://raw.githubusercontent.com/microsoft/WSL/main/distributions/DistributionInfo.json';
```

**Files to Update**:
- `test/unit/distros/distroDownloader.real.test.ts:182-197`
- `test/unit/distros/distroDownloader.real.test.ts:389-410`

#### 2. Fix Missing File Handling
**Priority: CRITICAL**

```typescript
// Add file existence check before copyFile
if (!fs.existsSync(appxPath)) {
    throw new Error(`APPX file not found: ${appxPath}`);
}
```

**Location**: `src/distros/DistroDownloader.ts:324`

#### 3. Unskip or Remove Dead Tests
**Priority: HIGH**

For each skipped test:
1. Try to fix and unskip
2. If unfixable, document WHY in test comment
3. If obsolete, remove entirely
4. If platform-specific, add proper guards

Example:
```typescript
// GOOD: Clear reason + removal plan
it.skip('should import from network share', async () => {
    // SKIPPED: Windows network share support requires Active Directory testing infrastructure
    // TODO: Implement mock network share for testing (Issue #123)
    // Target: Q2 2025
});

// BAD: Vague skip
it.skip('should do something', async () => {
    // TODO: Fix this
});
```

### Cross-Platform Test Architecture

```
test/
├── unit/                      # Platform-agnostic unit tests
│   ├── *.real.test.ts        # Real implementations, no mocks
│   └── platform/             # Platform-specific tests
│       ├── windows.test.ts
│       ├── macos.test.ts
│       └── linux.test.ts
├── integration/              # API-level tests
│   ├── *.real.test.ts       # Real VS Code instance
│   └── platform/
│       ├── windows/         # WSL-specific tests
│       ├── macos/          # Container-specific tests
│       └── linux/          # Container/native tests
└── e2e/                     # UI automation tests
    ├── windows/
    ├── macos/
    └── linux/
```

---

## Documentation Requirements

### Immediate
- [ ] Document current skipped tests with reasons
- [ ] Update TESTING.md with current status
- [ ] Document APPX extraction fix in CHANGELOG

### For macOS Support
- [ ] Container runtime comparison guide
- [ ] Setup instructions for each runtime
- [ ] Migration guide from Docker Desktop
- [ ] Performance benchmarks
- [ ] Security considerations

### For Linux Support
- [ ] Distribution-specific guides
- [ ] Package manager integration docs
- [ ] Rootless container setup
- [ ] Security hardening guide

---

## Success Criteria

### Windows (Current)
- ✅ 100% of non-network unit tests pass
- ⚠️ 2 network tests failing (httpbin.org issues)
- ⚠️ 23 tests skipped (needs audit)
- ✅ Manual testing: Downloads and extracts Debian successfully

### macOS (Target)
- [ ] Container runtime auto-detection works
- [ ] Can list and manage containers
- [ ] Terminal integration functional
- [ ] 90%+ test coverage
- [ ] <2s container listing
- [ ] <3s terminal connection

### Linux (Target)
- [ ] Both container and native paths supported
- [ ] Works on Debian, Ubuntu, Fedora, Arch
- [ ] Rootless container support
- [ ] 90%+ test coverage

---

## Immediate Action Items (Next 24 Hours)

### MUST DO:
1. **Fix network test failures** - Replace httpbin.org URLs
2. **Fix file existence check** - Handle non-existent APPX files
3. **Run full test suite** - Verify 100% pass rate (excluding documented skips)
4. **Audit all skipped tests** - Document or fix each one

### SHOULD DO:
1. Review cross-platform testing strategy document
2. Set up macOS development environment
3. Install Docker Desktop for macOS testing
4. Create proof-of-concept for container detection

### NICE TO HAVE:
1. Research OrbStack API
2. Investigate Podman vs Docker differences
3. Plan Phase 1 sprint for macOS support

---

## Notes

- **Policy**: NO TESTS SHALL BE SKIPPED WITHOUT DOCUMENTATION
- **Policy**: ALL EXTERNAL DEPENDENCIES MUST BE RELIABLE (no httpbin.org)
- **Policy**: MANUAL TESTING REQUIRED for all download/extraction flows
- **Policy**: 100% TEST PASS RATE before declaring work complete

Last Updated: 2025-10-02
