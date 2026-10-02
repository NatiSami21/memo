/**
 * Memo — Dashboard Webview Provider
 *
 * Implements the Living Memory Control Center in the IDE sidebar.
 * Engineered with high-aesthetic developer tooling standards:
 * - Glassmorphic dark theme tokens with luminous accents
 * - Glowing status pills and animated gradient progress indicators
 * - Git-graph vertical commit timeline with color-coded type chips
 * - Interactive micro-animations (check transitions, copy toasts, pulse auras)
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MarkdownParserService } from '../services/markdown-parser.service';
import { RuleInjectorService } from '../services/rule-injector.service';
import type {
  WebviewToExtensionMessage,
  ExtensionToWebviewMessage,
} from '../models/types';

export class DashboardWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'memo.dashboardView';
  private view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly markdownParser: MarkdownParserService,
    private readonly ruleInjector: RuleInjectorService,
    private readonly getWorkspaceRoot: () => string | undefined
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message: WebviewToExtensionMessage) => {
      await this.handleWebviewMessage(message);
    });

    this.refreshState();
  }

  public async refreshState(): Promise<void> {
    if (!this.view) {
      return;
    }

    const root = this.getWorkspaceRoot();
    if (!root) {
      return;
    }

    const config = vscode.workspace.getConfiguration('memo');
    const stalenessDays = config.get<number>('stalenessWarningDays', 3);
    const ruleStatus = await this.ruleInjector.syncAll(root);

    const state = await this.markdownParser.parseMemoryState(
      root,
      ruleStatus,
      stalenessDays
    );

    this.postMessage({
      type: 'stateUpdate',
      state,
    });
  }

  private postMessage(message: ExtensionToWebviewMessage): void {
    this.view?.webview.postMessage(message);
  }

  private async handleWebviewMessage(message: WebviewToExtensionMessage): Promise<void> {
    const root = this.getWorkspaceRoot();
    if (!root) {
      return;
    }

    switch (message.type) {
      case 'ready':
        await this.refreshState();
        break;

      case 'toggleTask':
        await this.markdownParser.toggleTask(
          root,
          message.milestoneId,
          message.taskId,
          message.completed
        );
        await this.refreshState();
        break;

      case 'addTask':
        if (message.text.trim()) {
          await this.markdownParser.addTaskToMilestone(
            root,
            message.milestoneId,
            message.text.trim()
          );
          await this.refreshState();
        }
        break;

      case 'logDecision':
        if (message.title.trim() && message.decision.trim()) {
          await this.markdownParser.recordDecision(root, {
            title: message.title.trim(),
            context: message.context.trim(),
            decision: message.decision.trim(),
          });
          vscode.window.showInformationMessage(`🧠 Memo: Logged decision — "${message.title}"`);
          await this.refreshState();
        }
        break;

      case 'copyDigest':
        try {
          const snapshotPath = path.join(root, 'memory', 'context_snapshot.md');
          if (fs.existsSync(snapshotPath)) {
            const digest = fs.readFileSync(snapshotPath, 'utf-8');
            await vscode.env.clipboard.writeText(digest);
            this.postMessage({ type: 'digestCopied', success: true });
            vscode.window.showInformationMessage('🧠 Memo: Context digest copied to clipboard!');
          }
        } catch {
          this.postMessage({ type: 'digestCopied', success: false });
        }
        break;

      case 'syncRules':
        const results = await this.ruleInjector.syncAll(root);
        this.postMessage({ type: 'rulesSynced', results });
        vscode.window.showInformationMessage('🧠 Memo: Agent governance rules re-synchronized.');
        await this.refreshState();
        break;

      case 'openFile':
        try {
          const fullPath = path.join(root, message.filePath);
          if (fs.existsSync(fullPath)) {
            const doc = await vscode.workspace.openTextDocument(fullPath);
            await vscode.window.showTextDocument(doc);
          }
        } catch {
          vscode.window.showErrorMessage(`Memo: Failed to open ${message.filePath}`);
        }
        break;

      case 'refresh':
        await this.refreshState();
        break;
    }
  }

  private getHtmlForWebview(_webview: vscode.Webview): string {
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Memo Control Center</title>
  <style>
    :root {
      --bg: var(--vscode-sideBar-background, #0f1117);
      --card-bg: rgba(255, 255, 255, 0.03);
      --card-hover: rgba(255, 255, 255, 0.05);
      --border: rgba(255, 255, 255, 0.08);
      --border-focus: rgba(99, 102, 241, 0.5);
      --fg: var(--vscode-foreground, #f3f4f6);
      --muted: var(--vscode-descriptionForeground, #9ca3af);
      --accent: #6366f1;
      --accent-glow: rgba(99, 102, 241, 0.35);
      --accent-gradient: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);
      --emerald: #10b981;
      --emerald-glow: rgba(16, 185, 129, 0.35);
      --amber: #f59e0b;
      --blue: #38bdf8;
      --pink: #f43f5e;
      --font-mono: var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
      font-size: var(--vscode-font-size, 12px);
      color: var(--fg);
      background-color: var(--bg);
      padding: 12px 10px;
      line-height: 1.5;
      user-select: none;
    }

    /* Scrollbars */
    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.12); border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }

    /* Top Brand & Status */
    .brand-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--border);
    }
    .brand-left {
      display: flex;
      align-items: center;
      gap: 7px;
    }
    .brand-icon {
      width: 20px;
      height: 20px;
      border-radius: 5px;
      background: var(--accent-gradient);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      box-shadow: 0 0 12px var(--accent-glow);
    }
    .project-title {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: -0.2px;
      max-width: 140px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 10px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 9999px;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.25);
      color: #34d399;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .pulse-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--emerald);
      box-shadow: 0 0 8px var(--emerald-glow);
      animation: pulse 2s infinite ease-in-out;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.85); }
    }

    /* Warning Banner */
    .stale-banner {
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0.05) 100%);
      border: 1px solid rgba(245, 158, 11, 0.35);
      color: #fbbf24;
      padding: 7px 10px;
      border-radius: 6px;
      font-size: 11px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 7px;
      animation: fadeIn 0.3s ease;
    }

    /* Metrics HUD */
    .metrics-hud {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      margin-bottom: 14px;
    }
    .hud-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 9px 6px;
      text-align: center;
      position: relative;
      overflow: hidden;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .hud-card:hover {
      background: var(--card-hover);
      border-color: rgba(255, 255, 255, 0.15);
      transform: translateY(-1px);
    }
    .hud-card::after {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.15), transparent);
    }
    .hud-value {
      font-size: 15px;
      font-weight: 800;
      letter-spacing: -0.3px;
      font-family: var(--font-mono);
      background: linear-gradient(180deg, #ffffff 40%, #9ca3af 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .hud-label {
      font-size: 9px;
      color: var(--muted);
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.6px;
      margin-top: 2px;
    }

    /* Cyber Tab Navigation */
    .tab-strip {
      display: flex;
      gap: 3px;
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 3px;
      margin-bottom: 14px;
    }
    .tab-item {
      flex: 1;
      background: transparent;
      border: none;
      color: var(--muted);
      padding: 6px 0;
      font-size: 11px;
      font-weight: 600;
      border-radius: 5px;
      cursor: pointer;
      text-align: center;
      transition: all 0.2s ease;
      letter-spacing: 0.2px;
    }
    .tab-item:hover {
      color: var(--fg);
    }
    .tab-item.active {
      background: var(--card-bg);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    }

    /* Content Panels */
    .tab-pane { display: none; }
    .tab-pane.active { display: block; animation: fadeIn 0.2s ease; }

    /* Active Milestone Header & Progress Bar */
    .milestone-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .milestone-name {
      font-size: 12px;
      font-weight: 700;
      color: var(--fg);
    }
    .milestone-badge {
      font-size: 10px;
      font-family: var(--font-mono);
      font-weight: 700;
      color: #c084fc;
    }
    .progress-track {
      width: 100%;
      height: 5px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 9999px;
      overflow: hidden;
      margin-bottom: 12px;
    }
    .progress-glow {
      height: 100%;
      background: var(--accent-gradient);
      border-radius: 9999px;
      box-shadow: 0 0 10px var(--accent-glow);
      transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* Tasks Checklist */
    .task-row {
      display: flex;
      align-items: flex-start;
      gap: 9px;
      padding: 7px 8px;
      border-radius: 6px;
      margin-bottom: 3px;
      transition: background 0.15s ease;
    }
    .task-row:hover {
      background: var(--card-hover);
    }
    .cyber-checkbox {
      appearance: none;
      -webkit-appearance: none;
      width: 15px;
      height: 15px;
      border: 1px solid rgba(255, 255, 255, 0.25);
      border-radius: 4px;
      background: transparent;
      cursor: pointer;
      margin-top: 2px;
      position: relative;
      flex-shrink: 0;
      transition: all 0.2s ease;
    }
    .cyber-checkbox:checked {
      background: var(--accent);
      border-color: var(--accent);
      box-shadow: 0 0 8px var(--accent-glow);
    }
    .cyber-checkbox:checked::after {
      content: '✓';
      position: absolute;
      top: -2px;
      left: 2px;
      font-size: 11px;
      color: #ffffff;
      font-weight: bold;
    }
    .task-label {
      flex: 1;
      font-size: 12px;
      word-break: break-word;
      transition: color 0.2s ease;
    }
    .task-label.done {
      text-decoration: line-through;
      color: var(--muted);
      opacity: 0.6;
    }

    /* Sleek Input Fields */
    .sleek-input {
      width: 100%;
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid var(--border);
      color: var(--fg);
      padding: 7px 10px;
      border-radius: 6px;
      font-size: 12px;
      margin-top: 8px;
      outline: none;
      transition: all 0.2s ease;
    }
    .sleek-input:focus {
      border-color: var(--border-focus);
      box-shadow: 0 0 10px var(--accent-glow);
    }
    .sleek-input::placeholder {
      color: rgba(255, 255, 255, 0.3);
    }

    /* Decision Cards */
    .decision-bubble {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 8px;
      transition: all 0.2s ease;
    }
    .decision-bubble:hover {
      background: var(--card-hover);
      border-color: rgba(255, 255, 255, 0.15);
    }
    .decision-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 5px;
    }
    .decision-id {
      font-size: 10px;
      font-family: var(--font-mono);
      font-weight: 700;
      color: var(--blue);
      background: rgba(56, 189, 248, 0.1);
      padding: 1px 6px;
      border-radius: 4px;
      border: 1px solid rgba(56, 189, 248, 0.2);
    }
    .decision-headline {
      font-weight: 600;
      font-size: 12px;
      color: var(--fg);
      margin-bottom: 4px;
    }
    .decision-body {
      font-size: 11px;
      color: var(--muted);
      line-height: 1.4;
    }

    /* Commits Timeline */
    .commit-row {
      position: relative;
      padding-left: 18px;
      padding-bottom: 12px;
      border-left: 2px solid rgba(99, 102, 241, 0.3);
      margin-left: 6px;
    }
    .commit-row:last-child {
      border-left-color: transparent;
      padding-bottom: 0;
    }
    .timeline-node {
      position: absolute;
      left: -6px;
      top: 0;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 0 8px var(--accent-glow);
    }
    .commit-chips {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 3px;
    }
    .chip {
      font-size: 10px;
      font-family: var(--font-mono);
      padding: 1px 6px;
      border-radius: 4px;
      font-weight: 600;
    }
    .chip-id {
      background: rgba(255, 255, 255, 0.08);
      color: var(--fg);
    }
    .chip-feat { background: rgba(99, 102, 241, 0.15); color: #818cf8; }
    .chip-rule { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
    .chip-refactor { background: rgba(56, 189, 248, 0.15); color: #38bdf8; }
    .chip-docs { background: rgba(16, 185, 129, 0.15); color: #34d399; }
    .commit-date {
      font-size: 10px;
      color: var(--muted);
    }
    .commit-text {
      font-size: 11px;
      color: var(--fg);
      line-height: 1.35;
    }

    /* Buttons */
    .cyber-btn {
      width: 100%;
      background: var(--accent-gradient);
      color: #ffffff;
      border: none;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-top: 10px;
      box-shadow: 0 0 14px rgba(99, 102, 241, 0.25);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .cyber-btn:hover {
      box-shadow: 0 0 20px var(--accent-glow);
      transform: translateY(-1px);
    }
    .cyber-btn:active {
      transform: translateY(0);
    }
    .cyber-btn-ghost {
      background: var(--card-bg);
      border: 1px solid var(--border);
      box-shadow: none;
      color: var(--fg);
    }
    .cyber-btn-ghost:hover {
      background: var(--card-hover);
      border-color: rgba(255, 255, 255, 0.18);
      box-shadow: none;
    }

    /* File Shortcuts */
    .file-shortcut {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 8px;
      border-radius: 5px;
      background: var(--card-bg);
      border: 1px solid var(--border);
      color: var(--fg);
      text-decoration: none;
      font-size: 11px;
      font-family: var(--font-mono);
      transition: all 0.15s ease;
    }
    .file-shortcut:hover {
      background: var(--card-hover);
      border-color: var(--border-focus);
      color: #ffffff;
    }

    /* Animations */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(3px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .empty-hud {
      text-align: center;
      padding: 24px 12px;
      color: var(--muted);
      font-size: 12px;
    }
  </style>
</head>
<body>
  <!-- Brand & Status -->
  <div class="brand-bar">
    <div class="brand-left">
      <div class="brand-icon">🧠</div>
      <span class="project-title" id="projectName">Memo</span>
    </div>
    <div class="status-pill" id="statusBadge">
      <div class="pulse-dot"></div>
      <span>Active</span>
    </div>
  </div>

  <!-- Staleness Warning -->
  <div class="stale-banner" id="staleWarning" style="display: none;">
    <span>⚠️</span>
    <span>Memory is stale (no updates in 3+ days).</span>
  </div>

  <!-- Metrics HUD -->
  <div class="metrics-hud">
    <div class="hud-card">
      <div class="hud-value" id="milestoneProgress">0%</div>
      <div class="hud-label">Milestone</div>
    </div>
    <div class="hud-card">
      <div class="hud-value" id="decisionCount">0</div>
      <div class="hud-label">Decisions</div>
    </div>
    <div class="hud-card">
      <div class="hud-value" id="commitCount">#0001</div>
      <div class="hud-label">Commits</div>
    </div>
  </div>

  <!-- Navigation Strip -->
  <div class="tab-strip">
    <button class="tab-item active" data-tab="tasks">Tasks</button>
    <button class="tab-item" data-tab="decisions">Decisions</button>
    <button class="tab-item" data-tab="commits">Timeline</button>
    <button class="tab-item" data-tab="toolkit">Toolkit</button>
  </div>

  <!-- Tab 1: Tasks -->
  <div class="tab-pane active" id="tab-tasks">
    <div class="milestone-meta">
      <span class="milestone-name" id="activeMilestoneTitle">Current Sprint</span>
      <span class="milestone-badge" id="milestonePercentText">0%</span>
    </div>
    <div class="progress-track">
      <div class="progress-glow" id="progressBar" style="width: 0%;"></div>
    </div>
    <div id="taskList"></div>
    <input type="text" class="sleek-input" id="newTaskInput" placeholder="+ Add task (press Enter ↵)...">
  </div>

  <!-- Tab 2: Decisions (ADRs) -->
  <div class="tab-pane" id="tab-decisions">
    <div id="decisionsList"></div>
    <button class="cyber-btn cyber-btn-ghost" id="toggleDecisionFormBtn">+ Record Decision (ADR)</button>
    <div id="decisionForm" style="display: none; margin-top: 10px; animation: fadeIn 0.2s ease;">
      <input type="text" class="sleek-input" id="decisionTitleInput" placeholder="Decision Title (e.g. Use WebSocket)">
      <input type="text" class="sleek-input" id="decisionContextInput" placeholder="Context (why was this needed?)">
      <input type="text" class="sleek-input" id="decisionChoiceInput" placeholder="Decision (what was chosen?)">
      <button class="cyber-btn" id="saveDecisionBtn">Save Decision Record</button>
    </div>
  </div>

  <!-- Tab 3: Commits Timeline -->
  <div class="tab-pane" id="tab-commits">
    <div id="commitList" style="margin-top: 4px;"></div>
  </div>

  <!-- Tab 4: Agent Toolkit -->
  <div class="tab-pane" id="tab-toolkit">
    <button class="cyber-btn" id="copyDigestBtn">📋 Copy Context Digest</button>
    <button class="cyber-btn cyber-btn-ghost" id="syncRulesBtn" style="margin-top: 6px;">🔄 Sync Agent Governance Rules</button>
    
    <div style="margin-top: 16px;">
      <div style="font-size: 10px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 6px;">
        Memory Files
      </div>
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <a href="#" class="file-shortcut" data-file="memory/context_snapshot.md">
          <span>context_snapshot.md</span>
          <span style="color: var(--muted); font-size: 10px;">Digest ↗</span>
        </a>
        <a href="#" class="file-shortcut" data-file="memory/architecture.md">
          <span>architecture.md</span>
          <span style="color: var(--muted); font-size: 10px;">Specs ↗</span>
        </a>
        <a href="#" class="file-shortcut" data-file="memory/guidelines.md">
          <span>guidelines.md</span>
          <span style="color: var(--muted); font-size: 10px;">Rules ↗</span>
        </a>
        <a href="#" class="file-shortcut" data-file="memory/progress.md">
          <span>progress.md</span>
          <span style="color: var(--muted); font-size: 10px;">Tasks ↗</span>
        </a>
        <a href="#" class="file-shortcut" data-file="memory/changelog.md">
          <span>changelog.md</span>
          <span style="color: var(--muted); font-size: 10px;">Audit ↗</span>
        </a>
      </div>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let currentState = null;

    vscode.postMessage({ type: 'ready' });

    // Tab navigation
    document.querySelectorAll('.tab-item').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-item').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const tabId = 'tab-' + btn.getAttribute('data-tab');
        document.getElementById(tabId)?.classList.add('active');
      });
    });

    // Handle incoming messages
    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.type === 'stateUpdate') {
        currentState = msg.state;
        renderState(msg.state);
      }
    });

    function renderState(state) {
      if (!state.isInitialized) {
        document.body.innerHTML = \`
          <div class="empty-hud">
            <div style="font-size: 28px; margin-bottom: 8px;">🧠</div>
            <div style="font-weight: 700; font-size: 13px; color: var(--fg);">Living Memory Inactive</div>
            <p style="margin-top: 6px; line-height: 1.4; color: var(--muted); font-size: 11px;">
              Initialize Living Memory to lock in architecture and prevent agent context compaction drift.
            </p>
          </div>
        \`;
        return;
      }

      document.getElementById('projectName').textContent = state.projectName;

      // Staleness
      const staleEl = document.getElementById('staleWarning');
      staleEl.style.display = state.isStale ? 'flex' : 'none';

      // Active Milestone & Progress Bar
      const activeMilestone = state.milestones.find(m => m.status === 'IN_PROGRESS') || state.milestones[0];
      const progress = activeMilestone ? activeMilestone.progressPercentage : 0;

      document.getElementById('milestoneProgress').textContent = progress + '%';
      document.getElementById('milestonePercentText').textContent = progress + '%';
      document.getElementById('progressBar').style.width = progress + '%';
      if (activeMilestone) {
        document.getElementById('activeMilestoneTitle').textContent = activeMilestone.title;
      }

      // Metric counters
      document.getElementById('decisionCount').textContent = state.technicalDecisions.length;
      const lastCommit = state.commits[0];
      document.getElementById('commitCount').textContent = lastCommit ? '#' + lastCommit.commitId.replace('COMMIT-', '') : '#0001';

      // Render Tasks
      const taskListEl = document.getElementById('taskList');
      taskListEl.innerHTML = '';
      if (activeMilestone && activeMilestone.tasks.length > 0) {
        activeMilestone.tasks.forEach(task => {
          const row = document.createElement('div');
          row.className = 'task-row';
          row.innerHTML = \`
            <input type="checkbox" class="cyber-checkbox" data-mid="\${activeMilestone.id}" data-tid="\${task.id}" \${task.completed ? 'checked' : ''}>
            <span class="task-label \${task.completed ? 'done' : ''}">\${escapeHtml(task.text)}</span>
          \`;
          taskListEl.appendChild(row);
        });
      } else {
        taskListEl.innerHTML = '<div style="color: var(--muted); font-size: 11px; padding: 8px 0; text-align: center;">No active tasks documented.</div>';
      }

      // Render Decisions (ADRs)
      const decisionsEl = document.getElementById('decisionsList');
      decisionsEl.innerHTML = '';
      if (state.technicalDecisions.length > 0) {
        state.technicalDecisions.forEach(d => {
          const card = document.createElement('div');
          card.className = 'decision-bubble';
          card.innerHTML = \`
            <div class="decision-head">
              <span class="decision-id">\${escapeHtml(d.id)}</span>
              <span style="font-size: 10px; color: var(--muted);">\${d.timestamp ? d.timestamp.split('T')[0] : ''}</span>
            </div>
            <div class="decision-headline">\${escapeHtml(d.title)}</div>
            <div class="decision-body">\${escapeHtml(d.decision)}</div>
          \`;
          decisionsEl.appendChild(card);
        });
      } else {
        decisionsEl.innerHTML = '<div style="color: var(--muted); font-size: 11px; padding: 12px 0; text-align: center;">No architectural decisions logged yet.</div>';
      }

      // Render Commits Timeline
      const commitListEl = document.getElementById('commitList');
      commitListEl.innerHTML = '';
      if (state.commits.length > 0) {
        state.commits.slice(0, 10).forEach(c => {
          const row = document.createElement('div');
          row.className = 'commit-row';
          const typeClass = 'chip-' + (c.type ? c.type.toLowerCase() : 'feat');
          row.innerHTML = \`
            <div class="timeline-node"></div>
            <div class="commit-chips">
              <span class="chip chip-id">\${escapeHtml(c.commitId)}</span>
              <span class="chip \${typeClass}">\${escapeHtml(c.type)}</span>
              <span class="commit-date">\${c.timestamp ? c.timestamp.split(' ')[0] : ''}</span>
            </div>
            <div class="commit-text">\${escapeHtml(c.summary)}</div>
          \`;
          commitListEl.appendChild(row);
        });
      } else {
        commitListEl.innerHTML = '<div style="color: var(--muted); font-size: 11px; padding: 12px 0; text-align: center;">No memory commits recorded yet.</div>';
      }
    }

    // Task checkbox toggle
    document.addEventListener('change', e => {
      if (e.target && e.target.classList.contains('cyber-checkbox')) {
        const milestoneId = e.target.getAttribute('data-mid');
        const taskId = e.target.getAttribute('data-tid');
        vscode.postMessage({
          type: 'toggleTask',
          milestoneId,
          taskId,
          completed: e.target.checked
        });
      }
    });

    // Add task (Enter key)
    document.getElementById('newTaskInput').addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.value.trim() && currentState) {
        const activeMilestone = currentState.milestones.find(m => m.status === 'IN_PROGRESS') || currentState.milestones[0];
        if (activeMilestone) {
          vscode.postMessage({
            type: 'addTask',
            milestoneId: activeMilestone.id,
            text: e.target.value.trim()
          });
          e.target.value = '';
        }
      }
    });

    // Decision Form
    document.getElementById('toggleDecisionFormBtn').addEventListener('click', () => {
      const form = document.getElementById('decisionForm');
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('saveDecisionBtn').addEventListener('click', () => {
      const title = document.getElementById('decisionTitleInput').value.trim();
      const context = document.getElementById('decisionContextInput').value.trim();
      const decision = document.getElementById('decisionChoiceInput').value.trim();
      if (title && decision) {
        vscode.postMessage({
          type: 'logDecision',
          title,
          context,
          decision
        });
        document.getElementById('decisionTitleInput').value = '';
        document.getElementById('decisionContextInput').value = '';
        document.getElementById('decisionChoiceInput').value = '';
        document.getElementById('decisionForm').style.display = 'none';
      }
    });

    // Toolkit Actions with visual feedback
    document.getElementById('copyDigestBtn').addEventListener('click', function() {
      const btn = this;
      vscode.postMessage({ type: 'copyDigest' });
      const origText = btn.textContent;
      btn.textContent = '✓ Copied to Clipboard!';
      setTimeout(() => { btn.textContent = origText; }, 1800);
    });

    document.getElementById('syncRulesBtn').addEventListener('click', function() {
      const btn = this;
      vscode.postMessage({ type: 'syncRules' });
      const origText = btn.textContent;
      btn.textContent = '✓ Rules Synced!';
      setTimeout(() => { btn.textContent = origText; }, 1800);
    });

    // File Link Click
    document.querySelectorAll('.file-shortcut').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const filePath = link.getAttribute('data-file');
        vscode.postMessage({ type: 'openFile', filePath });
      });
    });

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  </script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
