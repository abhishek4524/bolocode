import { labelToolCall } from '../toolLabeler';

describe('toolLabeler — labelToolCall()', () => {
  it('should label create_folder with folder name', () => {
    expect(labelToolCall('create_folder', { path: 'todo-app' })).toBe('Creating folder todo-app');
    expect(labelToolCall('create_folder', { path: 'src/components/ui' })).toBe('Creating folder ui');
  });

  it('should label create_file with file name only', () => {
    expect(labelToolCall('create_file', { path: 'todo-app/index.html', content: '<html></html>' }))
      .toBe('Writing index.html');
  });

  it('should label write_file with file name only', () => {
    expect(labelToolCall('write_file', { path: 'style.css', content: 'body {}' }))
      .toBe('Writing style.css');
  });

  it('should label edit_file with line number when present', () => {
    expect(labelToolCall('edit_file', { path: 'script.js', line: 15, replace: 'console.log()' }))
      .toBe('Editing script.js (line 15)');
    expect(labelToolCall('edit_file', { path: 'script.js', search: 'foo', replace: 'bar' }))
      .toBe('Editing script.js');
  });

  it('should label read_file with line range when specified', () => {
    expect(labelToolCall('read_file', { path: 'src/app.ts', start_line: 1, end_line: 50 }))
      .toBe('Reading app.ts (L1–50)');
    expect(labelToolCall('read_file', { path: 'src/app.ts' }))
      .toBe('Reading app.ts');
  });

  it('should label run_command with the command string', () => {
    expect(labelToolCall('run_command', { command: 'npm install' }))
      .toBe('Running: npm install');
  });

  it('should label search_in_files with query string', () => {
    expect(labelToolCall('search_in_files', { query: 'useState' }))
      .toBe('Searching: "useState"');
  });

  it('should label open_file with optional line number', () => {
    expect(labelToolCall('open_file', { path: 'main.rs', line: 42 }))
      .toBe('Opening main.rs:42');
    expect(labelToolCall('open_file', { path: 'main.rs' }))
      .toBe('Opening main.rs');
  });

  it('should label list_dir and move_path properly', () => {
    expect(labelToolCall('list_dir', { path: '' })).toBe('Listing root');
    expect(labelToolCall('list_dir', { path: 'src' })).toBe('Listing src');
    expect(labelToolCall('move_path', { from_path: 'old.txt', to_path: 'new.txt' }))
      .toBe('Moving old.txt → new.txt');
  });

  it('should label delete_path', () => {
    expect(labelToolCall('delete_path', { path: 'dist/bundle.js' }))
      .toBe('Deleting bundle.js');
  });
});
