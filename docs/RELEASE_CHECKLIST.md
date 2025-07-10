# Release Checklist for VSC WSL Manager

This checklist ensures a smooth and secure release process for the VSC WSL Manager extension.

## Pre-Release Checklist

### Code Quality
- [ ] All tests pass (`npm test`)
- [ ] Code coverage is above 80% (`npm run test:coverage`)
- [ ] No linting errors (`npm run lint`)
- [ ] TypeScript compilation succeeds (`npm run compile`)
- [ ] API documentation is up to date (`npm run docs`)

### Security
- [ ] No vulnerable dependencies (`npm audit`)
- [ ] Security tests pass (`npm run test:security`)
- [ ] No hardcoded secrets or API keys
- [ ] All user inputs are validated
- [ ] Error messages don't expose sensitive information

### Documentation
- [ ] README.md is up to date
- [ ] CHANGELOG.md has release notes
- [ ] Version number updated in package.json
- [ ] API documentation generated
- [ ] User guides are current

### Testing
- [ ] Manual testing on Windows 10
- [ ] Manual testing on Windows 11
- [ ] Test with different WSL distributions
- [ ] Test with VS Code stable
- [ ] Test with VS Code insiders
- [ ] Test extension installation
- [ ] Test extension update

## Build Process

### 1. Update Version
```bash
# Update version in package.json
npm version minor  # or major/patch
```

### 2. Build Extension
```bash
# Clean build
rm -rf out/
npm run compile

# Package extension
npm install -g vsce
vsce package
```

### 3. Verify VSIX
- [ ] VSIX file size is reasonable (<10MB)
- [ ] VSIX contains all required files
- [ ] No unnecessary files included
- [ ] Test install locally

## Release Process

### 1. GitHub Release
- [ ] Create git tag: `git tag -a v1.0.0 -m "Release v1.0.0"`
- [ ] Push tag: `git push origin v1.0.0`
- [ ] Create GitHub release with:
  - [ ] Release notes from CHANGELOG.md
  - [ ] Attach VSIX file
  - [ ] Mark as latest release

### 2. Marketplace Release
- [ ] Login to marketplace: `vsce login <publisher>`
- [ ] Publish extension: `vsce publish`
- [ ] Verify on marketplace after ~5 minutes
- [ ] Test installation from marketplace

### 3. Post-Release
- [ ] Update README.md badges if needed
- [ ] Close related GitHub issues
- [ ] Announce release (if applicable)
- [ ] Monitor for user feedback

## Rollback Plan

If issues are discovered post-release:

1. **Immediate Actions**
   - [ ] Unpublish from marketplace if critical
   - [ ] Create hotfix branch
   - [ ] Document issue in GitHub

2. **Fix Process**
   - [ ] Identify root cause
   - [ ] Implement fix with tests
   - [ ] Fast-track testing
   - [ ] Release patch version

3. **Communication**
   - [ ] Update GitHub release notes
   - [ ] Notify affected users
   - [ ] Document lessons learned

## Version Numbering

Follow Semantic Versioning:
- **MAJOR (1.0.0)**: Breaking changes
- **MINOR (0.1.0)**: New features, backwards compatible
- **PATCH (0.0.1)**: Bug fixes, backwards compatible

## Marketplace Metadata

Ensure these are updated:
- [ ] Extension display name
- [ ] Description
- [ ] Categories
- [ ] Keywords
- [ ] Icon (128x128 PNG)
- [ ] README with screenshots
- [ ] Repository URL
- [ ] License

## Final Checks

Before clicking publish:
- [ ] Version is correct
- [ ] CHANGELOG is updated
- [ ] No debug code left
- [ ] No development dependencies bundled
- [ ] Extension tested on clean VS Code install

## Support Plan

Post-release support:
- [ ] Monitor GitHub issues
- [ ] Check marketplace reviews
- [ ] Respond to user questions
- [ ] Plan next release improvements

---

**Remember**: It's better to delay a release than to ship with known issues!