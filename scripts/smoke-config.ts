import { loadConfig } from '../src/config.js';

const config = loadConfig();
console.log(
  JSON.stringify(
    {
      discordClientId: config.discord.clientId,
      discordGuildConfigured: Boolean(config.discord.guildId),
      notificationChannelId: config.discord.notificationChannelId,
      http: config.http,
      logLevel: config.logLevel,
      webhookAuthConfigured: Boolean(config.notificationWebhookToken),
      startupPlaceholderEnabled: config.sendStartupPlaceholderNotification,
    },
    null,
    2,
  ),
);
