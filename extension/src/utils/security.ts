export interface DangerousActionCheck {
  isDangerous: boolean;
  reason?: string;
}

const DESTRUCTIVE_COMMAND_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  { pattern: /\brm\s+-[rf]{1,2}\b/i, description: 'Recursive/forced directory removal (rm -rf)' },
  { pattern: /\bdel\s+\/[sfq]{1,3}\b/i, description: 'Forced recursive file deletion (del /s)' },
  { pattern: /\bformat\b/i, description: 'Drive formatting command (format)' },
  { pattern: /\bsudo\b/i, description: 'Superuser privilege escalation (sudo)' },
  { pattern: /git\s+push\s+.*(--force|-f)\b/i, description: 'Forced git repository push (git push --force)' },
  { pattern: /git\s+push\b/i, description: 'Remote git push operation' },
  { pattern: /(curl|wget)\s+.*\|\s*(sh|bash|zsh|powershell|cmd)\b/i, description: 'Remote script piping to shell (curl | sh)' },
  { pattern: /(bash|sh|zsh)\s+<\s*\(\s*(curl|wget)/i, description: 'Remote script execution via process substitution' },
  { pattern: /\bdd\s+if=/i, description: 'Direct disk write operation (dd)' },
  { pattern: /\bmkfs\b/i, description: 'File system creation command (mkfs)' },
  { pattern: /\bchmod\s+(777|a\+rwx)\b/i, description: 'Unrestricted permissions change (chmod 777)' },
  { pattern: /\bchown\b/i, description: 'File ownership modification (chown)' },
  { pattern: /\bdrop\s+(database|table)\b/i, description: 'SQL database/table drop command' },
  { pattern: /\bgit\s+reset\s+--hard\b/i, description: 'Hard git commit reset (git reset --hard)' },
  { pattern: /\bgit\s+clean\s+-[fdx]{1,3}\b/i, description: 'Forced untracked files cleanup (git clean)' }
];

export class SecurityClassifier {
  public static isDangerousAction(
    toolName: string,
    params: Record<string, any>,
    isInsideWorkspace: boolean
  ): DangerousActionCheck {
    // 1. Outside workspace target is always dangerous
    if (!isInsideWorkspace) {
      return {
        isDangerous: true,
        reason: 'Security Restriction: Target path is outside the currently opened workspace root directory.'
      };
    }

    // 2. delete_path is always a dangerous destructive action
    if (toolName === 'delete_path') {
      return {
        isDangerous: true,
        reason: `Destructive Action: Deleting path "${params.path || 'specified path'}" requires user confirmation.`
      };
    }

    // 3. run_command inspection against security denylist
    if (toolName === 'run_command' && params.command) {
      const commandStr = String(params.command).trim();
      for (const item of DESTRUCTIVE_COMMAND_PATTERNS) {
        if (item.pattern.test(commandStr)) {
          return {
            isDangerous: true,
            reason: `Dangerous Command Detected: "${commandStr}" matched rule [${item.description}]. Confirmation required.`
          };
        }
      }
    }

    return { isDangerous: false };
  }
}
