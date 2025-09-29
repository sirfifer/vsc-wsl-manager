# Security Documentation

This directory contains security audits, policies, and best practices for the VSC WSL Manager project.

## Contents

### Security Audits

- **[Shai-Hulud Supply-Chain Audit (2025)](./shai-hulud-supply-chain-audit-2025.md)**
  - Comprehensive audit for npm supply-chain attack exposure
  - Status: ✅ CLEARED - No evidence of compromise
  - Date: 2025-09-29

### Security Guides

- **[Supply-Chain Security Best Practices](./supply-chain-security.md)**
  - npm dependency management
  - Lockfile integrity verification
  - CI/CD security hardening
  - Incident response procedures

## Quick Links

### Reporting Security Issues

**DO NOT** create public GitHub issues for security vulnerabilities.

Please report security issues privately:
1. GitHub Security Advisories: [Create Private Report](../../security/advisories/new)
2. Email: security@your-organization.com (if applicable)

### Security Policies

- **Dependency Updates:** Weekly automated scans via Dependabot
- **Vulnerability Response:** Critical issues patched within 24 hours
- **Audit Cadence:** Quarterly supply-chain security audits
- **CI/CD Protection:** All workflows use `--ignore-scripts` flag

### Security Tools in Use

| Tool | Purpose | Status |
|------|---------|--------|
| **GitHub Actions** | Automated security scans | ✅ Active |
| **CodeQL** | Static code analysis | ✅ Active |
| **Snyk** | Dependency vulnerability scanning | ✅ Active |
| **GitLeaks** | Secret detection | ✅ Active |
| **TruffleHog** | Credential scanning | ✅ Active |
| **npm audit** | Built-in npm security | ✅ Active |
| **Lockfile Validation** | Integrity checking | ✅ Active |

## Recent Security Updates

### 2025-09-29: Supply-Chain Hardening
- ✅ Added `--ignore-scripts` to all CI/CD workflows
- ✅ Implemented lockfile integrity validation
- ✅ Completed Shai-Hulud audit (PASSED)
- ✅ Created comprehensive security documentation

### Security Metrics

**Current Status:**
- 🟢 Zero critical vulnerabilities
- 🟢 Zero high-severity vulnerabilities
- 🟢 100% lockfile integrity coverage
- 🟢 All secrets stored securely in GitHub

**Dependencies:**
- Production: 2 packages (uuid, @types/uuid)
- Development: 28 packages
- Total (with transitive): 1,260 packages
- Packages with lifecycle scripts: 0

## Security Training

For developers working on this project:

1. **Supply-Chain Security 101**
   - Read: [supply-chain-security.md](./supply-chain-security.md)
   - Time: 20 minutes

2. **Incident Response Training**
   - Review: Shai-Hulud audit, Section 9
   - Practice: Tabletop exercise (quarterly)

3. **Secure Development Practices**
   - Read: CLAUDE.md security sections
   - Complete: Security checklist before each PR

## Contact

For security questions or concerns:
- **Security Team:** [Create Security Advisory](../../security/advisories/new)
- **Development Questions:** [Open Discussion](../../discussions)
- **General Issues:** [Create Issue](../../issues/new)

---

*Last Updated: 2025-09-29*
*Document Owner: Engineering Security Team*