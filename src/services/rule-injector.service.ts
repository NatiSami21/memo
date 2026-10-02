/**
 * Memo — Rule Injector Service
 *
 * Generates and maintains AI agent governance rule files across
 * multiple platforms (Antigravity, Cursor, Copilot, Claude, Generic).
 *
 * Uses MEMO:START / MEMO:END markers to safely merge into existing
 * rule files without destroying developer-written content.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
  RULE_FILE_PATHS,
  MEMO_RULE_START_MARKER,
  MEMO_RULE_END_MARKER,
} from '../constants';
import type { AgentPlatform, RuleTargetStatus } from '../models/types';

export class RuleInjectorService {
  /**
   * Syncs governance rules to all configured target platforms.
   * Returns status for each platform.
   */
  public async syncAll(workspaceRoot: string): Promise<RuleTargetStatus[]> {
    const config = vscode.workspace.getConfiguration('memo');
    const platforms = config.get<AgentPlatform[]>('targetPlatforms', ['antigravity', 'generic']);

    const results: RuleTargetStatus[] = [];

    for (const platform of platforms) {
      const result = await this.syncPlatform(workspaceRoot, platform);
      results.push(result);
    }

    return results;
  }

  /**
   * Syncs governance rules for a single platform.
   */
  private async syncPlatform(workspaceRoot: string, platform: AgentPlatform): Promise<RuleTargetStatus> {
    const relativePath = RULE_FILE_PATHS[platform];
    if (!relativePath) {
      return {
        platform,
        filePath: '',
        exists: false,
        lastSynced: null,
        hasConflict: false,
      };
    }

    const absolutePath = path.join(workspaceRoot, relativePath);
    const directiveContent = this.generateDirective(platform);

    try {
      // Ensure parent directory exists
      const dir = path.dirname(absolutePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(absolutePath)) {
        // File exists — merge using MEMO:START / MEMO:END markers
        await this.mergeIntoExisting(absolutePath, directiveContent);
      } else {
        // File doesn't exist — create with full content
        const fullContent = this.wrapWithMarkers(directiveContent);
        fs.writeFileSync(absolutePath, fullContent, 'utf-8');
      }

      return {
        platform,
        filePath: relativePath,
        exists: true,
        lastSynced: new Date().toISOString(),
        hasConflict: false,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showWarningMessage(`Memo: Failed to sync rules for ${platform}: ${message}`);
      return {
        platform,
        filePath: relativePath,
        exists: false,
        lastSynced: null,
        hasConflict: true,
      };
    }
  }

  /**
   * Merges the Memo directive into an existing rule file
   * using MEMO:START / MEMO:END markers.
   */
  private async mergeIntoExisting(filePath: string, directiveContent: string): Promise<void> {
    let fileContent = fs.readFileSync(filePath, 'utf-8');

    const startIdx = fileContent.indexOf(MEMO_RULE_START_MARKER);
    const endIdx = fileContent.indexOf(MEMO_RULE_END_MARKER);

    if (startIdx !== -1 && endIdx !== -1) {
      // Replace existing Memo section
      const before = fileContent.substring(0, startIdx);
      const after = fileContent.substring(endIdx + MEMO_RULE_END_MARKER.length);
      fileContent = before + this.wrapWithMarkers(directiveContent) + after;
    } else {
      // No existing Memo section — append at end
      fileContent = fileContent.trimEnd() + '\n\n' + this.wrapWithMarkers(directiveContent) + '\n';
    }

    fs.writeFileSync(filePath, fileContent, 'utf-8');
  }

  /**
   * Wraps directive content with MEMO:START / MEMO:END markers.
   */
  private wrapWithMarkers(content: string): string {
    return `${MEMO_RULE_START_MARKER}\n${content}\n${MEMO_RULE_END_MARKER}`;
  }

  /**
   * Generates the governance directive content for a given platform.
   * The core rules are universal; the wrapper format varies by platform.
   */
  private generateDirective(platform: AgentPlatform): string {
    const coreDirective = this.getCoreDirective();

    switch (platform) {
      case 'cursor':
        return this.wrapForCursor(coreDirective);
      default:
        return coreDirective;
    }
  }

  /**
   * Cursor .mdc files use YAML frontmatter with glob patterns.
   */
  private wrapForCursor(coreDirective: string): string {
    return `---
description: "Memo Living Memory — Autonomous agent governance and anti-drift system"
globs: ["**/*"]
alwaysApply: true
---

${coreDirective}`;
  }

  /**
   * The universal governance directive injected into all platforms.
   */
  private getCoreDirective(): string {
    return `# SYSTEM DIRECTIVE: Autonomous Living Memory & Engineering Governance

You are the Lead Systems Architect & Senior Pair-Programming Partner on this project.
This repository is governed by a dedicated **\`memory/\`** knowledge directory.

## MANDATORY: Before Writing Any Code

1. **Read \`memory/context_snapshot.md\` FIRST** — This is a token-optimized summary of the project's current state, architecture, and active constraints.
2. **Cross-reference \`memory/architecture.md\`** — Verify your planned changes align with the documented mission and ecosystem map.
3. **Check \`memory/progress.md\`** — Understand the current phase, active tasks, and recently completed work.

## Non-Negotiable Rules

### Rule A: Anti-Hallucination
- Never assume an API, library, or framework capability exists without verifying exact versions and platform constraints.
- Never invent non-existent methods or claim a background process is simple when platform throttling applies.

### Rule B: Strict Drift Control
- Every feature, class, or service must tie directly to the core mission in \`memory/architecture.md\`.
- No bloat, no unneeded dependencies, no out-of-scope abstractions.

### Rule C: 3-Step Anti-Debug Loop Protocol
If a technical roadblock occurs, **NEVER repeat the exact same failed action**:
1. **Identify Root Cause**: Extract exact error codes and stack traces.
2. **Hypothesize Alternative**: Formulate a different architectural approach or fallback.
3. **Document**: Record the issue and pivot in \`memory/progress.md\`.

### Rule D: Radical Honesty
- If an OS, hardware, or economic limitation prevents a feature, state it plainly.
- Design layered fallbacks (Tier 1 → Tier 2 → Tier 3) for fragile integrations.

### Rule E: Mandatory Memory Edit Logging
- Every time you modify ANY file in \`memory/\`, append an entry to \`memory/changelog.md\` using the commit format:
  \`\`\`
  ### [COMMIT-XXXX] YYYY-MM-DD HH:MM:SS
  - **Type**: [INIT | FEAT | REFACTOR | DOCS | FIX | RULE]
  - **Target File(s)**: \`memory/target_file.md\`
  - **Summary**: Concise description of the change
  \`\`\`

## Turn-by-Turn Workflow
On EVERY interaction:
1. **Context Check**: Cross-reference the request against \`memory/context_snapshot.md\` and \`memory/progress.md\`.
2. **Execute with Verification**: Test and inspect actual outputs rather than assuming success.
3. **Log Progress**: Record key decisions and milestone updates in the appropriate memory files.
`;
  }
}
