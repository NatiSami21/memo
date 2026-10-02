/**
 * Memo — Workspace Watcher Service
 *
 * Detects workspace folders on activation, checks for memory/ existence,
 * and prompts the user to initialize if missing. Also watches for
 * changes inside memory/ to trigger state refreshes and auto-commit logging.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MEMORY_DIR, CONTEXT_KEY_INITIALIZED } from '../constants';

export class WorkspaceWatcherService implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private memoryFileWatcher: vscode.FileSystemWatcher | undefined;

  /** Event emitted when memory initialization status changes. */
  private readonly _onMemoryStatusChanged = new vscode.EventEmitter<boolean>();
  public readonly onMemoryStatusChanged = this._onMemoryStatusChanged.event;

  /** Event emitted when any file inside memory/ is modified. */
  private readonly _onMemoryFileChanged = new vscode.EventEmitter<vscode.Uri>();
  public readonly onMemoryFileChanged = this._onMemoryFileChanged.event;

  constructor() {
    // Watch for workspace folder changes (user opens/closes folders)
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.checkWorkspace())
    );
  }

  /**
   * Performs the initial workspace check on activation.
   * Returns true if memory/ is already initialized.
   */
  public async initialize(): Promise<boolean> {
    const isInitialized = await this.checkWorkspace();

    if (!isInitialized) {
      await this.promptInitialization();
    }

    return isInitialized;
  }

  /**
   * Returns the absolute path to the workspace's memory/ directory,
   * or undefined if no workspace folder is open.
   */
  public getMemoryDirPath(): string | undefined {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) {
      return undefined;
    }
    return path.join(workspaceRoot, MEMORY_DIR);
  }

  /**
   * Returns the workspace root folder path, or undefined.
   */
  public getWorkspaceRoot(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return undefined;
    }
    // Use the first workspace folder
    return folders[0].uri.fsPath;
  }

  /**
   * Checks whether memory/ exists in the current workspace.
   * Sets the context key for command visibility.
   */
  private async checkWorkspace(): Promise<boolean> {
    const memoryDir = this.getMemoryDirPath();

    if (!memoryDir) {
      await vscode.commands.executeCommand('setContext', CONTEXT_KEY_INITIALIZED, false);
      this._onMemoryStatusChanged.fire(false);
      return false;
    }

    const exists = fs.existsSync(memoryDir);

    await vscode.commands.executeCommand('setContext', CONTEXT_KEY_INITIALIZED, exists);
    this._onMemoryStatusChanged.fire(exists);

    if (exists) {
      this.startFileWatcher();
    } else {
      this.stopFileWatcher();
    }

    return exists;
  }

  /**
   * Shows a non-blocking notification prompting the user to initialize memory.
   */
  private async promptInitialization(): Promise<void> {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) {
      return;
    }

    const config = vscode.workspace.getConfiguration('memo');
    const autoInit = config.get<boolean>('autoInit', false);

    if (autoInit) {
      // Auto-init is enabled — execute init command directly
      await vscode.commands.executeCommand('memo.init');
      return;
    }

    // Show non-blocking notification (not a modal wizard)
    const selection = await vscode.window.showInformationMessage(
      '🧠 Memo: No Living Memory found in this workspace.',
      'Initialize',
      'Detailed Setup',
      'Don\'t Ask Again'
    );

    switch (selection) {
      case 'Initialize':
        await vscode.commands.executeCommand('memo.init');
        break;
      case 'Detailed Setup':
        await vscode.commands.executeCommand('memo.initDetailed');
        break;
      case 'Don\'t Ask Again':
        await config.update('autoInit', false, vscode.ConfigurationTarget.Workspace);
        break;
    }
  }

  /**
   * Starts watching memory/ directory for file changes.
   */
  private startFileWatcher(): void {
    if (this.memoryFileWatcher) {
      return; // Already watching
    }

    const memoryDir = this.getMemoryDirPath();
    if (!memoryDir) {
      return;
    }

    const pattern = new vscode.RelativePattern(memoryDir, '**/*.md');
    this.memoryFileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

    this.memoryFileWatcher.onDidChange((uri) => {
      this._onMemoryFileChanged.fire(uri);
    });

    this.memoryFileWatcher.onDidCreate((uri) => {
      this._onMemoryFileChanged.fire(uri);
    });

    this.memoryFileWatcher.onDidDelete(() => {
      // Re-check if memory/ still exists
      this.checkWorkspace();
    });

    this.disposables.push(this.memoryFileWatcher);
  }

  /**
   * Stops the file watcher if active.
   */
  private stopFileWatcher(): void {
    if (this.memoryFileWatcher) {
      this.memoryFileWatcher.dispose();
      this.memoryFileWatcher = undefined;
    }
  }

  /**
   * Forces a re-check of the workspace state.
   */
  public async refresh(): Promise<boolean> {
    return this.checkWorkspace();
  }

  dispose(): void {
    this._onMemoryStatusChanged.dispose();
    this._onMemoryFileChanged.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
