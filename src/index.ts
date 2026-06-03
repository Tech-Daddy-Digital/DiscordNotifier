import 'dotenv/config';
import { loadConfig } from './config.js';
import { createBot } from './discord/bot.js';
import { registerCommands } from './discord/register-commands.js';
import { createHttpServer } from './http-server.js';
import { createLogger } from './logger.js';

const config = loadConfig();
const logger = createLogger(config);
const bot = createBot(config, logger);
const httpServer = await createHttpServer({
  config,
  logger,
  notificationRouter: bot.notificationRouter,
});

await registerCommands(config, logger);
await httpServer.listen({ host: config.http.host, port: config.http.port });
logger.info({ host: config.http.host, port: config.http.port }, 'HTTP server listening');

await bot.client.login(config.discord.token);

const shutdown = async (signal: NodeJS.Signals) => {
  logger.info({ signal }, 'Shutting down');
  await httpServer.close();
  bot.client.destroy();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
