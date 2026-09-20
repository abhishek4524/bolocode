import * as vscode from 'vscode';
import { PathGuard } from '../pathGuard';

export class FileOps {
  public static async createFolder(params: { path: string }) {
    const uri = PathGuard.resolveUri(params.path);
    await vscode.workspace.fs.createDirectory(uri);
    return { path: uri.fsPath, message: `Folder created successfully at ${uri.fsPath}` };
  }

  public static async createFile(params: { path: string; content?: string }) {
    const uri = PathGuard.resolveUri(params.path);
    const contentBuffer = Buffer.from(params.content || '', 'utf8');
    await vscode.workspace.fs.writeFile(uri, contentBuffer);
    return { path: uri.fsPath, message: `File created successfully at ${uri.fsPath}` };
  }

  public static async writeFile(params: { path: string; content: string }) {
    const uri = PathGuard.resolveUri(params.path);
    const contentBuffer = Buffer.from(params.content, 'utf8');
    await vscode.workspace.fs.writeFile(uri, contentBuffer);
    return { path: uri.fsPath, message: `File written successfully at ${uri.fsPath}` };
  }

  public static async editFile(params: { path: string; search?: string; replace: string; line?: number }) {
    const uri = PathGuard.resolveUri(params.path);
    const uint8arr = await vscode.workspace.fs.readFile(uri);
    const content = Buffer.from(uint8arr).toString('utf8');
    const lines = content.split(/\r?\n/);

    if (params.line !== undefined && params.line !== null) {
      const lineNum = Math.trunc(params.line);
      if (lineNum < 1) {
        throw new Error(`Invalid line number: ${params.line}`);
      }
      while (lines.length < lineNum - 1) {
        lines.push('');
      }

      if (params.search && params.search.trim().length > 0) {
        if (lineNum <= lines.length) {
          lines[lineNum - 1] = lines[lineNum - 1].replace(params.search, params.replace);
        } else {
          lines.push(params.replace);
        }
      } else {
        lines.splice(lineNum - 1, 0, params.replace);
      }
      const updatedContent = lines.join('\n');
      await vscode.workspace.fs.writeFile(uri, Buffer.from(updatedContent, 'utf8'));
      return { path: uri.fsPath, message: `File updated successfully at ${uri.fsPath} (line ${lineNum})` };
    }

    if (!params.search || params.search.trim().length === 0) {
      throw new Error(`Target search string cannot be empty. Specify a line number or provide an exact non-empty search string.`);
    }

    if (!content.includes(params.search)) {
      throw new Error(`Target search string not found in file ${uri.fsPath}`);
    }

    const updatedContent = content.replace(params.search, params.replace);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(updatedContent, 'utf8'));
    return { path: uri.fsPath, message: `File updated successfully at ${uri.fsPath}` };
  }

  public static async readFile(params: { path: string; start_line?: number; end_line?: number }) {
    const uri = PathGuard.resolveUri(params.path);
    const uint8arr = await vscode.workspace.fs.readFile(uri);
    const content = Buffer.from(uint8arr).toString('utf8');
    const lines = content.split(/\r?\n/);

    if (params.start_line !== undefined || params.end_line !== undefined) {
      const start = Math.max(1, params.start_line || 1) - 1;
      const end = params.end_line ? Math.min(lines.length, params.end_line) : lines.length;
      const slicedLines = lines.slice(start, end);
      return {
        path: uri.fsPath,
        total_lines: lines.length,
        start_line: start + 1,
        end_line: end,
        content: slicedLines.join('\n')
      };
    }

    return { path: uri.fsPath, total_lines: lines.length, content };
  }

  public static async listDir(params: { path?: string }) {
    const uri = PathGuard.resolveUri(params.path);
    const entries = await vscode.workspace.fs.readDirectory(uri);

    const result = entries.map(([name, type]) => ({
      name,
      type: type === vscode.FileType.Directory ? 'directory' : 'file',
      path: vscode.Uri.joinPath(uri, name).fsPath
    }));

    return { path: uri.fsPath, count: result.length, entries: result };
  }

  public static async deletePath(params: { path: string }) {
    const uri = PathGuard.resolveUri(params.path);
    await vscode.workspace.fs.delete(uri, { recursive: true, useTrash: false });
    return { path: uri.fsPath, message: `Path ${uri.fsPath} deleted successfully.` };
  }

  public static async movePath(params: { from_path: string; to_path: string }) {
    const fromUri = PathGuard.resolveUri(params.from_path);
    const toUri = PathGuard.resolveUri(params.to_path);

    await vscode.workspace.fs.rename(fromUri, toUri, { overwrite: true });
    return {
      from: fromUri.fsPath,
      to: toUri.fsPath,
      message: `Moved ${fromUri.fsPath} to ${toUri.fsPath} successfully.`
    };
  }
}
