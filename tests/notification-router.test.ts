import { describe, expect, it, vi } from 'vitest';
import { NotificationRouter, type SendableTextChannel } from '../src/notifications/notification-router.js';

function createMockTextChannel() {
  return {
    id: '345678901234567890',
    isTextBased: () => true,
    send: vi.fn(async (payload: unknown) => payload),
  } as SendableTextChannel & { send: ReturnType<typeof vi.fn> };
}

describe('NotificationRouter', () => {
  it('sends a placeholder notification to the configured channel', async () => {
    const channel = createMockTextChannel();
    const fetchChannel = vi.fn(async (channelId: string) => {
      expect(channelId).toBe('345678901234567890');
      return channel;
    });
    const router = new NotificationRouter({
      notificationChannelId: '345678901234567890',
      fetchChannel,
    });

    await router.sendPlaceholderNotification({
      title: 'Smoke check',
      message: 'The bot can send to Discord.',
    });

    expect(fetchChannel).toHaveBeenCalledOnce();
    expect(channel.send).toHaveBeenCalledWith({
      embeds: [
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Smoke check',
            description: 'The bot can send to Discord.',
          }),
        }),
      ],
    });
  });

  it('fails clearly if the configured channel is not text-sendable', async () => {
    const router = new NotificationRouter({
      notificationChannelId: 'bad-channel',
      fetchChannel: vi.fn(async () => null),
    });

    await expect(
      router.sendPlaceholderNotification({ title: 'Nope', message: 'Missing channel' }),
    ).rejects.toThrow(/not found or is not text-based/);
  });
});
