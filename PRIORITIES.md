# VSC WSL Manager - Development Priorities

This document outlines the development priorities for VSC WSL Manager, organized into three main phases to guide our work from initial functionality validation through to marketplace release.

## Quick Start

**New automated setup process available!**
```bash
# Set up your entire development environment
python setup-environment.py

# Test the extension locally
python scripts/test-local.py
```

See [SETUP.md](docs/SETUP.md) for detailed setup instructions.

## Phase 1: Get It Working (Functional Validation) 🔧

**Goal**: Validate core functionality and refine features through rapid iteration.

### Immediate Blockers
- [ ] Run environment setup script: `python setup-environment.py`
  - [ ] Validates all dependencies
  - [ ] Installs npm packages
  - [ ] Prompts for GitHub username and publisher name
  - [ ] Creates development icon if missing
- [ ] Fix any runtime errors discovered during testing

### Core Functionality Testing
- [ ] Test WSL distribution listing on actual Windows system
- [ ] Verify distribution creation/cloning works
- [ ] Test import/export functionality with real TAR files
- [ ] Validate terminal integration creates proper profiles
- [ ] Test all error scenarios with actual WSL

### Quick Iterations
- [ ] Debug any command execution issues
- [ ] Refine user prompts and messages based on testing
- [ ] Adjust timeouts based on real-world performance
- [ ] Fix any UI/UX issues in tree view

### Local Testing Workflow
- [ ] Use automated testing script: `python scripts/test-local.py`
  - [ ] Compiles TypeScript
  - [ ] Runs unit tests
  - [ ] Packages extension
  - [ ] Provides installation instructions
- [ ] Manual testing in VS Code (F5 to launch)
- [ ] Verify all commands with real WSL distributions

### Acceptance Criteria
- Extension activates without errors
- All commands execute successfully
- Terminal profiles work correctly
- Error messages are helpful and accurate
- Environment setup completed successfully

## Phase 2: GitHub Public Release 🌍

**Goal**: Prepare for public visibility and community contributions.

### Repository Setup
- [ ] Create GitHub repository with proper name
- [ ] Update all URLs in package.json to real repository
- [ ] Set up branch protection rules
- [ ] Configure repository settings (issues, discussions, wiki)

### Documentation Enhancement
- [ ] Add real screenshots to README
  - [ ] Tree view with distributions
  - [ ] Terminal integration example
  - [ ] Import/export dialogs
- [ ] Create animated GIF demos for key features
- [ ] Add installation instructions for development setup

### Community Setup
- [ ] Create issue templates
  - [ ] Bug report template
  - [ ] Feature request template
  - [ ] Security issue template
- [ ] Create pull request template
- [ ] Set up GitHub Actions secrets if needed
- [ ] Add code of conduct
- [ ] Create initial GitHub release with VSIX

### Missing Implementation Items
- [ ] Set up pre-commit hooks (husky)
  - [ ] Run tests before commit
  - [ ] Run linting before commit
  - [ ] Prevent commits with failing tests
- [ ] Complete E2E tests setup
  - [ ] Create `test/e2e/` test suite
  - [ ] Test full user workflows
  - [ ] Add to CI pipeline

### Acceptance Criteria
- Repository is public and properly configured
- All documentation includes real examples
- Community can contribute easily
- CI/CD pipeline passes on all PRs

## Phase 3: VS Code Marketplace Submission 🚀

**Goal**: Professional release to VS Code Marketplace.

### Publisher Setup
- [ ] Create VS Code Marketplace publisher account
- [ ] Verify publisher identity
- [ ] Set up Personal Access Token for publishing
- [ ] Update package.json with real publisher ID

### Professional Assets
- [ ] Design professional icon (128x128 PNG)
- [ ] Create banner image for marketplace
- [ ] Prepare 5-6 high-quality screenshots
- [ ] Write compelling marketplace description
- [ ] Create demo video (optional but recommended)

### Performance Optimization
- [ ] Complete performance testing
  - [ ] Memory usage profiling
  - [ ] Command execution benchmarks
  - [ ] Extension load time optimization
- [ ] Minimize extension size
  - [ ] Review bundled dependencies
  - [ ] Exclude unnecessary files
  - [ ] Optimize assets

### Final Quality Checks
- [ ] Test on multiple Windows versions
  - [ ] Windows 10 (multiple builds)
  - [ ] Windows 11
  - [ ] Different WSL configurations
- [ ] Accessibility compliance
  - [ ] Screen reader compatibility
  - [ ] Keyboard navigation
  - [ ] High contrast theme support
- [ ] Security audit
  - [ ] Final dependency scan
  - [ ] Code security review
  - [ ] Rate limiting verification

### Marketplace Optimization
- [ ] SEO-friendly description with keywords
- [ ] Proper categorization
- [ ] Competitive analysis of similar extensions
- [ ] Pricing strategy (free)
- [ ] Support channel setup

### Acceptance Criteria
- Extension passes all marketplace requirements
- Professional appearance and branding
- Performance meets acceptable standards
- Zero security vulnerabilities

## Additional Priorities (Post-Launch) 📈

### Analytics and Telemetry
- [ ] Implement privacy-respecting telemetry
  - [ ] Usage metrics
  - [ ] Error tracking
  - [ ] Feature adoption rates
- [ ] Set up monitoring dashboard

### Feature Roadmap
- [ ] Gather user feedback from early adopters
- [ ] Plan v2.0 features based on requests
- [ ] Consider enterprise features
- [ ] Explore VS Code Remote WSL integration

### Support Infrastructure
- [ ] Set up support documentation site
- [ ] Create FAQ based on user questions
- [ ] Establish response time SLAs
- [ ] Build community around extension

## Priority Matrix

| Phase | Timeline | Risk | Impact |
|-------|----------|------|--------|
| Phase 1 | 1-2 days | Low | Critical - Must work |
| Phase 2 | 3-5 days | Medium | High - Public visibility |
| Phase 3 | 1 week | High | High - Official release |

## Dependencies

### Phase 1 → Phase 2
- Core functionality must be stable
- All critical bugs must be fixed
- Basic documentation must exist

### Phase 2 → Phase 3
- GitHub repository must be public
- Community feedback incorporated
- All tests must pass consistently
- Performance must be acceptable

## Success Metrics

### Phase 1
- Zero runtime errors
- All features functional
- Positive internal testing feedback

### Phase 2
- GitHub stars and watches
- Community contributions (issues, PRs)
- Clean CI/CD pipeline

### Phase 3
- Marketplace installs
- User ratings (target: 4.5+ stars)
- Low bug report rate
- Active user retention

---

**Note**: This is a living document. Update checkboxes as tasks are completed and add new items as discovered during development.