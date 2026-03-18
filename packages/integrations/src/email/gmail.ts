import { z } from 'zod';
import { defineIntegration } from '../base/define-integration.js';

export const gmailIntegration = defineIntegration({
  id: 'gmail',
  name: 'Gmail',
  description: 'Read, send, and manage emails with Gmail',
  icon: '📧',
  category: 'email',

  auth: {
    type: 'oauth2',
    config: {
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
      ],
      clientIdEnv: 'GOOGLE_CLIENT_ID',
      clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
      refreshable: true,
    },
  },

  actions: [
    {
      name: 'send_email',
      description: 'Send an email via Gmail',
      parameters: z.object({
        to: z.string().email().describe('Recipient email address'),
        subject: z.string().describe('Email subject'),
        body: z.string().describe('Email body (HTML or plain text)'),
        cc: z.array(z.string().email()).optional().describe('CC recipients'),
        bcc: z.array(z.string().email()).optional().describe('BCC recipients'),
      }),
      riskLevel: 'moderate',
      requiresApproval: true,
      execute: async (args, ctx) => {
        // TODO: Implement Gmail API send
        return { success: false, error: 'Gmail send_email not implemented yet' };
      },
    },
    {
      name: 'read_emails',
      description: 'Read recent emails from Gmail inbox',
      parameters: z.object({
        query: z.string().optional().describe('Gmail search query (e.g., "from:boss is:unread")'),
        maxResults: z.number().default(10).describe('Maximum number of emails to return'),
      }),
      riskLevel: 'safe',
      execute: async (args, ctx) => {
        // TODO: Implement Gmail API read
        return { success: false, error: 'Gmail read_emails not implemented yet' };
      },
    },
    {
      name: 'create_draft',
      description: 'Create a draft email in Gmail',
      parameters: z.object({
        to: z.string().email().describe('Recipient email'),
        subject: z.string().describe('Email subject'),
        body: z.string().describe('Email body'),
      }),
      riskLevel: 'safe',
      execute: async (args, ctx) => {
        return { success: false, error: 'Gmail create_draft not implemented yet' };
      },
    },
  ],

  triggers: [
    {
      name: 'new_email',
      description: 'Fires when a new email arrives in the inbox',
      eventSchema: z.object({
        messageId: z.string(),
        from: z.string(),
        subject: z.string(),
        snippet: z.string(),
        receivedAt: z.string(),
      }),
      pollInterval: 30_000,
      poll: async (lastPollTime, credentials) => {
        // TODO: Implement Gmail polling
        return [];
      },
    },
  ],
});
