import { z } from 'zod';
import { defineIntegration } from '../base/define-integration.js';

export const braveSearchIntegration = defineIntegration({
  id: 'brave-search',
  name: 'Brave Search',
  description: 'Search the web using Brave Search API',
  icon: '🔍',
  category: 'search',

  auth: {
    type: 'api-key',
    fields: [
      {
        key: 'apiKey',
        label: 'Brave Search API Key',
        type: 'secret',
        required: true,
        envVar: 'BRAVE_SEARCH_API_KEY',
      },
    ],
  },

  actions: [
    {
      name: 'web_search',
      description: 'Search the web using Brave Search',
      parameters: z.object({
        query: z.string().describe('Search query'),
        count: z.number().default(5).describe('Number of results'),
        freshness: z.enum(['pd', 'pw', 'pm', 'py']).optional().describe('pd=past day, pw=past week, pm=past month'),
      }),
      riskLevel: 'safe',
      execute: async (args, ctx) => {
        return { success: false, error: 'Brave Search web_search not implemented yet' };
      },
    },
    {
      name: 'news_search',
      description: 'Search news articles using Brave Search',
      parameters: z.object({
        query: z.string().describe('News search query'),
        count: z.number().default(5),
        freshness: z.enum(['pd', 'pw', 'pm']).optional(),
      }),
      riskLevel: 'safe',
      execute: async (args, ctx) => {
        return { success: false, error: 'Brave Search news_search not implemented yet' };
      },
    },
  ],
});
