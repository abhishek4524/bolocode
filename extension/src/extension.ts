import * as vscode from 'vscode';
import { BoloWebSocketServer } from './wsServer';
import { PathGuard } from './pathGuard';

let server: BoloWebSocketServer | null = null;
let statusBarItem: vscode.StatusBarItem | null = null;

export async function activate(context: vscode.ExtensionContext) {
  console.log('BoloCode Extension activating...');

  // 1. Create Status Bar Item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'bolocode.showConnectionInfo';
  context.subscriptions.push(statusBarItem);
  updateStatusBar(false, 0);

  // 2. Start WebSocket server on 127.0.0.1 free port
  server = new BoloWebSocketServer();
  try {
    const info = await server.start();
    updateStatusBar(true, info.port);
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to start BoloCode WebSocket server: ${err.message}`);
    updateStatusBar(false, 0);
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
      updateStatusBar(true, info.port);
    } else {
      vscode.window.showInformationMessage(`BoloCode server is running on port ${server.getPort()}`);
    }
  });

  const stopCmd = vscode.commands.registerCommand('bolocode.stopServer', () => {
    if (server) {
      server.stop();
      server = null;
      updateStatusBar(false, 0);
      vscode.window.showInformationMessage('BoloCode server stopped.');
    }
  });

  const infoCmd = vscode.commands.registerCommand('bolocode.showConnectionInfo', () => {
    if (server) {
      const port = server.getPort();
      const workspace = PathGuard.getWorkspaceRoot() || 'No workspace open';
      vscode.window.showInformationMessage(
        `BoloCode Server Active | Port: ${port} | Workspace: ${workspace} | PID: ${process.pid}`
      );
    } else {
      vscode.window.showWarningMessage('BoloCode server is currently disconnected.');
    }
  });

  context.subscriptions.push(startCmd, stopCmd, infoCmd);
}

function updateStatusBar(connected: boolean, port: number) {
  if (!statusBarItem) return;

  if (connected) {
    statusBarItem.text = `$(radio-tower) BoloCode: Connected (${port})`;
    statusBarItem.tooltip = `BoloCode server running on 127.0.0.1:${port}. Click for connection info.`;
    statusBarItem.backgroundColor = undefined;
    statusBarItem.show();
  } else {
    statusBarItem.text = `$(error) BoloCode: Disconnected`;
    statusBarItem.tooltip = `BoloCode server is disconnected. Click for info.`;
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    statusBarItem.show();
  }
}

export function deactivate() {
  if (server) {
    server.stop();
    server = null;
  }
}
