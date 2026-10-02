/**
 * Memo — Commit Auto-Logger & Changelog Rotation Service
 *
 * Implements Rule E: Mandatory Memory Edit Logging.
 * Whenever memory files are modified, automatically increments [COMMIT-XXXX],
 * records timestamps and diffs, and rotates older commits (> 20 entries)
 * into memory/archive/ to protect agent context window tokens.
 */

import * as path from 'path';
import * as fs from 'fs';
import matter from 'gray-matter';
import {
  MEMORY_DIR,
  COMMIT_ID_PREFIX,
  DEFAULT_MAX_CHANGELOG_ENTRIES,
} from '../constants';
import type { CommitType, MemoryCommit } from '../models/types';

export class CommitLoggerService {
  private isWriting = false;
  private pendingFiles: Set<string> = new Set();
  private debounceTimer: NodeJS.Timeout | null = null;

  /**
   * Registers a file change in memory/. Debounces rapid saves and records a commit.
   */
  public logFileChange(
    workspaceRoot: string,
    changedFilePath: string,
    onCommitted?: (commit: MemoryCommit) => void
  ): void {
    const filename = path.basename(changedFilePath);

    // Guard: ignore changelog.md and archive files to prevent infinite commit loops
    if (
      filename === 'changelog.md' ||
      changedFilePath.includes(path.join(MEMORY_DIR, 'archive')) ||
      this.isWriting
    ) {
      return;
    }

    this.pendingFiles.add(filename);

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      if (this.pendingFiles.size === 0) {
        return;
      }

      const files = Array.from(this.pendingFiles);
      this.pendingFiles.clear();

      try {
        const commit = await this.recordCommit(workspaceRoot, {
          type: this.inferCommitType(files),
          targetFiles: files.map((f) => `memory/${f}`),
          summary: `Updated ${files.join(', ')}`,
          diffSummary: files.map((f) => `Modified ${f} specifications`),
        });

        if (onCommitted) {
          onCommitted(commit);
        }
      } catch (err) {
        console.error('[Memo] CommitLogger error:', err);
      }
    }, 1500); // 1.5s debounce
  }

  /**
   * Records a structured commit into changelog.md.
   */
  public async recordCommit(
    workspaceRoot: string,
    data: {
      type: CommitType;
      targetFiles: string[];
      summary: string;
      diffSummary: string[];
      author?: string;
    },
    maxEntries: number = DEFAULT_MAX_CHANGELOG_ENTRIES
  ): Promise<MemoryCommit> {
    const changelogPath = path.join(workspaceRoot, MEMORY_DIR, 'changelog.md');
    if (!fs.existsSync(changelogPath)) {
      throw new Error('changelog.md not found');
    }

    this.isWriting = true;

    try {
      const fileContent = fs.readFileSync(changelogPath, 'utf-8');
      const parsed = matter(fileContent);

      const lastCommitId = (parsed.data.last_commit_id as number) || 0;
      const nextCommitId = lastCommitId + 1;
      const formattedCommitId = `${COMMIT_ID_PREFIX}-${String(nextCommitId).padStart(4, '0')}`;

      const now = new Date();
      const ts = now.toISOString().replace('T', ' ').substring(0, 19);
      const author = data.author || 'Lead Architect & Agent';

      const commit: MemoryCommit = {
        commitId: formattedCommitId,
        timestamp: ts,
        author,
        type: data.type,
        targetFiles: data.targetFiles,
        summary: data.summary,
        diffSummary: data.diffSummary,
      };

      const newCommitBlock = `
### [${formattedCommitId}] ${ts}
- **Author**: ${author}
- **Type**: ${data.type}
- **Target File(s)**: ${data.targetFiles.map((f) => `\`${f}\``).join(', ')}
- **Summary**: ${data.summary}
- **Diff / Details**:
${data.diffSummary.map((d) => `  - ${d}`).join('\n')}
`;

      // Update frontmatter
      parsed.data.last_commit_id = nextCommitId;
      parsed.data.last_updated = now.toISOString();

      // Prepend the new commit after the introductory markdown header
      let body = parsed.content;
      const insertMarker = '<!-- Entries are prepended below this line -->';

      if (body.includes(insertMarker)) {
        const parts = body.split(insertMarker);
        body = parts[0] + insertMarker + '\n' + newCommitBlock + parts[1];
      } else {
        body = newCommitBlock + '\n' + body;
      }

      // Check if rotation is required
      const rotatedBody = await this.rotateChangelogIfNeeded(
        workspaceRoot,
        body,
        maxEntries
      );

      const finalOutput = matter.stringify(rotatedBody, parsed.data);
      fs.writeFileSync(changelogPath, finalOutput, 'utf-8');

      return commit;
    } finally {
      // Release write lock after disk flush
      setTimeout(() => {
        this.isWriting = false;
      }, 500);
    }
  }

  /**
   * Rotates commits older than maxEntries into memory/archive/changelog-YYYY-MM.md.
   */
  private async rotateChangelogIfNeeded(
    workspaceRoot: string,
    changelogBody: string,
    maxEntries: number
  ): Promise<string> {
    const commitRegex =
      /(###\s*\[COMMIT-\d+\]\s*\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}[\s\S]*?)(?=\n###\s*\[COMMIT-|$)/g;

    const matches: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = commitRegex.exec(changelogBody)) !== null) {
      matches.push(match[1]);
    }

    if (matches.length <= maxEntries) {
      return changelogBody;
    }

    // Keep the first `maxEntries` in the main changelog
    const keptCommits = matches.slice(0, maxEntries);
    const archivedCommits = matches.slice(maxEntries);

    // Write archived commits to archive directory
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const archiveDir = path.join(workspaceRoot, MEMORY_DIR, 'archive');

    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }

    const archivePath = path.join(archiveDir, `changelog-${yearMonth}.md`);
    const archiveHeader = fs.existsSync(archivePath)
      ? ''
      : `# Memory Changelog Archive — ${yearMonth}\n\n> Historical audit trail rotated to protect context window tokens.\n\n`;

    fs.appendFileSync(archivePath, archiveHeader + archivedCommits.join('\n\n') + '\n', 'utf-8');

    // Reconstruct body with only kept commits
    const headerPart = changelogBody.split('### [COMMIT-')[0];
    return headerPart + keptCommits.join('\n\n') + '\n';
  }

  private inferCommitType(files: string[]): CommitType {
    if (files.some((f) => f.includes('guideline'))) {
      return 'RULE';
    }
    if (files.some((f) => f.includes('architecture') || f.includes('feasibility'))) {
      return 'REFACTOR';
    }
    if (files.some((f) => f.includes('progress'))) {
      return 'FEAT';
    }
    if (files.some((f) => f.includes('validation'))) {
      return 'DOCS';
    }
    return 'FEAT';
  }
}
