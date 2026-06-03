import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { loadConfig, type AppConfig } from '../config.js';
import { createLogger, type AppLogger } from '../logger.js';
import { listCommandDefinitions } from './commands.js';

export async function registerCommands(config: AppConfig, logger: AppLogger): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(config.discord.token);
  const commands = listCommandDefinitions();

  if (config.discord.guildId) {
    await rest.put(Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId), {
      body: commands,
    });
    logger.info(
      { guildId: config.discord.guildId, commandCount: commands.length },
      'Registered guild slash commands',
    );
    return;
  }

  await rest.put(Routes.applicationCommands(config.discord.clientId), { body: commands });
  logger.info({ commandCount: commands.length }, 'Registered global slash commands');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = loadConfig();
  const logger = createLogger(config);
  await registerCommands(config, logger);
}
