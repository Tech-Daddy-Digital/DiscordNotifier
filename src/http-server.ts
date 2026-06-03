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

const mockYouTubeLiveNotificationBodySchema = z.object({
  channelName: z.string().min(1).max(256),
  videoTitle: z.string().min(1).max(512),
  videoUrl: z.string().url(),
  startedAt: z.coerce.date(),
  pingRoleId: z.string().regex(/^\d{10,30}$/).optional(),
});

export type HttpServerOptions = {
  config: AppConfig;
  logger: AppLogger;
  notificationRouter: NotificationRouter;
};

export async function createHttpServer(options: HttpServerOptions) {
  const app = Fastify({ loggerInstance: options.logger });
  await app.register(helmet);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        error: 'Invalid request body',
        issues: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    options.logger.error({ error }, 'Unhandled HTTP request error');
    return reply.send(error);
  });

  app.get('/health', async () => ({
    ok: true,
    service: 'PulseDaddy Discord notification bot',
  }));

  app.post('/notifications/placeholder', async (request, reply) => {
    const authFailure = authorizeWebhookRequest(options.config, request.headers.authorization);
    if (authFailure) return reply.code(401).send(authFailure);

    const notification = placeholderNotificationBodySchema.parse(request.body);
    await options.notificationRouter.sendPlaceholderNotification(notification);
    return reply.code(202).send({ accepted: true });
  });

  app.post('/notifications/mock/youtube-live', async (request, reply) => {
    const authFailure = authorizeWebhookRequest(options.config, request.headers.authorization);
    if (authFailure) return reply.code(401).send(authFailure);

    const notification = mockYouTubeLiveNotificationBodySchema.parse(request.body);
    await options.notificationRouter.sendMockYouTubeLiveNotification(notification);
    return reply.code(202).send({ accepted: true });
  });

  return app;
}

function authorizeWebhookRequest(config: AppConfig, authorizationHeader?: string) {
  if (!config.notificationWebhookToken) return null;

  const expected = `Bearer ${config.notificationWebhookToken}`;
  if (authorizationHeader !== expected) {
    return { error: 'Unauthorized' };
  }

  return null;
}
