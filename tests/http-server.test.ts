import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config.js';
import { createLogger } from '../src/logger.js';
import { createHttpServer } from '../src/http-server.js';
import type { NotificationRouter } from '../src/notifications/notification-router.js';

describe('createHttpServer', () => {
  it('requires bearer auth for placeholder notifications when a webhook token is configured', async () => {
    const config = loadConfig({
      DISCORD_TOKEN: 'test-token',
      DISCORD_CLIENT_ID: '123456789012345678',
      DISCORD_NOTIFICATION_CHANNEL_ID: '345678901234567890',
      NOTIFICATION_WEBHOOK_TOKEN: 'secret',
    });
    const notificationRouter = {
      sendPlaceholderNotification: vi.fn(),
    } as unknown as NotificationRouter;
    const app = await createHttpServer({
      config,
      logger: createLogger({ logLevel: 'silent' }),
      notificationRouter,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/notifications/placeholder',
      payload: { title: 'Nope', message: 'No auth' },
    });

    expect(response.statusCode).toBe(401);
    expect(notificationRouter.sendPlaceholderNotification).not.toHaveBeenCalled();
    await app.close();
  });

  it('accepts placeholder notifications with valid bearer auth', async () => {
    const config = loadConfig({
      DISCORD_TOKEN: 'test-token',
      DISCORD_CLIENT_ID: '123456789012345678',
      DISCORD_NOTIFICATION_CHANNEL_ID: '345678901234567890',
      NOTIFICATION_WEBHOOK_TOKEN: 'secret',
    });
    const notificationRouter = {
      sendPlaceholderNotification: vi.fn(async () => undefined),
    } as unknown as NotificationRouter;
    const app = await createHttpServer({
      config,
      logger: createLogger({ logLevel: 'silent' }),
      notificationRouter,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/notifications/placeholder',
      headers: { authorization: 'Bearer secret' },
      payload: { title: 'Hello', message: 'World' },
    });

    expect(response.statusCode).toBe(202);
    expect(notificationRouter.sendPlaceholderNotification).toHaveBeenCalledWith({
      title: 'Hello',
      message: 'World',
    });
    await app.close();
  });
});
