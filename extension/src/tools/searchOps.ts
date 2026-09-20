import * as vscode from 'vscode';
import { PathGuard } from '../pathGuard';

export class SearchOps {
  public static async searchInFiles(params: { query: string; path?: string }) {
    const rootUri = PathGuard.getWorkspaceRootUri();
    const searchUri = params.path ? PathGuard.resolveUri(params.path) : rootUri;

    const pattern = new vscode.RelativePattern(searchUri, '**/*');
    const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 100);

    const results: Array<{ path: string; matches: Array<{ line: number; text: string }> }> = [];
    const queryLower = params.query.toLowerCase();

    for (const fileUri of files) {
      try {
        const uint8arr = await vscode.workspace.fs.readFile(fileUri);
        const text = Buffer.from(uint8arr).toString('utf8');
        const lines = text.split(/\r?\n/);

        const fileMatches: Array<{ line: number; text: string }> = [];

        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(queryLower)) {
            fileMatches.push({
              line: i + 1,
              text: lines[i].trim()
            });
          }
        }

        if (fileMatches.length > 0) {
          results.push({
            path: fileUri.fsPath,
            matches: fileMatches
          });
        }

        if (results.length >= 20) break;
      } catch {}
    }

    return {
      query: params.query,
      match_count: results.reduce((acc, curr) => acc + curr.matches.length, 0),
      file_count: results.length,
      results
    };
  }
}
