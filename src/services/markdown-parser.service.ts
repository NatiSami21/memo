/**
 * Memo — Markdown & Frontmatter Parser Service
 *
 * Parses YAML frontmatter and markdown content from memory/ files into
 * strongly-typed MemoryState models. Provides surgical methods to update
 * tasks, record decisions, and regenerate context_snapshot.md without
 * corrupting user notes or file structure.
 */

import * as path from 'path';
import * as fs from 'fs';
import matter from 'gray-matter';
import {
  MEMORY_DIR,
  CONTEXT_SNAPSHOT_FILE,
  DEFAULT_STALENESS_WARNING_DAYS,
  ADR_ID_PREFIX,
} from '../constants';
import type {
  MemoryState,
  MemoryProfile,
  MilestonePhase,
  TaskItem,
  ArchitecturalDecision,
  MemoryCommit,
  CommitType,
  RuleTargetStatus,
} from '../models/types';

export class MarkdownParserService {
  /**
   * Reads all memory files and aggregates the complete MemoryState.
   */
  public async parseMemoryState(
    workspaceRoot: string,
    ruleStatus: RuleTargetStatus[] = [],
    stalenessDays: number = DEFAULT_STALENESS_WARNING_DAYS
  ): Promise<MemoryState> {
    const memoryDir = path.join(workspaceRoot, MEMORY_DIR);

    if (!fs.existsSync(memoryDir)) {
      return this.createEmptyState(workspaceRoot);
    }

    // 1. Read architecture.md
    const archData = this.parseArchitectureFile(memoryDir);

    // 2. Read progress.md
    const milestones = this.parseProgressFile(memoryDir);

    // 3. Read decisions.md (standard/enterprise) or progress.md (minimal)
    const decisions = this.parseDecisionsFile(memoryDir, archData.profile);

    // 4. Read changelog.md
    const commits = this.parseChangelogFile(memoryDir);

    // 5. Calculate staleness & last updated time
    const { lastMemoryUpdate, isStale } = this.calculateStaleness(memoryDir, stalenessDays);

    return {
      isInitialized: true,
      workspacePath: workspaceRoot,
      projectName: archData.projectName || path.basename(workspaceRoot),
      profile: archData.profile,
      projectMission: archData.projectMission,
      milestones,
      technicalDecisions: decisions,
      commits,
      ruleStatus,
      lastMemoryUpdate,
      isStale,
    };
  }

  // ─── File Parsers ──────────────────────────────────────────────────

  private parseArchitectureFile(memoryDir: string): {
    projectName: string;
    profile: MemoryProfile;
    projectMission: string;
  } {
    const filePath = path.join(memoryDir, 'architecture.md');
    if (!fs.existsSync(filePath)) {
      return { projectName: '', profile: 'standard', projectMission: '' };
    }

    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const parsed = matter(fileContent);

      const projectName = (parsed.data.project_name as string) || '';
      const profile = (parsed.data.profile as MemoryProfile) || 'standard';

      // Extract mission from frontmatter or first section of markdown
      let projectMission = (parsed.data.project_description as string) || '';
      if (!projectMission) {
        const missionMatch = parsed.content.match(/## Product Mission\s*\n([\s\S]*?)(?=\n##|$)/);
        if (missionMatch) {
          projectMission = missionMatch[1].trim().replace(/^>\s*/gm, '');
        }
      }

      return { projectName, profile, projectMission };
    } catch {
      return { projectName: '', profile: 'standard', projectMission: '' };
    }
  }

  private parseProgressFile(memoryDir: string): MilestonePhase[] {
    const filePath = path.join(memoryDir, 'progress.md');
    if (!fs.existsSync(filePath)) {
      return [];
    }

    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const parsed = matter(fileContent);

      // Check if milestones exist in frontmatter
      if (Array.isArray(parsed.data.milestones)) {
        return parsed.data.milestones.map((m: any, idx: number) => {
          const tasks: TaskItem[] = Array.isArray(m.tasks)
            ? m.tasks.map((t: any, tIdx: number) => ({
                id: t.id || `t${String(tIdx + 1).padStart(3, '0')}`,
                text: t.text || '',
                completed: Boolean(t.done ?? t.completed),
              }))
            : [];

          const completedCount = tasks.filter((t) => t.completed).length;
          const progressPercentage =
            tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

          return {
            id: m.id || `phase-${idx + 1}`,
            title: m.title || `Phase ${idx + 1}`,
            status: (m.status as any) || 'IN_PROGRESS',
            progressPercentage,
            tasks,
          };
        });
      }

      // Fallback: parse markdown checkbox syntax (- [ ] or - [x])
      return this.parseMarkdownChecklists(parsed.content);
    } catch {
      return [];
    }
  }

  private parseMarkdownChecklists(content: string): MilestonePhase[] {
    const phases: MilestonePhase[] = [];
    const sectionRegex = /##\s+([^#\n]+)\n([\s\S]*?)(?=\n##|$)/g;
    let match: RegExpExecArray | null;

    let phaseIndex = 1;
    while ((match = sectionRegex.exec(content)) !== null) {
      const title = match[1].trim();
      if (title.toLowerCase().includes('technical decisions')) {
        continue;
      }

      const body = match[2];
      const taskRegex = /-\s*\[([ xX])\]\s*(.+)/g;
      let taskMatch: RegExpExecArray | null;
      const tasks: TaskItem[] = [];
      let taskIndex = 1;

      while ((taskMatch = taskRegex.exec(body)) !== null) {
        tasks.push({
          id: `t${String(taskIndex++).padStart(3, '0')}`,
          completed: taskMatch[1].toLowerCase() === 'x',
          text: taskMatch[2].trim(),
        });
      }

      if (tasks.length > 0) {
        const completedCount = tasks.filter((t) => t.completed).length;
        phases.push({
          id: `phase-${phaseIndex++}`,
          title,
          status: completedCount === tasks.length ? 'COMPLETED' : 'IN_PROGRESS',
          progressPercentage: Math.round((completedCount / tasks.length) * 100),
          tasks,
        });
      }
    }

    return phases;
  }

  private parseDecisionsFile(
    memoryDir: string,
    profile: MemoryProfile
  ): ArchitecturalDecision[] {
    const targetFile =
      profile === 'minimal' ? 'progress.md' : 'decisions.md';
    const filePath = path.join(memoryDir, targetFile);

    if (!fs.existsSync(filePath)) {
      return [];
    }

    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const parsed = matter(fileContent);

      // Check frontmatter decisions array
      if (Array.isArray(parsed.data.decisions)) {
        return parsed.data.decisions.map((d: any, idx: number) => ({
          id: d.id || `${ADR_ID_PREFIX}-${String(idx + 1).padStart(4, '0')}`,
          timestamp: d.timestamp || new Date().toISOString(),
          title: d.title || 'Untitled Decision',
          context: d.context || '',
          decision: d.decision || '',
          tradeoffs: Array.isArray(d.tradeoffs) ? d.tradeoffs : [],
        }));
      }

      // Fallback: parse markdown headings like ### [ADR-0001] Title
      const decisions: ArchitecturalDecision[] = [];
      const adrRegex = /###\s*\[(ADR-\d+)\]\s*([^\n]+)\n([\s\S]*?)(?=\n###\s*\[ADR-|$)/g;
      let adrMatch: RegExpExecArray | null;

      while ((adrMatch = adrRegex.exec(parsed.content)) !== null) {
        const id = adrMatch[1];
        const title = adrMatch[2].trim();
        const body = adrMatch[3];

        const contextMatch = body.match(/- \*\*Context\*\*:\s*([^\n]+)/);
        const decisionMatch = body.match(/- \*\*Decision\*\*:\s*([^\n]+)/);

        decisions.push({
          id,
          timestamp: new Date().toISOString(),
          title,
          context: contextMatch ? contextMatch[1].trim() : '',
          decision: decisionMatch ? decisionMatch[1].trim() : '',
          tradeoffs: [],
        });
      }

      return decisions;
    } catch {
      return [];
    }
  }

  private parseChangelogFile(memoryDir: string): MemoryCommit[] {
    const filePath = path.join(memoryDir, 'changelog.md');
    if (!fs.existsSync(filePath)) {
      return [];
    }

    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const commits: MemoryCommit[] = [];

      // Regex matches: ### [COMMIT-XXXX] YYYY-MM-DD HH:MM:SS
      const commitRegex =
        /###\s*\[(COMMIT-\d+)\]\s*(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})\n([\s\S]*?)(?=\n###\s*\[COMMIT-|$)/g;
      let match: RegExpExecArray | null;

      while ((match = commitRegex.exec(fileContent)) !== null) {
        const commitId = match[1];
        const timestamp = match[2];
        const body = match[3];

        const authorMatch = body.match(/- \*\*Author\*\*:\s*([^\n]+)/);
        const typeMatch = body.match(/- \*\*Type\*\*:\s*([^\n]+)/);
        const targetMatch = body.match(/- \*\*Target File\(s\)\*\*:\s*([^\n]+)/);
        const summaryMatch = body.match(/- \*\*Summary\*\*:\s*([^\n]+)/);

        const diffSummary: string[] = [];
        const diffRegex = /^\s*-\s+(.+)$/gm;
        let diffMatch: RegExpExecArray | null;
        let diffSection = false;

        const lines = body.split('\n');
        for (const line of lines) {
          if (line.includes('**Diff / Details**:')) {
            diffSection = true;
            continue;
          }
          if (diffSection && line.trim().startsWith('-')) {
            diffSummary.push(line.replace(/^\s*-\s+/, '').trim());
          }
        }

        commits.push({
          commitId,
          timestamp,
          author: authorMatch ? authorMatch[1].trim() : 'Developer / Agent',
          type: (typeMatch ? typeMatch[1].trim().toUpperCase() : 'FEAT') as CommitType,
          targetFiles: targetMatch
            ? targetMatch[1].split(',').map((s) => s.trim().replace(/`/g, ''))
            : [],
          summary: summaryMatch ? summaryMatch[1].trim() : 'Memory updated',
          diffSummary,
        });
      }

      return commits;
    } catch {
      return [];
    }
  }

  // ─── Surgical State Updaters ───────────────────────────────────────

  /**
   * Toggles task completion state in both YAML frontmatter and markdown body of progress.md.
   */
  public async toggleTask(
    workspaceRoot: string,
    milestoneId: string,
    taskId: string,
    completed: boolean
  ): Promise<void> {
    const filePath = path.join(workspaceRoot, MEMORY_DIR, 'progress.md');
    if (!fs.existsSync(filePath)) {
      return;
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const parsed = matter(fileContent);

    // 1. Update YAML frontmatter
    let taskText = '';
    if (Array.isArray(parsed.data.milestones)) {
      for (const m of parsed.data.milestones) {
        if (m.id === milestoneId && Array.isArray(m.tasks)) {
          for (const t of m.tasks) {
            if (t.id === taskId) {
              t.done = completed;
              taskText = t.text;
            }
          }
        }
      }
      parsed.data.last_updated = new Date().toISOString();
    }

    // 2. Update markdown body if task text is known
    let newContent = parsed.content;
    if (taskText) {
      const escapedText = taskText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const oldCheck = completed ? '\\[ \\]' : '\\[[xX]\\]';
      const newCheck = completed ? '[x]' : '[ ]';
      const regex = new RegExp(`(-\\s*)${oldCheck}(\\s+${escapedText})`, 'm');
      newContent = newContent.replace(regex, `$1${newCheck}$2`);
    }

    // Reconstruct file preserving formatting
    const updatedFile = matter.stringify(newContent, parsed.data);
    fs.writeFileSync(filePath, updatedFile, 'utf-8');

    // Regenerate context snapshot
    await this.regenerateContextSnapshot(workspaceRoot);
  }

  /**
   * Adds a task to a milestone in progress.md.
   */
  public async addTaskToMilestone(
    workspaceRoot: string,
    milestoneId: string,
    taskText: string
  ): Promise<void> {
    const filePath = path.join(workspaceRoot, MEMORY_DIR, 'progress.md');
    if (!fs.existsSync(filePath)) {
      return;
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const parsed = matter(fileContent);

    const newTaskId = `t${Date.now().toString().slice(-4)}`;

    if (Array.isArray(parsed.data.milestones)) {
      for (const m of parsed.data.milestones) {
        if (m.id === milestoneId) {
          if (!Array.isArray(m.tasks)) {
            m.tasks = [];
          }
          m.tasks.push({
            id: newTaskId,
            text: taskText,
            done: false,
          });
        }
      }
      parsed.data.last_updated = new Date().toISOString();
    }

    // Also append checkbox to the markdown section
    let newContent = parsed.content;
    const milestoneMatch = new RegExp(`(##\\s+[^\\n]*${milestoneId}[^\\n]*\\n)([\\s\\S]*?)(?=\\n##|$)`, 'i');
    if (milestoneMatch.test(newContent)) {
      newContent = newContent.replace(milestoneMatch, `$1$2- [ ] ${taskText}\n`);
    } else {
      newContent = newContent.trimEnd() + `\n- [ ] ${taskText}\n`;
    }

    const updatedFile = matter.stringify(newContent, parsed.data);
    fs.writeFileSync(filePath, updatedFile, 'utf-8');

    await this.regenerateContextSnapshot(workspaceRoot);
  }

  /**
   * Records a new Architectural Decision Record (ADR).
   */
  public async recordDecision(
    workspaceRoot: string,
    data: { title: string; context: string; decision: string }
  ): Promise<ArchitecturalDecision> {
    const memoryDir = path.join(workspaceRoot, MEMORY_DIR);
    const arch = this.parseArchitectureFile(memoryDir);
    const targetFile = arch.profile === 'minimal' ? 'progress.md' : 'decisions.md';
    const filePath = path.join(memoryDir, targetFile);

    let fileContent = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
    const parsed = matter(fileContent);

    if (!Array.isArray(parsed.data.decisions)) {
      parsed.data.decisions = [];
    }

    const adrNumber = parsed.data.decisions.length + 1;
    const adrId = `${ADR_ID_PREFIX}-${String(adrNumber).padStart(4, '0')}`;
    const timestamp = new Date().toISOString();

    const newDecision: ArchitecturalDecision = {
      id: adrId,
      timestamp,
      title: data.title,
      context: data.context,
      decision: data.decision,
      tradeoffs: [],
    };

    parsed.data.decisions.push(newDecision);
    parsed.data.last_updated = timestamp;

    // Append markdown block to content
    const adrMarkdown = `
### [${adrId}] ${data.title}
- **Date**: ${timestamp.split('T')[0]}
- **Context**: ${data.context}
- **Decision**: ${data.decision}
- **Status**: Accepted
`;
    const newContent = parsed.content.trimEnd() + '\n' + adrMarkdown;

    const updatedFile = matter.stringify(newContent, parsed.data);
    fs.writeFileSync(filePath, updatedFile, 'utf-8');

    await this.regenerateContextSnapshot(workspaceRoot);
    return newDecision;
  }

  /**
   * Re-generates context_snapshot.md with fresh active state.
   */
  public async regenerateContextSnapshot(workspaceRoot: string): Promise<void> {
    const memoryDir = path.join(workspaceRoot, MEMORY_DIR);
    if (!fs.existsSync(memoryDir)) {
      return;
    }

    const arch = this.parseArchitectureFile(memoryDir);
    const milestones = this.parseProgressFile(memoryDir);
    const decisions = this.parseDecisionsFile(memoryDir, arch.profile);

    const activeMilestone =
      milestones.find((m) => m.status === 'IN_PROGRESS') || milestones[0];

    const recentDecisions = decisions.slice(-3).reverse();

    const snapshotContent = `---
auto_generated: true
generated_at: "${new Date().toISOString()}"
warning: "Auto-generated by Memo extension. Do not edit manually."
---

# Context Snapshot — ${arch.projectName || path.basename(workspaceRoot)}

> **Token-Optimized Agent Digest**: Read this FIRST on new chat or after context compaction.
> Refer to individual files in \`memory/\` for granular details.

## Project Mission
${arch.projectMission || 'Not yet defined.'}

## Active Milestone: ${activeMilestone ? activeMilestone.title : 'None'}
${
  activeMilestone
    ? activeMilestone.tasks
        .map((t) => `- [${t.completed ? 'x' : ' '}] ${t.text}`)
        .join('\n')
    : '- No active tasks'
}

## Recent Architectural Decisions (Last 3)
${
  recentDecisions.length > 0
    ? recentDecisions
        .map((d) => `- **[${d.id}] ${d.title}**: ${d.decision}`)
        .join('\n')
    : '- None recorded yet'
}

## Core Operating Rules
- Anti-Hallucination: Verify all imports, APIs, and versions before coding.
- Anti-Drift: All work must map to \`memory/architecture.md\`.
- 3-Step Anti-Debug Loop: Extract error → Formulate alternative → Document pivot.
- Memory Auditing: Append \`[COMMIT-XXXX]\` to \`memory/changelog.md\` on any memory edit.

## Last Updated
- ${new Date().toISOString()}
`;

    const snapshotPath = path.join(memoryDir, CONTEXT_SNAPSHOT_FILE);
    fs.writeFileSync(snapshotPath, snapshotContent, 'utf-8');
  }

  // ─── Helpers ───────────────────────────────────────────────────────

  private calculateStaleness(
    memoryDir: string,
    stalenessDays: number
  ): { lastMemoryUpdate: string | null; isStale: boolean } {
    let latestTime = 0;

    try {
      const files = fs.readdirSync(memoryDir);
      for (const file of files) {
        if (file.endsWith('.md')) {
          const stats = fs.statSync(path.join(memoryDir, file));
          if (stats.mtimeMs > latestTime) {
            latestTime = stats.mtimeMs;
          }
        }
      }
    } catch {
      return { lastMemoryUpdate: null, isStale: false };
    }

    if (latestTime === 0) {
      return { lastMemoryUpdate: null, isStale: false };
    }

    const lastDate = new Date(latestTime);
    const daysSince = (Date.now() - latestTime) / (1000 * 60 * 60 * 24);

    return {
      lastMemoryUpdate: lastDate.toISOString(),
      isStale: daysSince >= stalenessDays,
    };
  }

  private createEmptyState(workspaceRoot: string): MemoryState {
    return {
      isInitialized: false,
      workspacePath: workspaceRoot,
      projectName: path.basename(workspaceRoot),
      profile: 'standard',
      projectMission: '',
      milestones: [],
      technicalDecisions: [],
      commits: [],
      ruleStatus: [],
      lastMemoryUpdate: null,
      isStale: false,
    };
  }
}
