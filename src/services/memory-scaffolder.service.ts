/**
 * Memo — Memory Scaffolder Service
 *
 * Creates the memory/ directory and populates it with profile-appropriate
 * template files using YAML frontmatter for machine-readable state
 * and markdown body for human/agent readability.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
  MEMORY_DIR,
  MEMORY_FILES,
  CONTEXT_SNAPSHOT_FILE,
} from '../constants';
import type { MemoryProfile, InitWizardInput } from '../models/types';

export class MemoryScaffolderService {
  /**
   * Quick-initialize with auto-detected defaults.
   * Uses the folder name as project name and the configured profile.
   */
  public async quickInit(workspaceRoot: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('memo');
    const profile = config.get<MemoryProfile>('memoryProfile', 'standard');
    const projectName = path.basename(workspaceRoot);

    await this.scaffold(workspaceRoot, {
      projectName,
      projectDescription: '',
      techStack: '',
      profile,
      targetPlatforms: config.get('targetPlatforms', ['antigravity', 'generic']),
    });
  }

  /**
   * Detailed-initialize with user-provided project info via input boxes.
   */
  public async detailedInit(workspaceRoot: string): Promise<void> {
    const projectName = await vscode.window.showInputBox({
      prompt: 'Project Name',
      value: path.basename(workspaceRoot),
      placeHolder: 'e.g. wa-leba',
    });
    if (!projectName) { return; } // Cancelled

    const projectDescription = await vscode.window.showInputBox({
      prompt: 'Brief Project Description / Mission',
      placeHolder: 'e.g. Anti-theft Android tracking system with real-time alerts',
    });
    if (projectDescription === undefined) { return; }

    const techStack = await vscode.window.showInputBox({
      prompt: 'Primary Tech Stack',
      placeHolder: 'e.g. TypeScript, NestJS, React Native, PostgreSQL',
    });
    if (techStack === undefined) { return; }

    const profilePick = await vscode.window.showQuickPick(
      [
        { label: 'Minimal', description: '3 files — solo/hobby projects', value: 'minimal' as MemoryProfile },
        { label: 'Standard', description: '5 files — team projects (recommended)', value: 'standard' as MemoryProfile },
        { label: 'Enterprise', description: '7+ files — monorepos/regulated projects', value: 'enterprise' as MemoryProfile },
      ],
      { placeHolder: 'Select memory profile tier' }
    );
    if (!profilePick) { return; }

    const config = vscode.workspace.getConfiguration('memo');

    await this.scaffold(workspaceRoot, {
      projectName,
      projectDescription: projectDescription || '',
      techStack: techStack || '',
      profile: profilePick.value,
      targetPlatforms: config.get('targetPlatforms', ['antigravity', 'generic']),
    });
  }

  /**
   * Core scaffolding logic — creates memory/ and all template files.
   */
  private async scaffold(workspaceRoot: string, input: InitWizardInput): Promise<void> {
    const memoryDir = path.join(workspaceRoot, MEMORY_DIR);

    // Create memory/ directory
    if (!fs.existsSync(memoryDir)) {
      fs.mkdirSync(memoryDir, { recursive: true });
    }

    // Create archive directory for changelog rotation
    const archiveDir = path.join(memoryDir, 'archive');
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }

    // Enterprise profile: create modules/ directory
    if (input.profile === 'enterprise') {
      const modulesDir = path.join(memoryDir, 'modules');
      if (!fs.existsSync(modulesDir)) {
        fs.mkdirSync(modulesDir, { recursive: true });
      }
    }

    // Generate each memory file from templates
    const files = MEMORY_FILES[input.profile];
    for (const filename of files) {
      const filePath = path.join(memoryDir, filename);
      if (!fs.existsSync(filePath)) {
        const content = this.generateTemplate(filename, input);
        fs.writeFileSync(filePath, content, 'utf-8');
      }
    }

    // Always generate context_snapshot.md
    const snapshotPath = path.join(memoryDir, CONTEXT_SNAPSHOT_FILE);
    const snapshotContent = this.generateContextSnapshot(input);
    fs.writeFileSync(snapshotPath, snapshotContent, 'utf-8');

    // Generate initial changelog entry (COMMIT-0001)
    const changelogPath = path.join(memoryDir, 'changelog.md');
    if (fs.existsSync(changelogPath)) {
      const content = fs.readFileSync(changelogPath, 'utf-8');
      if (!content.includes('COMMIT-0001')) {
        const initEntry = this.generateInitCommitEntry(input);
        fs.appendFileSync(changelogPath, '\n' + initEntry, 'utf-8');
      }
    }

    // Update settings with chosen profile
    const config = vscode.workspace.getConfiguration('memo');
    await config.update('memoryProfile', input.profile, vscode.ConfigurationTarget.Workspace);

    vscode.window.showInformationMessage(
      `🧠 Memo: Living Memory initialized (${input.profile} profile) with ${files.length + 1} files.`
    );
  }

  // ─── Template Generators ───────────────────────────────────────────

  private generateTemplate(filename: string, input: InitWizardInput): string {
    switch (filename) {
      case 'architecture.md':
        return this.templateArchitecture(input);
      case 'guidelines.md':
        return this.templateGuidelines(input);
      case 'progress.md':
        return this.templateProgress(input);
      case 'decisions.md':
        return this.templateDecisions(input);
      case 'changelog.md':
        return this.templateChangelog(input);
      case 'feasibility.md':
        return this.templateFeasibility(input);
      case 'validation.md':
        return this.templateValidation(input);
      default:
        return `# ${filename}\n\n> TODO: Populate this file.\n`;
    }
  }

  private templateArchitecture(input: InitWizardInput): string {
    return `---
project_name: "${input.projectName}"
project_description: "${input.projectDescription}"
tech_stack: "${input.techStack}"
profile: "${input.profile}"
created_at: "${new Date().toISOString()}"
last_updated: "${new Date().toISOString()}"
---

# ${input.projectName} — Master Architecture

## Product Mission
${input.projectDescription || '> Define the core mission and value proposition of this project.'}

## Tech Stack
${input.techStack || '> List primary technologies, frameworks, and infrastructure.'}

## System Ecosystem Map
> Document the high-level components, services, and their relationships.

\`\`\`
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend    │────▶│   Database   │
└──────────────┘     └──────────────┘     └──────────────┘
\`\`\`

## State Machine & Core Flows
> Document key application states and transitions.

## Threat Matrix & Risk Register
| Risk | Severity | Mitigation | Status |
| :--- | :--- | :--- | :--- |
| *Example: API rate limiting* | Medium | *Implement exponential backoff* | Open |
`;
  }

  private templateGuidelines(input: InitWizardInput): string {
    return `---
project_name: "${input.projectName}"
last_updated: "${new Date().toISOString()}"
---

# Development Guidelines — Non-Negotiable Rules of Engagement

## Rule A: Anti-Hallucination & Reality-First Engineering
- Never assume an API, library, or framework capability exists without verifying exact versions, deprecation notices, and platform constraints.
- Never invent non-existent methods or claim a background process is simple when platform throttling applies.
- Always verify code compiles and artifacts exist before claiming completion.

## Rule B: Strict Drift Control
- Every feature, class, or service must tie directly to the core project mission documented in \`memory/architecture.md\`.
- No bloat, no unneeded dependencies, and no out-of-scope abstractions.

## Rule C: 3-Step Anti-Debug Loop Protocol
If a technical roadblock occurs (build fails, API crashes, test errors):
1. **Identify Root Cause**: Extract exact error codes and stack traces.
2. **Hypothesize & Formulate Alternative**: Formulate an alternative architectural approach or fallback layer.
3. **Document in Progress Log**: Record the issue and the architectural pivot in \`memory/progress.md\`.

> **NEVER repeat the exact same failed action in a loop.**

## Rule D: Radical Honesty & Platform Boundary Disclosure
- If an OS, hardware, or economic limitation prevents a feature from working 100% natively, state it plainly.
- Always design layered fallbacks (Tier 1 → Tier 2 → Tier 3) for fragile integrations.

## Rule E: Mandatory Memory Edit Logging
- Every time you create, modify, or refactor ANY file in \`memory/\`, immediately append an entry to \`memory/changelog.md\`.
- Use the standard commit format documented in changelog.md.
`;
  }

  private templateProgress(input: InitWizardInput): string {
    return `---
project_name: "${input.projectName}"
current_phase: 1
last_updated: "${new Date().toISOString()}"
milestones:
  - id: "phase-1"
    title: "Phase 1: Foundation & Scaffolding"
    status: "IN_PROGRESS"
    tasks:
      - id: "t001"
        text: "Project initialization and repository setup"
        done: true
      - id: "t002"
        text: "Core architecture documentation"
        done: false
      - id: "t003"
        text: "Development environment configuration"
        done: false
---

# ${input.projectName} — Progress Log

## Phase 1: Foundation & Scaffolding
- [x] Project initialization and repository setup
- [ ] Core architecture documentation
- [ ] Development environment configuration

## Technical Decisions Log
> Architectural decisions are recorded in \`memory/decisions.md\` (standard/enterprise profiles) or below (minimal profile).
`;
  }

  private templateDecisions(input: InitWizardInput): string {
    return `---
project_name: "${input.projectName}"
last_updated: "${new Date().toISOString()}"
decisions: []
---

# Architectural Decision Records (ADR)

> Each decision is a numbered record documenting the context, choice, and tradeoffs of a significant technical decision.

<!-- New decisions are appended below. The extension auto-manages the frontmatter. -->
`;
  }

  private templateChangelog(input: InitWizardInput): string {
    return `---
project_name: "${input.projectName}"
last_commit_id: 0
last_updated: "${new Date().toISOString()}"
---

# Memory Changelog — Audit Trail

> Immutable commit-style log of every modification to \`memory/\` files.
> The Memo extension auto-increments commit IDs and timestamps.
> Older entries (beyond the last 20) are archived to \`memory/archive/\`.

<!-- Entries are prepended below this line -->
`;
  }

  private templateFeasibility(input: InitWizardInput): string {
    return `---
project_name: "${input.projectName}"
last_updated: "${new Date().toISOString()}"
---

# Feasibility Analysis

## Hard Platform Boundaries
> Document OS, hardware, or kernel-level constraints that limit this project.

## Economic & Rate-Limit Constraints
> Document API pricing tiers, rate limits, and cost ceilings.

## Layered Fallback Design
| Integration | Tier 1 (Primary) | Tier 2 (Fallback) | Tier 3 (Degraded) |
| :--- | :--- | :--- | :--- |
| *Example* | *Native API* | *Polling wrapper* | *Manual sync* |
`;
  }

  private templateValidation(input: InitWizardInput): string {
    return `---
project_name: "${input.projectName}"
last_updated: "${new Date().toISOString()}"
---

# Validation Findings & Architecture Review

## Review Scorecard
| Dimension | Score (1-5) | Notes |
| :--- | :--- | :--- |
| Code Quality | — | |
| Architecture Alignment | — | |
| Test Coverage | — | |
| Security Posture | — | |

## Known Edge Cases
> Document discovered edge cases and their handling status.

## Resolved Risks
> Document risks that were identified and successfully mitigated.
`;
  }

  // ─── Context Snapshot (Auto-Generated) ─────────────────────────────

  private generateContextSnapshot(input: InitWizardInput): string {
    return `---
auto_generated: true
generated_at: "${new Date().toISOString()}"
warning: "This file is auto-generated by the Memo extension. Manual edits will be overwritten."
---

# Context Snapshot — ${input.projectName}

> **Purpose**: This is a token-optimized summary of the project's current state.
> Agents should read this file FIRST when starting a new conversation or recovering from context compaction.
> For detailed information, refer to the individual memory files.

## Project
- **Name**: ${input.projectName}
- **Description**: ${input.projectDescription || 'Not yet defined'}
- **Stack**: ${input.techStack || 'Not yet defined'}

## Current Phase
- Phase 1: Foundation & Scaffolding (In Progress)

## Recent Decisions
- None yet.

## Active Constraints
- See \`memory/guidelines.md\` for non-negotiable rules of engagement.

## Last Memory Update
- ${new Date().toISOString()}
`;
  }

  // ─── Initial Commit Entry ──────────────────────────────────────────

  private generateInitCommitEntry(input: InitWizardInput): string {
    const now = new Date();
    const ts = now.toISOString().replace('T', ' ').substring(0, 19);
    return `
### [COMMIT-0001] ${ts}
- **Author**: Memo Extension (Auto-Init)
- **Type**: INIT
- **Target File(s)**: All memory files
- **Summary**: Living Memory system initialized with ${input.profile} profile
- **Diff / Details**:
  - Created memory/ directory structure
  - Scaffolded ${MEMORY_FILES[input.profile].length} memory files + context_snapshot.md
  - Profile: ${input.profile}
  - Project: ${input.projectName}
`;
  }
}
