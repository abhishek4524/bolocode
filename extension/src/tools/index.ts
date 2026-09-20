import { FileOps } from './fileOps';
import { EditorOps } from './editorOps';
import { SearchOps } from './searchOps';
import { TerminalOps } from './terminalOps';
import { PathGuard } from '../pathGuard';
import { SecurityClassifier } from '../utils/security';

export class ToolDispatcher {
  public static async executeTool(
    toolName: string,
    params: Record<string, any>,
    confirmed: boolean = false
  ): Promise<any> {
    const checkPath = params.path || params.from_path;
    let isInsideWorkspace = true;

    if (checkPath) {
      try {
        const resolvedUri = PathGuard.resolveUri(checkPath);
        isInsideWorkspace = PathGuard.validateWithinWorkspace(resolvedUri.fsPath);
      } catch (err: any) {
        isInsideWorkspace = false;
      }
    }

    // Safety check for dangerous operations
    const securityCheck = SecurityClassifier.isDangerousAction(toolName, params, isInsideWorkspace);
    if (securityCheck.isDangerous && !confirmed) {
      return {
        needsConfirmation: true,
        reason: securityCheck.reason || 'Dangerous action requires user confirmation.'
      };
    }

    switch (toolName) {
      case 'create_folder':
        return await FileOps.createFolder(params as { path: string });
      case 'create_file':
        return await FileOps.createFile(params as { path: string; content?: string });
      case 'write_file':
        return await FileOps.writeFile(params as { path: string; content: string });
      case 'edit_file':
        return await FileOps.editFile(params as { path: string; search: string; replace: string });
      case 'read_file':
        return await FileOps.readFile(params as { path: string; start_line?: number; end_line?: number });
      case 'list_dir':
        return await FileOps.listDir(params as { path?: string });
      case 'delete_path':
        return await FileOps.deletePath(params as { path: string });
      case 'move_path':
        return await FileOps.movePath(params as { from_path: string; to_path: string });
      case 'open_file':
        return await EditorOps.openFile(params as { path: string; line?: number });
      case 'get_active_file':
        return await EditorOps.getActiveFile();
      case 'search_in_files':
        return await SearchOps.searchInFiles(params as { query: string; path?: string });
      case 'run_command':
        return await TerminalOps.runCommand(params as { command: string });
      default:
        throw new Error(`Unknown tool name: ${toolName}`);
    }
  }
}
