import * as vscode from 'vscode';
import { BoloWebSocketServer } from './wsServer';
import { PathGuard } from './pathGuard';

let server: BoloWebSocketServer | null = null;
let statusBarItem: vscode.StatusBarItem | null = null;

type StatusState = 'disconnected' | 'connected' | 'busy';

export async function activate(context: vscode.ExtensionContext) {
  console.log('BoloCode Extension activating...');

  // 1. Create Status Bar Item (right side, high priority so it stays visible)
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'bolocode.showConnectionInfo';
  context.subscriptions.push(statusBarItem);
  setStatusBar('disconnected', 0);

  // 2. Start WebSocket server on 127.0.0.1 free port
  server = new BoloWebSocketServer();
  try {
    const info = await server.start();
    setStatusBar('connected', info.port);
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to start BoloCode WebSocket server: ${err.message}`);
    setStatusBar('disconnected', 0);
  }

  // 3. Update lastFocused timestamp when VS Code window gains focus
  const focusListener = vscode.window.onDidChangeWindowState((e) => {
    if (e.focused && server) {
      server.updateLastFocused();
    }
  });
  context.subscriptions.push(focusListener);

  // 4. Commands
  const startCmd = vscode.commands.registerCommand('bolocode.startServer', async () => {
    if (!server) {
      server = new BoloWebSocketServer();
      const info = await server.start();
      setStatusBar('connected', info.port);
      vscode.window.showInformationMessage(`BoloCode server started on port ${info.port}.`);
    } else {
      vscode.window.showInformationMessage(`BoloCode server is already running on port ${server.getPort()}`);
    }
  });

  const stopCmd = vscode.commands.registerCommand('bolocode.stopServer', () => {
    if (server) {
      server.stop();
      server = null;
      setStatusBar('disconnected', 0);
      vscode.window.showInformationMessage('BoloCode server stopped.');
    }
  });

  const infoCmd = vscode.commands.registerCommand('bolocode.showConnectionInfo', () => {
    if (server) {
      const port = server.getPort();
      const workspace = PathGuard.getWorkspaceRoot() || 'No workspace open';
      vscode.window.showInformationMessage(
        `$(mic) BoloCode Active | Port: ${port} | Workspace: ${workspace} | PID: ${process.pid}`
      );
    } else {
      vscode.window.showWarningMessage('$(debug-disconnect) BoloCode server is currently disconnected. Use "BoloCode: Start Voice Agent Server" to restart.');
    }
  });

  context.subscriptions.push(startCmd, stopCmd, infoCmd);
}

/**
 * Update the VS Code status bar item.
 * States:
 *   connected   → $(mic) BoloCode  (green)
 *   disconnected → $(debug-disconnect) BoloCode  (error red)
 *   busy        → $(sync~spin) BoloCode  (warning yellow)
 */
function setStatusBar(state: StatusState, port: number) {
  if (!statusBarItem) return;

  switch (state) {
    case 'connected':
      statusBarItem.text = `$(mic) BoloCode`;
      statusBarItem.tooltip = `BoloCode — Connected on 127.0.0.1:${port}\nClick for connection info.`;
      statusBarItem.backgroundColor = undefined;
      statusBarItem.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
      break;

    case 'busy':
      statusBarItem.text = `$(sync~spin) BoloCode`;
      statusBarItem.tooltip = `BoloCode — Processing voice command…`;
      statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      statusBarItem.color = undefined;
      break;

    case 'disconnected':
    default:
      statusBarItem.text = `$(debug-disconnect) BoloCode`;
      statusBarItem.tooltip = `BoloCode — Disconnected. Click for info.`;
      statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      statusBarItem.color = undefined;
      break;
  }

  statusBarItem.show();
}

export function deactivate() {
  if (server) {
    server.stop();
    server = null;
  }
}

// Exported so wsServer can drive status bar state changes
export { setStatusBar };
