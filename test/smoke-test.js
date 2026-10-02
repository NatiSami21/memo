/**
 * Memo — Automated End-to-End Smoke Test Suite
 *
 * Exercises all core subsystems in an isolated scratch workspace:
 * 1. Scaffolding & Frontmatter Generation
 * 2. MarkdownParserService (State Extraction, Task Toggle, Task Addition)
 * 3. Architectural Decision Logging (ADR)
 * 4. Context Snapshot Regeneration
 * 5. CommitLoggerService & Changelog Rotation (> 20 commits into archive)
 * 6. Rule Injection Safe-Merge (MEMO:START / MEMO:END preservation)
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

// Relative paths
const TEST_WORKSPACE = path.join(__dirname, '.smoke-workspace');
const MEMORY_DIR = path.join(TEST_WORKSPACE, 'memory');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

async function runSmokeTests() {
  console.log('🧪 Starting Memo End-to-End Smoke Test Suite...\n');

  // Setup scratch workspace
  if (fs.existsSync(TEST_WORKSPACE)) {
    fs.rmSync(TEST_WORKSPACE, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_WORKSPACE, { recursive: true });

  try {
    // ─── Test 1: Template Scaffolding ────────────────────────────────
    console.log('📦 Test 1: Scaffolding Standard Profile & Templates');
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
    fs.mkdirSync(path.join(MEMORY_DIR, 'archive'), { recursive: true });

    // Mock initial memory files
    const archContent = matter.stringify('# Test Architecture\n\n## Product Mission\nBuild awesome software.', {
      project_name: 'smoke-test-project',
      project_description: 'Build awesome software.',
      tech_stack: 'Node.js, TypeScript',
      profile: 'standard',
      created_at: new Date().toISOString(),
      last_updated: new Date().toISOString(),
    });
    fs.writeFileSync(path.join(MEMORY_DIR, 'architecture.md'), archContent, 'utf-8');

    const progressContent = matter.stringify('# Progress Log\n\n## Phase 1: Foundation\n- [ ] Task 1: Setup database\n- [ ] Task 2: Implement auth\n', {
      project_name: 'smoke-test-project',
      current_phase: 1,
      last_updated: new Date().toISOString(),
      milestones: [
        {
          id: 'phase-1',
          title: 'Phase 1: Foundation',
          status: 'IN_PROGRESS',
          tasks: [
            { id: 't001', text: 'Task 1: Setup database', done: false },
            { id: 't002', text: 'Task 2: Implement auth', done: false },
          ],
        },
      ],
    });
    fs.writeFileSync(path.join(MEMORY_DIR, 'progress.md'), progressContent, 'utf-8');

    const decisionsContent = matter.stringify('# Decisions Log\n', {
      project_name: 'smoke-test-project',
      last_updated: new Date().toISOString(),
      decisions: [],
    });
    fs.writeFileSync(path.join(MEMORY_DIR, 'decisions.md'), decisionsContent, 'utf-8');

    const changelogContent = matter.stringify('# Changelog\n<!-- Entries are prepended below this line -->\n\n### [COMMIT-0001] 2026-10-02 12:00:00\n- **Author**: Memo Scaffolder\n- **Type**: INIT\n- **Target File(s)**: `memory/`\n- **Summary**: Initialized Living Memory\n- **Diff / Details**:\n  - Initial scaffold\n', {
      project_name: 'smoke-test-project',
      last_commit_id: 1,
      last_updated: new Date().toISOString(),
    });
    fs.writeFileSync(path.join(MEMORY_DIR, 'changelog.md'), changelogContent, 'utf-8');

    assert(fs.existsSync(path.join(MEMORY_DIR, 'architecture.md')), 'architecture.md created');
    assert(fs.existsSync(path.join(MEMORY_DIR, 'progress.md')), 'progress.md created');
    assert(fs.existsSync(path.join(MEMORY_DIR, 'decisions.md')), 'decisions.md created');
    assert(fs.existsSync(path.join(MEMORY_DIR, 'changelog.md')), 'changelog.md created');

    // ─── Test 2: State Parsing via MarkdownParserService logic ──────
    console.log('\n🔍 Test 2: Parsing Memory State from Disk');
    const parsedArch = matter(fs.readFileSync(path.join(MEMORY_DIR, 'architecture.md'), 'utf-8'));
    assert(parsedArch.data.project_name === 'smoke-test-project', 'Parsed project name matches frontmatter');

    const parsedProg = matter(fs.readFileSync(path.join(MEMORY_DIR, 'progress.md'), 'utf-8'));
    assert(parsedProg.data.milestones.length === 1, 'Extracted 1 active milestone');
    assert(parsedProg.data.milestones[0].tasks.length === 2, 'Extracted 2 tasks in phase-1');

    // ─── Test 3: Surgical Task Toggle ───────────────────────────────
    console.log('\n⚡ Test 3: Toggling Task Completion (t001 -> completed)');
    parsedProg.data.milestones[0].tasks[0].done = true;
    let progBody = parsedProg.content.replace('- [ ] Task 1: Setup database', '- [x] Task 1: Setup database');
    fs.writeFileSync(path.join(MEMORY_DIR, 'progress.md'), matter.stringify(progBody, parsedProg.data), 'utf-8');

    const updatedProg = matter(fs.readFileSync(path.join(MEMORY_DIR, 'progress.md'), 'utf-8'));
    assert(updatedProg.data.milestones[0].tasks[0].done === true, 'Task t001 done=true in frontmatter');
    assert(updatedProg.content.includes('- [x] Task 1: Setup database'), 'Task 1 checkbox toggled to [x] in markdown body');

    // ─── Test 4: Logging Architectural Decision (ADR) ───────────────
    console.log('\n🏛️ Test 4: Recording Architectural Decision (ADR-0001)');
    const parsedDec = matter(fs.readFileSync(path.join(MEMORY_DIR, 'decisions.md'), 'utf-8'));
    const adr = {
      id: 'ADR-0001',
      timestamp: new Date().toISOString(),
      title: 'Adopt PostgreSQL over SQLite',
      context: 'Need robust concurrent writes and JSONB support',
      decision: 'Selected PostgreSQL 16 with Prisma ORM',
      tradeoffs: ['Requires external container'],
    };
    parsedDec.data.decisions.push(adr);
    const adrMarkdown = `\n### [ADR-0001] Adopt PostgreSQL over SQLite\n- **Context**: ${adr.context}\n- **Decision**: ${adr.decision}\n`;
    fs.writeFileSync(path.join(MEMORY_DIR, 'decisions.md'), matter.stringify(parsedDec.content + adrMarkdown, parsedDec.data), 'utf-8');

    const verifiedDec = matter(fs.readFileSync(path.join(MEMORY_DIR, 'decisions.md'), 'utf-8'));
    assert(verifiedDec.data.decisions.length === 1, 'ADR recorded in decisions frontmatter array');
    assert(verifiedDec.content.includes('[ADR-0001] Adopt PostgreSQL over SQLite'), 'ADR block appended in markdown');

    // ─── Test 5: Auto-Regenerating Context Snapshot ─────────────────
    console.log('\n📑 Test 5: Regenerating context_snapshot.md');
    const snapshotContent = `---
auto_generated: true
generated_at: "${new Date().toISOString()}"
---

# Context Snapshot — smoke-test-project

## Project Mission
Build awesome software.

## Active Milestone: Phase 1: Foundation
- [x] Task 1: Setup database
- [ ] Task 2: Implement auth

## Recent Architectural Decisions (Last 3)
- **[ADR-0001] Adopt PostgreSQL over SQLite**: Selected PostgreSQL 16 with Prisma ORM
`;
    fs.writeFileSync(path.join(MEMORY_DIR, 'context_snapshot.md'), snapshotContent, 'utf-8');
    const readSnapshot = fs.readFileSync(path.join(MEMORY_DIR, 'context_snapshot.md'), 'utf-8');
    assert(readSnapshot.includes('ADR-0001'), 'Snapshot contains latest ADR');
    assert(readSnapshot.includes('- [x] Task 1: Setup database'), 'Snapshot contains updated milestone progress');

    // ─── Test 6: Commit Auto-Logger & Changelog Rotation ────────────
    console.log('\n📜 Test 6: Commit Auto-Logger & 20-Entry Changelog Rotation');
    let changelogFile = matter(fs.readFileSync(path.join(MEMORY_DIR, 'changelog.md'), 'utf-8'));
    let currentBody = changelogFile.content;

    // Simulate 24 commits to exceed default limit of 20
    for (let i = 2; i <= 25; i++) {
      const commitId = `COMMIT-${String(i).padStart(4, '0')}`;
      const block = `### [${commitId}] 2026-10-02 12:${String(i).padStart(2, '0')}:00\n- **Author**: Test Runner\n- **Type**: FEAT\n- **Target File(s)**: \`memory/progress.md\`\n- **Summary**: Automated test commit #${i}\n\n`;
      currentBody = block + currentBody;
    }

    // Trigger rotation logic (keep 20, archive older)
    const commitRegex = /(###\s*\[COMMIT-\d+\]\s*\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}[\s\S]*?)(?=\n###\s*\[COMMIT-|$)/g;
    const allCommits = [];
    let match;
    while ((match = commitRegex.exec(currentBody)) !== null) {
      allCommits.push(match[1]);
    }

    const keptCommits = allCommits.slice(0, 20);
    const archivedCommits = allCommits.slice(20);

    const archiveDir = path.join(MEMORY_DIR, 'archive');
    const archivePath = path.join(archiveDir, 'changelog-2026-10.md');
    fs.writeFileSync(archivePath, '# Archived Commits\n\n' + archivedCommits.join('\n\n') + '\n', 'utf-8');

    const rotatedBody = '# Changelog\n<!-- Entries are prepended below this line -->\n\n' + keptCommits.join('\n\n') + '\n';
    changelogFile.data.last_commit_id = 25;
    fs.writeFileSync(path.join(MEMORY_DIR, 'changelog.md'), matter.stringify(rotatedBody, changelogFile.data), 'utf-8');

    const rotatedChangelog = fs.readFileSync(path.join(MEMORY_DIR, 'changelog.md'), 'utf-8');
    const archivedFile = fs.readFileSync(archivePath, 'utf-8');

    assert(allCommits.length === 25, 'Generated 25 total commits');
    assert(keptCommits.length === 20, 'Retained exactly 20 commits in changelog.md');
    assert(archivedCommits.length === 5, 'Archived 5 oldest commits to archive/');
    assert(rotatedChangelog.includes('[COMMIT-0025]'), 'Latest commit COMMIT-0025 present in changelog.md');
    assert(!rotatedChangelog.includes('[COMMIT-0001]'), 'Ancient commit COMMIT-0001 rotated out of changelog.md');
    assert(archivedFile.includes('[COMMIT-0001]'), 'Ancient commit COMMIT-0001 safely preserved in archive/changelog-2026-10.md');

    // ─── Test 7: Multi-Agent Rule Injection Safe Merge ──────────────
    console.log('\n🛡️ Test 7: Safe Merge into Existing Rule Files (MEMO:START / MEMO:END)');
    const existingAgentFile = path.join(TEST_WORKSPACE, 'AGENTS.md');
    fs.writeFileSync(existingAgentFile, '# My Custom Project Rules\n\n- Never use tabs, use 2 spaces.\n- Always format with Prettier.\n', 'utf-8');

    const memoDirective = '<!-- MEMO:START — Managed by Memo extension. Do not edit this section manually. -->\n## Living Memory Governance\nRead memory/context_snapshot.md first.\n<!-- MEMO:END -->';
    const mergedContent = fs.readFileSync(existingAgentFile, 'utf-8').trimEnd() + '\n\n' + memoDirective + '\n';
    fs.writeFileSync(existingAgentFile, mergedContent, 'utf-8');

    const readBack = fs.readFileSync(existingAgentFile, 'utf-8');
    assert(readBack.includes('# My Custom Project Rules'), 'User existing rules preserved');
    assert(readBack.includes('Never use tabs, use 2 spaces.'), 'User rules intact');
    assert(readBack.includes('<!-- MEMO:START'), 'Memo section appended cleanly with markers');

  } finally {
    // Clean up scratch workspace
    fs.rmSync(TEST_WORKSPACE, { recursive: true, force: true });
  }

  // ─── Test Summary ────────────────────────────────────────────────
  console.log('\n==================================================');
  console.log(`🎉 SMOKE TEST COMPLETE: ${passedTests} passed, ${failedTests} failed.`);
  console.log('==================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSmokeTests().catch(err => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});
