import { z } from 'zod';
import { defineIntegration } from '../base/define-integration.js';

export const slackApiIntegration = defineIntegration({
  id: 'slack-api',
  name: 'Slack',
  description: 'Send messages, manage channels, and interact with Slack workspaces',
  icon: '💼',
  category: 'messaging',

  auth: {
    type: 'oauth2',
    config: {
      authorizationUrl: 'https://slack.com/oauth/v2/authorize',
      tokenUrl: 'https://slack.com/api/oauth.v2.access',
      scopes: [
        'chat:write',
        'channels:read',
        'channels:history',
        'users:read',
        'files:write',
      ],
      clientIdEnv: 'SLACK_CLIENT_ID',
      clientSecretEnv: 'SLACK_CLIENT_SECRET',
      refreshable: true,
    },
  },

  actions: [
    {
      name: 'send_message',
      description: 'Send a message to a Slack channel',
      parameters: z.object({
        channel: z.string().describe('Channel ID or name (e.g., #general)'),
        text: z.string().describe('Message text'),
        threadTs: z.string().optional().describe('Thread timestamp for replies'),
      }),
      riskLevel: 'moderate',
      execute: async (args, ctx) => {
        return { success: false, error: 'Slack send_message not implemented yet' };
      },
    },
    {
      name: 'list_channels',
      description: 'List channels in the Slack workspace',
      parameters: z.object({
        limit: z.number().default(20),
        types: z.string().default('public_channel').describe('Channel types to include'),
      }),
      riskLevel: 'safe',
      execute: async (args, ctx) => {
        return { success: false, error: 'Slack list_channels not implemented yet' };
      },
    },
    {
      name: 'read_messages',
      description: 'Read recent messages from a Slack channel',
      parameters: z.object({
        channel: z.string().describe('Channel ID'),
        limit: z.number().default(20),
      }),
      riskLevel: 'safe',
      execute: async (args, ctx) => {
        return { success: false, error: 'Slack read_messages not implemented yet' };
      },
    },
    {
      name: 'upload_file',
      description: 'Upload a file to a Slack channel',
      parameters: z.object({
        channels: z.string().describe('Channel ID to share file in'),
        filename: z.string(),
        content: z.string().describe('File content as text'),
        title: z.string().optional(),
      }),
      riskLevel: 'moderate',
      execute: async (args, ctx) => {
        return { success: false, error: 'Slack upload_file not implemented yet' };
      },
    },
  ],

  triggers: [
    {
      name: 'new_message',
      description: 'Fires when a new message is posted in a channel',
      eventSchema: z.object({
        channel: z.string(),
        user: z.string(),
        text: z.string(),
        ts: z.string(),
        threadTs: z.string().optional(),
      }),
    },
  ],
});
