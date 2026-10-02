/**
 * Memo — Extension Entry Point
 *
 * Coordinates the Living Memory system:
 * - Scaffolding (minimal, standard, enterprise tiers)
 * - Multi-Agent Rule Injection (Antigravity, Cursor, Copilot, Claude, Generic)
 * - Bidirectional Markdown Parser & Surgical State Updates
 * - Commit Auto-Logger with Changelog Rotation
 * - GitHub-Style Control Center Webview Sidebar
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceWatcherService } from './services/workspace-watcher.service';
import { StatusBarService } from './services/status-bar.service';
import { MemoryScaffolderService } from './services/memory-scaffolder.service';
import { RuleInjectorService } from './services/rule-injector.service';
import { MarkdownParserService } from './services/markdown-parser.service';
import { CommitLoggerService } from './services/commit-logger.service';
import { DashboardWebviewProvider } from './views/dashboard-webview.provider';

let workspaceWatcher: WorkspaceWatcherService;
let statusBar: StatusBarService;
let scaffolder: MemoryScaffolderService;
let ruleInjector: RuleInjectorService;
let markdownParser: MarkdownParserService;
let commitLogger: CommitLoggerService;
let dashboardProvider: DashboardWebviewProvider;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('[Memo] Living Memory extension activating...');

  // ─── Initialize Core Services ──────────────────────────────────────
  workspaceWatcher = new WorkspaceWatcherService();
  statusBar = new StatusBarService();
  scaffolder = new MemoryScaffolderService();
  ruleInjector = new RuleInjectorService();
  markdownParser = new MarkdownParserService();
  commitLogger = new CommitLoggerService();

  // ─── Register Dashboard Webview ────────────────────────────────────
  dashboardProvider = new DashboardWebviewProvider(
    context.extensionUri,
    markdownParser,
    ruleInjector,
    () => workspaceWatcher.getWorkspaceRoot()
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      DashboardWebviewProvider.viewType,
      dashboardProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  context.subscriptions.push(workspaceWatcher, statusBar);

  // ─── Register Commands ─────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('memo.init', async () => {
      const root = workspaceWatcher.getWorkspaceRoot();
      if (!root) {
        vscode.window.showErrorMessage('Memo: No workspace folder is open.');
        return;
      }
      statusBar.setLoading();
      await scaffolder.quickInit(root);
      await ruleInjector.syncAll(root);
      await workspaceWatcher.refresh();
      await dashboardProvider.refreshState();
      statusBar.setActive('0001');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('memo.initDetailed', async () => {
      const root = workspaceWatcher.getWorkspaceRoot();
      if (!root) {
        vscode.window.showErrorMessage('Memo: No workspace folder is open.');
        return;
      }
      statusBar.setLoading();
      await scaffolder.detailedInit(root);
      await ruleInjector.syncAll(root);
      await workspaceWatcher.refresh();
      await dashboardProvider.refreshState();
      statusBar.setActive('0001');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('memo.syncRules', async () => {
      const root = workspaceWatcher.getWorkspaceRoot();
      if (!root) {
        vscode.window.showErrorMessage('Memo: No workspace folder is open.');
        return;
      }
      statusBar.setLoading();
      const results = await ruleInjector.syncAll(root);
      const synced = results.filter((r) => r.exists).length;
      const failed = results.filter((r) => r.hasConflict).length;
      statusBar.setActive();
      await dashboardProvider.refreshState();
      vscode.window.showInformationMessage(
        `🧠 Memo: Rules synced to ${synced} platform(s).${failed > 0 ? ` ${failed} failed.` : ''}`
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('memo.copyDigest', async () => {
      const memoryDir = workspaceWatcher.getMemoryDirPath();
      if (!memoryDir) {
        vscode.window.showErrorMessage('Memo: No memory directory found.');
        return;
      }
      try {
        const snapshotPath = path.join(memoryDir, 'context_snapshot.md');
        if (fs.existsSync(snapshotPath)) {
          const content = fs.readFileSync(snapshotPath, 'utf-8');
          await vscode.env.clipboard.writeText(content);
          vscode.window.showInformationMessage('🧠 Memo: Context digest copied to clipboard!');
        } else {
          vscode.window.showWarningMessage('Memo: context_snapshot.md not found. Run "Memo: Initialize" first.');
        }
      } catch {
        vscode.window.showErrorMessage('Memo: Failed to copy context digest.');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('memo.logDecision', async () => {
      const root = workspaceWatcher.getWorkspaceRoot();
      if (!root) {
        vscode.window.showErrorMessage('Memo: No workspace folder open.');
        return;
      }

      const title = await vscode.window.showInputBox({
        prompt: 'Decision Title',
        placeHolder: 'e.g. Enforce UUIDv7 over auto-increment ID for distributed safety',
      });
      if (!title) { return; }

      const context_ = await vscode.window.showInputBox({
        prompt: 'Context — Why is this decision needed?',
        placeHolder: 'e.g. Distributed nodes require collision-free time-sortable IDs',
      });
      if (context_ === undefined) { return; }

      const decision = await vscode.window.showInputBox({
        prompt: 'Decision — What was chosen and what are the tradeoffs?',
        placeHolder: 'e.g. Adopted UUIDv7 via standard library generator',
      });
      if (decision === undefined) { return; }

      await markdownParser.recordDecision(root, {
        title,
        context: context_,
        decision,
      });

      await dashboardProvider.refreshState();
      vscode.window.showInformationMessage(`🧠 Memo: Decision logged — "${title}"`);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('memo.openDashboard', async () => {
      await vscode.commands.executeCommand('memo.dashboardView.focus');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('memo.refreshDashboard', async () => {
      await workspaceWatcher.refresh();
      await dashboardProvider.refreshState();
      vscode.window.showInformationMessage('🧠 Memo: Dashboard refreshed.');
    })
  );

  // ─── Reactive Event Loop ───────────────────────────────────────────

  workspaceWatcher.onMemoryStatusChanged(async (isInitialized) => {
    if (isInitialized) {
      const root = workspaceWatcher.getWorkspaceRoot();
      if (root) {
        const state = await markdownParser.parseMemoryState(root);
        const lastCommit = state.commits[0];
        if (state.isStale) {
          statusBar.setStale(3);
        } else {
          statusBar.setActive(lastCommit?.commitId.replace('COMMIT-', ''));
        }
      } else {
        statusBar.setActive();
      }
    } else {
      statusBar.setNotInitialized();
    }
    await dashboardProvider.refreshState();
  });

  workspaceWatcher.onMemoryFileChanged(async (uri) => {
    const root = workspaceWatcher.getWorkspaceRoot();
    if (!root) {
      return;
    }

    // 1. Trigger commit auto-logger
    commitLogger.logFileChange(root, uri.fsPath, async (commit) => {
      statusBar.setActive(commit.commitId.replace('COMMIT-', ''));
      await dashboardProvider.refreshState();
    });

    // 2. Auto-sync rules if enabled
    const config = vscode.workspace.getConfiguration('memo');
    if (config.get<boolean>('autoSyncRules', true)) {
      await ruleInjector.syncAll(root);
    }

    // 3. Update dashboard UI
    await dashboardProvider.refreshState();
  });

  // ─── Initial Startup Check ─────────────────────────────────────────

  const isInitialized = await workspaceWatcher.initialize();
  if (isInitialized) {
    const root = workspaceWatcher.getWorkspaceRoot();
    if (root) {
      const state = await markdownParser.parseMemoryState(root);
      const lastCommit = state.commits[0];
      if (state.isStale) {
        statusBar.setStale(3);
      } else {
        statusBar.setActive(lastCommit?.commitId.replace('COMMIT-', ''));
      }
    }
  }

  console.log('[Memo] Living Memory extension activated.');
}

export function deactivate(): void {
  console.log('[Memo] Living Memory extension deactivated.');
}
