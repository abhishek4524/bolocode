import { AgentEventBus, agentRunReducer, INITIAL_RUN_STATE } from '../agentStore';

describe('agentStore — Event ordering & reducer state transitions', () => {
  it('should process run_started and reset state', () => {
    let state = INITIAL_RUN_STATE;
    const bus = new AgentEventBus();
    bus.subscribe((evt) => {
      state = agentRunReducer(state, evt);
    });

    bus.emit({ type: 'run_started', id: 'run_123', userText: 'create todo app' });
    expect(state.runId).toBe('run_123');
    expect(state.userText).toBe('create todo app');
    expect(state.phase).toBe('thinking');
    expect(state.runStartedAt).toBeGreaterThan(0);
  });

  it('should track parallel or sequential tool started & finished with correct ids', () => {
    let state = INITIAL_RUN_STATE;
    const bus = new AgentEventBus();
    bus.subscribe((evt) => {
      state = agentRunReducer(state, evt);
    });

    bus.emit({ type: 'run_started', id: 'run_1', userText: 'setup project' });
    bus.emit({ type: 'step_started', index: 1, kind: 'tools' });
    expect(state.phase).toBe('acting');

    // Simulate parallel tool calls started
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

    expect(state.toolItems).toHaveLength(2);
    expect(state.toolItems[0].status).toBe('running');
    expect(state.toolItems[1].status).toBe('running');

    // Tool 2 finishes before Tool 1 (out-of-order resolution)
    bus.emit({
      type: 'tool_finished',
      id: 'call_2',
      status: 'ok',
      durationMs: 250,
      summary: 'Writing index.html'
    });

    expect(state.toolItems.find(t => t.id === 'call_2')?.status).toBe('ok');
    expect(state.toolItems.find(t => t.id === 'call_2')?.durationMs).toBe(250);
    expect(state.toolItems.find(t => t.id === 'call_1')?.status).toBe('running');

    // Tool 1 finishes
    bus.emit({
      type: 'tool_finished',
      id: 'call_1',
      status: 'ok',
      durationMs: 400,
      summary: 'Creating folder todo-app'
    });

    expect(state.toolItems.find(t => t.id === 'call_1')?.status).toBe('ok');
    expect(state.toolItems.find(t => t.id === 'call_1')?.durationMs).toBe(400);
  });

  it('should update plan checklist steps via plan_updated event', () => {
    let state = INITIAL_RUN_STATE;
    const bus = new AgentEventBus();
    bus.subscribe((evt) => {
      state = agentRunReducer(state, evt);
    });

    bus.emit({
      type: 'plan_updated',
      steps: [
        { title: 'Create folder', status: 'done' },
        { title: 'Write index.html', status: 'active' },
        { title: 'Write style.css', status: 'pending' }
      ]
    });

    expect(state.planSteps).toHaveLength(3);
    expect(state.planSteps[0].status).toBe('done');
    expect(state.planSteps[1].status).toBe('active');
  });

  it('should transition to idle and set summary on run_finished', () => {
    let state = INITIAL_RUN_STATE;
    const bus = new AgentEventBus();
    bus.subscribe((evt) => {
      state = agentRunReducer(state, evt);
    });

    bus.emit({ type: 'run_started', id: 'run_1', userText: 'test' });
    bus.emit({
      type: 'run_finished',
      summary: 'Done: 2 files created, 1.5s',
      totalMs: 1500,
      toolCount: 2,
      failedCount: 0
    });

    expect(state.phase).toBe('idle');
    expect(state.summary).toBe('Done: 2 files created, 1.5s');
  });

  it('should record cancelledWork on run_cancelled', () => {
    let state = INITIAL_RUN_STATE;
    const bus = new AgentEventBus();
    bus.subscribe((evt) => {
      state = agentRunReducer(state, evt);
    });

    bus.emit({ type: 'run_started', id: 'run_1', userText: 'test' });
    bus.emit({
      type: 'run_cancelled',
      doneWork: ['Creating folder todo-app', 'Writing index.html']
    });

    expect(state.phase).toBe('idle');
    expect(state.cancelledWork).toHaveLength(2);
    expect(state.cancelledWork[0]).toBe('Creating folder todo-app');
  });
});
