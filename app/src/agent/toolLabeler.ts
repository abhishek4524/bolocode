// ─────────────────────────────────────────────────────────────────────────────
// toolLabeler.ts — Pure function that produces short human-readable labels
// for tool calls WITHOUT calling the LLM. No async, no side effects.
// ─────────────────────────────────────────────────────────────────────────────

/** Return just the basename of a path string */
function base(p: string): string {
  return p.replace(/\\/g, '/').split('/').filter(Boolean).pop() || p;
}

/**
 * Given a tool name and its arguments, return a short label like:
 *   "Creating folder todo-app"
 *   "Writing index.html"
 *   "Running: npm install"
 * Never shows file CONTENTS — only names and commands.
 */
export function labelToolCall(name: string, args: Record<string, any>): string {
  switch (name) {
    case 'create_folder':
      return `Creating folder ${base(args.path || '')}`;

    case 'create_file':
      return `Writing ${base(args.path || '')}`;

    case 'write_file':
      return `Writing ${base(args.path || '')}`;

    case 'edit_file':
      if (args.line != null) {
        return `Editing ${base(args.path || '')} (line ${args.line})`;
      }
      return `Editing ${base(args.path || '')}`;

    case 'read_file': {
      const range = args.start_line != null
        ? ` (L${args.start_line}–${args.end_line ?? '…'})`
        : '';
      return `Reading ${base(args.path || '')}${range}`;
    }

    case 'list_dir':
      return `Listing ${base(args.path || '') || 'root'}`;

    case 'delete_path':
      return `Deleting ${base(args.path || '')}`;

    case 'move_path':
      return `Moving ${base(args.from_path || '')} → ${base(args.to_path || '')}`;

    case 'open_file': {
      const lineHint = args.line != null ? `:${args.line}` : '';
      return `Opening ${base(args.path || '')}${lineHint}`;
    }

    case 'get_active_file':
      return 'Checking active file';

    case 'search_in_files': {
      const q = String(args.query || '').slice(0, 40);
      return `Searching: "${q}"`;
    }

    case 'run_command': {
      const cmd = String(args.command || '').slice(0, 50);
      return `Running: ${cmd}`;
    }

    case 'update_plan':
      return '(plan update)';

    default:
      return name.replace(/_/g, ' ');
  }
}
