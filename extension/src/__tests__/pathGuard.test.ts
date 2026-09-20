/**
 * Unit tests for PathGuard — path traversal prevention
 *
 * Run with: node --experimental-vm-modules node_modules/.bin/jest extension/src/__tests__/pathGuard.test.ts
 * Or via: npm test (if jest is configured in extension/package.json)
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// ---------------------------------------------------------------------------
// Minimal stub for vscode module (not available in plain Node test environment)
// ---------------------------------------------------------------------------
let MOCK_WORKSPACE_ROOT: string = '';

jest.mock('vscode', () => ({
  workspace: {
    workspaceFolders: undefined as any,
  },
  Uri: {
    file: (p: string) => ({ fsPath: p }),
  },
}), { virtual: true });

// Dynamically patch mock workspace root before each test
beforeEach(() => {
  const vscode = require('vscode');
  if (MOCK_WORKSPACE_ROOT) {
    vscode.workspace.workspaceFolders = [
      { uri: { fsPath: MOCK_WORKSPACE_ROOT } }
    ];
  } else {
    vscode.workspace.workspaceFolders = [];
  }
});

import { PathGuard } from '../pathGuard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function setRoot(root: string) {
  MOCK_WORKSPACE_ROOT = root;
  const vscode = require('vscode');
  vscode.workspace.workspaceFolders = [{ uri: { fsPath: root } }];
}

// Use OS temp dir as a stable absolute path for tests
const TMP = os.tmpdir();
const FAKE_ROOT = path.join(TMP, 'bolocode-test-workspace');

// ---------------------------------------------------------------------------
// sanitizeInputPath
// ---------------------------------------------------------------------------
describe('PathGuard.sanitizeInputPath', () => {
  test('returns empty string for undefined input', () => {
    expect(PathGuard.sanitizeInputPath(undefined)).toBe('');
  });

  test('returns trimmed string for normal path', () => {
    expect(PathGuard.sanitizeInputPath('  src/index.ts  ')).toBe('src/index.ts');
  });

  test('throws on null byte injection', () => {
    expect(() => PathGuard.sanitizeInputPath('src/in\0dex.ts')).toThrow('Null byte');
  });

  test('decodes URL-encoded traversal sequence', () => {
    // %2e%2e%2f == ../
    const result = PathGuard.sanitizeInputPath('%2e%2e%2fsecret.txt');
    // After decode: ../secret.txt — the decoded form should be returned (traversal caught later by validateWithinWorkspace)
    expect(result).toBe('../secret.txt');
  });

  test('decodes double-URL-encoded dot-dot-slash', () => {
    const result = PathGuard.sanitizeInputPath('%252e%252e%252f');
    // single decode: %2e%2e%2f, but we only decode once — that is expected
    // Just ensure it doesn't crash and null bytes are handled
    expect(typeof result).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// validateWithinWorkspace
// ---------------------------------------------------------------------------
describe('PathGuard.validateWithinWorkspace', () => {
  beforeAll(() => {
    // Ensure FAKE_ROOT exists for realpathSync to resolve correctly
    fs.mkdirSync(FAKE_ROOT, { recursive: true });
    setRoot(FAKE_ROOT);
  });

  afterAll(() => {
    fs.rmSync(FAKE_ROOT, { recursive: true, force: true });
    MOCK_WORKSPACE_ROOT = '';
  });

  test('allows path equal to workspace root', () => {
    expect(PathGuard.validateWithinWorkspace(FAKE_ROOT)).toBe(true);
  });

  test('allows child path within workspace', () => {
    const child = path.join(FAKE_ROOT, 'src', 'index.ts');
    expect(PathGuard.validateWithinWorkspace(child)).toBe(true);
  });

  test('rejects simple parent traversal (../)', () => {
    const outside = path.join(FAKE_ROOT, '..', 'etc', 'passwd');
    expect(PathGuard.validateWithinWorkspace(outside)).toBe(false);
  });

  test('rejects deep parent traversal (../../)', () => {
    const outside = path.join(FAKE_ROOT, '..', '..', 'secret');
    expect(PathGuard.validateWithinWorkspace(outside)).toBe(false);
  });

  test('rejects absolute path outside workspace', () => {
    const outside = path.join(TMP, 'other-dir', 'file.txt');
    expect(PathGuard.validateWithinWorkspace(outside)).toBe(false);
  });

  test('rejects root filesystem path', () => {
    const rootPath = process.platform === 'win32' ? 'C:\\Windows\\System32' : '/etc/passwd';
    expect(PathGuard.validateWithinWorkspace(rootPath)).toBe(false);
  });

  test('allows deeply nested child path', () => {
    const deep = path.join(FAKE_ROOT, 'a', 'b', 'c', 'd', 'e.ts');
    expect(PathGuard.validateWithinWorkspace(deep)).toBe(true);
  });

  test('rejects path with null segment via join normalization', () => {
    // path.join normalizes, so this should resolve to a valid child or throw
    const p = path.join(FAKE_ROOT, 'src', '..', '..', '..', 'etc');
    expect(PathGuard.validateWithinWorkspace(p)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolveUri
// ---------------------------------------------------------------------------
describe('PathGuard.resolveUri', () => {
  beforeAll(() => {
    fs.mkdirSync(FAKE_ROOT, { recursive: true });
    setRoot(FAKE_ROOT);
  });

  afterAll(() => {
    fs.rmSync(FAKE_ROOT, { recursive: true, force: true });
    MOCK_WORKSPACE_ROOT = '';
  });

  test('resolves "root" to workspace root URI', () => {
    const uri = PathGuard.resolveUri('root');
    expect(uri.fsPath.toLowerCase()).toBe(FAKE_ROOT.toLowerCase());
  });

  test('resolves "." to workspace root URI', () => {
    const uri = PathGuard.resolveUri('.');
    expect(uri.fsPath.toLowerCase()).toBe(FAKE_ROOT.toLowerCase());
  });

  test('resolves relative path within workspace', () => {
    const uri = PathGuard.resolveUri('src/index.ts');
    expect(uri.fsPath.toLowerCase()).toBe(path.join(FAKE_ROOT, 'src', 'index.ts').toLowerCase());
  });

  test('resolves root-prefixed path', () => {
    const uri = PathGuard.resolveUri('root/components/App.tsx');
    expect(uri.fsPath.toLowerCase()).toBe(path.join(FAKE_ROOT, 'components', 'App.tsx').toLowerCase());
  });

  test('throws Access Denied for traversal path', () => {
    expect(() => PathGuard.resolveUri('../../../etc/passwd')).toThrow('OUT_OF_BOUNDS');
  });

  test('throws Access Denied for encoded traversal path', () => {
    expect(() => PathGuard.resolveUri('%2e%2e%2f%2e%2e%2fetc%2fpasswd')).toThrow('OUT_OF_BOUNDS');
  });

  test('throws when no workspace open', () => {
    const vscode = require('vscode');
    const prev = vscode.workspace.workspaceFolders;
    vscode.workspace.workspaceFolders = [];
    expect(() => PathGuard.resolveUri('src/index.ts')).toThrow('No workspace folder');
    vscode.workspace.workspaceFolders = prev;
  });
});
