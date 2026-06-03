import { randomBytes, randomUUID } from 'node:crypto';
import helmet from '@fastify/helmet';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { z } from 'zod';
import { renderAdminShell, renderGuildAdminShell } from './admin-ui.js';
import type { AppConfig } from './config.js';
import { FetchDiscordApiClient, type DiscordApiClient, type DiscordUserGuild } from './discord-api-client.js';
import { canManageGuild } from './guild-authorization.js';
import type { AppLogger } from './logger.js';
import type { NotificationRouter } from './notifications/notification-router.js';
import { GuildSettingsStore, type GuildSettingsStore as StoreType } from './settings-store.js';

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

const guildSettingsBodySchema = z.object({
  guildName: z.string().min(1).max(256),
  defaultChannelId: z.string().min(1).nullable(),
  adminRoleIds: z.array(z.string().min(1)).default([]),
});

const routeBodySchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1).max(128),
  channelId: z.string().min(1),
  pingRoleId: z.string().min(1).nullable().optional(),
  messageTemplate: z.string().min(1).max(2000),
});

const sourceBodySchema = z.object({
  id: z.string().min(1).optional(),
  type: z.enum(['youtube', 'twitch', 'kick', 'x', 'bluesky', 'instagram']),
  displayName: z.string().min(1).max(256),
  externalId: z.string().min(1).max(512),
  url: z.string().url().nullable().optional(),
  routeId: z.string().min(1).nullable().optional(),
  enabled: z.boolean().default(true),
  config: z.record(z.string(), z.unknown()).default({}),
});

export type HttpServerOptions = {
  config: AppConfig;
  logger: AppLogger;
  notificationRouter: NotificationRouter;
  settingsStore?: StoreType;
  discordApi?: DiscordApiClient;
};

export async function createHttpServer(options: HttpServerOptions) {
  const app = Fastify({ loggerInstance: options.logger });
  await app.register(helmet, { contentSecurityPolicy: false });

  const settingsStore = options.settingsStore ?? new GuildSettingsStore(options.config.databasePath);
  const discordApi = options.discordApi ?? new FetchDiscordApiClient(options.config.discord.clientId, options.config.discord.clientSecret);
  const userGuildCache = new Map<string, { expiresAt: number; guilds: DiscordUserGuild[] }>();

  app.addHook('onClose', async () => {
    if (!options.settingsStore) settingsStore.close();
  });

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

  app.get('/', async (_request, reply) => reply.type('text/html').send(renderAdminShell()));
  app.get('/admin', async (_request, reply) => reply.type('text/html').send(renderAdminShell()));
  app.get<{ Params: { guildId: string } }>('/admin/guilds/:guildId', async (request, reply) => reply.type('text/html').send(renderGuildAdminShell(request.params.guildId)));

  app.get('/auth/login', async (_request, reply) => {
    const state = randomBytes(24).toString('base64url');
    const url = new URL('https://discord.com/oauth2/authorize');
    url.searchParams.set('client_id', options.config.discord.clientId);
    url.searchParams.set('redirect_uri', oauthCallbackUrl(options.config));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'identify guilds');
    url.searchParams.set('state', state);
    reply.header('Set-Cookie', serializeCookie('pulsedaddy_oauth_state', state, options.config, 600));
    return reply.redirect(url.toString());
  });

  app.get<{ Querystring: { code?: string; state?: string } }>('/auth/callback', async (request, reply) => {
    const expectedState = parseCookies(request.headers.cookie).pulsedaddy_oauth_state;
    if (!request.query.code || !request.query.state || request.query.state !== expectedState) {
      return reply.code(400).send({ error: 'Invalid OAuth callback state' });
    }
    const token = await discordApi.exchangeCodeForToken(request.query.code, oauthCallbackUrl(options.config));
    const user = await discordApi.fetchCurrentUser(token.accessToken);
    const sid = settingsStore.createSession({
      userId: user.id,
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.avatar,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: token.expiresAt,
    });
    reply.header('Set-Cookie', [
      serializeCookie('pulsedaddy_session', sid, options.config, 60 * 60 * 24 * 7),
      expireCookie('pulsedaddy_oauth_state', options.config),
    ]);
    return reply.redirect('/admin');
  });

  app.get('/auth/logout', async (request, reply) => {
    const sid = parseCookies(request.headers.cookie).pulsedaddy_session;
    if (sid) settingsStore.deleteSession(sid);
    reply.header('Set-Cookie', expireCookie('pulsedaddy_session', options.config));
    return reply.redirect('/');
  });

  app.get('/invite', async (_request, reply) => {
    const url = new URL('https://discord.com/oauth2/authorize');
    url.searchParams.set('client_id', options.config.discord.clientId);
    url.searchParams.set('scope', 'bot applications.commands');
    url.searchParams.set('permissions', '2147485696');
    return reply.redirect(url.toString());
  });

  app.get('/api/session', async (request) => {
    const session = getSessionFromRequest(request, settingsStore);
    if (!session) return { authenticated: false };
    return { authenticated: true, user: { id: session.userId, username: session.username, discriminator: session.discriminator, avatar: session.avatar } };
  });

  app.get('/api/guilds', async (request, reply) => {
    const session = getSessionFromRequest(request, settingsStore);
    if (!session) return reply.code(401).send({ error: 'Login required' });
    const guilds = await listManageableGuilds(discordApi, settingsStore, session, userGuildCache);
    return { guilds };
  });

  app.get<{ Params: { guildId: string } }>('/api/guilds/:guildId', async (request, reply) => {
    const auth = await requireGuildAdmin(request, reply, discordApi, settingsStore, userGuildCache);
    if (!auth) return reply;
    const [channels, roles] = await Promise.all([
      discordApi.fetchGuildChannels(options.config.discord.token, request.params.guildId),
      discordApi.fetchGuildRoles(options.config.discord.token, request.params.guildId),
    ]);
    return {
      guild: auth.guild,
      configuration: settingsStore.getGuildConfiguration(request.params.guildId),
      channels: channels.filter((channel) => [0, 5, 10, 11, 12, 15].includes(channel.type)),
      roles: roles.filter((role) => !role.managed),
    };
  });

  app.put<{ Params: { guildId: string } }>('/api/guilds/:guildId/settings', async (request, reply) => {
    const auth = await requireGuildAdmin(request, reply, discordApi, settingsStore, userGuildCache);
    if (!auth) return reply;
    const body = guildSettingsBodySchema.parse(request.body);
    settingsStore.upsertGuildSettings({ guildId: request.params.guildId, guildName: body.guildName, defaultChannelId: body.defaultChannelId });
    settingsStore.replaceAdminRoles(request.params.guildId, body.adminRoleIds);
    return { configuration: settingsStore.getGuildConfiguration(request.params.guildId) };
  });

  app.get<{ Params: { guildId: string } }>('/api/guilds/:guildId/routes', async (request, reply) => {
    const auth = await requireGuildAdmin(request, reply, discordApi, settingsStore, userGuildCache);
    if (!auth) return reply;
    const routes = settingsStore.getGuildConfiguration(request.params.guildId).routes.map((route) => ({
      id: route.id,
      name: route.name,
      channelId: route.channelId,
      pingRoleId: route.pingRoleId,
    }));
    return { routes };
  });

  app.post<{ Params: { guildId: string } }>('/api/guilds/:guildId/routes', async (request, reply) => {
    const auth = await requireGuildAdmin(request, reply, discordApi, settingsStore, userGuildCache);
    if (!auth) return reply;
    const body = routeBodySchema.parse(request.body);
    settingsStore.upsertNotificationRoute({ id: body.id ?? randomUUID(), guildId: request.params.guildId, name: body.name, channelId: body.channelId, pingRoleId: body.pingRoleId ?? null, messageTemplate: body.messageTemplate });
    return reply.code(201).send({ configuration: settingsStore.getGuildConfiguration(request.params.guildId) });
  });

  app.delete<{ Params: { guildId: string; routeId: string } }>('/api/guilds/:guildId/routes/:routeId', async (request, reply) => {
    const auth = await requireGuildAdmin(request, reply, discordApi, settingsStore, userGuildCache);
    if (!auth) return reply;
    return { deleted: settingsStore.deleteNotificationRoute(request.params.guildId, request.params.routeId) };
  });

  app.post<{ Params: { guildId: string } }>('/api/guilds/:guildId/sources', async (request, reply) => {
    const auth = await requireGuildAdmin(request, reply, discordApi, settingsStore, userGuildCache);
    if (!auth) return reply;
    const body = sourceBodySchema.parse(request.body);
    settingsStore.upsertMonitoredSource({ id: body.id ?? randomUUID(), guildId: request.params.guildId, type: body.type, displayName: body.displayName, externalId: body.externalId, url: body.url ?? null, routeId: body.routeId ?? null, enabled: body.enabled, config: body.config });
    return reply.code(201).send({ configuration: settingsStore.getGuildConfiguration(request.params.guildId) });
  });

  app.delete<{ Params: { guildId: string; sourceId: string } }>('/api/guilds/:guildId/sources/:sourceId', async (request, reply) => {
    const auth = await requireGuildAdmin(request, reply, discordApi, settingsStore, userGuildCache);
    if (!auth) return reply;
    return { deleted: settingsStore.deleteMonitoredSource(request.params.guildId, request.params.sourceId) };
  });

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

function oauthCallbackUrl(config: AppConfig): string {
  return `${config.http.webBaseUrl}/auth/callback`;
}

function getSessionFromRequest(request: FastifyRequest, store: StoreType) {
  return store.getSession(parseCookies(request.headers.cookie).pulsedaddy_session);
}

type UserGuildCache = Map<string, { expiresAt: number; guilds: DiscordUserGuild[] }>;

async function getCurrentUserGuilds(discordApi: DiscordApiClient, session: NonNullable<ReturnType<StoreType['getSession']>>, cache: UserGuildCache): Promise<DiscordUserGuild[]> {
  const cached = cache.get(session.id);
  if (cached && cached.expiresAt > Date.now()) return cached.guilds;

  const guilds = await discordApi.fetchCurrentUserGuilds(session.accessToken);
  cache.set(session.id, { expiresAt: Date.now() + 5 * 60 * 1000, guilds });
  return guilds;
}

async function listManageableGuilds(discordApi: DiscordApiClient, store: StoreType, session: NonNullable<ReturnType<StoreType['getSession']>>, cache: UserGuildCache): Promise<DiscordUserGuild[]> {
  const guilds = await getCurrentUserGuilds(discordApi, session, cache);
  const manageable: DiscordUserGuild[] = [];
  for (const guild of guilds) {
    if (guild.owner || canManageGuild({ userId: session.userId, guildOwnerId: guild.owner ? session.userId : null, permissions: guild.permissions, memberRoleIds: [], configuredAdminRoleIds: [] })) {
      manageable.push(guild);
      continue;
    }
    const configuredAdminRoleIds = store.getGuildConfiguration(guild.id).adminRoleIds;
    if (configuredAdminRoleIds.length === 0) continue;
    const member = await discordApi.fetchGuildMember(session.accessToken, guild.id);
    if (canManageGuild({ userId: session.userId, guildOwnerId: null, permissions: guild.permissions, memberRoleIds: member.roleIds, configuredAdminRoleIds })) manageable.push(guild);
  }
  return manageable;
}

async function requireGuildAdmin(request: FastifyRequest<{ Params: { guildId: string } }>, reply: FastifyReply, discordApi: DiscordApiClient, store: StoreType, cache: UserGuildCache) {
  const session = getSessionFromRequest(request, store);
  if (!session) {
    reply.code(401).send({ error: 'Login required' });
    return null;
  }
  const guilds = await getCurrentUserGuilds(discordApi, session, cache);
  const guild = guilds.find((candidate) => candidate.id === request.params.guildId);
  if (!guild) {
    reply.code(403).send({ error: 'Guild is not available for this Discord user' });
    return null;
  }
  const configuration = store.getGuildConfiguration(request.params.guildId);
  if (guild.owner || canManageGuild({ userId: session.userId, guildOwnerId: guild.owner ? session.userId : null, permissions: guild.permissions, memberRoleIds: [], configuredAdminRoleIds: [] })) {
    return { session, guild, member: null };
  }

  if (configuration.adminRoleIds.length > 0) {
    const member = await discordApi.fetchGuildMember(session.accessToken, request.params.guildId);
    if (canManageGuild({ userId: session.userId, guildOwnerId: null, permissions: guild.permissions || member.permissions, memberRoleIds: member.roleIds, configuredAdminRoleIds: configuration.adminRoleIds })) {
      return { session, guild, member };
    }
  }

  reply.code(403).send({ error: 'PulseDaddy guild admin permission required' });
  return null;
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (!rawName || rawValue.length === 0) continue;
    cookies[rawName] = decodeURIComponent(rawValue.join('='));
  }
  return cookies;
}

function serializeCookie(name: string, value: string, config: AppConfig, maxAgeSeconds: number): string {
  const secure = config.http.webBaseUrl.startsWith('https://') ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

function expireCookie(name: string, config: AppConfig): string {
  const secure = config.http.webBaseUrl.startsWith('https://') ? '; Secure' : '';
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
