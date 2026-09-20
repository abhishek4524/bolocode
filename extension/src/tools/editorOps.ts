import * as vscode from 'vscode';
import { PathGuard } from '../pathGuard';

export class EditorOps {
  public static async openFile(params: { path: string; line?: number }) {
    const uri = PathGuard.resolveUri(params.path);
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc);

    if (params.line && params.line > 0) {
      const lineIdx = params.line - 1;
      const position = new vscode.Position(lineIdx, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
    }

    return {
      path: uri.fsPath,
      line: params.line || 1,
      message: `Opened file ${uri.fsPath} in editor.`
    };
  }

  public static async getActiveFile() {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return { active: false, message: 'No active editor found.' };
    }

    const doc = activeEditor.document;
    const selection = activeEditor.selection;

    return {
      active: true,
      path: doc.uri.fsPath,
      language: doc.languageId,
      line_count: doc.lineCount,
      cursor_line: selection.active.line + 1,
      cursor_column: selection.active.character + 1,
      selected_text: doc.getText(selection)
    };
  }
}
