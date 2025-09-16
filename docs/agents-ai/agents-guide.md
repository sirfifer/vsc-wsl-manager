# AGENTS.md Maintenance Guide for VSC WSL Manager

## Overview

This guide helps both human developers and AI coding assistants understand how to create, maintain, and utilize the `AGENTS.md` file for the VSC WSL Manager project. AGENTS.md is a simple, open format for guiding coding agents, used by over 20k open-source projects.

## What is AGENTS.md?

Think of AGENTS.md as a README for agents: a dedicated, predictable place to provide the context and instructions to help AI coding agents work on your project. While README.md is optimized for humans, AGENTS.md provides machine-readable instructions that ensure consistent, high-quality code generation across different AI tools (Claude Code, GitHub Copilot, Cursor, etc.).

## Why This Matters for VSC WSL Manager

For an open source VSCode extension project that prioritizes:
- 100% test coverage
- Test-driven development
- Clean, maintainable code
- Comprehensive documentation

Having a well-maintained AGENTS.md ensures that every AI assistant contributor follows these same standards, regardless of which tool they use.

## Key Principles for Our Project

### 1. Test-Driven Development is Non-Negotiable

TDD with Claude Code guided by Test Driven Development to create a useful MCP (Model Context Protocol). Every feature, bug fix, or modification must follow this cycle:
- **RED**: Write failing tests first
- **GREEN**: Write minimal code to pass tests
- **REFACTOR**: Improve code while keeping tests green

### 2. 100% Test Coverage Requirement

All code must have complete test coverage:
- Unit tests for individual functions/methods
- Integration tests for component interactions
- E2E tests for user workflows (separate from CI initially)
- Security tests to ensure no `exec()` usage

### 3. Documentation Standards

Inline comments: The primary purpose of inline comments is to provide information that the code itself cannot contain, such as why the code is there.

Every piece of code needs:
- **Inline comments**: Explain the "why" behind complex logic
- **Method documentation**: Clear API contracts with parameters, returns, and exceptions
- **Module documentation**: High-level purpose and usage
- **README updates**: Keep user-facing documentation current

## Structure of AGENTS.md

The AGENTS.md file should be organized into clear sections that guide AI assistants through your project's requirements. Here's the recommended structure:

```markdown
# VSC WSL Manager - Agent Instructions

## Project Overview
Brief description of what the extension does and its core value proposition.

## Development Principles
### Test-Driven Development (TDD)
MANDATORY: Follow strict TDD workflow for ALL changes...

### Code Coverage Requirements
MANDATORY: Maintain 100% test coverage...

### Documentation Standards
MANDATORY: Document all code thoroughly...

## Environment Setup
Step-by-step setup instructions with exact commands...

## Testing Instructions
### Running Tests
Specific commands for different test types...

### Coverage Verification
How to check and maintain coverage...

### CI/CD Integration
Requirements for passing CI checks...

## Code Style Guidelines
### TypeScript Standards
Specific formatting and structure rules...

### Security Requirements
NEVER use exec() - always use spawn()...

## Workflow Instructions
### Creating New Features
1. Create test file first...
2. Write failing tests...
3. Implement minimal code...

### Fixing Bugs
1. Write test that reproduces bug...
2. Fix code to pass test...
3. Add regression tests...

## Common Patterns
Examples of properly implemented features...

## File Structure
Where different types of code belong...
```

## Maintenance Best Practices

### 1. Keep It Current
Keep instructions up to date: Make sure the file is always current with your project's needs. Update AGENTS.md whenever you:
- Change testing frameworks
- Modify CI/CD pipelines
- Update coding standards
- Add new architectural patterns
- Discover new edge cases

### 2. Be Explicit and Prescriptive
Use strong language ("always," "never," "must," "do not"). Clear, unambiguous instructions prevent AI agents from making assumptions:

**Good**: "ALWAYS write tests before implementation code"  
**Bad**: "Try to write tests first when possible"

### 3. Provide Concrete Examples
Include actual code snippets showing both correct and incorrect approaches:

```typescript
// ✅ CORRECT: Using spawn for security
import { spawn } from 'child_process';
const result = spawn('wsl', ['--list']);

// ❌ WRONG: Never use exec
import { exec } from 'child_process';
exec('wsl --list'); // Security vulnerability!
```

### 4. Link to Existing Documentation
Link to existing docs: Instead of duplicating information, link to your existing documentation. Don't duplicate information that exists elsewhere:
- Link to API documentation
- Reference test automation setup guides
- Point to style guides

### 5. Version Control Integration
Treat AGENTS.md as a first-class citizen in your repository:
- Include it in code reviews
- Update it with every PR that changes processes
- Track its history to understand evolution

## Testing the AGENTS.md File

### Validation Checklist
Before committing changes to AGENTS.md, verify:

- [ ] All commands execute successfully
- [ ] Test instructions produce 100% coverage
- [ ] Setup steps work on fresh environment
- [ ] Examples compile and pass tests
- [ ] Links to documentation are valid
- [ ] Security requirements are clear

### AI Agent Testing
Test your AGENTS.md with different AI tools:
1. Create a test branch
2. Ask the AI to implement a small feature following AGENTS.md
3. Verify it follows TDD process
4. Check test coverage meets requirements
5. Ensure documentation is complete

## Common Pitfalls to Avoid

### 1. Vague Instructions
❌ "Write good tests"  
✅ "Write tests that cover: happy path, error cases, edge cases, and security concerns"

### 2. Missing Context
❌ "Use the test framework"  
✅ "Use Mocha with Chai assertions for unit tests, following the pattern in src/test/suite/"

### 3. Outdated Information
Review AGENTS.md monthly to ensure:
- Dependencies are current
- Commands still work
- Patterns match current codebase
- CI/CD references are accurate

### 4. Tool-Specific Instructions
Avoid instructions specific to one AI tool. AGENTS.md should work with:
- Claude Code
- GitHub Copilot
- Cursor
- Any future AI coding assistant

## Autonomous Agent Integration

### ChatGPT Codex Support

Codex can be guided by AGENTS.md files placed within your repository. These are text files, akin to README.md, where you can inform Codex how to navigate your codebase, which commands to run for testing, and how best to adhere to your project's standard practices.

ChatGPT Codex features for AGENTS.md:
- **Automatic Discovery**: You can provide an AGENTS.md file in your repo to give Codex custom instructions on how to behave within that project.
- **Parallel Execution**: Can run up to 60 concurrent instances per hour
- **Cloud Sandboxes**: Each task runs in isolated environment
- **Hierarchical Support**: Respects nested AGENTS.md files for directory-specific rules

### GitHub Copilot Agents Support

Copilot coding agent, our autonomous background agent, now supports AGENTS.md custom instructions. You can create a single AGENTS.md file in the root of your repository. You can also create nested AGENTS.md files which apply to specific parts of your project.

GitHub Copilot features for AGENTS.md:
- **Multiple Formats**: Alongside AGENTS.md, the agent continues to support GitHub's .github/copilot-instructions.md and .github/instructions/**.instructions.md formats, plus CLAUDE.md and GEMINI.md files.
- **GitHub Actions Environment**: Runs in secure GitHub Actions containers
- **Parallel Tasks**: Multiple agents can work simultaneously on different issues
- **MCP Server Integration**: Can connect to Model Context Protocol servers

### Ensuring AGENTS.md Works with Autonomous Agents

Both tools will automatically discover and use your AGENTS.md file when:
1. The file is placed in the repository root
2. The file uses standard Markdown format
3. Instructions are clear and unambiguous

#### Discovery Hierarchy
```
repository-root/
├── AGENTS.md                 # Root instructions (applies to all)
├── src/
│   └── AGENTS.md            # Overrides for src directory
└── test/
    └── AGENTS.md            # Test-specific instructions
```

**Important**: agents.md is basically a method for you to, kind of, compress that, like, test time exploration that it has to do so it can, like, know more.

### Optimizing for Parallel Execution

Since both ChatGPT Codex and GitHub Copilot can run multiple autonomous instances:

#### 1. Make Instructions Stateless
```markdown
## Testing Instructions
ALWAYS run these tests independently:
- Unit tests: `npm run test:unit`
- Integration tests: `npm run test:integration`
- Coverage check: `npm run coverage`

Each test suite MUST be runnable in isolation.
```

#### 2. Define Clear Task Boundaries
```markdown
## Task Isolation
Each feature/fix MUST:
- Have its own test file
- Not depend on other in-progress work
- Be mergeable independently
```

#### 3. Specify Resource Requirements
```markdown
## Environment Requirements
- Node.js 18+ required
- 4GB RAM minimum for test suite
- Port 3000-3100 reserved for testing
```

### Testing Agent Compatibility

To verify your AGENTS.md works with autonomous agents:

1. **ChatGPT Codex Test**:
   ```bash
   # Assign a simple task to Codex
   # It should follow AGENTS.md without additional prompting
   ```

2. **GitHub Copilot Test**:
   ```bash
   # Create an issue and assign to @copilot
   # Verify it follows TDD and coverage requirements
   ```

3. **Parallel Test**:
   ```bash
   # Assign multiple issues simultaneously
   # Ensure no conflicts in test execution
   ```

## Integration with CI/CD

### Automated Verification
Your CI pipeline should verify that code follows AGENTS.md requirements:

```yaml
- name: Verify Test Coverage
  run: |
    npm test
    if [ $(cat coverage/coverage-summary.json | jq '.total.lines.pct') -lt 100 ]; then
      echo "ERROR: Test coverage below 100%"
      exit 1
    fi

- name: Check Documentation
  run: |
    # Verify all exported functions have JSDoc
    npm run lint:docs

- name: Security Check
  run: |
    # Ensure no exec() usage
    ! grep -r "\.exec(" src/
```

### PR Requirements
Every pull request must:
1. Pass all tests with 100% coverage
2. Include updated documentation
3. Update AGENTS.md if processes change
4. Follow TDD workflow (reviewable in commit history)

## Monitoring and Metrics

Track the effectiveness of your AGENTS.md:
- **Compliance Rate**: % of PRs following TDD
- **Coverage Stability**: Maintaining 100% across releases
- **Documentation Quality**: Completeness of inline comments
- **AI Success Rate**: % of AI-generated PRs passing CI

## For Human Developers

While AGENTS.md is primarily for AI assistants, human developers should:
1. Read and understand all requirements
2. Use it as a checklist for contributions
3. Update it when discovering gaps
4. Ensure their manual work meets same standards

## For AI Assistants

When reading this guide, AI assistants should:
1. Always consult AGENTS.md before starting work
2. Follow TDD workflow without exception
3. Maintain 100% test coverage
4. Document code thoroughly
5. Update AGENTS.md if instructions are unclear

## Living Document Philosophy

Write short and useful documents. Cut out everything unnecessary, including out-of-date, incorrect, or redundant information. Treat AGENTS.md as a living document that evolves with your project. Regular maintenance ensures it remains a valuable tool rather than outdated documentation.

## Quick Reference Checklist

### Before Starting Work
- [ ] Read latest AGENTS.md
- [ ] Verify environment setup
- [ ] Understand testing requirements
- [ ] Review code style guidelines

### During Development
- [ ] Follow TDD cycle (Red-Green-Refactor)
- [ ] Write comprehensive tests first
- [ ] Document code with inline comments
- [ ] Use spawn() not exec() for processes

### Before Submitting PR
- [ ] 100% test coverage achieved
- [ ] All tests passing
- [ ] Documentation complete
- [ ] AGENTS.md updated if needed
- [ ] CI checks passing

## Conclusion

A well-maintained AGENTS.md transforms AI coding assistants from code generators into disciplined development partners. By embedding your project's principles—especially TDD and 100% test coverage—directly into AGENTS.md, you ensure consistent, high-quality contributions regardless of whether they come from humans or AI.

Remember: By giving AI assistants a clear, predictable playbook, we reduce friction and unlock smoother human–AI collaboration.

## Additional Resources

- [Official AGENTS.md Specification](https://agents.md)
- [VSCode Extension Test Automation Setup](./test-automation-setup.md)
- [Project Contributing Guidelines](./CONTRIBUTING.md)
- [Test Coverage Reports](./coverage/index.html)

---

**Last Updated**: September 2025  
**Maintainer**: VSC WSL Manager Team  
**Review Frequency**: Monthly
