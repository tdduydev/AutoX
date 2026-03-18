import { z } from 'zod';
import { defineIntegration } from '../base/define-integration.js';

export const huggingfaceIntegration = defineIntegration({
  id: 'huggingface',
  name: 'Hugging Face',
  description: 'Access Hugging Face models, datasets, and Inference API for ML tasks',
  icon: '🤗',
  category: 'ai',

  auth: {
    type: 'bearer',
    fields: [
      {
        key: 'token',
        label: 'Hugging Face Token',
        type: 'secret',
        required: true,
        envVar: 'HUGGINGFACE_TOKEN',
        placeholder: 'hf_...',
      },
    ],
  },

  actions: [
    {
      name: 'inference',
      description: 'Run inference on a Hugging Face model via the Inference API',
      parameters: z.object({
        model: z.string().describe('Model ID, e.g. "facebook/bart-large-mnli"'),
        inputs: z.union([z.string(), z.array(z.string())]).describe('Input text or texts'),
        parameters: z.record(z.unknown()).optional().describe('Model-specific parameters'),
        task: z.enum([
          'text-classification',
          'token-classification',
          'question-answering',
          'summarization',
          'translation',
          'text-generation',
          'fill-mask',
          'sentence-similarity',
          'feature-extraction',
          'zero-shot-classification',
          'table-question-answering',
        ]).optional().describe('Task type'),
      }),
      riskLevel: 'safe',
      execute: async (args, ctx) => {
        return { success: false, error: 'Hugging Face inference not implemented yet — requires HTTP integration' };
      },
    },
    {
      name: 'list_models',
      description: 'Search for models on Hugging Face Hub',
      parameters: z.object({
        search: z.string().optional().describe('Search query'),
        author: z.string().optional(),
        filter: z.string().optional().describe('Filter by tag, e.g. "text-classification"'),
        sort: z.enum(['downloads', 'likes', 'trending', 'lastModified']).default('downloads'),
        limit: z.number().default(10),
      }),
      riskLevel: 'safe',
      execute: async (args, ctx) => {
        return { success: false, error: 'Hugging Face list_models not implemented yet' };
      },
    },
    {
      name: 'list_datasets',
      description: 'Search for datasets on Hugging Face Hub',
      parameters: z.object({
        search: z.string().optional().describe('Search query'),
        author: z.string().optional(),
        filter: z.string().optional().describe('Filter by tag'),
        sort: z.enum(['downloads', 'likes', 'trending', 'lastModified']).default('downloads'),
        limit: z.number().default(10),
      }),
      riskLevel: 'safe',
      execute: async (args, ctx) => {
        return { success: false, error: 'Hugging Face list_datasets not implemented yet' };
      },
    },
    {
      name: 'get_model_info',
      description: 'Get detailed information about a specific model',
      parameters: z.object({
        model: z.string().describe('Model ID, e.g. "bert-base-uncased"'),
      }),
      riskLevel: 'safe',
      execute: async (args, ctx) => {
        return { success: false, error: 'Hugging Face get_model_info not implemented yet' };
      },
    },
    {
      name: 'text_embedding',
      description: 'Generate text embeddings using a Hugging Face model',
      parameters: z.object({
        model: z.string().default('sentence-transformers/all-MiniLM-L6-v2').describe('Embedding model'),
        inputs: z.array(z.string()).describe('Texts to embed'),
      }),
      riskLevel: 'safe',
      execute: async (args, ctx) => {
        return { success: false, error: 'Hugging Face text_embedding not implemented yet' };
      },
    },
  ],
});
