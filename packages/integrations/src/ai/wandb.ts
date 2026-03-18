import { z } from 'zod';
import { defineIntegration } from '../base/define-integration.js';

export const wandbIntegration = defineIntegration({
  id: 'wandb',
  name: 'Weights & Biases',
  description: 'Track ML experiments, log metrics, and manage model artifacts with W&B',
  icon: '📊',
  category: 'ai',

  auth: {
    type: 'api-key',
    fields: [
      {
        key: 'apiKey',
        label: 'W&B API Key',
        type: 'secret',
        required: true,
        envVar: 'WANDB_API_KEY',
        placeholder: 'wandb-api-key...',
      },
      {
        key: 'entity',
        label: 'W&B Entity (team or user)',
        type: 'string',
        required: false,
        envVar: 'WANDB_ENTITY',
        placeholder: 'my-team',
      },
    ],
  },

  actions: [
    {
      name: 'log_run',
      description: 'Log metrics for an ML training run',
      parameters: z.object({
        project: z.string().describe('W&B project name'),
        runName: z.string().optional().describe('Run name'),
        metrics: z.record(z.number()).describe('Metrics to log, e.g. {"accuracy": 0.95, "loss": 0.1}'),
        config: z.record(z.unknown()).optional().describe('Run configuration/hyperparameters'),
        tags: z.array(z.string()).optional().describe('Tags for the run'),
      }),
      riskLevel: 'moderate',
      execute: async (args, ctx) => {
        return { success: false, error: 'W&B log_run not implemented yet — requires HTTP integration' };
      },
    },
    {
      name: 'list_runs',
      description: 'List runs in a W&B project',
      parameters: z.object({
        project: z.string().describe('W&B project name'),
        filters: z.record(z.unknown()).optional().describe('Filter criteria'),
        order: z.string().optional().default('-created_at'),
        perPage: z.number().default(10),
      }),
      riskLevel: 'safe',
      execute: async (args, ctx) => {
        return { success: false, error: 'W&B list_runs not implemented yet' };
      },
    },
    {
      name: 'get_run',
      description: 'Get detailed metrics and artifacts for a specific run',
      parameters: z.object({
        project: z.string(),
        runId: z.string().describe('Run ID'),
      }),
      riskLevel: 'safe',
      execute: async (args, ctx) => {
        return { success: false, error: 'W&B get_run not implemented yet' };
      },
    },
    {
      name: 'log_artifact',
      description: 'Log a model or dataset as a W&B artifact',
      parameters: z.object({
        project: z.string(),
        name: z.string().describe('Artifact name'),
        type: z.enum(['model', 'dataset', 'result']).describe('Artifact type'),
        description: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
      }),
      riskLevel: 'moderate',
      execute: async (args, ctx) => {
        return { success: false, error: 'W&B log_artifact not implemented yet' };
      },
    },
    {
      name: 'create_report',
      description: 'Create a W&B report comparing runs',
      parameters: z.object({
        project: z.string(),
        title: z.string(),
        runIds: z.array(z.string()).optional().describe('Runs to include'),
        description: z.string().optional(),
      }),
      riskLevel: 'moderate',
      execute: async (args, ctx) => {
        return { success: false, error: 'W&B create_report not implemented yet' };
      },
    },
  ],
});
