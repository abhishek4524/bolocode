/**
 * Manual mock for the 'vscode' module.
 * Used by Jest when running unit tests outside of the VS Code extension host.
 * Individual tests can override workspace state via jest.mock() overrides.
 */

const workspace = {
  workspaceFolders: [] as Array<{ uri: { fsPath: string } }>,
};

const Uri = {
  file: (p: string) => ({ fsPath: p }),
};

const window = {
  terminals: [] as any[],
  createTerminal: jest.fn(),
  showInformationMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  showErrorMessage: jest.fn(),
};

module.exports = {
  workspace,
  Uri,
  window,
};
