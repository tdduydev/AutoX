import type { ChannelPlugin, IncomingMessage, OutgoingMessage } from '@xclaw-ai/shared';
import { TelegramApi } from './telegram-api.js';
import type { TelegramUpdate, TelegramMessage } from './telegram-api.js';

export interface TelegramChannelConfig {
  botToken: string;
  /** Bot username (without @), auto-detected from getMe */
  botUsername?: string;
  /** Polling interval in ms when no updates (default: 1000) */
  pollInterval?: number;
}

export class TelegramChannel implements ChannelPlugin {
  readonly id = 'telegram-channel';
  readonly platform = 'telegram' as const;
  readonly name = 'Telegram Channel';
  readonly version = '2.0.0';

  private api!: TelegramApi;
  private config!: TelegramChannelConfig;
  private messageHandler?: (message: IncomingMessage) => Promise<void>;
  private running = false;
  private offset = 0;
  private pollTimer?: ReturnType<typeof setTimeout>;

  async initialize(config: Record<string, unknown>): Promise<void> {
    const botToken = config.botToken as string;
    if (!botToken) {
      throw new Error('TelegramChannel: botToken is required');
    }

    this.api = new TelegramApi(botToken);

    // Verify bot token & get bot username
    const me = await this.api.getMe();
    this.config = {
      botToken,
      botUsername: me.username,
      pollInterval: (config.pollInterval as number) || 1000,
    };
    console.log(`   Telegram:  connected as @${me.username} (${me.first_name})`);
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    console.log('   Telegram:  polling started');
    this.poll();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
    }
    console.log('   Telegram:  polling stopped');
  }

  async send(message: OutgoingMessage): Promise<void> {
    const chatId = message.channelId;
    const replyToId = message.replyTo ? parseInt(message.replyTo, 10) : undefined;

    // Split long messages (Telegram limit: 4096 chars)
    const chunks = this.splitMessage(message.content, 4096);
    for (const chunk of chunks) {
      await this.api.sendMessage(chatId, chunk, {
        replyToMessageId: replyToId,
      });
    }
  }

  onMessage(handler: (message: IncomingMessage) => Promise<void>): void {
    this.messageHandler = handler;
  }

  /** Get the underlying API for direct calls */
  getApi(): TelegramApi {
    return this.api;
  }

  // ─── Private ────────────────────────────────────────────

  private poll(): void {
    if (!this.running) return;

    this.api.getUpdates(this.offset, 30)
      .then((updates) => this.handleUpdates(updates))
      .catch((err) => {
        console.error('Telegram polling error:', err instanceof Error ? err.message : err);
      })
      .finally(() => {
        if (this.running) {
          this.pollTimer = setTimeout(() => this.poll(), this.config.pollInterval || 1000);
        }
      });
  }

  private async handleUpdates(updates: TelegramUpdate[]): Promise<void> {
    for (const update of updates) {
      this.offset = update.update_id + 1;

      const msg = update.message;
      if (!msg || !msg.text || msg.from?.is_bot) continue;

      // In groups: only respond when mentioned or replied to the bot
      if (msg.chat.type !== 'private' && !this.isBotAddressed(msg)) continue;

      // Strip bot mention from the message text for cleaner processing
      const cleanText = this.stripBotMention(msg.text);
      if (!cleanText.trim()) continue;

      // Convert to IncomingMessage
      const incoming: IncomingMessage = {
        platform: 'telegram',
        channelId: String(msg.chat.id),
        userId: String(msg.from?.id || 0),
        content: cleanText,
        timestamp: new Date(msg.date * 1000).toISOString(),
        replyTo: msg.reply_to_message ? String(msg.reply_to_message.message_id) : undefined,
        metadata: {
          messageId: msg.message_id,
          chatType: msg.chat.type,
          chatTitle: msg.chat.title,
          username: msg.from?.username,
          firstName: msg.from?.first_name,
          lastName: msg.from?.last_name,
        },
      };

      // Show typing indicator
      this.api.sendChatAction(msg.chat.id, 'typing').catch(() => {});

      // Process message
      if (this.messageHandler) {
        try {
          await this.messageHandler(incoming);
        } catch (err) {
          console.error('Telegram message handler error:', err instanceof Error ? err.message : err);
          // Send error feedback to user
          await this.api.sendMessage(msg.chat.id, '❌ Xin lỗi, có lỗi xảy ra khi xử lý tin nhắn.', {
            replyToMessageId: msg.message_id,
          }).catch(() => {});
        }
      }
    }
  }

  /** Check if the message is directed at the bot (mention, reply, or command) */
  private isBotAddressed(msg: TelegramMessage): boolean {
    // Reply to a bot message
    if (msg.reply_to_message?.from?.is_bot && msg.reply_to_message.from.username === this.config.botUsername) {
      return true;
    }
    // @mention the bot
    if (msg.entities?.some((e) =>
      e.type === 'mention' && msg.text?.substring(e.offset, e.offset + e.length).toLowerCase() === `@${this.config.botUsername?.toLowerCase()}`
    )) {
      return true;
    }
    // Bot command (e.g. /ask@xdev_xclaw_ai_bot)
    if (msg.entities?.some((e) => e.type === 'bot_command')) {
      return true;
    }
    return false;
  }

  /** Remove @bot_username from message text */
  private stripBotMention(text: string): string {
    if (!this.config.botUsername) return text;
    return text.replace(new RegExp(`@${this.config.botUsername}`, 'gi'), '').trim();
  }

  private splitMessage(text: string, maxLen: number): string[] {
    if (text.length <= maxLen) return [text];
    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
      if (remaining.length <= maxLen) {
        chunks.push(remaining);
        break;
      }
      // Try to split at newline
      let splitIdx = remaining.lastIndexOf('\n', maxLen);
      if (splitIdx <= 0) splitIdx = maxLen;
      chunks.push(remaining.slice(0, splitIdx));
      remaining = remaining.slice(splitIdx).replace(/^\n/, '');
    }
    return chunks;
  }
}
