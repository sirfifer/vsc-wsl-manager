# Feature Coverage Tracking - VSC WSL Manager

Last Updated: <!-- Update this date when modifying -->

## Coverage Summary
- **Overall Coverage:** ____%
- **Critical Path Coverage:** ____%
- **Edge Case Coverage:** ____%
- **E2E Coverage:** ____%

## Quick Stats
- Total Features: 24
- Completed: 0 (🟢)
- In Progress: 0 (🟡)
- Not Started: 24 (🔴)

## Feature Coverage Matrix

| Feature ID | Feature Name | Priority | Status | Unit Tests | Integration Tests | E2E Tests | Coverage % | Owner | Notes |
|------------|--------------|----------|--------|------------|-------------------|-----------|------------|-------|-------|
| **WSL Distribution Management** |||||||||
| WSL-001 | List Distributions | Critical | 🔴 Not Started | 0/5 | 0/3 | 0/2 | 0% | - | Display all WSL distros in tree view |
| WSL-002 | Clone Distribution | Critical | 🔴 Not Started | 0/8 | 0/4 | 0/3 | 0% | - | Create new distro from template |
| WSL-003 | Delete Distribution | High | 🔴 Not Started | 0/6 | 0/3 | 0/2 | 0% | - | Safe deletion with confirmations |
| WSL-004 | Import Distribution | High | 🔴 Not Started | 0/7 | 0/3 | 0/2 | 0% | - | Import from TAR file |
| WSL-005 | Export Distribution | High | 🔴 Not Started | 0/6 | 0/3 | 0/2 | 0% | - | Export to TAR file |
| WSL-006 | Distribution Status | Medium | 🔴 Not Started | 0/4 | 0/2 | 0/1 | 0% | - | Real-time status updates |
| **Terminal Integration** |||||||||
| TERM-001 | Open Terminal | Critical | 🔴 Not Started | 0/5 | 0/3 | 0/2 | 0% | - | Open terminal for specific distro |
| TERM-002 | Auto Profile Registration | High | 🔴 Not Started | 0/6 | 0/4 | 0/2 | 0% | - | Register terminal profiles |
| TERM-003 | Terminal Context Menu | Medium | 🔴 Not Started | 0/4 | 0/2 | 0/2 | 0% | - | Right-click terminal actions |
| **Tree View UI** |||||||||
| UI-001 | Distro Tree View | Critical | 🔴 Not Started | 0/6 | 0/3 | 0/3 | 0% | - | Two-world architecture display |
| UI-002 | Image Tree View | Critical | 🔴 Not Started | 0/6 | 0/3 | 0/3 | 0% | - | Instance management view |
| UI-003 | Tree Refresh | High | 🔴 Not Started | 0/4 | 0/2 | 0/2 | 0% | - | Manual and auto refresh |
| UI-004 | Tree Icons | Low | 🔴 Not Started | 0/3 | 0/1 | 0/1 | 0% | - | Status-based icons |
| **Command Palette** |||||||||
| CMD-001 | Command Registration | Critical | 🔴 Not Started | 0/8 | 0/4 | 0/2 | 0% | - | All commands available |
| CMD-002 | Command Validation | High | 🔴 Not Started | 0/6 | 0/3 | 0/2 | 0% | - | Input validation |
| CMD-003 | Quick Pick UI | Medium | 🔴 Not Started | 0/5 | 0/2 | 0/3 | 0% | - | Template selection |
| **Security** |||||||||
| SEC-001 | Input Sanitization | Critical | 🔴 Not Started | 0/10 | 0/5 | 0/2 | 0% | - | Prevent command injection |
| SEC-002 | Rate Limiting | High | 🔴 Not Started | 0/5 | 0/3 | 0/1 | 0% | - | Prevent resource exhaustion |
| SEC-003 | Audit Logging | Medium | 🔴 Not Started | 0/4 | 0/2 | 0/1 | 0% | - | Track all operations |
| **AI Tool Support** |||||||||
| AI-001 | Aider Integration | High | 🔴 Not Started | 0/6 | 0/3 | 0/3 | 0% | - | Primary AI tool support |
| AI-002 | Claude Code Support | High | 🔴 Not Started | 0/5 | 0/3 | 0/2 | 0% | - | Anthropic CLI integration |
| AI-003 | Environment Isolation | Critical | 🔴 Not Started | 0/7 | 0/4 | 0/2 | 0% | - | Project-specific environments |
| **Extension Core** |||||||||
| EXT-001 | Activation Events | Critical | 🔴 Not Started | 0/4 | 0/3 | 0/2 | 0% | - | Clean activation |
| EXT-002 | Configuration | Medium | 🔴 Not Started | 0/5 | 0/2 | 0/2 | 0% | - | User settings support |


## Legend

### Status Indicators
- 🟢 **Complete**: Feature fully tested with >90% coverage
- 🟡 **In Progress**: Partial test coverage (10-90%)
- 🔴 **Not Started**: No tests written yet (<10%)

### Priority Levels
- **Critical**: Must have 100% coverage before release
- **High**: Should have >80% coverage
- **Medium**: Target 70% coverage
- **Low**: Nice to have, >50% coverage acceptable

### Test Count Format
- Format: `completed/total`
- Example: `3/5` means 3 tests completed out of 5 planned

## Critical Path Features
These features must maintain 100% coverage at all times:
1. **WSL-001**: List Distributions - Core functionality
2. **WSL-002**: Clone Distribution - Primary use case
3. **TERM-001**: Open Terminal - Essential integration
4. **UI-001**: Distro Tree View - Main UI component
5. **CMD-001**: Command Registration - All commands must work
6. **SEC-001**: Input Sanitization - Security critical
7. **AI-003**: Environment Isolation - Key value proposition
8. **EXT-001**: Activation Events - Extension must activate cleanly

## Test Writing Priority Queue
Based on priority and the TDD approach (test first, then implement):

### Sprint 1: Foundation (Week 1-2)
- [ ] EXT-001: Activation Events
- [ ] WSL-001: List Distributions
- [ ] UI-001: Distro Tree View
- [ ] CMD-001: Command Registration

### Sprint 2: Core WSL Features (Week 3-4)
- [ ] WSL-002: Clone Distribution
- [ ] WSL-003: Delete Distribution
- [ ] SEC-001: Input Sanitization
- [ ] TERM-001: Open Terminal

### Sprint 3: Terminal & UI (Week 5-6)
- [ ] TERM-002: Auto Profile Registration
- [ ] UI-002: Image Tree View
- [ ] UI-003: Tree Refresh
- [ ] CMD-002: Command Validation

### Sprint 4: AI Tool Support (Week 7-8)
- [ ] AI-003: Environment Isolation
- [ ] AI-001: Aider Integration
- [ ] AI-002: Claude Code Support
- [ ] WSL-004: Import Distribution

### Sprint 5: Security & Polish (Week 9-10)
- [ ] SEC-002: Rate Limiting
- [ ] SEC-003: Audit Logging
- [ ] WSL-005: Export Distribution
- [ ] EXT-002: Configuration

## Coverage Goals by Milestone

| Milestone | Target Date | Overall Coverage | Critical Path | Notes |
|-----------|------------|------------------|---------------|-------|
| Pre-Alpha | - | 20% | 40% | Basic functionality |
| Alpha | - | 40% | 60% | Core features working |
| Beta | - | 60% | 80% | AI tools integrated |
| RC1 | - | 75% | 95% | Security hardened |
| Release | - | 80% | 100% | Production ready |

## Test Debt Tracking

| Feature | Technical Debt | Impact | Resolution Plan |
|---------|---------------|--------|-----------------|
| WSL-002 | Need to test piping between export/import | High | Add integration tests for streaming |
| TERM-002 | Terminal profiles vary by VS Code version | Medium | Test against multiple VS Code versions |
| AI-001 | Aider command variations | Medium | Parametrize tests for different Aider configs |
| SEC-001 | Unicode in distribution names | Low | Add edge case tests |

## Notes for Contributors

### How to Update This Document
1. When starting work on a feature, update status to 🟡
2. Write tests FIRST (TDD approach)
3. Update test counts as you write tests
4. Calculate coverage % as: (completed tests / total tests) * 100
5. Move to 🟢 when coverage >90%
6. Add your GitHub username as Owner when taking responsibility

### Test-First Development Process
1. **Pick a feature** from the priority queue
2. **Write failing tests** based on the test counts
3. **Run tests** to verify they fail
4. **Implement feature** until tests pass
5. **Refactor** with confidence
6. **Update this document** with progress

### Adding New Features
1. Use next available ID in category (e.g., WSL-007)
2. Define total test counts based on:
   - Unit: One test per public method + edge cases
   - Integration: One test per interaction point
   - E2E: One test per user workflow
3. Set appropriate priority level
4. Add to priority queue if Critical or High

### Calculating Coverage Percentages
```
Feature Coverage % = (Completed Tests / Total Tests) × 100
Overall Coverage % = Average of all feature coverages weighted by priority
Critical Path Coverage % = Average of Critical priority features only
```

### AI-Assisted Test Writing
This project is optimized for AI coding assistants. When using tools like Aider or Claude Code:
1. Point them to this document for context
2. Ask them to write tests for a specific Feature ID
3. Have them update the test counts after writing
4. Request they follow the templates in TESTING.md

## WebdriverIO E2E Test Focus Areas

Since UI testing is critical for this extension and AI tools need to interact with it:

### Primary E2E Scenarios
1. **Complete Distribution Creation Flow**: Template selection → Name input → Creation → Verification
2. **Terminal Integration**: Open terminal → Verify profile → Execute commands
3. **Tree View Interactions**: Refresh → Context menus → Drag and drop (future)
4. **Error Handling**: Invalid inputs → Duplicate names → WSL not installed
5. **AI Tool Workflows**: Create environment → Install tools → Isolation verification

### E2E Test Data Requirements
- Mock WSL command outputs for consistent testing
- Pre-created TAR files for import testing
- Template distribution configurations
- Invalid input test cases for security testing
