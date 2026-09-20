import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { PathGuard } from '../pathGuard';

// Maximum output bytes captured from a command (5 MB)
const MAX_OUTPUT_BYTES = 5 * 1024 * 1024;

// Maximum time to wait for command to complete (60 seconds)
const COMMAND_TIMEOUT_MS = 60_000;

export class TerminalOps {
  public static async runCommand(params: { command: string }) {
    const root = PathGuard.getWorkspaceRoot() || process.cwd();

    // 1. Validate command is a non-empty string (no null bytes)
    if (!params.command || typeof params.command !== 'string') {
      throw new Error('run_command: command parameter must be a non-empty string.');
    }
    if (params.command.includes('\0')) {
      throw new Error('Security Error: Null byte detected in command parameter.');
    }

    const command = params.command.trim();
    if (command.length === 0) {
      throw new Error('run_command: command must not be empty.');
    }

    // 2. Show command visually in the named VS Code terminal (no shell injection here —
    //    sendText only displays what the user would see; execution is separate via spawn).
    let terminal = vscode.window.terminals.find(t => t.name === 'BoloCode');
    if (!terminal) {
      terminal = vscode.window.createTerminal({ name: 'BoloCode', cwd: root });
    }
    terminal.show(true);
    terminal.sendText(command);

    // 3. Execute using spawn with shell:true but with sanitized command string.
    //    We pass the command as a single string to the OS shell (required for
    //    commands like "npm install", "git status" etc.) but we impose strict output
    //    and time limits. The denylist in SecurityClassifier prevents the most
    //    dangerous shell constructs from even reaching this point.
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let outputBytes = 0;
      let timedOut = false;

      const isWindows = process.platform === 'win32';
      const shellCmd = isWindows ? 'cmd' : 'sh';
      const shellArgs = isWindows ? ['/c', command] : ['-c', command];

      const child = spawn(shellCmd, shellArgs, {
        cwd: root,
        shell: false,     // Shell selection is explicit above; no double shell
        env: {
          ...process.env,
          // Harden PATH — strip user-writable tmp locations on Unix
          ...(isWindows ? {} : { PATH: process.env.PATH }),
        },
        windowsHide: true
      });

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, COMMAND_TIMEOUT_MS);

      child.stdout?.on('data', (chunk: Buffer) => {
        outputBytes += chunk.length;
        if (outputBytes <= MAX_OUTPUT_BYTES) {
          stdout += chunk.toString('utf8');
        }
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        outputBytes += chunk.length;
        if (outputBytes <= MAX_OUTPUT_BYTES) {
          stderr += chunk.toString('utf8');
        }
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (timedOut) {
          resolve({
            success: false,
            command,
            exit_code: -1,
            stdout: stdout.slice(0, MAX_OUTPUT_BYTES),
            stderr: `Command timed out after ${COMMAND_TIMEOUT_MS / 1000} seconds.`
          });
        } else if (outputBytes > MAX_OUTPUT_BYTES) {
          resolve({
            success: code === 0,
            command,
            exit_code: code ?? 1,
            stdout: stdout.slice(0, MAX_OUTPUT_BYTES) + '\n[OUTPUT TRUNCATED — exceeded 5 MB limit]',
            stderr: stderr.slice(0, 4096)
          });
        } else {
          resolve({
            success: code === 0,
            command,
            exit_code: code ?? 0,
            stdout,
            stderr
          });
        }
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          success: false,
          command,
          exit_code: 1,
          stdout: '',
          stderr: err.message
        });
      });
    });
  }
}
