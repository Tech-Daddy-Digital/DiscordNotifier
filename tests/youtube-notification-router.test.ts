import { describe, expect, it, vi } from 'vitest';
import { NotificationRouter, type SendableTextChannel } from '../src/notifications/notification-router.js';

function createMockTextChannel() {
  return {
    id: '345678901234567890',
    isTextBased: () => true,
    send: vi.fn(async (payload: unknown) => payload),
  } as SendableTextChannel & { send: ReturnType<typeof vi.fn> };
}

describe('NotificationRouter mock YouTube livestream notifications', () => {
  it('formats a Discord message for a YouTube now-live event', async () => {
    const channel = createMockTextChannel();
    const router = new NotificationRouter({
      notificationChannelId: '345678901234567890',
      fetchChannel: vi.fn(async () => channel),
    });

    await router.sendMockYouTubeLiveNotification({
      channelName: 'Tech Daddy Digital',
      videoTitle: 'Friday Homelab Stream',
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      startedAt: new Date('2026-06-03T06:32:00.000Z'),
      pingRoleId: '456789012345678901',
    });

    expect(channel.send).toHaveBeenCalledWith({
      content: '<@&456789012345678901>',
      embeds: [
        expect.objectContaining({
          data: expect.objectContaining({
            title: '🔴 Tech Daddy Digital is live on YouTube',
            description: 'Friday Homelab Stream',
            url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            fields: expect.arrayContaining([
              expect.objectContaining({ name: 'Event', value: 'Stream started' }),
            ]),
          }),
        }),
      ],
    });
  });
});
