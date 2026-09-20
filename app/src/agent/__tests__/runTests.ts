import { labelToolCall } from '../toolLabeler';
import { AgentEventBus, agentRunReducer, INITIAL_RUN_STATE } from '../agentStore';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`PASS: ${msg}`);
}

console.log('\n--- 1. Testing toolLabeler ---');
assert(labelToolCall('create_folder', { path: 'todo-app' }) === 'Creating folder todo-app', 'create_folder simple');
assert(labelToolCall('create_folder', { path: 'src/components/ui' }) === 'Creating folder ui', 'create_folder nested path strips to basename');
assert(labelToolCall('create_file', { path: 'todo-app/index.html', content: '<html></html>' }) === 'Writing index.html', 'create_file hides content');
assert(labelToolCall('write_file', { path: 'style.css', content: 'body {}' }) === 'Writing style.css', 'write_file hides content');
assert(labelToolCall('edit_file', { path: 'script.js', line: 15, replace: 'console.log()' }) === 'Editing script.js (line 15)', 'edit_file with line');
assert(labelToolCall('edit_file', { path: 'script.js', search: 'foo', replace: 'bar' }) === 'Editing script.js', 'edit_file without line');
assert(labelToolCall('read_file', { path: 'src/app.ts', start_line: 1, end_line: 50 }) === 'Reading app.ts (L1–50)', 'read_file with range');
assert(labelToolCall('read_file', { path: 'src/app.ts' }) === 'Reading app.ts', 'read_file without range');
assert(labelToolCall('run_command', { command: 'npm install' }) === 'Running: npm install', 'run_command label');
assert(labelToolCall('search_in_files', { query: 'useState' }) === 'Searching: "useState"', 'search_in_files query');
assert(labelToolCall('open_file', { path: 'main.rs', line: 42 }) === 'Opening main.rs:42', 'open_file with line');
assert(labelToolCall('list_dir', { path: '' }) === 'Listing root', 'list_dir root');
assert(labelToolCall('move_path', { from_path: 'old.txt', to_path: 'new.txt' }) === 'Moving old.txt → new.txt', 'move_path');
assert(labelToolCall('delete_path', { path: 'dist/bundle.js' }) === 'Deleting bundle.js', 'delete_path');

console.log('\n--- 2. Testing AgentEventBus & agentRunReducer ordering ---');
let state = INITIAL_RUN_STATE;
const bus = new AgentEventBus();
bus.subscribe((evt) => {
  state = agentRunReducer(state, evt);
});

bus.emit({ type: 'run_started', id: 'run_test_1', userText: 'create todo-app with 3 files' });
assert(state.runId === 'run_test_1', 'run_started sets runId');
assert(state.phase === 'thinking', 'run_started sets thinking phase');

bus.emit({ type: 'step_started', index: 1, kind: 'tools' });
assert(state.phase === 'acting', 'step_started(tools) sets acting phase');

// Test parallel tool calls started
bus.emit({
  type: 'tool_started',
  id: 'call_1',
  name: 'create_folder',
  label: 'Creating folder todo-app',
  startedAt: 1000
});
bus.emit({
  type: 'tool_started',
  id: 'call_2',
  name: 'create_file',
  label: 'Writing index.html',
  startedAt: 1001
});

assert(state.toolItems.length === 2, 'Two parallel tools added to toolItems');
assert(state.toolItems[0].status === 'running', 'Tool 1 is running');
assert(state.toolItems[1].status === 'running', 'Tool 2 is running');

// Tool 2 finishes before Tool 1
bus.emit({
  type: 'tool_finished',
  id: 'call_2',
  status: 'ok',
  durationMs: 180,
  summary: 'Writing index.html'
});

const t2 = state.toolItems.find(t => t.id === 'call_2');
assert(t2?.status === 'ok' && t2?.durationMs === 180, 'Tool 2 finished with ok and 180ms');
const t1 = state.toolItems.find(t => t.id === 'call_1');
assert(t1?.status === 'running', 'Tool 1 still running while Tool 2 finished');

// Tool 1 finishes
bus.emit({
  type: 'tool_finished',
  id: 'call_1',
  status: 'ok',
  durationMs: 320,
  summary: 'Creating folder todo-app'
});

const t1_done = state.toolItems.find(t => t.id === 'call_1');
assert(t1_done?.status === 'ok' && t1_done?.durationMs === 320, 'Tool 1 finished with ok and 320ms');

// Test plan updates
bus.emit({
  type: 'plan_updated',
  steps: [
    { title: 'Create folder', status: 'done' },
    { title: 'Write index.html', status: 'done' },
    { title: 'Write style.css', status: 'active' }
  ]
});

assert(state.planSteps.length === 3, 'Plan steps updated to 3 items');
assert(state.planSteps[0].status === 'done', 'Plan step 1 marked done');
assert(state.planSteps[2].status === 'active', 'Plan step 3 marked active');

// Test run completion
bus.emit({
  type: 'run_finished',
  summary: 'Done: 2 files created, 1.2s',
  totalMs: 1200,
  toolCount: 2,
  failedCount: 0
});

assert(state.phase === 'idle', 'Run finished transitions to idle phase');
assert(state.summary === 'Done: 2 files created, 1.2s', 'Summary stored on run_finished');

console.log('\nAll assertions PASSED successfully!\n');
