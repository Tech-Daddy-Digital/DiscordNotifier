import helmet from '@fastify/helmet';
import Fastify from 'fastify';
import { z } from 'zod';
import type { AppConfig } from './config.js';
import type { AppLogger } from './logger.js';
import type { NotificationRouter } from './notifications/notification-router.js';

const placeholderNotificationBodySchema = z.object({
  title: z.string().min(1).max(256),
  message: z.string().min(1).max(4096),
});

export type HttpServerOptions = {
  config: AppConfig;
  logger: AppLogger;
  notificationRouter: NotificationRouter;
};

export async function createHttpServer(options: HttpServerOptions) {
  const app = Fastify({ loggerInstance: options.logger });
  await app.register(helmet);

  app.get('/health', async () => ({
    ok: true,
    service: 'PulseDaddy Discord notification bot',
  }));

  app.post('/notifications/placeholder', async (request, reply) => {
    if (options.config.notificationWebhookToken) {
      const expected = `Bearer ${options.config.notificationWebhookToken}`;
      if (request.headers.authorization !== expected) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }
    }

    const notification = placeholderNotificationBodySchema.parse(request.body);
    await options.notificationRouter.sendPlaceholderNotification(notification);
    return reply.code(202).send({ accepted: true });
  });

  return app;
}
