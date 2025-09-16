# Autonomous Agents Configuration Guide for VSC WSL Manager

## Overview

This guide provides specific configuration and optimization strategies for autonomous AI coding agents, particularly **ChatGPT Codex** and **GitHub Copilot Agents**, which can work on your codebase in parallel instances independently.

## How Autonomous Agents Discover AGENTS.md

### ChatGPT Codex

Codex can be guided by AGENTS.md files placed within your repository. These are text files, akin to README.md, where you can inform Codex how to navigate your codebase, which commands to run for testing, and how best to adhere to your project's standard practices.

**Discovery Process**:
1. Codex automatically scans for AGENTS.md in repository root
2. Reads and incorporates instructions into its workflow
3. Applies hierarchical rules (root → subdirectory overrides)
4. You can even ask Codex to write its own Agents.md

**Key Capabilities**:
- you can run up to 60 concurrent Codex instances per hour, meaning you can fire up a Codex task every minute
- Each instance runs in isolated cloud sandbox
- Has access to full repository context

### GitHub Copilot Agents

Copilot coding agent, our autonomous background agent, now supports AGENTS.md custom instructions. You can create a single AGENTS.md file in the root of your repository. You can also create nested AGENTS.md files which apply to specific parts of your project.

**Discovery Process**:
1. Searches for AGENTS.md in repository root
2. Also recognizes alternative formats:
   - `.github/copilot-instructions.md`
   - `.github/instructions/**.instructions.md`
   - `CLAUDE.md`
   - `GEMINI.md`
3. Applies nested AGENTS.md for specific directories

**Key Capabilities**:
- Runs in GitHub Actions environment
- Can work on multiple tasks in parallel
- Creates isolated branches for each task
- Integrates with MCP (Model Context Protocol) servers

## Optimizing AGENTS.md for Parallel Execution

### 1. Stateless Instructions

Make all instructions self-contained and independent:

```markdown
## Build Instructions
# Each agent should run independently:
npm clean-install  # Not 'npm install' to ensure clean state
npm run build
npm test
```

### 2. Resource Management

Prevent conflicts between parallel instances:

```markdown
## Test Environment
- Test database: Use unique name with timestamp
  `test_db_${AGENT_ID}_${TIMESTAMP}`
- Test ports: Allocate from pool 3000-3999
  `const PORT = 3000 + (AGENT_ID % 1000)`
- Temp directories: Create unique paths
  `/tmp/wsl-test-${AGENT_ID}-${TIMESTAMP}/`
```

### 3. Branch Strategy

Define clear branch naming for agent isolation:

```markdown
## Branch Naming
- Codex: `codex/issue-{number}-{description}`
- Copilot: `copilot/issue-{number}-{description}`
- Other agents: `agent/{tool}/issue-{number}`

NEVER push to: main, master, develop, release/*
```

### 4. Test Isolation

Ensure tests can run simultaneously:

```markdown
## Parallel Test Execution
Each test suite MUST:
1. Use unique test data fixtures
2. Clean up after completion
3. Not depend on execution order
4. Use isolated mock services

Example:
```typescript
describe('Feature-${ISSUE_NUMBER}', () => {
  const testId = Date.now();
  const testDir = `/tmp/test-${testId}`;
  
  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });
  
  afterEach(() => {
    fs.rmSync(testDir, { recursive: true });
  });
});
```

## Directory-Specific AGENTS.md

Use hierarchical configuration for complex projects:

### Root AGENTS.md
```markdown
# Global rules for all agents
- 100% test coverage required
- TDD mandatory
- Use TypeScript strict mode
```

### src/AGENTS.md
```markdown
# Source code specific rules
- All functions must have JSDoc
- No console.log in production code
- Use dependency injection
```

### test/AGENTS.md
```markdown
# Test specific rules
- Use Mocha/Chai for unit tests
- Mock all external services
- Test files must end with .test.ts
```

## Verification Strategies

### 1. Pre-Submission Checklist

Include in AGENTS.md for agents to self-verify:

```markdown
## Before Submitting PR
Autonomous agents MUST verify:
- [ ] All tests pass: `npm test`
- [ ] 100% coverage: `npm run coverage`
- [ ] No linting errors: `npm run lint`
- [ ] No security issues: `npm run security`
- [ ] Documentation updated
- [ ] PR description complete
```

### 2. Agent Self-Testing

Add meta-tests for agent compliance:

```typescript
// test/agent-compliance.test.ts
describe('Agent Compliance', () => {
  it('should have 100% test coverage', async () => {
    const coverage = await getCoverageReport();
    expect(coverage.total).to.equal(100);
  });
  
  it('should follow TDD (tests before code)', () => {
    const commits = getCommitHistory();
    const firstCommit = commits[0];
    expect(firstCommit.files).to.match(/\.test\.ts$/);
  });
});
```

### 3. Monitoring Agent Performance

Track agent effectiveness:

```yaml
# .github/workflows/agent-metrics.yml
name: Agent Performance Metrics
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  metrics:
    runs-on: ubuntu-latest
    steps:
      - name: Check if PR is from agent
        id: is-agent
        run: |
          if [[ "${{ github.head_ref }}" =~ ^(codex|copilot|agent)/ ]]; then
            echo "IS_AGENT=true" >> $GITHUB_OUTPUT
          fi
      
      - name: Validate agent compliance
        if: steps.is-agent.outputs.IS_AGENT == 'true'
        run: |
          # Check TDD compliance
          # Verify test coverage
          # Validate documentation
          # Security scan
```

## Best Practices for Agent Instructions

### DO ✅

1. **Be Explicit**: write modular code, and use linters, formatters, and commit hooks extensively to give the machine a faster feedback loop

2. **Provide Context**: Explain WHY not just WHAT
   ```markdown
   # Use spawn instead of exec (security: prevents injection attacks)
   ```

3. **Include Examples**: Show correct patterns
   ```markdown
   ## Correct Error Handling
   ```typescript
   try {
     await riskyOperation();
   } catch (error) {
     logger.error('Operation failed', { error, context });
     throw new OperationalError('User-friendly message', error);
   }
   ```

4. **Define Success Criteria**: Be measurable
   ```markdown
   Success = All tests pass + 100% coverage + 0 security warnings
   ```

### DON'T ❌

1. **Assume Context**: Don't reference undefined variables
2. **Use Relative Terms**: Avoid "fast", "good", "appropriate"
3. **Create Dependencies**: Don't require sequential execution
4. **Forget Edge Cases**: Always specify error handling

## Integration with CI/CD

### Automated Agent Validation

```yaml
# Validate that agents followed AGENTS.md
- name: Validate Agent Compliance
  run: |
    # Check if tests were written first
    FIRST_COMMIT=$(git log --reverse --pretty=%H | head -1)
    FILES_IN_FIRST=$(git show --name-only $FIRST_COMMIT)
    
    if ! echo "$FILES_IN_FIRST" | grep -q "\.test\."; then
      echo "ERROR: First commit must contain tests (TDD)"
      exit 1
    fi
    
    # Verify 100% coverage
    npm run coverage
    COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
    if [ "$COVERAGE" != "100" ]; then
      echo "ERROR: Coverage is $COVERAGE%, must be 100%"
      exit 1
    fi
```

## Troubleshooting

### Common Issues with Autonomous Agents

1. **Agent ignores AGENTS.md**
   - Verify file is in repository root
   - Check file name is exactly `AGENTS.md` (case-sensitive)
   - Ensure valid Markdown syntax

2. **Parallel execution conflicts**
   - Add unique identifiers to all resources
   - Implement proper cleanup in tests
   - Use timestamp-based naming

3. **Incomplete PR submissions**
   - Make checklist mandatory in AGENTS.md
   - Add PR template validation
   - Include self-verification steps

4. **Test failures in CI but not locally**
   - Ensure tests are truly isolated
   - Check for hardcoded paths/ports
   - Verify environment variables

## Advanced Configuration

### MCP Server Integration (GitHub Copilot)

```json
{
  "mcp_servers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"]
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/projects"]
    }
  }
}
```

### Custom Tool Integration

Extend agent capabilities:

```markdown
## Custom Tools Available
- `wsl-validator`: Validates WSL configuration
  Usage: `npm run tool:wsl-validator`
- `coverage-reporter`: Generates detailed coverage report
  Usage: `npm run tool:coverage-report`
```

## Monitoring and Metrics

Track autonomous agent effectiveness:

```javascript
// scripts/agent-metrics.js
const metrics = {
  tddCompliance: checkTDDInCommits(),
  coverageAverage: getAverageCoverage(),
  prCompleteness: checkPRCompleteness(),
  securityCompliance: checkSecurityRules(),
  documentationQuality: assessDocumentation(),
};

console.log('Agent Performance Score:', calculateScore(metrics));
```

## Conclusion

Properly configured AGENTS.md enables autonomous agents to work effectively in parallel, maintaining code quality while accelerating development. The key is providing clear, stateless instructions that any agent instance can execute independently.

Remember: agents.md is basically a method for you to, kind of, compress that, like, test time exploration that it has to do so it can, like, know more.

---

**Last Updated**: September 2025  
**Applicable Agents**: ChatGPT Codex, GitHub Copilot Agents, Claude Code, Cursor  
**Maintenance**: Review monthly or when adding new agent tools
