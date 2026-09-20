import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

export class PathGuard {
  public static getWorkspaceRoot(): string | null {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return null;
    }
    return path.normalize(folders[0].uri.fsPath);
  }

  public static getWorkspaceRootUri(): vscode.Uri {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      throw new Error('No workspace folder is open in VS Code.');
    }
    return folders[0].uri;
  }

  /**
   * Sanitize path input: reject null bytes, control chars, or encoded traversal attacks.
   */
  public static sanitizeInputPath(inputPath?: string): string {
    if (!inputPath) return '';
    if (inputPath.includes('\0')) {
      throw new Error('Security Error: Null byte detected in path parameter.');
    }
    let cleaned = inputPath.trim();
    // Normalize URL-encoded characters if present
    try {
      if (cleaned.includes('%')) {
        cleaned = decodeURIComponent(cleaned);
      }
    } catch {}
    return cleaned;
  }

  /**
   * Resolve inputPath relative to workspace root and validate that it does not escape root.
   */
  public static resolveUri(inputPath?: string): vscode.Uri {
    const root = this.getWorkspaceRoot();
    if (!root) {
      throw new Error('No workspace folder is open in VS Code.');
    }

    const cleanPath = this.sanitizeInputPath(inputPath);
    if (cleanPath === '' || cleanPath.toLowerCase() === 'root' || cleanPath === '.') {
      return vscode.Uri.file(root);
    }

    let targetRel = cleanPath;
    if (targetRel.toLowerCase().startsWith('root/')) {
      targetRel = targetRel.substring(5);
    } else if (targetRel.toLowerCase().startsWith('root\\')) {
      targetRel = targetRel.substring(5);
    }

    const resolvedFsPath = path.isAbsolute(targetRel)
      ? path.normalize(targetRel)
      : path.normalize(path.join(root, targetRel));

    if (!this.validateWithinWorkspace(resolvedFsPath)) {
      throw new Error(`Access Denied (OUT_OF_BOUNDS): Path "${inputPath}" escapes workspace root "${root}".`);
    }

    return vscode.Uri.file(resolvedFsPath);
  }

  /**
   * Strictly validate that targetPath is within workspace root directory.
   */
  public static validateWithinWorkspace(targetPath: string): boolean {
    const root = this.getWorkspaceRoot();
    if (!root) {
      return false;
    }

    const normalizedRoot = path.normalize(root).toLowerCase();
    let normalizedTarget = path.normalize(targetPath).toLowerCase();

    // Resolve symlinks if path exists
    try {
      if (fs.existsSync(normalizedTarget)) {
        normalizedTarget = fs.realpathSync(normalizedTarget).toLowerCase();
      }
    } catch {}

    let realRoot = normalizedRoot;
    try {
      if (fs.existsSync(normalizedRoot)) {
        realRoot = fs.realpathSync(normalizedRoot).toLowerCase();
      }
    } catch {}

    if (normalizedTarget === realRoot || normalizedTarget === normalizedRoot) {
      return true;
    }

    const relativeToRoot = path.relative(realRoot, normalizedTarget);
    const relativeToNormalized = path.relative(normalizedRoot, normalizedTarget);

    const escapesRoot = relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot);
    const escapesNormalized = relativeToNormalized.startsWith('..') || path.isAbsolute(relativeToNormalized);

    return !escapesRoot && !escapesNormalized;
  }
}
