/**
 * Memo — Constants & Configuration Defaults
 */

import type { MemoryProfile } from './models/types';

// ─── Extension Identity ────────────────────────────────────────────

export const EXTENSION_ID = 'memo-living-memory';
export const EXTENSION_DISPLAY_NAME = 'Memo';

// ─── Memory Directory ──────────────────────────────────────────────

export const MEMORY_DIR = 'memory';
export const MEMORY_ARCHIVE_DIR = 'memory/archive';

// ─── Memory File Names (by profile tier) ───────────────────────────

export const MEMORY_FILES: Record<MemoryProfile, string[]> = {
  minimal: [
    'architecture.md',
    'progress.md',
    'changelog.md',
  ],
  standard: [
    'architecture.md',
    'guidelines.md',
    'progress.md',
    'decisions.md',
    'changelog.md',
  ],
  enterprise: [
    'architecture.md',
    'guidelines.md',
    'feasibility.md',
    'progress.md',
    'decisions.md',
    'changelog.md',
    'validation.md',
  ],
};

/** Auto-generated file present in ALL profiles. */
export const CONTEXT_SNAPSHOT_FILE = 'context_snapshot.md';

// ─── Rule Injection Targets ────────────────────────────────────────

export const RULE_FILE_PATHS: Record<string, string> = {
  antigravity: '.agents/rules/living_memory.md',
  cursor: '.cursor/rules/living_memory.mdc',
  copilot: '.github/copilot-instructions.md',
  claude: 'CLAUDE.md',
  generic: 'AGENTS.md',
};

/** Markers used for safe merge-injection into existing rule files. */
export const MEMO_RULE_START_MARKER = '<!-- MEMO:START — Managed by Memo extension. Do not edit this section manually. -->';
export const MEMO_RULE_END_MARKER = '<!-- MEMO:END -->';

// ─── Changelog / Commit Defaults ───────────────────────────────────

export const DEFAULT_MAX_CHANGELOG_ENTRIES = 20;
export const COMMIT_ID_PREFIX = 'COMMIT';
export const ADR_ID_PREFIX = 'ADR';

// ─── Staleness ─────────────────────────────────────────────────────

export const DEFAULT_STALENESS_WARNING_DAYS = 3;

// ─── Status Bar ────────────────────────────────────────────────────

export const STATUS_BAR_PRIORITY = 100;
export const STATUS_BAR_ID = 'memo.statusBar';

// ─── Context Keys ──────────────────────────────────────────────────

export const CONTEXT_KEY_INITIALIZED = 'memo.isInitialized';
