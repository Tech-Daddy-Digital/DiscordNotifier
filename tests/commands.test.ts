import { describe, expect, it, vi } from 'vitest';
import {
  buildSetupResponse,
  buildStatusResponse,
  handleInteraction,
  listCommandDefinitions,
} from '../src/discord/commands.js';

describe('Discord command definitions', () => {
  it('registers status and setup slash commands', () => {
    const commands = listCommandDefinitions();

    expect(commands.map((command) => command.name)).toEqual(['status', 'setup']);
    expect(commands.find((command) => command.name === 'setup')?.description).toMatch(/configuration/i);
  });
});

describe('Discord command responses', () => {
  it('builds a status response with the configured notification channel', () => {
    expect(
      buildStatusResponse({ notificationChannelId: '345678901234567890', hasWebhookToken: true }),
    ).toContain('<#345678901234567890>');
  });

  it('builds a setup response explaining the MVP env/webhook flow', () => {
    const response = buildSetupResponse({
      notificationChannelId: '345678901234567890',
      hasWebhookToken: true,
    });

    expect(response).toContain('DISCORD_NOTIFICATION_CHANNEL_ID');
    expect(response).toContain('/notifications/mock/youtube-live');
    expect(response).toContain('Authorization: Bearer');
  });

  it('replies to the setup command ephemerally', async () => {
    const reply = vi.fn(async () => undefined);
    const interaction = {
      isChatInputCommand: () => true,
      commandName: 'setup',
      reply,
    };
    const logger = { warn: vi.fn() };

    await handleInteraction(interaction as never, logger as never, {
      notificationChannelId: '345678901234567890',
      hasWebhookToken: false,
    });

    expect(reply).toHaveBeenCalledWith({
      content: expect.stringContaining('DISCORD_NOTIFICATION_CHANNEL_ID'),
      ephemeral: true,
    });
  });
});
