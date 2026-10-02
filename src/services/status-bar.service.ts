/**
 * Memo — Status Bar Service
 *
 * Manages the VS Code status bar item that shows the current
 * memory state: initialization status, last commit ID, and staleness.
 */

import * as vscode from 'vscode';
import { STATUS_BAR_PRIORITY, STATUS_BAR_ID } from '../constants';

export class StatusBarService implements vscode.Disposable {
  private readonly statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      STATUS_BAR_ID,
      vscode.StatusBarAlignment.Left,
      STATUS_BAR_PRIORITY
    );
    this.statusBarItem.command = 'memo.openDashboard';
    this.statusBarItem.name = 'Memo Living Memory';
    this.setNotInitialized();
    this.statusBarItem.show();
  }

  /** Show "not initialized" state. */
  public setNotInitialized(): void {
    this.statusBarItem.text = '$(brain) Memo: Not Initialized';
    this.statusBarItem.tooltip = 'Click to open Memo dashboard. Living Memory is not set up for this workspace.';
    this.statusBarItem.backgroundColor = undefined;
  }

  /** Show "active" state with optional last commit ID. */
  public setActive(lastCommitId?: string): void {
    const commitLabel = lastCommitId ? ` | #${lastCommitId}` : '';
    this.statusBarItem.text = `$(brain) Memo: Active${commitLabel}`;
    this.statusBarItem.tooltip = 'Click to open Memo dashboard. Living Memory is active and synced.';
    this.statusBarItem.backgroundColor = undefined;
  }

  /** Show "stale" warning state. */
  public setStale(daysSinceUpdate: number): void {
    this.statusBarItem.text = `$(brain) Memo: Stale (${daysSinceUpdate}d)`;
    this.statusBarItem.tooltip = `Memory files haven't been updated in ${daysSinceUpdate} days. Consider updating progress.md or logging a decision.`;
    this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  }

  /** Show brief loading state. */
  public setLoading(): void {
    this.statusBarItem.text = '$(loading~spin) Memo: Syncing...';
    this.statusBarItem.tooltip = 'Synchronizing memory state...';
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}
