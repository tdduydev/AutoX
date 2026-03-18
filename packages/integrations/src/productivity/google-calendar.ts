import { z } from 'zod';
import { defineIntegration } from '../base/define-integration.js';

export const googleCalendarIntegration = defineIntegration({
  id: 'google-calendar',
  name: 'Google Calendar',
  description: 'Create, read, and manage calendar events',
  icon: '📅',
  category: 'productivity',

  auth: {
    type: 'oauth2',
    config: {
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
      ],
      clientIdEnv: 'GOOGLE_CLIENT_ID',
      clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
      refreshable: true,
    },
  },

  actions: [
    {
      name: 'list_events',
      description: 'List upcoming calendar events',
      parameters: z.object({
        maxResults: z.number().default(10),
        timeMin: z.string().optional().describe('Start time (ISO 8601)'),
        timeMax: z.string().optional().describe('End time (ISO 8601)'),
        calendarId: z.string().default('primary'),
      }),
      riskLevel: 'safe',
      execute: async (args, ctx) => {
        return { success: false, error: 'Google Calendar list_events not implemented yet' };
      },
    },
    {
      name: 'create_event',
      description: 'Create a new calendar event',
      parameters: z.object({
        summary: z.string().describe('Event title'),
        description: z.string().optional().describe('Event description'),
        start: z.string().describe('Start time (ISO 8601)'),
        end: z.string().describe('End time (ISO 8601)'),
        location: z.string().optional(),
        attendees: z.array(z.string().email()).optional(),
        calendarId: z.string().default('primary'),
      }),
      riskLevel: 'moderate',
      requiresApproval: true,
      execute: async (args, ctx) => {
        return { success: false, error: 'Google Calendar create_event not implemented yet' };
      },
    },
    {
      name: 'delete_event',
      description: 'Delete a calendar event',
      parameters: z.object({
        eventId: z.string().describe('Event ID to delete'),
        calendarId: z.string().default('primary'),
      }),
      riskLevel: 'dangerous',
      requiresApproval: true,
      execute: async (args, ctx) => {
        return { success: false, error: 'Google Calendar delete_event not implemented yet' };
      },
    },
  ],

  triggers: [
    {
      name: 'event_starting_soon',
      description: 'Fires when a calendar event is starting soon (default: 15 min)',
      eventSchema: z.object({
        eventId: z.string(),
        summary: z.string(),
        start: z.string(),
        minutesUntilStart: z.number(),
      }),
      pollInterval: 60_000,
      poll: async (lastPollTime, credentials) => {
        return [];
      },
    },
  ],
});
