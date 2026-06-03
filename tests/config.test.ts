import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('parses required Discord and HTTP settings from an environment object', () => {
    const config = loadConfig({
      DISCORD_TOKEN: 'test-token',
      DISCORD_CLIENT_ID: '123456789012345678',
      DISCORD_GUILD_ID: '234567890123456789',
      DISCORD_NOTIFICATION_CHANNEL_ID: '345678901234567890',
      HTTP_HOST: '127.0.0.1',
      HTTP_PORT: '3001',
      LOG_LEVEL: 'debug',
      NOTIFICATION_WEBHOOK_TOKEN: 'secret',
      SEND_STARTUP_PLACEHOLDER_NOTIFICATION: 'true',
    });

    expect(config.discord.token).toBe('test-token');
    expect(config.discord.clientId).toBe('123456789012345678');
    expect(config.discord.guildId).toBe('234567890123456789');
    expect(config.discord.notificationChannelId).toBe('345678901234567890');
    expect(config.http).toMatchObject({ host: '127.0.0.1', port: 3001, webBaseUrl: 'http://localhost:3000' });
    expect(config.databasePath).toBe('./data/pulsedaddy.sqlite');
    expect(config.logLevel).toBe('debug');
    expect(config.notificationWebhookToken).toBe('secret');
    expect(config.sendStartupPlaceholderNotification).toBe(true);
  });

  it('uses safe local defaults for non-secret settings', () => {
    const config = loadConfig({
      DISCORD_TOKEN: 'test-token',
      DISCORD_CLIENT_ID: '123456789012345678',
      DISCORD_NOTIFICATION_CHANNEL_ID: '345678901234567890',
    });

    expect(config.discord.guildId).toBeUndefined();
    expect(config.http).toMatchObject({ host: '0.0.0.0', port: 3000, webBaseUrl: 'http://localhost:3000' });
    expect(config.http.sessionSecret).toHaveLength(43);
    expect(config.databasePath).toBe('./data/pulsedaddy.sqlite');
    expect(config.logLevel).toBe('info');
    expect(config.notificationWebhookToken).toBeUndefined();
  });

  it('throws a readable error when required secrets or IDs are missing', () => {
    expect(() => loadConfig({})).toThrow(/DISCORD_TOKEN/);
    expect(() => loadConfig({ DISCORD_TOKEN: 'x' })).toThrow(/DISCORD_CLIENT_ID/);
  });
});
