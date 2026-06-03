import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Interaction,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import type { AppLogger } from '../logger.js';

export type CommandRuntimeConfig = {
  notificationChannelId: string;
  hasWebhookToken: boolean;
};

export const statusCommand = new SlashCommandBuilder()
  .setName('status')
  .setDescription('Check whether PulseDaddy is online.');

export const setupCommand = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Show the MVP Discord notification configuration flow.');

export function listCommandDefinitions(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
  return [statusCommand.toJSON(), setupCommand.toJSON()];
}

export function buildStatusResponse(runtimeConfig?: CommandRuntimeConfig): string {
  if (!runtimeConfig) {
    return 'PulseDaddy is online and ready to relay future service notifications.';
  }

  const webhookStatus = runtimeConfig.hasWebhookToken
    ? 'The mock notification webhook is protected with bearer-token auth.'
    : 'The mock notification webhook is currently open; set NOTIFICATION_WEBHOOK_TOKEN before exposing it publicly.';

  return [
    'PulseDaddy is online and ready to relay notifications.',
    `Default notification channel: <#${runtimeConfig.notificationChannelId}>.`,
    webhookStatus,
  ].join('\n');
}

export function buildSetupResponse(runtimeConfig: CommandRuntimeConfig): string {
  const authHint = runtimeConfig.hasWebhookToken
    ? 'Include `Authorization: Bearer $NOTIFICATION_WEBHOOK_TOKEN` when calling the webhook.'
    : 'Set `NOTIFICATION_WEBHOOK_TOKEN` before exposing the webhook outside your LAN/VPS.';

  return [
    'PulseDaddy MVP setup is environment-driven:',
    '1. Set `DISCORD_NOTIFICATION_CHANNEL_ID` to the Discord channel that should receive alerts.',
    '2. Register commands with `npm run discord:register` or restart the Docker container.',
    '3. Send a representative YouTube livestream notification to `POST /notifications/mock/youtube-live`.',
    `Current notification channel: <#${runtimeConfig.notificationChannelId}>.`,
    authHint,
  ].join('\n');
}

export async function handleInteraction(
  interaction: Interaction,
  logger: AppLogger,
  runtimeConfig?: CommandRuntimeConfig,
): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'status') {
    await handleStatusCommand(interaction, runtimeConfig);
    return;
  }

  if (interaction.commandName === 'setup') {
    if (!runtimeConfig) {
      logger.warn('Setup command received before runtime configuration was attached');
      await interaction.reply({
        content: 'PulseDaddy is online, but setup details are unavailable in this runtime.',
        ephemeral: true,
      });
      return;
    }
    await handleSetupCommand(interaction, runtimeConfig);
    return;
  }

  logger.warn({ commandName: interaction.commandName }, 'Unknown slash command received');
}

async function handleStatusCommand(
  interaction: ChatInputCommandInteraction,
  runtimeConfig?: CommandRuntimeConfig,
): Promise<void> {
  await interaction.reply({
    content: buildStatusResponse(runtimeConfig),
    ephemeral: true,
  });
}

async function handleSetupCommand(
  interaction: ChatInputCommandInteraction,
  runtimeConfig: CommandRuntimeConfig,
): Promise<void> {
  await interaction.reply({
    content: buildSetupResponse(runtimeConfig),
    ephemeral: true,
  });
}
