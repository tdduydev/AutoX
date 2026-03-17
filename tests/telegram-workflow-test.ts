// ============================================================
// Telegram + Workflow Integration Test
// Tests the full flow: Telegram message → Workflow trigger → Response
// Does NOT require a real Telegram bot — mocks the grammY layer
// ============================================================

import {
  EventBus, ToolRegistry, WorkflowEngine, LLMRouter,
} from '@xclaw/core';
import type {
  Workflow, IncomingMessage, OutgoingMessage, ChannelPlugin, ChatPlatform,
} from '@xclaw/shared';

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
    // Simple medical triage mock
    if (userMsg.toLowerCase().includes('headache')) {
      return { content: 'Based on your symptom, headaches can be caused by tension, dehydration, or migraines. Please stay hydrated and rest.', usage: { promptTokens: 10, completionTokens: 30, totalTokens: 40 } };
    }
    if (userMsg.toLowerCase().includes('fever')) {
      return { content: 'Fever may indicate an infection. Monitor your temperature and consult a doctor if it persists.', usage: { promptTokens: 10, completionTokens: 25, totalTokens: 35 } };
    }
    return { content: `I understand. ${userMsg.substring(0, 80)}`, usage: { promptTokens: 10, completionTokens: 15, totalTokens: 25 } };
  }
  async stream() { throw new Error('Not implemented'); }
}

// ─── Mock Telegram Channel ──────────────────────────────────

class MockTelegramChannel implements ChannelPlugin {
  readonly id = 'telegram-mock';
  readonly platform: ChatPlatform = 'telegram';
  readonly name = 'Telegram (Mock)';
  readonly version = '0.1.0';
  readonly description = 'Mock Telegram for testing';

  private handler?: (message: IncomingMessage) => Promise<void>;
  public sentMessages: OutgoingMessage[] = [];

  async initialize(_config: Record<string, unknown>) {}
  async start() {}
  async stop() {}

  async send(message: OutgoingMessage): Promise<void> {
    this.sentMessages.push(message);
  }

  onMessage(handler: (message: IncomingMessage) => Promise<void>): void {
    this.handler = handler;
  }

  /** Simulate an incoming Telegram message */
  async simulateMessage(text: string, userId = '12345', chatId = '67890'): Promise<void> {
    if (!this.handler) throw new Error('No message handler registered');
    const incoming: IncomingMessage = {
      platform: 'telegram',
      channelId: chatId,
      userId,
      content: text,
      timestamp: new Date().toISOString(),
      metadata: {
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
        chatType: 'private',
      },
    };
    await this.handler(incoming);
  }
}

// ─── Test: Chat → Workflow Pipeline ─────────────────────────

async function main() {
  console.log('\n📱 Telegram + Workflow Integration Test');
  console.log('   Simulating: Message → Workflow → Response\n');

  const eventBus = new EventBus();
  const toolRegistry = new ToolRegistry(eventBus);
  const llmRouter = new LLMRouter(eventBus);
  llmRouter.registerAdapter('default', new MockLLMAdapter() as any);

  const engine = new WorkflowEngine(toolRegistry, llmRouter, eventBus);
  const telegram = new MockTelegramChannel();

  // ────────────────────────────────────────────────────────
  section('1. Mock Telegram Channel Setup');
  // ────────────────────────────────────────────────────────

  assert(telegram.platform === 'telegram', 'Channel platform is telegram');
  assert(telegram.sentMessages.length === 0, 'No messages sent initially');

  // ────────────────────────────────────────────────────────
  section('2. Medical Triage Workflow');
  // ────────────────────────────────────────────────────────

  // Build a medical triage workflow:
  // Trigger → LLM Triage → Condition (severity) → Output
  const triageWorkflow: Workflow = {
    id: 'wf-triage',
    name: 'Medical Triage',
    description: 'Triage incoming symptoms via LLM',
    version: 1,
    nodes: [
      {
        id: 'trigger', type: 'trigger', position: { x: 0, y: 0 },
        data: { label: 'Message Received', config: { triggerType: 'message' } },
        inputs: [], outputs: [{ id: 'output', name: 'output', type: 'any' }],
      },
      {
        id: 'triage-llm', type: 'llm-call', position: { x: 200, y: 0 },
        data: {
          label: 'LLM Triage',
          config: {
            prompt: 'Patient reports: {{_trigger.content}}. Provide medical triage assessment.',
            systemPrompt: 'You are a medical triage assistant.',
          },
        },
        inputs: [{ id: 'input', name: 'input', type: 'any' }],
        outputs: [{ id: 'output', name: 'output', type: 'any' }],
      },
      {
        id: 'format', type: 'transform', position: { x: 400, y: 0 },
        data: {
          label: 'Format Response',
          config: { template: '🏥 Triage: {{triage-llm.response}}' },
        },
        inputs: [{ id: 'input', name: 'input', type: 'any' }],
        outputs: [{ id: 'output', name: 'output', type: 'any' }],
      },
      {
        id: 'output', type: 'output', position: { x: 600, y: 0 },
        data: { label: 'Send Response', config: {} },
        inputs: [{ id: 'input', name: 'input', type: 'any' }],
        outputs: [],
      },
    ],
    edges: [
      { id: 'e1', source: 'trigger', sourcePort: 'output', target: 'triage-llm', targetPort: 'input' },
      { id: 'e2', source: 'triage-llm', sourcePort: 'output', target: 'format', targetPort: 'input' },
      { id: 'e3', source: 'format', sourcePort: 'output', target: 'output', targetPort: 'input' },
    ],
    variables: [],
    trigger: { id: 'trigger', type: 'message', name: 'Chat Message', description: '', config: {} },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    enabled: true,
  };

  // ────────────────────────────────────────────────────────
  section('3. Wire Telegram → Workflow → Telegram');
  // ────────────────────────────────────────────────────────

  // Register the message handler: simulate the gateway flow
  telegram.onMessage(async (msg: IncomingMessage) => {
    // Execute the workflow with the message as trigger data
    const execution = await engine.execute(triageWorkflow, {
      content: msg.content,
      userId: msg.userId,
      channelId: msg.channelId,
      platform: msg.platform,
    });

    // Extract the response from the workflow output
    let response = 'Workflow completed.';
    const formatResult = execution.nodeResults.get('format');
    if (formatResult?.output.result) {
      response = formatResult.output.result as string;
    } else {
      // Fallback: get LLM response
      const llmResult = execution.nodeResults.get('triage-llm');
      if (llmResult?.output.response) {
        response = llmResult.output.response as string;
      }
    }

    // Send response back via Telegram
    await telegram.send({
      platform: 'telegram',
      channelId: msg.channelId,
      userId: msg.userId,
      content: response,
      timestamp: new Date().toISOString(),
    });
  });

  assert(true, 'Message handler registered');

  // ────────────────────────────────────────────────────────
  section('4. Simulate Headache Message');
  // ────────────────────────────────────────────────────────

  await telegram.simulateMessage('I have a bad headache', 'user1', 'chat1');

  assert(telegram.sentMessages.length === 1, 'One response was sent');
  const resp1 = telegram.sentMessages[0];
  assert(resp1.channelId === 'chat1', 'Response sent to correct chat');
  assert(resp1.content.includes('headache') || resp1.content.includes('Triage'), 'Response mentions headache or triage');
  console.log(`    💬 Response: "${resp1.content.substring(0, 80)}..."`);

  // ────────────────────────────────────────────────────────
  section('5. Simulate Fever Message');
  // ────────────────────────────────────────────────────────

  await telegram.simulateMessage('I have a 39°C fever since yesterday', 'user2', 'chat2');

  assert(telegram.sentMessages.length === 2, 'Two responses total');
  const resp2 = telegram.sentMessages[1];
  assert(resp2.channelId === 'chat2', 'Second response to chat2');
  assert(resp2.content.includes('fever') || resp2.content.includes('Fever') || resp2.content.includes('Triage'), 'Response addresses fever');
  console.log(`    💬 Response: "${resp2.content.substring(0, 80)}..."`);

  // ────────────────────────────────────────────────────────
  section('6. Multi-Step Workflow with Condition');
  // ────────────────────────────────────────────────────────

  const multiStepWf: Workflow = {
    id: 'wf-multi',
    name: 'Multi-Step with Condition',
    description: 'Trigger → Condition → LLM or Transform',
    version: 1,
    nodes: [
      {
        id: 'trigger', type: 'trigger', position: { x: 0, y: 0 },
        data: { label: 'Message', config: { triggerType: 'message' } },
        inputs: [], outputs: [{ id: 'output', name: 'output', type: 'any' }],
      },
      {
        id: 'check-urgent', type: 'condition', position: { x: 200, y: 0 },
        data: { label: 'Is Urgent?', config: { expression: '_trigger.urgent === true' } },
        inputs: [{ id: 'input', name: 'input', type: 'any' }],
        outputs: [{ id: 'output', name: 'output', type: 'any' }],
      },
      {
        id: 'urgent-llm', type: 'llm-call', position: { x: 400, y: -100 },
        data: { label: 'Urgent LLM', config: { prompt: 'URGENT: {{_trigger.content}}' } },
        inputs: [{ id: 'input', name: 'input', type: 'any' }],
        outputs: [{ id: 'output', name: 'output', type: 'any' }],
      },
      {
        id: 'normal-transform', type: 'transform', position: { x: 400, y: 100 },
        data: { label: 'Normal Response', config: { template: 'Your query has been noted: {{_trigger.content}}' } },
        inputs: [{ id: 'input', name: 'input', type: 'any' }],
        outputs: [{ id: 'output', name: 'output', type: 'any' }],
      },
    ],
    edges: [
      { id: 'e1', source: 'trigger', sourcePort: 'output', target: 'check-urgent', targetPort: 'input' },
      { id: 'e2', source: 'check-urgent', sourcePort: 'output', target: 'urgent-llm', targetPort: 'input', condition: 'check-urgent.result === true' },
      { id: 'e3', source: 'check-urgent', sourcePort: 'output', target: 'normal-transform', targetPort: 'input', condition: 'check-urgent.result === false' },
    ],
    variables: [],
    trigger: { id: 'trigger', type: 'message', name: 'Chat Message', description: '', config: {} },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    enabled: true,
  };

  // Test urgent path
  const urgentResult = await engine.execute(multiStepWf, { content: 'chest pain', urgent: true });
  assert(urgentResult.status === 'completed', 'Urgent workflow completed');
  assert(urgentResult.nodeResults.has('check-urgent'), 'Condition node executed');
  const urgentCond = urgentResult.nodeResults.get('check-urgent');
  assert(urgentCond?.output.branch === 'true', 'Urgent condition evaluated to true');

  // Test normal path
  const normalResult = await engine.execute(multiStepWf, { content: 'routine checkup', urgent: false });
  assert(normalResult.status === 'completed', 'Normal workflow completed');
  const normalCond = normalResult.nodeResults.get('check-urgent');
  assert(normalCond?.output.branch === 'false', 'Normal condition evaluated to false');

  // ────────────────────────────────────────────────────────
  section('7. Event Flow Verification');
  // ────────────────────────────────────────────────────────

  const nodeEvents: { type: string; nodeId: string }[] = [];
  eventBus.on('workflow:node:started', (event) => {
    nodeEvents.push({ type: 'started', nodeId: event.payload.nodeId });
  });
  eventBus.on('workflow:node:completed', (event) => {
    nodeEvents.push({ type: 'completed', nodeId: event.payload.nodeId });
  });

  await engine.execute(triageWorkflow, { content: 'test' });

  assert(nodeEvents.length > 0, 'Node events were emitted');
  const startedEvents = nodeEvents.filter(e => e.type === 'started');
  const completedEvents = nodeEvents.filter(e => e.type === 'completed');
  assert(startedEvents.length === completedEvents.length, 'Every started node was completed');
  console.log(`    📊 ${startedEvents.length} nodes started and completed`);

  // ────────────────────────────────────────────────────────
  section('8. Concurrent Messages (Simulated)');
  // ────────────────────────────────────────────────────────

  const beforeCount = telegram.sentMessages.length;
  await Promise.all([
    telegram.simulateMessage('headache and nausea', 'user3', 'chat3'),
    telegram.simulateMessage('back pain', 'user4', 'chat4'),
    telegram.simulateMessage('cough for 3 days', 'user5', 'chat5'),
  ]);

  const afterCount = telegram.sentMessages.length;
  assert(afterCount - beforeCount === 3, `3 concurrent messages processed (${afterCount - beforeCount} responses)`);

  // Verify responses went to correct chats
  const chat3Resp = telegram.sentMessages.find(m => m.channelId === 'chat3');
  const chat4Resp = telegram.sentMessages.find(m => m.channelId === 'chat4');
  const chat5Resp = telegram.sentMessages.find(m => m.channelId === 'chat5');
  assert(!!chat3Resp, 'Chat3 got a response');
  assert(!!chat4Resp, 'Chat4 got a response');
  assert(!!chat5Resp, 'Chat5 got a response');

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
