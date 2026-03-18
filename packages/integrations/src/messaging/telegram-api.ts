import { z } from 'zod';
import { defineIntegration } from '../base/define-integration.js';

export const telegramApiIntegration = defineIntegration({
  id: 'telegram-api',
  name: 'Telegram API',
  description: 'Send messages, manage groups and channels via Telegram Bot API',
  icon: '✈️',
  category: 'messaging',

  auth: {
    type: 'api-key',
    fields: [
      {
        key: 'botToken',
        label: 'Bot Token',
        type: 'secret',
        required: true,
        envVar: 'TELEGRAM_BOT_TOKEN',
        placeholder: '123456:ABC-DEF...',
      },
    ],
  },

  actions: [
    {
      name: 'send_message',
      description: 'Send a text message to a Telegram chat',
      parameters: z.object({
        chatId: z.string().describe('Chat ID or @username'),
        text: z.string().describe('Message text (supports Markdown)'),
        parseMode: z.enum(['Markdown', 'MarkdownV2', 'HTML']).default('MarkdownV2'),
        disableNotification: z.boolean().optional(),
      }),
      riskLevel: 'moderate',
      execute: async (args, ctx) => {
        return { success: false, error: 'Telegram send_message not implemented yet' };
      },
    },
    {
      name: 'send_photo',
      description: 'Send a photo to a Telegram chat',
      parameters: z.object({
        chatId: z.string(),
        photoUrl: z.string().url().describe('Photo URL'),
        caption: z.string().optional(),
      }),
      riskLevel: 'moderate',
      execute: async (args, ctx) => {
        return { success: false, error: 'Telegram send_photo not implemented yet' };
      },
    },
    {
      name: 'send_document',
      description: 'Send a document/file to a Telegram chat',
      parameters: z.object({
        chatId: z.string(),
        documentUrl: z.string().url().describe('Document URL'),
        caption: z.string().optional(),
      }),
      riskLevel: 'moderate',
      execute: async (args, ctx) => {
        return { success: false, error: 'Telegram send_document not implemented yet' };
      },
    },
    {
      name: 'get_chat_info',
      description: 'Get information about a Telegram chat',
      parameters: z.object({
        chatId: z.string().describe('Chat ID or @username'),
      }),
      riskLevel: 'safe',
      execute: async (args, ctx) => {
        return { success: false, error: 'Telegram get_chat_info not implemented yet' };
      },
    },
  ],

  triggers: [
    {
      name: 'new_message',
      description: 'Fires when a new message is received in bot chat',
      eventSchema: z.object({
        messageId: z.number(),
        chatId: z.number(),
        from: z.object({
          id: z.number(),
          username: z.string().optional(),
          firstName: z.string(),
        }),
        text: z.string(),
        date: z.number(),
      }),
    },
  ],
});
