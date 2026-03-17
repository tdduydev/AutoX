// ============================================================
// Workflow Engine – E2E Test
// Tests: Trigger → Condition → Code → Loop → Switch → Merge → Output
// Also tests: Validator, Template resolution, Error handling
// ============================================================

import { EventBus, ToolRegistry, WorkflowEngine, validateWorkflow } from '@xclaw/core';
import { LLMRouter } from '@xclaw/core';
import type { Workflow, WorkflowNode, WorkflowEdge } from '@xclaw/shared';

// ─── Test Helpers ───────────────────────────────────────────

const PASS = '\x1b[32m✓ PASS\x1b[0m';
const FAIL = '\x1b[31m✗ FAIL\x1b[0m';
const HEADER = '\x1b[36m';
const RESET = '\x1b[0m';
let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    console.log(`  ${PASS} ${label}`);
    passed++;
  } else {
    console.log(`  ${FAIL} ${label}` + (detail ? ` — ${detail}` : ''));
    failed++;
  }
}

function section(title: string) {
  console.log(`\n${HEADER}══════════════════════════════════════════${RESET}`);
  console.log(`${HEADER}  ${title}${RESET}`);
  console.log(`${HEADER}══════════════════════════════════════════${RESET}`);
}

// ─── Mock LLM ───────────────────────────────────────────────

class MockLLMAdapter {
  name = 'mock';
  async chat(messages: { role: string; content: string }[]) {
    const userMsg = messages.find(m => m.role === 'user')?.content ?? '';
    return {
      content: `Mock response to: ${userMsg.substring(0, 50)}`,
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    };
  }
  async stream() { throw new Error('Not implemented'); }
}

// ─── Helper to make nodes/edges ─────────────────────────────

function makeNode(id: string, type: string, config: Record<string, unknown> = {}, label?: string): WorkflowNode {
  return {
    id,
    type: type as any,
    position: { x: 0, y: 0 },
    data: { label: label ?? id, config },
    inputs: [{ id: 'input', name: 'input', type: 'any' }],
    outputs: [{ id: 'output', name: 'output', type: 'any' }],
  };
}

function makeEdge(source: string, target: string, sourcePort = 'output', targetPort = 'input', condition?: string): WorkflowEdge {
  return {
    id: `${source}-${target}`,
    source,
    sourcePort,
    target,
    targetPort,
    condition,
  };
}

// ─── Tests ──────────────────────────────────────────────────

async function main() {
  console.log('\n⚡ Workflow Engine — E2E Test');
  console.log('   Testing: Validator, Execution, Loop, Switch, Merge\n');

  const eventBus = new EventBus();
  const toolRegistry = new ToolRegistry(eventBus);
  const llmRouter = new LLMRouter(eventBus);
  llmRouter.registerAdapter('default', new MockLLMAdapter() as any);

  // Register a test tool
  toolRegistry.register(
    {
      name: 'test_tool',
      description: 'A test tool',
      parameters: { type: 'object', properties: { input: { type: 'string' } } },
    },
    async (args: Record<string, unknown>) => `Processed: ${args.input}`,
  );

  const engine = new WorkflowEngine(toolRegistry, llmRouter, eventBus);

  // ────────────────────────────────────────────────────────
  section('1. Workflow Validator');
  // ────────────────────────────────────────────────────────

  // Empty workflow
  const emptyWf: Workflow = {
    id: 'wf-empty', name: 'Empty', description: '', version: 1,
    nodes: [], edges: [], variables: [],
    trigger: { id: 't', type: 'manual', name: 'Manual', description: '', config: {} },
    createdAt: '', updatedAt: '', enabled: true,
  };
  const emptyErrors = validateWorkflow(emptyWf);
  assert(emptyErrors.length > 0, 'Empty workflow has errors');
  assert(emptyErrors.some(e => e.message.includes('no nodes')), 'Detects no nodes');

  // Missing trigger
  const noTriggerWf: Workflow = {
    ...emptyWf,
    id: 'wf-no-trig',
    nodes: [makeNode('n1', 'code', { code: 'return {};' })],
  };
  const noTrigErrors = validateWorkflow(noTriggerWf);
  assert(noTrigErrors.some(e => e.message.includes('no trigger')), 'Detects missing trigger');

  // Orphan node
  const orphanWf: Workflow = {
    ...emptyWf,
    id: 'wf-orphan',
    nodes: [
      makeNode('trigger1', 'trigger'),
      makeNode('orphan1', 'code', { code: 'return {};' }, 'Orphan'),
    ],
    edges: [],
  };
  const orphanErrors = validateWorkflow(orphanWf);
  assert(orphanErrors.some(e => e.message.includes('Orphan') && e.severity === 'warning'), 'Detects orphan nodes');

  // Valid workflow
  const validWf: Workflow = {
    ...emptyWf,
    id: 'wf-valid',
    nodes: [
      makeNode('t1', 'trigger'),
      makeNode('c1', 'code', { code: 'return { result: 42 };' }),
      makeNode('o1', 'output'),
    ],
    edges: [
      makeEdge('t1', 'c1'),
      makeEdge('c1', 'o1'),
    ],
  };
  const validErrors = validateWorkflow(validWf);
  const hasOnlyWarnings = validErrors.every(e => e.severity === 'warning');
  assert(validErrors.filter(e => e.severity === 'error').length === 0, 'Valid workflow has no errors');

  // Missing LLM prompt
  const missingPromptWf: Workflow = {
    ...emptyWf,
    id: 'wf-no-prompt',
    nodes: [
      makeNode('t1', 'trigger'),
      makeNode('llm1', 'llm-call', {}),
    ],
    edges: [makeEdge('t1', 'llm1')],
  };
  const promptErrors = validateWorkflow(missingPromptWf);
  assert(promptErrors.some(e => e.field === 'prompt'), 'Detects missing LLM prompt');

  // ────────────────────────────────────────────────────────
  section('2. Basic Execution: Trigger → Code → Output');
  // ────────────────────────────────────────────────────────

  const basicWf: Workflow = {
    ...emptyWf,
    id: 'wf-basic',
    nodes: [
      makeNode('t', 'trigger'),
      makeNode('code1', 'code', { code: 'return { sum: inputs.a + inputs.b };' }),
      makeNode('out', 'output'),
    ],
    edges: [
      makeEdge('t', 'code1'),
      makeEdge('code1', 'out'),
    ],
    variables: [
      { name: 'greeting', type: 'string', defaultValue: 'hello' },
    ],
  };

  const basicResult = await engine.execute(basicWf, { a: 3, b: 7 });
  assert(basicResult.status === 'completed', 'Basic workflow completed');
  assert(basicResult.nodeResults.has('t'), 'Trigger node was executed');
  assert(basicResult.nodeResults.has('code1'), 'Code node was executed');
  assert(basicResult.nodeResults.has('out'), 'Output node was executed');

  const codeResult = basicResult.nodeResults.get('code1');
  assert(codeResult?.status === 'completed', 'Code node status = completed');

  // ────────────────────────────────────────────────────────
  section('3. Condition Branching');
  // ────────────────────────────────────────────────────────

  const condWf: Workflow = {
    ...emptyWf,
    id: 'wf-cond',
    nodes: [
      makeNode('t', 'trigger'),
      makeNode('cond', 'condition', { expression: '_trigger.value > 10' }),
      makeNode('yes', 'code', { code: 'return { branch: "yes" };' }, 'Yes Branch'),
      makeNode('no', 'code', { code: 'return { branch: "no" };' }, 'No Branch'),
    ],
    edges: [
      makeEdge('t', 'cond'),
      { id: 'cond-yes', source: 'cond', sourcePort: 'output', target: 'yes', targetPort: 'input', condition: 'cond.result === true' },
      { id: 'cond-no', source: 'cond', sourcePort: 'output', target: 'no', targetPort: 'input', condition: 'cond.result === false' },
    ],
  };

  // value > 10 → should take "yes" branch
  const condResult = await engine.execute(condWf, { value: 20 });
  assert(condResult.status === 'completed', 'Condition workflow completed');
  assert(condResult.nodeResults.has('cond'), 'Condition node executed');

  const condOutput = condResult.nodeResults.get('cond');
  assert(condOutput?.output.branch === 'true', 'Condition evaluates to true for value=20');

  // ────────────────────────────────────────────────────────
  section('4. Loop Execution');
  // ────────────────────────────────────────────────────────

  // Loop with items
  const loopItemsWf: Workflow = {
    ...emptyWf,
    id: 'wf-loop-items',
    nodes: [
      makeNode('t', 'trigger'),
      makeNode('loop1', 'loop', {
        items: ['apple', 'banana', 'cherry'],
        loopVariable: 'fruit',
        maxIterations: 10,
      }),
      makeNode('out', 'output'),
    ],
    edges: [
      makeEdge('t', 'loop1'),
      makeEdge('loop1', 'out'),
    ],
  };

  const loopResult = await engine.execute(loopItemsWf);
  assert(loopResult.status === 'completed', 'Loop workflow completed');

  const loopOutput = loopResult.nodeResults.get('loop1');
  assert(loopOutput?.status === 'completed', 'Loop node completed');
  assert((loopOutput?.output.iterations as number) === 3, 'Loop iterated 3 times for 3 items');

  // Loop with condition
  const loopCondWf: Workflow = {
    ...emptyWf,
    id: 'wf-loop-cond',
    nodes: [
      makeNode('t', 'trigger'),
      makeNode('loop2', 'loop', {
        condition: 'index < 5',
        maxIterations: 100,
        loopVariable: 'i',
      }),
      makeNode('out', 'output'),
    ],
    edges: [
      makeEdge('t', 'loop2'),
      makeEdge('loop2', 'out'),
    ],
  };

  const loopCondResult = await engine.execute(loopCondWf);
  const loopCondOutput = loopCondResult.nodeResults.get('loop2');
  assert(loopCondResult.status === 'completed', 'Condition loop completed');
  assert((loopCondOutput?.output.iterations as number) === 5, 'Condition loop ran 5 times (index < 5)');

  // ────────────────────────────────────────────────────────
  section('5. Switch Node');
  // ────────────────────────────────────────────────────────

  const switchWf: Workflow = {
    ...emptyWf,
    id: 'wf-switch',
    nodes: [
      makeNode('t', 'trigger'),
      makeNode('sw', 'switch', {
        expression: '_trigger.category',
        cases: [
          { value: 'A', label: 'Category A' },
          { value: 'B', label: 'Category B' },
          { value: 'C', label: 'Category C' },
        ],
      }),
      makeNode('out', 'output'),
    ],
    edges: [
      makeEdge('t', 'sw'),
      makeEdge('sw', 'out'),
    ],
  };

  const switchResult = await engine.execute(switchWf, { category: 'B' });
  assert(switchResult.status === 'completed', 'Switch workflow completed');
  const switchOutput = switchResult.nodeResults.get('sw');
  assert(switchOutput?.output.matchedCase === 'B', 'Switch matched case B');

  // Default case
  const switchDefault = await engine.execute(switchWf, { category: 'Z' });
  const switchDefaultOut = switchDefault.nodeResults.get('sw');
  assert(switchDefaultOut?.output.matchedCase === 'default', 'Switch falls through to default');

  // ────────────────────────────────────────────────────────
  section('6. LLM Call (Mock)');
  // ────────────────────────────────────────────────────────

  const llmWf: Workflow = {
    ...emptyWf,
    id: 'wf-llm',
    nodes: [
      makeNode('t', 'trigger'),
      makeNode('llm', 'llm-call', { prompt: 'Hello {{_trigger.name}}, what is 2+2?' }),
      makeNode('out', 'output'),
    ],
    edges: [
      makeEdge('t', 'llm'),
      makeEdge('llm', 'out'),
    ],
  };

  const llmResult = await engine.execute(llmWf, { name: 'xClaw' });
  assert(llmResult.status === 'completed', 'LLM workflow completed');
  const llmOutput = llmResult.nodeResults.get('llm');
  assert(typeof llmOutput?.output.response === 'string', 'LLM returned string response');
  assert((llmOutput?.output.response as string).includes('Mock response'), 'LLM used mock adapter');

  // ────────────────────────────────────────────────────────
  section('7. Tool Call');
  // ────────────────────────────────────────────────────────

  const toolWf: Workflow = {
    ...emptyWf,
    id: 'wf-tool',
    nodes: [
      makeNode('t', 'trigger'),
      makeNode('tool', 'tool-call', { toolName: 'test_tool', arguments: { input: '{{_trigger.data}}' } }),
      makeNode('out', 'output'),
    ],
    edges: [
      makeEdge('t', 'tool'),
      makeEdge('tool', 'out'),
    ],
  };

  const toolResult = await engine.execute(toolWf, { data: 'test123' });
  assert(toolResult.status === 'completed', 'Tool workflow completed');
  const toolOutput = toolResult.nodeResults.get('tool');
  assert(toolOutput?.output.success === true, 'Tool executed successfully');
  assert((toolOutput?.output.result as string).includes('test123'), 'Tool resolved template variable');

  // ────────────────────────────────────────────────────────
  section('8. Transform & Template Resolution');
  // ────────────────────────────────────────────────────────

  const transformWf: Workflow = {
    ...emptyWf,
    id: 'wf-transform',
    nodes: [
      makeNode('t', 'trigger'),
      makeNode('tr', 'transform', { template: 'Hello {{_trigger.user}}! Your score is {{_trigger.score}}.' }),
      makeNode('out', 'output'),
    ],
    edges: [
      makeEdge('t', 'tr'),
      makeEdge('tr', 'out'),
    ],
  };

  const trResult = await engine.execute(transformWf, { user: 'Alice', score: 95 });
  const trOutput = trResult.nodeResults.get('tr');
  assert(trResult.status === 'completed', 'Transform workflow completed');
  assert((trOutput?.output.result as string).includes('Alice'), 'Template resolved user');
  assert((trOutput?.output.result as string).includes('95'), 'Template resolved score');

  // ────────────────────────────────────────────────────────
  section('9. Wait Node');
  // ────────────────────────────────────────────────────────

  const waitWf: Workflow = {
    ...emptyWf,
    id: 'wf-wait',
    nodes: [
      makeNode('t', 'trigger'),
      makeNode('w', 'wait', { seconds: 0.1 }),
      makeNode('out', 'output'),
    ],
    edges: [
      makeEdge('t', 'w'),
      makeEdge('w', 'out'),
    ],
  };

  const startTime = Date.now();
  const waitResult = await engine.execute(waitWf);
  const waitTime = Date.now() - startTime;
  assert(waitResult.status === 'completed', 'Wait workflow completed');
  assert(waitTime >= 80, `Wait node actually waited (${waitTime}ms >= 80ms)`);

  // ────────────────────────────────────────────────────────
  section('10. Event Bus Integration');
  // ────────────────────────────────────────────────────────

  const events: string[] = [];
  eventBus.on('workflow:started', () => events.push('started'));
  eventBus.on('workflow:completed', () => events.push('completed'));
  eventBus.on('workflow:node:started', () => events.push('node:started'));
  eventBus.on('workflow:node:completed', () => events.push('node:completed'));

  await engine.execute(basicWf, { a: 1, b: 2 });
  assert(events.includes('started'), 'Emitted workflow:started event');
  assert(events.includes('completed'), 'Emitted workflow:completed event');
  assert(events.includes('node:started'), 'Emitted workflow:node:started event');
  assert(events.includes('node:completed'), 'Emitted workflow:node:completed event');

  // ────────────────────────────────────────────────────────
  section('11. Error Handling');
  // ────────────────────────────────────────────────────────

  const errorWf: Workflow = {
    ...emptyWf,
    id: 'wf-error',
    nodes: [
      makeNode('t', 'trigger'),
      makeNode('bad', 'code', { code: 'throw new Error("intentional");' }),
      makeNode('out', 'output'),
    ],
    edges: [
      makeEdge('t', 'bad'),
      makeEdge('bad', 'out'),
    ],
  };

  const errorResult = await engine.execute(errorWf);
  assert(errorResult.status === 'failed', 'Error workflow failed as expected');
  assert(errorResult.error?.includes('intentional'), 'Error message preserved');
  const badNode = errorResult.nodeResults.get('bad');
  assert(badNode?.status === 'failed', 'Failed node marked as failed');

  // ────────────────────────────────────────────────────────
  section('12. Notification Node');
  // ────────────────────────────────────────────────────────

  let notificationSent = false;
  eventBus.on('notification:send', (event) => {
    notificationSent = true;
  });

  const notifWf: Workflow = {
    ...emptyWf,
    id: 'wf-notif',
    nodes: [
      makeNode('t', 'trigger'),
      makeNode('n', 'notification', { message: 'Alert: {{_trigger.alert}}', channel: 'test' }),
      makeNode('out', 'output'),
    ],
    edges: [
      makeEdge('t', 'n'),
      makeEdge('n', 'out'),
    ],
  };

  const notifResult = await engine.execute(notifWf, { alert: 'High CPU' });
  assert(notifResult.status === 'completed', 'Notification workflow completed');
  const notifOutput = notifResult.nodeResults.get('n');
  assert((notifOutput?.output.message as string).includes('High CPU'), 'Notification resolved template');
  assert(notificationSent, 'Notification event was emitted');

  // ────────────────────────────────────────────────────────
  // Summary
  // ────────────────────────────────────────────────────────

  console.log(`\n${HEADER}══════════════════════════════════════════${RESET}`);
  console.log(`  Total: ${passed + failed} tests — ${PASS.replace(' PASS', '')} ${passed} passed, ${FAIL.replace(' FAIL', '')} ${failed} failed`);
  console.log(`${HEADER}══════════════════════════════════════════${RESET}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Test crashed:', err);
  process.exit(1);
});
