import { z } from 'zod';
import { defineIntegration } from '../base/define-integration.js';

export const notionIntegration = defineIntegration({
  id: 'notion',
  name: 'Notion',
  description: 'Search, read, and create pages and databases in Notion',
  icon: '📝',
  category: 'productivity',

  auth: {
    type: 'bearer',
    fields: [
      {
        key: 'token',
        label: 'Internal Integration Token',
        type: 'secret',
        required: true,
        envVar: 'NOTION_TOKEN',
        placeholder: 'secret_...',
      },
    ],
  },

  actions: [
    {
      name: 'search',
      description: 'Search pages and databases in Notion',
      parameters: z.object({
        query: z.string().describe('Search query'),
        filter: z.enum(['page', 'database']).optional(),
        pageSize: z.number().default(10),
      }),
      riskLevel: 'safe',
      execute: async (args, ctx) => {
        return { success: false, error: 'Notion search not implemented yet' };
      },
    },
    {
      name: 'get_page',
      description: 'Get a Notion page by ID',
      parameters: z.object({
        pageId: z.string().describe('Notion page ID'),
      }),
      riskLevel: 'safe',
      execute: async (args, ctx) => {
        return { success: false, error: 'Notion get_page not implemented yet' };
      },
    },
    {
      name: 'create_page',
      description: 'Create a new page in Notion',
      parameters: z.object({
        parentId: z.string().describe('Parent page or database ID'),
        title: z.string().describe('Page title'),
        content: z.string().optional().describe('Page content (markdown)'),
      }),
      riskLevel: 'moderate',
      execute: async (args, ctx) => {
        return { success: false, error: 'Notion create_page not implemented yet' };
      },
    },
    {
      name: 'query_database',
      description: 'Query a Notion database with filters',
      parameters: z.object({
        databaseId: z.string().describe('Database ID'),
        filter: z.record(z.unknown()).optional().describe('Filter object'),
        pageSize: z.number().default(20),
      }),
      riskLevel: 'safe',
      execute: async (args, ctx) => {
        return { success: false, error: 'Notion query_database not implemented yet' };
      },
    },
  ],
});
