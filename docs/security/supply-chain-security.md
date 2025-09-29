# Supply-Chain Security Best Practices

## Overview

This document outlines security practices for managing npm dependencies and protecting against supply-chain attacks.

## Table of Contents

1. [Dependency Management](#dependency-management)
2. [Lockfile Integrity](#lockfile-integrity)
3. [CI/CD Security](#cicd-security)
4. [Monitoring & Detection](#monitoring--detection)
5. [Incident Response](#incident-response)
6. [Security Checklists](#security-checklists)

---

## Dependency Management

### Principles

1. **Minimize Dependencies**
   - Production dependencies: Keep to absolute minimum
   - Current count: 2 (uuid, @types/uuid)
   - Review each new dependency critically

2. **Use Exact Versions**
   ```json
   // ✅ GOOD - Exact version
   "dependencies": {
     "uuid": "12.0.0"
   }

   // ❌ BAD - Floating version
   "dependencies": {
     "uuid": "^12.0.0"
   }
   ```

3. **Audit Before Adding**
   ```bash
   # Check package reputation
   npm view <package-name>

   # Check for known vulnerabilities
   npm audit <package-name>

   # Check download stats and maintenance
   npm info <package-name>
   ```

### Dependency Review Checklist

Before adding a new dependency:

- [ ] **Necessity:** Can we implement this ourselves?
- [ ] **Reputation:** >1M weekly downloads OR well-known maintainer
- [ ] **Maintenance:** Updated within last 6 months
- [ ] **Security:** No known vulnerabilities (`npm audit`)
- [ ] **License:** Compatible with MIT (our license)
- [ ] **Size:** Reasonable bundle impact
- [ ] **Dependencies:** Minimal transitive dependencies
- [ ] **Alternatives:** Evaluated 2-3 alternatives

---

## Lockfile Integrity

### Why Lockfile Matters

The `package-lock.json` file:
- Ensures reproducible builds
- Locks exact dependency versions
- Includes SHA-512 integrity hashes
- Prevents supply-chain attacks via version substitution

### Lockfile Security Rules

**Rule 1: Never commit without lockfile**
```bash
# Always commit both together:
git add package.json package-lock.json
git commit -m "feat: add new dependency"
```

**Rule 2: Validate integrity after install**
```bash
# Check lockfile unchanged:
git diff package-lock.json

# If changed without adding dependencies, investigate!
```

**Rule 3: Use `npm ci` in CI/CD**
```bash
# ✅ GOOD - Uses lockfile exactly
npm ci --ignore-scripts

# ❌ BAD - May update lockfile
npm install
```

### Integrity Hash Verification

All packages must have integrity hashes:

```json
{
  "node_modules/uuid": {
    "version": "12.0.0",
    "resolved": "https://registry.npmjs.org/uuid/-/uuid-12.0.0.tgz",
    "integrity": "sha512-USe1zesMYh4fjCA8ZH5+X5WIVD0J4V1Jksm1bFTVBX2F/cwSXt0RO5w/3UXbdLKmZX65MiWV+hwhSS8p6oBTGA=="
  }
}
```

**Verify all packages:**
```bash
# Check for missing integrity hashes:
jq '.packages | to_entries[] | select(.key != "" and .value.integrity == null and .value.link == null) | .key' package-lock.json

# Should return empty result
```

---

## CI/CD Security

### Script Execution Prevention

**CRITICAL:** Always use `--ignore-scripts` flag in CI/CD.

**Why:** Lifecycle scripts (`postinstall`, `preinstall`) can:
- Steal secrets from environment variables
- Modify source code or artifacts
- Exfiltrate credentials to attacker-controlled servers
- Backdoor the build process

**Implementation:**

```yaml
# .github/workflows/*.yml

# ✅ SECURE
- name: Install dependencies
  run: npm ci --ignore-scripts

# ❌ INSECURE
- name: Install dependencies
  run: npm ci
```

### Secret Management

**Rule 1: Never hardcode secrets**

```typescript
// ❌ BAD
const apiKey = "sk_live_abc123";

// ✅ GOOD
const apiKey = process.env.API_KEY;
```

**Rule 2: Use GitHub Secrets**

```yaml
# Correct secret usage:
env:
  VSCE_PAT: ${{ secrets.VSCE_PAT }}
```

**Rule 3: Minimal secret permissions**

- `CODECOV_TOKEN`: Read-only (public repos don't need)
- `SNYK_TOKEN`: Scan-only
- `GITHUB_TOKEN`: Auto-generated, scoped
- `VSCE_PAT`: Publish-only, no additional scopes

### Workflow Security Checklist

For each GitHub Actions workflow:

- [ ] Uses `npm ci --ignore-scripts`
- [ ] Secrets accessed only when needed
- [ ] No secret logging or echoing
- [ ] Pinned action versions (not `@main`)
- [ ] Minimal permissions (`permissions:` block)
- [ ] No `pull_request_target` trigger (dangerous)
- [ ] Timeout limits set
- [ ] Artifact upload restricted

---

## Monitoring & Detection

### Automated Scanning

**Daily Security Scans (via `.github/workflows/security.yml`):**

1. **Dependency Audit**
   - Tool: `npm audit`
   - Frequency: Every PR + Daily cron
   - Action: Auto-create issue for vulnerabilities

2. **Lockfile Validation**
   - Tool: Custom validation script
   - Frequency: Every PR
   - Action: Fail build if integrity missing

3. **Secret Scanning**
   - Tools: GitLeaks, TruffleHog
   - Frequency: Every commit
   - Action: Block commit if secrets found

4. **Code Analysis**
   - Tool: CodeQL
   - Frequency: Every PR + Daily
   - Action: Create security advisory for findings

5. **Vulnerability Scanning**
   - Tool: Snyk
   - Frequency: Every PR + Daily
   - Action: Fail on high/critical vulnerabilities

### Manual Monitoring

**Weekly Tasks:**
```bash
# 1. Check for outdated dependencies
npm outdated

# 2. Review Dependabot PRs
# GitHub → Pull Requests → Filter: author:dependabot

# 3. Check npm audit results
npm audit --production

# 4. Review security workflow runs
# GitHub → Actions → Security Scan
```

**Monthly Tasks:**
- Review VS Code Marketplace analytics for unusual download patterns
- Audit GitHub Actions logs for anomalies
- Rotate non-critical secrets
- Update security documentation

**Quarterly Tasks:**
- Full supply-chain security audit
- Penetration testing
- Incident response drill (tabletop exercise)
- Rotate all secrets

---

## Incident Response

### Detection Indicators

**Compromise Suspected If:**

1. **Lockfile changes without PR:**
   ```bash
   git log --all package-lock.json
   # Look for unexpected commits
   ```

2. **Workflow failures with suspicious errors:**
   - Network timeouts to unknown domains
   - File permission errors in unexpected locations
   - Environment variable access denials

3. **Unusual npm install behavior:**
   - Install takes significantly longer
   - Network activity during install (with `--ignore-scripts`)
   - New files created outside `node_modules/`

4. **Marketplace anomalies:**
   - Unexpected version published
   - Download spike from unusual geographies
   - User reports of suspicious behavior

### Response Procedures

**Phase 1: Containment (< 15 minutes)**

1. **Immediately revoke all secrets:**
   ```bash
   # GitHub → Settings → Secrets → Actions
   # Delete: VSCE_PAT, CODECOV_TOKEN, SNYK_TOKEN
   ```

2. **Disable GitHub Actions:**
   ```bash
   # GitHub → Actions → Disable workflow runs
   ```

3. **Unpublish extension (if compromised):**
   ```bash
   # VS Code Marketplace → Manage → Unpublish
   ```

4. **Create incident channel:**
   - Notify security team
   - Create private incident tracking issue
   - Start incident timeline

**Phase 2: Investigation (< 1 hour)**

1. **Audit recent changes:**
   ```bash
   # Check all commits since last known-good
   git log --all --since="<last-known-good-date>" --name-only

   # Check for unauthorized workflow modifications
   git log --all .github/workflows/

   # Check lockfile history
   git log --all -p package-lock.json
   ```

2. **Analyze installed packages:**
   ```bash
   # List all installed packages
   npm ls --all > current-dependencies.txt

   # Compare with last known-good
   diff known-good-dependencies.txt current-dependencies.txt
   ```

3. **Review CI/CD logs:**
   - Download all workflow run logs
   - Search for suspicious network activity
   - Check for unexpected file modifications

4. **Inspect node_modules:**
   ```bash
   # Check for suspicious files
   find node_modules -name "*.sh" -o -name "preinstall*" -o -name "postinstall*"

   # Check for obfuscated JavaScript
   grep -r "eval(" node_modules/ --include="*.js" | head -20

   # Check for network requests
   grep -r "http://" node_modules/ --include="*.js" | grep -v "registry.npmjs.org"
   ```

**Phase 3: Remediation (< 2 hours)**

1. **Clean install from known-good state:**
   ```bash
   # Checkout last verified commit
   git checkout <last-known-good-commit>

   # Full clean
   rm -rf node_modules package-lock.json
   npm cache clean --force

   # Fresh install with protection
   npm install --ignore-scripts
   ```

2. **Regenerate secrets:**
   - VSCE_PAT: Create new in VS Code Marketplace
   - CODECOV_TOKEN: Regenerate in Codecov dashboard
   - SNYK_TOKEN: Regenerate in Snyk settings
   - Update GitHub Secrets with new values

3. **Harden CI/CD:**
   ```bash
   # Ensure all workflows use --ignore-scripts
   grep -r "npm ci" .github/workflows/

   # Add to all files if missing:
   npm ci --ignore-scripts
   ```

4. **Verify build integrity:**
   ```bash
   # Clean build
   npm run clean
   npm run compile

   # Run all tests
   npm test

   # Verify output
   ls -la out/
   ```

**Phase 4: Communication (< 4 hours)**

1. **Internal notification:**
   - Update incident channel with findings
   - Brief leadership team
   - Coordinate external notifications

2. **User notification (if published compromise):**
   ```markdown
   # GitHub Security Advisory Template

   ## Summary
   A supply-chain security incident was detected on [DATE].

   ## Impact
   Users who downloaded versions [X.Y.Z] to [X.Y.Z] may be affected.

   ## Timeline
   - [DATE TIME]: Incident detected
   - [DATE TIME]: Extension unpublished
   - [DATE TIME]: Remediation complete
   - [DATE TIME]: Clean version published

   ## Action Required
   1. Update to version [SAFE-VERSION]
   2. Rotate any credentials that may have been exposed
   3. Review recent activity for anomalies

   ## Questions
   Contact security@your-org.com
   ```

3. **External reporting (if required):**
   - VS Code Marketplace security team
   - CISA (if critical infrastructure)
   - npm security team
   - Affected organizations (if known)

**Phase 5: Post-Incident (< 1 week)**

1. **Root cause analysis:**
   - Document timeline
   - Identify entry vector
   - Determine scope of impact
   - List missed detection opportunities

2. **Preventive measures:**
   - Implement additional controls
   - Update detection rules
   - Enhance monitoring
   - Schedule follow-up audit

3. **Documentation:**
   - Update incident response procedures
   - Add lessons learned
   - Update security training
   - Create public disclosure (after 90 days)

---

## Security Checklists

### Pre-Commit Checklist

Before committing dependency changes:

- [ ] Ran `npm audit` (no high/critical vulnerabilities)
- [ ] Reviewed lockfile changes for anomalies
- [ ] No new lifecycle scripts added
- [ ] All packages from `registry.npmjs.org`
- [ ] Integrity hashes present for all new packages
- [ ] Tests pass with new dependencies
- [ ] Build succeeds
- [ ] No new warnings or errors

### Pre-Release Checklist

Before publishing new version:

- [ ] All security scans passed (CodeQL, Snyk, npm audit)
- [ ] Lockfile validation successful
- [ ] No secrets in source code or artifacts
- [ ] CI/CD workflows use `--ignore-scripts`
- [ ] CHANGELOG.md updated with security fixes
- [ ] Version number follows semantic versioning
- [ ] Tested in clean environment
- [ ] Signed git tag created

### Quarterly Audit Checklist

Every 3 months:

- [ ] Full supply-chain audit performed
- [ ] All secrets rotated
- [ ] Dependency tree reviewed (remove unused)
- [ ] CI/CD workflows audited
- [ ] Incident response procedures tested
- [ ] Security documentation updated
- [ ] Team security training completed
- [ ] Third-party security assessment (optional)

---

## Tools & Resources

### Recommended Tools

| Tool | Purpose | URL |
|------|---------|-----|
| **Socket.dev** | Real-time supply-chain monitoring | https://socket.dev |
| **Snyk** | Vulnerability scanning | https://snyk.io |
| **npm audit** | Built-in security scanning | Built into npm |
| **GitLeaks** | Secret detection | https://github.com/gitleaks/gitleaks |
| **TruffleHog** | Credential scanning | https://github.com/trufflesecurity/trufflehog |
| **Dependabot** | Automated dependency updates | Built into GitHub |
| **StepSecurity Harden-Runner** | GitHub Actions sandboxing | https://github.com/step-security/harden-runner |

### Learning Resources

- **OWASP Top 10 for npm:** https://owasp.org/www-project-dependency-check/
- **SLSA Framework:** https://slsa.dev/
- **npm Security Best Practices:** https://docs.npmjs.com/security
- **GitHub Actions Security:** https://docs.github.com/en/actions/security-guides
- **Supply-Chain Attacks (CISA):** https://www.cisa.gov/supply-chain

### Threat Intelligence

Monitor these sources for supply-chain threats:

- npm Security Advisories: https://github.com/advisories
- Socket.dev Blog: https://socket.dev/blog
- Snyk Intel: https://security.snyk.io/
- NIST NVD: https://nvd.nist.gov/
- Unit 42 (Palo Alto): https://unit42.paloaltonetworks.com/

---

## Conclusion

Supply-chain security is an ongoing process, not a one-time fix. By following these practices:

1. ✅ Minimize and audit dependencies
2. ✅ Validate lockfile integrity
3. ✅ Prevent script execution in CI/CD
4. ✅ Monitor continuously
5. ✅ Respond quickly to incidents

We significantly reduce our exposure to supply-chain attacks.

**Remember:** The goal is not perfection, but continuous improvement and rapid detection/response.

---

*Document Version: 1.0.0*
*Last Updated: 2025-09-29*
*Owner: Engineering Security Team*
*Review Cadence: Quarterly*