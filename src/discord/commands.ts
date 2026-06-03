import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Interaction,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import type { AppLogger } from '../logger.js';

export const statusCommand = new SlashCommandBuilder()
  .setName('status')
  .setDescription('Check whether PulseDaddy is online.');

export function listCommandDefinitions(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
  return [statusCommand.toJSON()];
}

export async function handleInteraction(interaction: Interaction, logger: AppLogger): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'status') {
    await handleStatusCommand(interaction);
    return;
  }

  logger.warn({ commandName: interaction.commandName }, 'Unknown slash command received');
}

async function handleStatusCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.reply({
    content: 'PulseDaddy is online and ready to relay future service notifications.',
    ephemeral: true,
  });
}
