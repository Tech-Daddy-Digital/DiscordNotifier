import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config.js';
import { createLogger } from '../src/logger.js';
import { createHttpServer } from '../src/http-server.js';
import type { NotificationRouter } from '../src/notifications/notification-router.js';

describe('mock YouTube livestream notification endpoint', () => {
  it('accepts and forwards a representative YouTube livestream payload', async () => {
    const config = loadConfig({
      DISCORD_TOKEN: 'test-token',
      DISCORD_CLIENT_ID: '123456789012345678',
      DISCORD_NOTIFICATION_CHANNEL_ID: '345678901234567890',
      NOTIFICATION_WEBHOOK_TOKEN: 'secret',
    });
    const notificationRouter = {
      sendMockYouTubeLiveNotification: vi.fn(async () => undefined),
    } as unknown as NotificationRouter;
    const app = await createHttpServer({
      config,
      logger: createLogger({ logLevel: 'silent' }),
      notificationRouter,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/notifications/mock/youtube-live',
      headers: { authorization: 'Bearer secret' },
      payload: {
        channelName: 'Tech Daddy Digital',
        videoTitle: 'Friday Homelab Stream',
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        startedAt: '2026-06-03T06:32:00.000Z',
        pingRoleId: '456789012345678901',
      },
    });

    expect(response.statusCode).toBe(202);
    expect(notificationRouter.sendMockYouTubeLiveNotification).toHaveBeenCalledWith({
      channelName: 'Tech Daddy Digital',
      videoTitle: 'Friday Homelab Stream',
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      startedAt: new Date('2026-06-03T06:32:00.000Z'),
      pingRoleId: '456789012345678901',
    });
    await app.close();
  });

  it('returns a 400 response for malformed YouTube livestream payloads', async () => {
    const config = loadConfig({
      DISCORD_TOKEN: 'test-token',
      DISCORD_CLIENT_ID: '123456789012345678',
      DISCORD_NOTIFICATION_CHANNEL_ID: '345678901234567890',
      NOTIFICATION_WEBHOOK_TOKEN: 'secret',
    });
    const notificationRouter = {
      sendMockYouTubeLiveNotification: vi.fn(),
    } as unknown as NotificationRouter;
    const app = await createHttpServer({
      config,
      logger: createLogger({ logLevel: 'silent' }),
      notificationRouter,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/notifications/mock/youtube-live',
      headers: { authorization: 'Bearer secret' },
      payload: {
        channelName: 'Tech Daddy Digital',
        videoTitle: 'Malformed livestream payload',
        videoUrl: 'not-a-url',
        startedAt: '2026-06-03T06:32:00.000Z',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: 'Invalid request body',
      issues: [{ path: 'videoUrl', message: 'Invalid URL' }],
    });
    expect(notificationRouter.sendMockYouTubeLiveNotification).not.toHaveBeenCalled();
    await app.close();
  });
});
