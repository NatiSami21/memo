/**
 * Memo — Core Data Models
 *
 * These interfaces define the structured state that the extension
 * parses from YAML frontmatter in memory/ markdown files and
 * exposes to the Webview dashboard and agent digest engine.
 */

// ─── Memory Profiles ───────────────────────────────────────────────

/** Tiered memory profiles controlling how many files are scaffolded. */
export type MemoryProfile = 'minimal' | 'standard' | 'enterprise';

/** Target AI platforms for rule injection. */
export type AgentPlatform = 'antigravity' | 'cursor' | 'copilot' | 'claude' | 'generic';

// ─── Memory State (Root aggregate) ─────────────────────────────────

/** The complete in-memory representation of a workspace's living memory. */
export interface MemoryState {
  /** Whether memory/ directory exists and is initialized. */
  isInitialized: boolean;

  /** Absolute path to the workspace root. */
  workspacePath: string;

  /** Project name extracted from architecture.md frontmatter or folder name. */
  projectName: string;

  /** Active memory profile tier. */
  profile: MemoryProfile;

  /** High-level project mission from architecture.md. */
  projectMission: string;

  /** Parsed milestones from progress.md frontmatter. */
  milestones: MilestonePhase[];

  /** Parsed architectural decisions from decisions.md (standard+) or progress.md (minimal). */
  technicalDecisions: ArchitecturalDecision[];

  /** Parsed commit entries from changelog.md. */
  commits: MemoryCommit[];

  /** Status of rule files per platform. */
  ruleStatus: RuleTargetStatus[];

  /** Staleness info — last modification timestamp of any memory file. */
  lastMemoryUpdate: string | null;

  /** Whether memory files are stale (exceed configured staleness threshold). */
  isStale: boolean;
}

// ─── Milestones ────────────────────────────────────────────────────

export interface MilestonePhase {
  id: string;
  title: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  progressPercentage: number;
  tasks: TaskItem[];
}

export interface TaskItem {
  id: string;
  text: string;
  completed: boolean;
}

// ─── Architectural Decision Records (ADR) ──────────────────────────

export interface ArchitecturalDecision {
  /** Unique ID, e.g. "ADR-0001" */
  id: string;
  timestamp: string;
  title: string;
  context: string;
  decision: string;
  tradeoffs: string[];
}

// ─── Memory Commit Audit Trail ─────────────────────────────────────

export type CommitType = 'INIT' | 'FEAT' | 'REFACTOR' | 'DOCS' | 'FIX' | 'RULE';

export interface MemoryCommit {
  /** Unique ID, e.g. "COMMIT-0001" */
  commitId: string;
  timestamp: string;
  author: string;
  type: CommitType;
  targetFiles: string[];
  summary: string;
  diffSummary: string[];
}

// ─── Rule Injection Status ─────────────────────────────────────────

export interface RuleTargetStatus {
  platform: AgentPlatform;
  filePath: string;
  exists: boolean;
  lastSynced: string | null;
  hasConflict: boolean;
}

// ─── Init Wizard Input ─────────────────────────────────────────────

export interface InitWizardInput {
  projectName: string;
  projectDescription: string;
  techStack: string;
  profile: MemoryProfile;
  targetPlatforms: AgentPlatform[];
}

// ─── Webview Message Protocol ──────────────────────────────────────

/** Messages from Webview → Extension Host */
export type WebviewToExtensionMessage =
  | { type: 'ready' }
  | { type: 'toggleTask'; milestoneId: string; taskId: string; completed: boolean }
  | { type: 'addTask'; milestoneId: string; text: string }
  | { type: 'logDecision'; title: string; context: string; decision: string }
  | { type: 'copyDigest' }
  | { type: 'syncRules' }
  | { type: 'openFile'; filePath: string }
  | { type: 'refresh' };

/** Messages from Extension Host → Webview */
export type ExtensionToWebviewMessage =
  | { type: 'stateUpdate'; state: MemoryState }
  | { type: 'digestCopied'; success: boolean }
  | { type: 'rulesSynced'; results: RuleTargetStatus[] }
  | { type: 'error'; message: string };
