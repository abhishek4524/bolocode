import * as http from 'http';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { WebSocketServer, WebSocket } from 'ws';
import * as vscode from 'vscode';
import { ToolDispatcher } from './tools';
import { PathGuard } from './pathGuard';

const ALLOWED_ORIGINS = [
  'null',
  'tauri://localhost',
  'http://localhost:1420',
  'http://127.0.0.1:1420'
];

export class BoloWebSocketServer {
  private server: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private authToken: string = '';
  private port: number = 0;
  private authenticatedClients: Set<WebSocket> = new Set();
  private instanceFilePath: string = '';

  public async start(): Promise<{ port: number; token: string }> {
    // Generate secure 32-byte (256-bit) random auth token
    this.authToken = crypto.randomBytes(32).toString('hex');

    this.server = http.createServer();
    this.wss = new WebSocketServer({ noServer: true });

    // Handle Upgrade requests strictly from 127.0.0.1 and valid local origins
    this.server.on('upgrade', (request, socket, head) => {
      const netSocket = socket as import('net').Socket;
      const remoteAddr = netSocket.remoteAddress;

      // 1. Remote address loopback check
      if (remoteAddr !== '127.0.0.1' && remoteAddr !== '::1' && remoteAddr !== '::ffff:127.0.0.1') {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }

      // 2. Origin Header Validation against WebSocket Hijacking / CSWSH
      const origin = request.headers['origin'];
      if (origin) {
        const isAllowedOrigin = ALLOWED_ORIGINS.includes(origin.toLowerCase()) ||
          origin.toLowerCase().startsWith('vscode-webview://');

        if (!isAllowedOrigin) {
          socket.write('HTTP/1.1 403 Forbidden - Untrusted Origin\r\n\r\n');
          socket.destroy();
          return;
        }
      }

      this.wss?.handleUpgrade(request, socket, head, (ws) => {
        this.wss?.emit('connection', ws, request);
      });
    });

    this.wss.on('connection', (ws: WebSocket) => {
      let isFirstMessage = true;

      ws.on('message', async (data: Buffer | string) => {
        try {
          const message = JSON.parse(data.toString());

          // Mandatory Token Authentication on First Message
          if (isFirstMessage) {
            isFirstMessage = false;

            const clientToken = String(message.token || (message.parameters && message.parameters.token) || '');
            if (this.timingSafeTokenCompare(clientToken, this.authToken)) {
              this.authenticatedClients.add(ws);
              const workspaceRoot = PathGuard.getWorkspaceRoot();
              ws.send(JSON.stringify({
                type: 'auth_response',
                success: true,
                workspace_root: workspaceRoot
              }));
              return;
            } else {
              ws.send(JSON.stringify({
                type: 'auth_response',
                success: false,
                error: 'Unauthorized: Invalid auth token'
              }));
              ws.close();
              return;
            }
          }

          if (!this.authenticatedClients.has(ws)) {
            ws.send(JSON.stringify({
              type: 'error',
              error: 'Unauthorized: Connection not authenticated'
            }));
            ws.close();
            return;
          }

          if (message.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
            return;
          }

          if (message.type === 'tool_request' || message.tool_name) {
            const requestId = message.request_id || message.id || `req_${Date.now()}`;
            const toolName = message.tool_name || message.tool;
            const params = message.parameters || message.params || {};
            const isConfirmed = Boolean(message.confirmed || message.user_confirmed);

            const result = await ToolDispatcher.executeTool(
              toolName,
              params,
              isConfirmed
            );

            if (result && result.needsConfirmation) {
              ws.send(JSON.stringify({
                type: 'tool_response',
                request_id: requestId,
                success: false,
                needsConfirmation: true,
                error: 'REQUIRES_CONFIRMATION',
                reason: result.reason
              }));
            } else {
              ws.send(JSON.stringify({
                type: 'tool_response',
                request_id: requestId,
                success: true,
                data: result
              }));
            }
          }
        } catch (err: any) {
          ws.send(JSON.stringify({
            type: 'error',
            error: `Invalid JSON payload or handler failure: ${err.message}`
          }));
        }
      });

      ws.on('close', () => {
        this.authenticatedClients.delete(ws);
      });
    });

    await new Promise<void>((resolve, reject) => {
      this.server?.listen(0, '127.0.0.1', () => {
        const addr = this.server?.address();
        if (addr && typeof addr === 'object') {
          this.port = addr.port;
          resolve();
        } else {
          reject(new Error('Failed to bind server to a free port on 127.0.0.1'));
        }
      });
    });

    this.writeInstanceFile();
    return { port: this.port, token: this.authToken };
  }

  /**
   * Constant-time string comparison to prevent timing attacks.
   */
  private timingSafeTokenCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    try {
      return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
    } catch {
      return false;
    }
  }

  public writeInstanceFile() {
    try {
      const instancesDir = path.join(os.homedir(), '.bolocode', 'instances');
      if (!fs.existsSync(instancesDir)) {
        fs.mkdirSync(instancesDir, { recursive: true });
      }

      this.instanceFilePath = path.join(instancesDir, `${process.pid}.json`);
      const payload = {
        port: this.port,
        token: this.authToken,
        workspace: PathGuard.getWorkspaceRoot(),
        lastFocused: new Date().toISOString()
      };

      fs.writeFileSync(this.instanceFilePath, JSON.stringify(payload, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to write BoloCode instance file:', err);
    }
  }

  public updateLastFocused() {
    if (fs.existsSync(this.instanceFilePath)) {
      try {
        const content = fs.readFileSync(this.instanceFilePath, 'utf8');
        const data = JSON.parse(content);
        data.lastFocused = new Date().toISOString();
        data.workspace = PathGuard.getWorkspaceRoot();
        fs.writeFileSync(this.instanceFilePath, JSON.stringify(data, null, 2), 'utf8');
      } catch (err) {
        console.error('Failed to update lastFocused in instance file:', err);
      }
    }
  }

  public getPort(): number {
    return this.port;
  }

  public getToken(): string {
    return this.authToken;
  }

  public stop() {
    this.wss?.close();
    this.server?.close();
    if (this.instanceFilePath && fs.existsSync(this.instanceFilePath)) {
      try {
        fs.unlinkSync(this.instanceFilePath);
      } catch {}
    }
  }
}
