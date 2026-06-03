import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config.js';
import { createHttpServer } from '../src/http-server.js';
import { createLogger } from '../src/logger.js';
import { renderGuildAdminShell } from '../src/admin-ui.js';
import { GuildSettingsStore } from '../src/settings-store.js';
import type { DiscordApiClient } from '../src/discord-api-client.js';
import type { NotificationRouter } from '../src/notifications/notification-router.js';

const dirs: string[] = [];
function makeStore() {
  const dir = mkdtempSync(join(tmpdir(), 'pulsedaddy-web-'));
  dirs.push(dir);
  return new GuildSettingsStore(join(dir, `${randomUUID()}.sqlite`));
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function config() {
  return loadConfig({
    DISCORD_TOKEN: 'test-token',
    DISCORD_CLIENT_ID: '123456789012345678',
    DISCORD_CLIENT_SECRET: 'client-secret',
    DISCORD_NOTIFICATION_CHANNEL_ID: '345678901234567890',
    WEB_BASE_URL: 'http://localhost:3000',
    SESSION_SECRET: 'test-session-secret-that-is-long-enough',
  });
}

describe('web admin and OAuth routes', () => {
  it('builds Discord login and bot invite URLs from configured OAuth settings', async () => {
    const app = await createHttpServer({ config: config(), logger: createLogger({ logLevel: 'silent' }), notificationRouter: {} as NotificationRouter, settingsStore: makeStore() });

    const login = await app.inject({ method: 'GET', url: '/auth/login' });
    expect(login.statusCode).toBe(302);
    expect(login.headers.location).toContain('discord.com/oauth2/authorize');
    expect(login.headers.location).toContain('scope=identify+guilds');

    const invite = await app.inject({ method: 'GET', url: '/invite' });
    expect(invite.statusCode).toBe(302);
    expect(invite.headers.location).toContain('scope=bot+applications.commands');
    expect(invite.headers.location).toContain('permissions=2147485696');
    await app.close();
  });

  it('reports no current session when not logged in', async () => {
    const app = await createHttpServer({ config: config(), logger: createLogger({ logLevel: 'silent' }), notificationRouter: {} as NotificationRouter, settingsStore: makeStore() });
    const response = await app.inject({ method: 'GET', url: '/api/session' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ authenticated: false });
    await app.close();
  });

  it('requires an authorized guild admin before mutating monitored sources', async () => {
    const store = makeStore();
    store.upsertGuildSettings({ guildId: 'guild-1', guildName: 'Tech Server', defaultChannelId: null });
    const discordApi: Partial<DiscordApiClient> = {
      exchangeCodeForToken: vi.fn(), fetchCurrentUser: vi.fn(), fetchCurrentUserGuilds: vi.fn(async () => [{ id: 'guild-1', name: 'Tech Server', owner: false, permissions: '0' }]), fetchGuildMember: vi.fn(async () => ({ userId: 'user-1', roleIds: [], permissions: '0' })), fetchGuildChannels: vi.fn(), fetchGuildRoles: vi.fn(),
    };
    const app = await createHttpServer({ config: config(), logger: createLogger({ logLevel: 'silent' }), notificationRouter: {} as NotificationRouter, settingsStore: store, discordApi: discordApi as DiscordApiClient });
    const sid = store.createSession({ userId: 'user-1', username: 'Nope', discriminator: '0000', avatar: null, accessToken: 'access', refreshToken: null, expiresAt: Date.now() + 60000 });

    const response = await app.inject({
      method: 'POST',
      url: '/api/guilds/guild-1/sources',
      cookies: { pulsedaddy_session: sid },
      payload: { type: 'youtube', displayName: 'Tech Daddy', externalId: '@TechDaddy', routeId: null, enabled: true, config: { lifecycle: ['live'] } },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('reuses the current user guild list between admin navigation requests', async () => {
    const store = makeStore();
    const fetchCurrentUserGuilds = vi.fn(async () => [{ id: 'guild-1', name: 'Tech Server', owner: false, permissions: '32' }]);
    const discordApi: Partial<DiscordApiClient> = {
      exchangeCodeForToken: vi.fn(),
      fetchCurrentUser: vi.fn(),
      fetchCurrentUserGuilds,
      fetchGuildMember: vi.fn(async () => ({ userId: 'user-1', roleIds: [], permissions: '32' })),
      fetchGuildChannels: vi.fn(async () => [{ id: 'chan-1', name: 'alerts', type: 0 }]),
      fetchGuildRoles: vi.fn(async () => [{ id: 'role-1', name: 'Ping Crew' }]),
    };
    const app = await createHttpServer({ config: config(), logger: createLogger({ logLevel: 'silent' }), notificationRouter: {} as NotificationRouter, settingsStore: store, discordApi: discordApi as DiscordApiClient });
    const sid = store.createSession({ userId: 'user-1', username: 'Admin', discriminator: '0000', avatar: null, accessToken: 'access', refreshToken: null, expiresAt: Date.now() + 60000 });

    const list = await app.inject({ method: 'GET', url: '/api/guilds', cookies: { pulsedaddy_session: sid } });
    expect(list.statusCode).toBe(200);

    const detail = await app.inject({ method: 'GET', url: '/api/guilds/guild-1', cookies: { pulsedaddy_session: sid } });
    expect(detail.statusCode).toBe(200);
    expect(fetchCurrentUserGuilds).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it('renders monitored source route selection as an optional dropdown backed by created routes', () => {
    const shell = renderGuildAdminShell('guild-1');

    expect(shell).toContain('function routeOptionLabel(route)');
    expect(shell).toContain('<select id="sourceRoute">');
    expect(shell).toContain('<option value="">No specific route</option>');
    expect(shell).not.toContain('<input id="sourceRoute" placeholder="Optional route ID">');
  });

  it('allows an administrator to configure settings, routes, and monitored sources', async () => {
    const store = makeStore();
    const discordApi: Partial<DiscordApiClient> = {
      exchangeCodeForToken: vi.fn(),
      fetchCurrentUser: vi.fn(),
      fetchCurrentUserGuilds: vi.fn(async () => [{ id: 'guild-1', name: 'Tech Server', owner: false, permissions: '32' }]),
      fetchGuildMember: vi.fn(async () => ({ userId: 'user-1', roleIds: [], permissions: '32' })),
      fetchGuildChannels: vi.fn(async () => [{ id: 'chan-1', name: 'alerts', type: 0 }]),
      fetchGuildRoles: vi.fn(async () => [{ id: 'role-1', name: 'Ping Crew' }]),
    };
    const app = await createHttpServer({ config: config(), logger: createLogger({ logLevel: 'silent' }), notificationRouter: {} as NotificationRouter, settingsStore: store, discordApi: discordApi as DiscordApiClient });
    const sid = store.createSession({ userId: 'user-1', username: 'Admin', discriminator: '0000', avatar: null, accessToken: 'access', refreshToken: null, expiresAt: Date.now() + 60000 });

    const settings = await app.inject({ method: 'PUT', url: '/api/guilds/guild-1/settings', cookies: { pulsedaddy_session: sid }, payload: { guildName: 'Tech Server', defaultChannelId: 'chan-1', adminRoleIds: ['role-1'] } });
    expect(settings.statusCode).toBe(200);

    const route = await app.inject({ method: 'POST', url: '/api/guilds/guild-1/routes', cookies: { pulsedaddy_session: sid }, payload: { id: 'route-1', name: 'Livestreams', channelId: 'chan-1', pingRoleId: 'role-1', messageTemplate: '{{displayName}} is live: {{title}}' } });
    expect(route.statusCode).toBe(201);

    const source = await app.inject({ method: 'POST', url: '/api/guilds/guild-1/sources', cookies: { pulsedaddy_session: sid }, payload: { id: 'src-1', type: 'youtube', displayName: 'Tech Daddy', externalId: '@TechDaddy', routeId: 'route-1', enabled: true, config: { lifecycle: ['scheduled', 'live'] } } });
    expect(source.statusCode).toBe(201);
    expect(source.json().configuration.sources).toHaveLength(1);

    const deleted = await app.inject({ method: 'DELETE', url: '/api/guilds/guild-1/sources/src-1', cookies: { pulsedaddy_session: sid } });
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json()).toEqual({ deleted: true });
    await app.close();
  });
});
