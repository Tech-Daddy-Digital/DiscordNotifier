import { z } from 'zod';

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID is required'),
  DISCORD_CLIENT_SECRET: z.string().min(1).optional(),
  DISCORD_GUILD_ID: z.string().min(1).optional(),
  DISCORD_NOTIFICATION_CHANNEL_ID: z
    .string()
    .min(1, 'DISCORD_NOTIFICATION_CHANNEL_ID is required'),
  HTTP_HOST: z.string().default('0.0.0.0'),
  HTTP_PORT: z.coerce.number().int().positive().default(3000),
  WEB_BASE_URL: z.string().url().default('http://localhost:3000'),
  SESSION_SECRET: z.string().min(32).default('development-session-secret-change-me-please'),
  DATABASE_PATH: z.string().min(1).default('./data/pulsedaddy.sqlite'),
  NOTIFICATION_WEBHOOK_TOKEN: z.string().min(1).optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  SEND_STARTUP_PLACEHOLDER_NOTIFICATION: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

export type AppConfig = {
  discord: {
    token: string;
    clientId: string;
    clientSecret?: string;
    guildId?: string;
    notificationChannelId: string;
  };
  http: {
    host: string;
    port: number;
    webBaseUrl: string;
    sessionSecret: string;
  };
  databasePath: string;
  notificationWebhookToken?: string;
  logLevel: z.infer<typeof envSchema>['LOG_LEVEL'];
  sendStartupPlaceholderNotification: boolean;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const messages = parsed.error.issues.map((issue) => {
      const key = issue.path.join('.') || 'environment';
      return `${key}: ${issue.message}`;
    });
    throw new Error(`Invalid configuration:\n${messages.join('\n')}`);
  }

  const discord: AppConfig['discord'] = {
    token: parsed.data.DISCORD_TOKEN,
    clientId: parsed.data.DISCORD_CLIENT_ID,
    notificationChannelId: parsed.data.DISCORD_NOTIFICATION_CHANNEL_ID,
  };
  if (parsed.data.DISCORD_CLIENT_SECRET) discord.clientSecret = parsed.data.DISCORD_CLIENT_SECRET;
  if (parsed.data.DISCORD_GUILD_ID) discord.guildId = parsed.data.DISCORD_GUILD_ID;

  const config: AppConfig = {
    discord,
    http: {
      host: parsed.data.HTTP_HOST,
      port: parsed.data.HTTP_PORT,
      webBaseUrl: parsed.data.WEB_BASE_URL.replace(/\/$/, ''),
      sessionSecret: parsed.data.SESSION_SECRET,
    },
    databasePath: parsed.data.DATABASE_PATH,
    logLevel: parsed.data.LOG_LEVEL,
    sendStartupPlaceholderNotification: parsed.data.SEND_STARTUP_PLACEHOLDER_NOTIFICATION,
  };
  if (parsed.data.NOTIFICATION_WEBHOOK_TOKEN) {
    config.notificationWebhookToken = parsed.data.NOTIFICATION_WEBHOOK_TOKEN;
  }
  return config;
}
