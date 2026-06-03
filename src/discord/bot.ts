import { Client, Events, GatewayIntentBits } from 'discord.js';
import type { AppConfig } from '../config.js';
import type { AppLogger } from '../logger.js';
import { handleInteraction } from './commands.js';
import { NotificationRouter } from '../notifications/notification-router.js';

export type BotRuntime = {
  client: Client;
  notificationRouter: NotificationRouter;
};

export function createBot(config: AppConfig, logger: AppLogger): BotRuntime {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  const notificationRouter = NotificationRouter.fromClient(
    client,
    config.discord.notificationChannelId,
  );

  client.once(Events.ClientReady, async (readyClient) => {
    logger.info({ userTag: readyClient.user.tag }, 'Discord bot connected');

    if (config.sendStartupPlaceholderNotification) {
      try {
        await notificationRouter.sendPlaceholderNotification({
          title: 'PulseDaddy startup check',
          message: 'The Discord notification bot connected successfully.',
        });
      } catch (error) {
        logger.error({ error }, 'Failed to send startup placeholder notification');
      }
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      await handleInteraction(interaction, logger, {
        notificationChannelId: config.discord.notificationChannelId,
        hasWebhookToken: Boolean(config.notificationWebhookToken),
      });
    } catch (error) {
      logger.error({ error }, 'Failed to handle Discord interaction');
    }
  });

  return { client, notificationRouter };
}
