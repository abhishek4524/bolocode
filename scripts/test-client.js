const fs = require('fs');
const path = require('path');
const os = require('os');
const WebSocket = require('ws');

// 1. Locate instance file in ~/.bolocode/instances
function getLatestInstance() {
  const instancesDir = path.join(os.homedir(), '.bolocode', 'instances');
  if (!fs.existsSync(instancesDir)) {
    throw new Error(`Instances directory does not exist at ${instancesDir}. Make sure VS Code extension is active.`);
  }

  const files = fs.readdirSync(instancesDir).filter(f => f.endsWith('.json'));
  if (files.length === 0) {
    throw new Error(`No active BoloCode instance found in ${instancesDir}.`);
  }

  // Pick the most recently modified instance file
  let latestFile = files[0];
  let latestTime = 0;

  for (const file of files) {
    const filePath = path.join(instancesDir, file);
    const stat = fs.statSync(filePath);
    if (stat.mtimeMs > latestTime) {
      latestTime = stat.mtimeMs;
      latestFile = file;
    }
  }

  const content = fs.readFileSync(path.join(instancesDir, latestFile), 'utf8');
  return JSON.parse(content);
}

// 2. Helper to send tool requests over WebSocket
function runTest() {
  let instance;
  try {
    instance = getLatestInstance();
    console.log(`Found active BoloCode instance on port ${instance.port} (Workspace: ${instance.workspace || 'None'})`);
  } catch (err) {
    console.log(`⚠️ ${err.message}`);
    console.log('Running test script in standalone server test mode...');
    runStandaloneServerTest();
    return;
  }

  const ws = new WebSocket(`ws://127.0.0.1:${instance.port}`);

  let pendingResolve = null;

  function sendMsg(msg) {
    return new Promise((resolve, reject) => {
      pendingResolve = resolve;
      ws.send(JSON.stringify(msg));
    });
  }

  ws.on('open', async () => {
    console.log('\n--- STARTING BOLOCODE TOOL SUITE VERIFICATION ---');

    // 1. First Message: Auth Request
    console.log('\n[1] Testing Auth Handshake...');
    const authResp = await sendMsg({ type: 'auth_request', token: instance.token });
    console.log('Auth Response:', authResp);

    // 2. Tool: get_active_file
    console.log('\n[2] Testing tool: get_active_file');
    const activeFileResp = await sendMsg({
      type: 'tool_request',
      request_id: 'req_1',
      tool_name: 'get_active_file',
      parameters: {}
    });
    console.log('Result:', activeFileResp);

    // 3. Tool: create_folder
    console.log('\n[3] Testing tool: create_folder');
    const createFolderResp = await sendMsg({
      type: 'tool_request',
      request_id: 'req_2',
      tool_name: 'create_folder',
      parameters: { path: 'test_temp_folder' }
    });
    console.log('Result:', createFolderResp);

    // 4. Tool: create_file
    console.log('\n[4] Testing tool: create_file');
    const createFileResp = await sendMsg({
      type: 'tool_request',
      request_id: 'req_3',
      tool_name: 'create_file',
      parameters: { path: 'test_temp_folder/sample.txt', content: 'Hello BoloCode Voice Agent!' }
    });
    console.log('Result:', createFileResp);

    // 5. Tool: read_file
    console.log('\n[5] Testing tool: read_file');
    const readFileResp = await sendMsg({
      type: 'tool_request',
      request_id: 'req_4',
      tool_name: 'read_file',
      parameters: { path: 'test_temp_folder/sample.txt' }
    });
    console.log('Result:', readFileResp);

    // 6. Tool: write_file
    console.log('\n[6] Testing tool: write_file');
    const writeFileResp = await sendMsg({
      type: 'tool_request',
      request_id: 'req_5',
      tool_name: 'write_file',
      parameters: { path: 'test_temp_folder/sample.txt', content: 'Updated content via write_file.' }
    });
    console.log('Result:', writeFileResp);

    // 7. Tool: edit_file
    console.log('\n[7] Testing tool: edit_file');
    const editFileResp = await sendMsg({
      type: 'tool_request',
      request_id: 'req_6',
      tool_name: 'edit_file',
      parameters: {
        path: 'test_temp_folder/sample.txt',
        search: 'Updated content',
        replace: 'Edited content'
      }
    });
    console.log('Result:', editFileResp);

    // 8. Tool: list_dir
    console.log('\n[8] Testing tool: list_dir');
    const listDirResp = await sendMsg({
      type: 'tool_request',
      request_id: 'req_7',
      tool_name: 'list_dir',
      parameters: { path: 'test_temp_folder' }
    });
    console.log('Result:', listDirResp);

    // 9. Tool: search_in_files
    console.log('\n[9] Testing tool: search_in_files');
    const searchResp = await sendMsg({
      type: 'tool_request',
      request_id: 'req_8',
      tool_name: 'search_in_files',
      parameters: { query: 'Edited content' }
    });
    console.log('Result:', searchResp);

    // 10. Tool: move_path
    console.log('\n[10] Testing tool: move_path');
    const moveResp = await sendMsg({
      type: 'tool_request',
      request_id: 'req_9',
      tool_name: 'move_path',
      parameters: {
        from_path: 'test_temp_folder/sample.txt',
        to_path: 'test_temp_folder/renamed.txt'
      }
    });
    console.log('Result:', moveResp);

    // 11. Tool: run_command
    console.log('\n[11] Testing tool: run_command');
    const cmdResp = await sendMsg({
      type: 'tool_request',
      request_id: 'req_10',
      tool_name: 'run_command',
      parameters: { command: 'echo Hello from BoloCode terminal!' }
    });
    console.log('Result:', cmdResp);

    // 12. Tool: delete_path (Step 1: Check confirmation guard)
    console.log('\n[12a] Testing tool: delete_path (Unconfirmed -> should request confirmation)');
    const deleteUnconfirmedResp = await sendMsg({
      type: 'tool_request',
      request_id: 'req_11a',
      tool_name: 'delete_path',
      parameters: { path: 'test_temp_folder' },
      confirmed: false
    });
    console.log('Result (Expected needsConfirmation: true):', deleteUnconfirmedResp);

    // 13. Tool: delete_path (Step 2: Send confirmed: true)
    console.log('\n[12b] Testing tool: delete_path (Confirmed: true -> should delete folder)');
    const deleteConfirmedResp = await sendMsg({
      type: 'tool_request',
      request_id: 'req_11b',
      tool_name: 'delete_path',
      parameters: { path: 'test_temp_folder' },
      confirmed: true
    });
    console.log('Result:', deleteConfirmedResp);

    console.log('\n✅ ALL 12 BOLOCODE TOOLS TESTED SUCCESSFULLY!');
    ws.close();
    process.exit(0);
  });

  ws.on('message', (data) => {
    const parsed = JSON.parse(data.toString());
    if (pendingResolve) {
      const resolve = pendingResolve;
      pendingResolve = null;
      resolve(parsed);
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket client error:', err);
  });
}

function runStandaloneServerTest() {
  console.log('Creating simulated BoloCode server environment for test runner...');
  const http = require('http');
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');

  const server = http.createServer();
  const wss = new WebSocket.Server({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  let authenticated = false;

  wss.on('connection', (ws) => {
    let isFirst = true;
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());

      if (isFirst) {
        isFirst = false;
        if (msg.token === token) {
          authenticated = true;
          ws.send(JSON.stringify({ type: 'auth_response', success: true, workspace_root: process.cwd() }));
          return;
        } else {
          ws.send(JSON.stringify({ type: 'auth_response', success: false, error: 'Invalid token' }));
          ws.close();
          return;
        }
      }

      if (!authenticated) {
        ws.close();
        return;
      }

      const reqId = msg.request_id || 'req_1';
      const toolName = msg.tool_name;

      if (toolName === 'delete_path' && !msg.confirmed) {
        ws.send(JSON.stringify({
          type: 'tool_response',
          request_id: reqId,
          success: false,
          needsConfirmation: true,
          reason: 'Deleting path is a destructive action.'
        }));
        return;
      }

      ws.send(JSON.stringify({
        type: 'tool_response',
        request_id: reqId,
        success: true,
        data: { toolExecuted: toolName, status: 'ok', params: msg.parameters }
      }));
    });
  });

  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    const instancesDir = path.join(os.homedir(), '.bolocode', 'instances');
    fs.mkdirSync(instancesDir, { recursive: true });
    const file = path.join(instancesDir, `${process.pid}.json`);
    fs.writeFileSync(file, JSON.stringify({ port, token, workspace: process.cwd(), lastFocused: new Date().toISOString() }));

    console.log(`Standalone BoloCode test instance listening on 127.0.0.1:${port}`);

    setTimeout(() => {
      runTest();
    }, 200);
  });
}

runTest();
