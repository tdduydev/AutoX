import { z } from 'zod';
import { defineIntegration } from '../base/define-integration.js';

export const githubIntegration = defineIntegration({
  id: 'github',
  name: 'GitHub',
  description: 'Manage repositories, issues, pull requests, and code on GitHub',
  icon: '🐙',
  category: 'developer',

  auth: {
    type: 'bearer',
    fields: [
      {
        key: 'token',
        label: 'Personal Access Token',
        type: 'secret',
        required: true,
        envVar: 'GITHUB_TOKEN',
        placeholder: 'ghp_...',
      },
    ],
  },

  actions: [
    {
      name: 'list_repos',
      description: 'List repositories for the authenticated user',
      parameters: z.object({
        type: z.enum(['all', 'owner', 'member']).default('owner'),
        sort: z.enum(['created', 'updated', 'pushed', 'full_name']).default('updated'),
        perPage: z.number().default(10),
      }),
      riskLevel: 'safe',
      execute: async (args, ctx) => {
        return { success: false, error: 'GitHub list_repos not implemented yet' };
      },
    },
    {
      name: 'create_issue',
      description: 'Create a new issue in a GitHub repository',
      parameters: z.object({
        owner: z.string().describe('Repository owner'),
        repo: z.string().describe('Repository name'),
        title: z.string().describe('Issue title'),
        body: z.string().optional().describe('Issue body (markdown)'),
        labels: z.array(z.string()).optional(),
        assignees: z.array(z.string()).optional(),
      }),
      riskLevel: 'moderate',
      execute: async (args, ctx) => {
        return { success: false, error: 'GitHub create_issue not implemented yet' };
      },
    },
    {
      name: 'list_issues',
      description: 'List issues in a GitHub repository',
      parameters: z.object({
        owner: z.string().describe('Repository owner'),
        repo: z.string().describe('Repository name'),
        state: z.enum(['open', 'closed', 'all']).default('open'),
        labels: z.string().optional().describe('Comma-separated label names'),
        perPage: z.number().default(10),
      }),
      riskLevel: 'safe',
      execute: async (args, ctx) => {
        return { success: false, error: 'GitHub list_issues not implemented yet' };
      },
    },
    {
      name: 'create_pull_request',
      description: 'Create a pull request',
      parameters: z.object({
        owner: z.string(),
        repo: z.string(),
        title: z.string(),
        body: z.string().optional(),
        head: z.string().describe('Branch with changes'),
        base: z.string().default('main').describe('Target branch'),
      }),
      riskLevel: 'moderate',
      requiresApproval: true,
      execute: async (args, ctx) => {
        return { success: false, error: 'GitHub create_pull_request not implemented yet' };
      },
    },
    {
      name: 'get_file_contents',
      description: 'Get contents of a file from a repository',
      parameters: z.object({
        owner: z.string(),
        repo: z.string(),
        path: z.string().describe('File path in the repository'),
        ref: z.string().optional().describe('Branch, tag, or commit SHA'),
      }),
      riskLevel: 'safe',
      execute: async (args, ctx) => {
        return { success: false, error: 'GitHub get_file_contents not implemented yet' };
      },
    },
  ],

  triggers: [
    {
      name: 'push',
      description: 'Fires when code is pushed to a repository',
      eventSchema: z.object({
        ref: z.string(),
        repository: z.string(),
        pusher: z.string(),
        commits: z.array(z.object({
          message: z.string(),
          author: z.string(),
        })),
      }),
    },
    {
      name: 'issue_opened',
      description: 'Fires when a new issue is opened',
      eventSchema: z.object({
        action: z.string(),
        issueNumber: z.number(),
        title: z.string(),
        body: z.string().optional(),
        author: z.string(),
        repository: z.string(),
      }),
    },
  ],
});
