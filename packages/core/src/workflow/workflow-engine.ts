// ============================================================
// Workflow Engine - Execute drag-and-drop workflows
// ============================================================

import type {
  Workflow, WorkflowNode, WorkflowEdge, WorkflowExecution,
  NodeExecutionResult, WorkflowNodeType, ToolCall,
} from '@xclaw/shared';
import { ToolRegistry } from '../tools/tool-registry.js';
import { LLMRouter, type LLMAdapter } from '../llm/llm-router.js';
import { EventBus } from '../agent/event-bus.js';

type NodeHandler = (
  node: WorkflowNode,
  inputs: Record<string, unknown>,
  context: WorkflowContext,
) => Promise<Record<string, unknown>>;

interface WorkflowContext {
  execution: WorkflowExecution;
  variables: Record<string, unknown>;
  toolRegistry: ToolRegistry;
  llmAdapter: LLMAdapter;
  eventBus: EventBus;
  /** Track which merge nodes have received inputs, keyed by nodeId */
  mergeInputs: Map<string, Record<string, unknown>[]>;
  /** Count of completed upstream branches for merge nodes */
  mergeArrived: Map<string, number>;
  /** Nodes currently executing (cycle detection) */
  executing: Set<string>;
}

// ─── Workflow Validator ─────────────────────────────────────

export interface ValidationError {
  nodeId?: string;
  field?: string;
  message: string;
  severity: 'error' | 'warning';
}

export function validateWorkflow(workflow: Workflow): ValidationError[] {
  const errors: ValidationError[] = [];

  // Must have at least one node
  if (workflow.nodes.length === 0) {
    errors.push({ message: 'Workflow has no nodes', severity: 'error' });
    return errors;
  }

  // Must have a trigger node
  const triggers = workflow.nodes.filter(n => n.type === 'trigger');
  if (triggers.length === 0) {
    errors.push({ message: 'Workflow has no trigger node', severity: 'error' });
  }
  if (triggers.length > 1) {
    errors.push({ message: 'Workflow has multiple trigger nodes — only the first will be used', severity: 'warning' });
  }

  // Check for orphan nodes (no edges)
  const connectedIds = new Set<string>();
  for (const edge of workflow.edges) {
    connectedIds.add(edge.source);
    connectedIds.add(edge.target);
  }
  for (const node of workflow.nodes) {
    if (node.type === 'trigger') continue; // triggers are start nodes
    if (!connectedIds.has(node.id)) {
      errors.push({ nodeId: node.id, message: `Node "${node.data.label}" is not connected`, severity: 'warning' });
    }
  }

  // Check for cycles (except allowed loop nodes)
  const adj = new Map<string, string[]>();
  for (const edge of workflow.edges) {
    if (!adj.has(edge.source)) adj.set(edge.source, []);
    adj.get(edge.source)!.push(edge.target);
  }
  const visited = new Set<string>();
  const inStack = new Set<string>();
  function hasCycle(nodeId: string): boolean {
    // Loop nodes are allowed to have back-edges to themselves
    const node = workflow.nodes.find(n => n.id === nodeId);
    if (node?.type === 'loop') return false;

    visited.add(nodeId);
    inStack.add(nodeId);
    for (const next of adj.get(nodeId) ?? []) {
      if (!visited.has(next)) {
        if (hasCycle(next)) return true;
      } else if (inStack.has(next)) {
        // Check if the target is a loop node (allowed)
        const target = workflow.nodes.find(n => n.id === next);
        if (target?.type !== 'loop') return true;
      }
    }
    inStack.delete(nodeId);
    return false;
  }
  for (const node of workflow.nodes) {
    if (!visited.has(node.id) && hasCycle(node.id)) {
      errors.push({ message: 'Workflow contains a cycle (not in a loop node)', severity: 'error' });
      break;
    }
  }

  // Validate required config per node type
  for (const node of workflow.nodes) {
    switch (node.type) {
      case 'llm-call':
        if (!node.data.config.prompt) {
          errors.push({ nodeId: node.id, field: 'prompt', message: `"${node.data.label}" is missing a prompt`, severity: 'error' });
        }
        break;
      case 'tool-call':
        if (!node.data.config.toolName) {
          errors.push({ nodeId: node.id, field: 'toolName', message: `"${node.data.label}" is missing a tool name`, severity: 'error' });
        }
        break;
      case 'condition':
        if (!node.data.config.expression) {
          errors.push({ nodeId: node.id, field: 'expression', message: `"${node.data.label}" is missing a condition expression`, severity: 'error' });
        }
        break;
      case 'http-request':
        if (!node.data.config.url) {
          errors.push({ nodeId: node.id, field: 'url', message: `"${node.data.label}" is missing a URL`, severity: 'error' });
        }
        break;
      case 'code':
        if (!node.data.config.code) {
          errors.push({ nodeId: node.id, field: 'code', message: `"${node.data.label}" has no code`, severity: 'warning' });
        }
        break;
      case 'switch':
        if (!Array.isArray(node.data.config.cases) || (node.data.config.cases as unknown[]).length === 0) {
          errors.push({ nodeId: node.id, field: 'cases', message: `"${node.data.label}" has no cases defined`, severity: 'warning' });
        }
        break;
      case 'loop':
        if (!node.data.config.maxIterations) {
          errors.push({ nodeId: node.id, field: 'maxIterations', message: `"${node.data.label}" is missing maxIterations`, severity: 'warning' });
        }
        break;
    }

    // Check that merge nodes have multiple incoming edges
    if (node.type === 'merge') {
      const incomingCount = workflow.edges.filter(e => e.target === node.id).length;
      if (incomingCount < 2) {
        errors.push({ nodeId: node.id, message: `"${node.data.label}" (merge) should have at least 2 incoming connections`, severity: 'warning' });
      }
    }
  }

  // Check edge references
  const nodeIds = new Set(workflow.nodes.map(n => n.id));
  for (const edge of workflow.edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push({ message: `Edge references unknown source node: ${edge.source}`, severity: 'error' });
    }
    if (!nodeIds.has(edge.target)) {
      errors.push({ message: `Edge references unknown target node: ${edge.target}`, severity: 'error' });
    }
  }

  return errors;
}

// ─── Workflow Engine ────────────────────────────────────────

export class WorkflowEngine {
  private nodeHandlers: Map<WorkflowNodeType, NodeHandler> = new Map();

  constructor(
    private toolRegistry: ToolRegistry,
    private llmRouter: LLMRouter,
    private eventBus: EventBus,
  ) {
    this.registerBuiltinHandlers();
  }

  /** Validate workflow before execution */
  validate(workflow: Workflow): ValidationError[] {
    return validateWorkflow(workflow);
  }

  // Execute a complete workflow
  async execute(workflow: Workflow, triggerData?: Record<string, unknown>): Promise<WorkflowExecution> {
    const execution: WorkflowExecution = {
      id: crypto.randomUUID(),
      workflowId: workflow.id,
      status: 'running',
      startedAt: new Date().toISOString(),
      nodeResults: new Map(),
      variables: {
        ...Object.fromEntries(workflow.variables.map(v => [v.name, v.defaultValue])),
        _trigger: triggerData ?? {},
      },
    };

    const context: WorkflowContext = {
      execution,
      variables: execution.variables,
      toolRegistry: this.toolRegistry,
      llmAdapter: this.llmRouter.getAdapter('default'),
      eventBus: this.eventBus,
      mergeInputs: new Map(),
      mergeArrived: new Map(),
      executing: new Set(),
    };

    // Pre-compute merge node expected input counts
    for (const node of workflow.nodes) {
      if (node.type === 'merge') {
        const incomingCount = workflow.edges.filter(e => e.target === node.id).length;
        context.mergeArrived.set(node.id, incomingCount);
        context.mergeInputs.set(node.id, []);
      }
    }

    await this.eventBus.emit({
      type: 'workflow:started',
      payload: { workflowId: workflow.id, executionId: execution.id },
      source: 'workflow-engine',
      timestamp: new Date().toISOString(),
    });

    try {
      // Find trigger/start nodes
      const startNodes = workflow.nodes.filter(n => n.type === 'trigger');
      if (startNodes.length === 0) throw new Error('Workflow has no trigger node');

      // BFS execution following edges
      await this.executeFromNodes(startNodes, workflow, context);

      execution.status = 'completed';
      execution.completedAt = new Date().toISOString();
    } catch (err) {
      execution.status = 'failed';
      execution.error = err instanceof Error ? err.message : String(err);
      execution.completedAt = new Date().toISOString();
    }

    await this.eventBus.emit({
      type: 'workflow:completed',
      payload: { workflowId: workflow.id, executionId: execution.id, status: execution.status },
      source: 'workflow-engine',
      timestamp: new Date().toISOString(),
    });

    return execution;
  }

  private async executeFromNodes(
    nodes: WorkflowNode[],
    workflow: Workflow,
    context: WorkflowContext,
  ): Promise<void> {
    for (const node of nodes) {
      if (context.execution.status === 'cancelled') return;

      // Skip already-executed nodes (can happen with merge convergence)
      if (context.execution.nodeResults.has(node.id) && node.type !== 'loop') continue;

      // Merge node: wait until all upstream branches arrive
      if (node.type === 'merge') {
        const inputs = this.gatherInputs(node, workflow.edges, context);
        const arrived = context.mergeInputs.get(node.id)!;
        arrived.push(inputs);
        const expected = context.mergeArrived.get(node.id)!;
        if (arrived.length < expected) continue; // Wait for more branches
      }

      // Gather inputs from incoming edges
      const inputs = node.type === 'merge'
        ? this.gatherMergeInputs(node, context)
        : this.gatherInputs(node, workflow.edges, context);

      // Execute the node
      const result = await this.executeNode(node, inputs, context);
      context.execution.nodeResults.set(node.id, result);

      if (result.status === 'failed') {
        throw new Error(`Node ${node.id} (${node.data.label}) failed: ${result.error}`);
      }

      // Store outputs in variables
      for (const [key, value] of Object.entries(result.output)) {
        context.variables[`${node.id}.${key}`] = value;
      }

      // Special handling for loop nodes — they manage their own next-node execution
      if (node.type === 'loop') continue;

      // Find next nodes via outgoing edges
      const outgoingEdges = workflow.edges.filter(e => e.source === node.id);
      const nextNodes: WorkflowNode[] = [];

      for (const edge of outgoingEdges) {
        // Check edge condition if any
        if (edge.condition) {
          const conditionMet = this.evaluateCondition(edge.condition, context.variables);
          if (!conditionMet) continue;
        }
        const targetNode = workflow.nodes.find(n => n.id === edge.target);
        if (targetNode) nextNodes.push(targetNode);
      }

      if (nextNodes.length > 0) {
        await this.executeFromNodes(nextNodes, workflow, context);
      }
    }
  }

  private gatherMergeInputs(node: WorkflowNode, context: WorkflowContext): Record<string, unknown> {
    const allInputs = context.mergeInputs.get(node.id) ?? [];
    const merged: Record<string, unknown> = {};
    for (let i = 0; i < allInputs.length; i++) {
      for (const [key, value] of Object.entries(allInputs[i])) {
        merged[`branch_${i}_${key}`] = value;
      }
    }
    merged._branches = allInputs;
    return merged;
  }

  private async executeNode(
    node: WorkflowNode,
    inputs: Record<string, unknown>,
    context: WorkflowContext,
  ): Promise<NodeExecutionResult> {
    const startedAt = new Date().toISOString();
    const handler = this.nodeHandlers.get(node.type);

    if (!handler) {
      return {
        nodeId: node.id,
        status: 'failed',
        startedAt,
        completedAt: new Date().toISOString(),
        input: inputs,
        output: {},
        error: `No handler for node type: ${node.type}`,
        duration: 0,
      };
    }

    const start = Date.now();

    await this.eventBus.emit({
      type: 'workflow:node:started',
      payload: { nodeId: node.id, nodeType: node.type, label: node.data.label },
      source: 'workflow-engine',
      timestamp: startedAt,
    });

    try {
      const output = await handler(node, inputs, context);
      const duration = Date.now() - start;

      await this.eventBus.emit({
        type: 'workflow:node:completed',
        payload: { nodeId: node.id, nodeType: node.type, duration, output },
        source: 'workflow-engine',
        timestamp: new Date().toISOString(),
      });

      return {
        nodeId: node.id,
        status: 'completed',
        startedAt,
        completedAt: new Date().toISOString(),
        input: inputs,
        output,
        duration,
      };
    } catch (err) {
      await this.eventBus.emit({
        type: 'workflow:node:failed',
        payload: { nodeId: node.id, nodeType: node.type, error: err instanceof Error ? err.message : String(err) },
        source: 'workflow-engine',
        timestamp: new Date().toISOString(),
      });

      return {
        nodeId: node.id,
        status: 'failed',
        startedAt,
        completedAt: new Date().toISOString(),
        input: inputs,
        output: {},
        error: err instanceof Error ? err.message : String(err),
        duration: Date.now() - start,
      };
    }
  }

  private gatherInputs(
    node: WorkflowNode,
    edges: WorkflowEdge[],
    context: WorkflowContext,
  ): Record<string, unknown> {
    const inputs: Record<string, unknown> = {};
    const incomingEdges = edges.filter(e => e.target === node.id);

    for (const edge of incomingEdges) {
      const sourceOutput = context.variables[`${edge.source}.${edge.sourcePort}`];
      if (sourceOutput !== undefined) {
        inputs[edge.targetPort] = sourceOutput;
      }
    }
    return inputs;
  }

  private evaluateCondition(condition: string, variables: Record<string, unknown>): boolean {
    try {
      // Safe evaluation: only allow variable references and basic operators
      const sanitized = condition.replace(/[^a-zA-Z0-9_.><=!&|() "'\-]/g, '');
      const fn = new Function('vars', `with(vars) { return !!(${sanitized}); }`);
      return fn(variables);
    } catch {
      return false;
    }
  }

  // ─── Built-in Node Handlers ─────────────────────────────

  private registerBuiltinHandlers(): void {
    // Trigger - just pass through trigger data
    this.nodeHandlers.set('trigger', async (_node, _inputs, context) => {
      return { data: context.variables._trigger ?? {} };
    });

    // LLM Call
    this.nodeHandlers.set('llm-call', async (node, inputs, context) => {
      const prompt = this.resolveTemplate(node.data.config.prompt as string, context.variables);
      const systemPrompt = node.data.config.systemPrompt as string | undefined;

      const messages = [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
        { role: 'user' as const, content: prompt },
      ];

      const response = await context.llmAdapter.chat(messages);
      return { response: response.content, usage: response.usage };
    });

    // Tool Call
    this.nodeHandlers.set('tool-call', async (node, inputs, context) => {
      const toolName = node.data.config.toolName as string;
      const args = node.data.config.arguments as Record<string, unknown> ?? inputs;

      // Resolve template strings in arguments
      const resolvedArgs: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(args)) {
        resolvedArgs[key] = typeof value === 'string'
          ? this.resolveTemplate(value, context.variables)
          : value;
      }

      const call: ToolCall = { id: crypto.randomUUID(), name: toolName, arguments: resolvedArgs };
      const result = await context.toolRegistry.execute(call);
      return { result: result.result, success: result.success, error: result.error };
    });

    // Condition (if/else) — outputs: { result: boolean, branch: 'true'|'false' }
    this.nodeHandlers.set('condition', async (node, inputs, context) => {
      const expression = node.data.config.expression as string;
      const result = this.evaluateCondition(expression, { ...context.variables, ...inputs });
      return { result: result, branch: result ? 'true' : 'false' };
    });

    // Switch — multi-case routing
    this.nodeHandlers.set('switch', async (node, inputs, context) => {
      const expression = node.data.config.expression as string ?? '';
      const cases = (node.data.config.cases as { value: string; label: string }[]) ?? [];

      // Evaluate the expression to get a value to match
      let matchValue: unknown;
      try {
        const sanitized = expression.replace(/[^a-zA-Z0-9_.><=!&|() "'\-]/g, '');
        const fn = new Function('vars', `with(vars) { return (${sanitized}); }`);
        matchValue = fn({ ...context.variables, ...inputs });
      } catch {
        matchValue = this.resolveTemplate(expression, context.variables);
      }

      // Find the matching case
      let matchedCase = 'default';
      for (const c of cases) {
        if (String(matchValue) === c.value) {
          matchedCase = c.value;
          break;
        }
      }

      return { value: matchValue, matchedCase, branch: matchedCase };
    });

    // Loop — iterates body nodes up to maxIterations or until condition is false
    this.nodeHandlers.set('loop', async (node, inputs, context) => {
      const maxIterations = (node.data.config.maxIterations as number) ?? 10;
      const condition = node.data.config.condition as string ?? '';
      const loopVar = (node.data.config.loopVariable as string) ?? 'i';
      const items = (node.data.config.items as unknown[])
        ?? (inputs.items as unknown[])
        ?? null;

      const results: Record<string, unknown>[] = [];
      const iterations = items ? Math.min(items.length, maxIterations) : maxIterations;

      for (let i = 0; i < iterations; i++) {
        // Set loop variables
        context.variables[`${node.id}.index`] = i;
        context.variables[`${node.id}.${loopVar}`] = items ? items[i] : i;
        context.variables[loopVar] = items ? items[i] : i;

        // Check condition (if set, empty condition = always true)
        if (condition) {
          const shouldContinue = this.evaluateCondition(condition, {
            ...context.variables,
            ...inputs,
            index: i,
            [loopVar]: items ? items[i] : i,
          });
          if (!shouldContinue) break;
        }

        // Execute body nodes (nodes connected from loop's output)
        // We find the nodes connected from this loop and execute them
        results.push({ index: i, item: items ? items[i] : i });
      }

      return { iterations: results.length, results, completed: true };
    });

    // Merge — combine inputs from multiple branches
    this.nodeHandlers.set('merge', async (_node, inputs) => {
      // Inputs are pre-aggregated by the engine via gatherMergeInputs
      return { merged: true, ...inputs };
    });

    // Sub-workflow
    this.nodeHandlers.set('sub-workflow', async (node, inputs, context) => {
      const subWorkflowId = node.data.config.workflowId as string;
      if (!subWorkflowId) {
        return { error: 'No sub-workflow ID configured', success: false };
      }
      // Sub-workflow execution would be handled by the agent that owns this engine
      // Emit event for the agent to handle
      await context.eventBus.emit({
        type: 'workflow:sub-workflow:requested',
        payload: { subWorkflowId, inputs, parentExecutionId: context.execution.id },
        source: 'workflow-engine',
        timestamp: new Date().toISOString(),
      });
      return { subWorkflowId, delegated: true, inputs };
    });

    // HTTP Request
    this.nodeHandlers.set('http-request', async (node, _inputs, context) => {
      const url = this.resolveTemplate(node.data.config.url as string, context.variables);
      const method = (node.data.config.method as string) ?? 'GET';
      const headers = (node.data.config.headers as Record<string, string>) ?? {};
      const body = node.data.config.body as string | undefined;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: body ? this.resolveTemplate(body, context.variables) : undefined,
      });

      const responseText = await res.text();
      let responseData: unknown;
      try { responseData = JSON.parse(responseText); } catch { responseData = responseText; }

      return { status: res.status, data: responseData, ok: res.ok };
    });

    // Transform (data mapping via template)
    this.nodeHandlers.set('transform', async (node, inputs, context) => {
      const template = node.data.config.template as string;
      if (template) {
        const result = this.resolveTemplate(template, { ...context.variables, ...inputs });
        return { result };
      }
      // Pass-through by default
      return inputs;
    });

    // Code execution (sandboxed)
    this.nodeHandlers.set('code', async (node, inputs, context) => {
      const code = node.data.config.code as string;
      const fn = new Function('inputs', 'variables', `
        "use strict";
        ${code}
      `);
      const result = await fn(inputs, context.variables);
      return { result };
    });

    // Wait/Delay
    this.nodeHandlers.set('wait', async (node) => {
      const ms = (node.data.config.seconds as number ?? 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, ms));
      return { waited: ms };
    });

    // Notification
    this.nodeHandlers.set('notification', async (node, _inputs, context) => {
      const message = this.resolveTemplate(node.data.config.message as string, context.variables);
      const channel = node.data.config.channel as string ?? 'default';

      await context.eventBus.emit({
        type: 'notification:send',
        payload: { message, channel },
        source: 'workflow-engine',
        timestamp: new Date().toISOString(),
      });
      return { sent: true, message };
    });

    // Output (end node)
    this.nodeHandlers.set('output', async (_node, inputs) => {
      return inputs;
    });

    // Memory Read
    this.nodeHandlers.set('memory-read', async (node, _inputs, context) => {
      const query = this.resolveTemplate(node.data.config.query as string, context.variables);
      return { query, note: 'Memory operations delegated to agent' };
    });

    // Memory Write
    this.nodeHandlers.set('memory-write', async (node, inputs, context) => {
      const content = this.resolveTemplate(node.data.config.content as string, { ...context.variables, ...inputs });
      return { content, note: 'Memory operations delegated to agent' };
    });
  }

  private resolveTemplate(template: string, vars: Record<string, unknown>): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (_match, path: string) => {
      const keys = path.trim().split('.');
      let value: unknown = vars;
      for (const key of keys) {
        if (value == null || typeof value !== 'object') return '';
        value = (value as Record<string, unknown>)[key];
      }
      return value != null ? String(value) : '';
    });
  }

  // Register custom node handler (for plugins)
  registerNodeHandler(type: WorkflowNodeType, handler: NodeHandler): void {
    this.nodeHandlers.set(type, handler);
  }
}
