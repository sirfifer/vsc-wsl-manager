# 📚 Documentation Reference Guide

## Overview

This is the master reference guide for all documentation in the VSC WSL Manager project. It provides clear navigation for both human developers and AI coding assistants to understand what documentation exists, where to find it, and which documents are most critical.

**Last Updated:** September 19, 2025
**Purpose:** Central documentation navigation and reference
**Audience:** Developers, Contributors, and AI Agents

## 🔴 Critical Documents (Must Read)

These documents are essential for anyone working on this project:

| Document | Purpose | Last Updated |
|----------|---------|--------------|
| [CLAUDE.md](./CLAUDE.md) | **AI agent instructions** - Mandatory validation steps, testing requirements, architecture guidance | Sept 2024 |
| [README.md](./README.md) | **Project overview** - Current status, features, AI tool support, installation | Sept 2024 |
| [PRIORITIES.md](./PRIORITIES.md) | **Development roadmap** - Three-phase plan from functional validation to marketplace release | Sept 2024 |
| [docs/testing/TESTING.md](./docs/testing/TESTING.md) | **Testing standards** - NO MOCKS policy, three-level architecture, coverage requirements | Sept 2024 |
| [test-workspace/testing-framework-todo.md](./test-workspace/testing-framework-todo.md) | **Testing implementation status** - Current progress on real testing migration | Sept 2024 |

## 🟡 Important Configuration Files

Essential project configuration and guidelines:

| Document | Purpose |
|----------|---------|
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Contribution guidelines and code of conduct |
| [SECURITY.md](./SECURITY.md) | Security policy and vulnerability reporting (Updated recently) |
| [CHANGELOG.md](./CHANGELOG.md) | Version history and release notes |
| [package.json](./package.json) | Project configuration and dependencies |

## 📁 Documentation Folders

### /docs/ - Main Documentation Hub

| Folder | Purpose | Key Documents |
|--------|---------|---------------|
| **agents-ai/** | AI agent integration and configuration | AGENTS.md, autonomous-agents-config.md, quick-reference.md |
| **api/** | TypeDoc generated API documentation | Auto-generated class and module documentation |
| **architecture/** | System design and architecture | overview.md, security.md |
| **guides/** | User and developer guides | getting-started.md, advanced-usage.md, faq.md |
| **project-history/** | Implementation tracking and historical fixes | IMPLEMENTATION_PLAN.md, various fix documentation |
| **references/** 🔧 | Cross-platform guides and proposals (AI-injected) | cross-platform-dev-guide.md, mac-containers-image-management-proposal.md |
| **reviews/** | Code and project review reports | comprehensive-review-report.md |
| **testing/** | Comprehensive testing documentation | TESTING.md, TESTING-ARCHITECTURE.md, E2E guides |

### /test-workspace/ - Work in Progress 🔧

**Purpose:** AI-injected workspace for testing documentation and work-in-progress items

| Subfolder | Purpose |
|-----------|---------|
| **wip/** | Active work-in-progress documentation |
| **archive/** | Completed or deprecated testing documentation |

**Key Documents:**
- phase2-completion-report.md - Latest testing phase completion status
- testing-framework-todo.md - Current testing implementation progress

### Root Level Documentation

| Document | Purpose |
|----------|---------|
| **AGENTS.md** | Autonomous agent configuration for the extension |
| Various setup scripts | Environment setup and testing automation |

## 🚀 Recently Updated Documents

Based on modification timestamps, these documents have been updated recently and may contain the most current information:

1. **SECURITY.md** - Security policy (Most recent)
2. **docs/references/mac-containers-image-management-proposal.md** - Mac platform proposal
3. **docs/references/cross-platform-dev-guide.md** - Cross-platform development guide
4. **test-workspace/testing-framework-todo.md** - Testing progress tracking
5. **test-workspace/phase2-completion-report.md** - Phase 2 completion status

## 🤖 AI Agent Guidelines

### For AI Coding Assistants

When working with this codebase, AI agents should:

1. **Always read CLAUDE.md first** - Contains mandatory validation steps and testing requirements
2. **Check /docs/references/** - Contains AI-injected information about cross-platform development
3. **Review /test-workspace/** - Contains work-in-progress items and testing status
4. **Follow the NO MOCKS policy** - All tests must use real implementations
5. **Run mandatory validation** - Complete all steps in CLAUDE.md before declaring work done

### Special AI Information Folders

These folders are specifically maintained for AI agent consumption:

- **/docs/references/** - Cross-platform development guidelines and proposals
- **/test-workspace/** - Current work items and testing progress
- **/docs/agents-ai/** - AI agent configuration and integration guides

## 📊 Documentation Coverage by Category

| Category | Coverage | Primary Location |
|----------|----------|------------------|
| Setup & Installation | ✅ Complete | docs/SETUP.md, README.md |
| Testing | ✅ Comprehensive | docs/testing/, test-workspace/ |
| Architecture | ✅ Good | docs/architecture/ |
| API Reference | ✅ Auto-generated | docs/api/ |
| Security | ✅ Documented | SECURITY.md, docs/architecture/security.md |
| AI Integration | ✅ Extensive | docs/agents-ai/, CLAUDE.md |
| Cross-Platform | ✅ Detailed | docs/references/ |
| Development Process | ✅ Complete | PRIORITIES.md, CONTRIBUTING.md |

## 🔍 Quick Reference

### For New Contributors
1. Start with [README.md](./README.md)
2. Read [CONTRIBUTING.md](./CONTRIBUTING.md)
3. Review [docs/guides/getting-started.md](./docs/guides/getting-started.md)
4. Check [PRIORITIES.md](./PRIORITIES.md) for current focus areas

### For Testing
1. Read [docs/testing/TESTING.md](./docs/testing/TESTING.md)
2. Check [test-workspace/testing-framework-todo.md](./test-workspace/testing-framework-todo.md)
3. Review testing architecture in [docs/testing/TESTING-ARCHITECTURE.md](./docs/testing/TESTING-ARCHITECTURE.md)

### For AI Agents
1. **MUST READ:** [CLAUDE.md](./CLAUDE.md)
2. Check [docs/agents-ai/quick-reference.md](./docs/agents-ai/quick-reference.md)
3. Review [docs/references/](./docs/references/) for platform-specific guidance

### For Security
1. Read [SECURITY.md](./SECURITY.md)
2. Review [docs/architecture/security.md](./docs/architecture/security.md)
3. Check security implementation in source code

## 📝 Documentation Standards

All documentation in this project follows these standards:

- **Markdown format** for all documentation
- **Clear headings** with hierarchical structure
- **Code examples** where applicable
- **Last updated dates** for critical documents
- **Purpose statements** at the beginning of each document
- **Cross-references** to related documentation

## 🔄 Maintenance

This reference guide should be updated when:
- New documentation folders are created
- Critical documents are added or removed
- Major documentation restructuring occurs
- Folder purposes change significantly

---

*Note: Documents in .wdio-vscode-service/, node_modules/, and claude-personas/ are excluded from this reference as they are external dependencies.*