import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';

export type GuildSettings = {
  guildId: string;
  guildName: string;
  defaultChannelId: string | null;
};

export type NotificationRoute = {
  id: string;
  guildId: string;
  name: string;
  channelId: string;
  pingRoleId: string | null;
  messageTemplate: string;
};

export type MonitoredSourceType = 'youtube' | 'twitch' | 'kick' | 'x' | 'bluesky' | 'instagram';

export type MonitoredSource = {
  id: string;
  guildId: string;
  type: MonitoredSourceType;
  displayName: string;
  externalId: string;
  url: string | null;
  routeId: string | null;
  enabled: boolean;
  config: Record<string, unknown>;
};

export type UserSession = {
  id: string;
  userId: string;
  username: string;
  discriminator: string | null;
  avatar: string | null;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
  createdAt: number;
};

export type CreateSessionInput = Omit<UserSession, 'id' | 'createdAt'>;

export type GuildConfiguration = {
  settings: GuildSettings | null;
  adminRoleIds: string[];
  routes: NotificationRoute[];
  sources: MonitoredSource[];
};

export class GuildSettingsStore {
  public readonly databasePath: string;
  private readonly db: Database.Database;

  constructor(databasePath: string) {
    this.databasePath = databasePath;
    if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });
    this.db = new Database(databasePath);
    this.db.pragma('journal_mode = WAL');
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  upsertGuildSettings(settings: GuildSettings): void {
    this.db.prepare(`
      INSERT INTO guild_settings (guild_id, guild_name, default_channel_id, updated_at)
      VALUES (@guildId, @guildName, @defaultChannelId, unixepoch())
      ON CONFLICT(guild_id) DO UPDATE SET
        guild_name = excluded.guild_name,
        default_channel_id = excluded.default_channel_id,
        updated_at = unixepoch()
    `).run(settings);
  }

  replaceAdminRoles(guildId: string, roleIds: readonly string[]): void {
    const replace = this.db.transaction(() => {
      this.db.prepare('DELETE FROM guild_admin_roles WHERE guild_id = ?').run(guildId);
      const insert = this.db.prepare('INSERT INTO guild_admin_roles (guild_id, role_id) VALUES (?, ?)');
      for (const roleId of roleIds) insert.run(guildId, roleId);
    });
    replace();
  }

  upsertNotificationRoute(route: NotificationRoute): void {
    this.db.prepare(`
      INSERT INTO notification_routes (id, guild_id, name, channel_id, ping_role_id, message_template, updated_at)
      VALUES (@id, @guildId, @name, @channelId, @pingRoleId, @messageTemplate, unixepoch())
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        channel_id = excluded.channel_id,
        ping_role_id = excluded.ping_role_id,
        message_template = excluded.message_template,
        updated_at = unixepoch()
    `).run(route);
  }

  deleteNotificationRoute(guildId: string, routeId: string): boolean {
    const result = this.db.prepare('DELETE FROM notification_routes WHERE guild_id = ? AND id = ?').run(guildId, routeId);
    return result.changes > 0;
  }

  upsertMonitoredSource(source: MonitoredSource): void {
    this.db.prepare(`
      INSERT INTO monitored_sources (id, guild_id, type, display_name, external_id, url, route_id, enabled, config_json, updated_at)
      VALUES (@id, @guildId, @type, @displayName, @externalId, @url, @routeId, @enabledValue, @configJson, unixepoch())
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        display_name = excluded.display_name,
        external_id = excluded.external_id,
        url = excluded.url,
        route_id = excluded.route_id,
        enabled = excluded.enabled,
        config_json = excluded.config_json,
        updated_at = unixepoch()
    `).run({ ...source, enabledValue: source.enabled ? 1 : 0, configJson: JSON.stringify(source.config) });
  }

  deleteMonitoredSource(guildId: string, sourceId: string): boolean {
    const result = this.db.prepare('DELETE FROM monitored_sources WHERE guild_id = ? AND id = ?').run(guildId, sourceId);
    return result.changes > 0;
  }

  getGuildConfiguration(guildId: string): GuildConfiguration {
    const settings = this.db.prepare('SELECT guild_id as guildId, guild_name as guildName, default_channel_id as defaultChannelId FROM guild_settings WHERE guild_id = ?').get(guildId) as GuildSettings | undefined;
    const adminRoleRows = this.db.prepare('SELECT role_id as roleId FROM guild_admin_roles WHERE guild_id = ? ORDER BY role_id').all(guildId) as Array<{ roleId: string }>;
    const routes = this.db.prepare('SELECT id, guild_id as guildId, name, channel_id as channelId, ping_role_id as pingRoleId, message_template as messageTemplate FROM notification_routes WHERE guild_id = ? ORDER BY name').all(guildId) as NotificationRoute[];
    const sourceRows = this.db.prepare('SELECT id, guild_id as guildId, type, display_name as displayName, external_id as externalId, url, route_id as routeId, enabled, config_json as configJson FROM monitored_sources WHERE guild_id = ? ORDER BY display_name').all(guildId) as Array<Omit<MonitoredSource, 'enabled' | 'config'> & { enabled: number; configJson: string }>;

    return {
      settings: settings ?? null,
      adminRoleIds: adminRoleRows.map((row) => row.roleId),
      routes,
      sources: sourceRows.map((row) => ({
        id: row.id,
        guildId: row.guildId,
        type: row.type,
        displayName: row.displayName,
        externalId: row.externalId,
        url: row.url,
        routeId: row.routeId,
        enabled: Boolean(row.enabled),
        config: JSON.parse(row.configJson) as Record<string, unknown>,
      })),
    };
  }

  createSession(input: CreateSessionInput): string {
    const id = randomBytes(32).toString('base64url');
    this.db.prepare(`
      INSERT INTO sessions (id, user_id, username, discriminator, avatar, access_token, refresh_token, expires_at, created_at)
      VALUES (@id, @userId, @username, @discriminator, @avatar, @accessToken, @refreshToken, @expiresAt, @createdAt)
    `).run({ ...input, id, createdAt: Date.now() });
    return id;
  }

  getSession(id: string | undefined): UserSession | null {
    if (!id) return null;
    const row = this.db.prepare(`
      SELECT id, user_id as userId, username, discriminator, avatar, access_token as accessToken,
        refresh_token as refreshToken, expires_at as expiresAt, created_at as createdAt
      FROM sessions WHERE id = ?
    `).get(id) as UserSession | undefined;
    if (!row) return null;
    if (row.expiresAt <= Date.now()) {
      this.deleteSession(id);
      return null;
    }
    return row;
  }

  deleteSession(id: string): void {
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id TEXT PRIMARY KEY,
        guild_name TEXT NOT NULL,
        default_channel_id TEXT,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS guild_admin_roles (
        guild_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        PRIMARY KEY (guild_id, role_id)
      );
      CREATE TABLE IF NOT EXISTS notification_routes (
        id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        name TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        ping_role_id TEXT,
        message_template TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS monitored_sources (
        id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        type TEXT NOT NULL,
        display_name TEXT NOT NULL,
        external_id TEXT NOT NULL,
        url TEXT,
        route_id TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        config_json TEXT NOT NULL DEFAULT '{}',
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS delivery_events (
        id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        source_id TEXT,
        event_type TEXT NOT NULL,
        status TEXT NOT NULL,
        payload_json TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        discriminator TEXT,
        avatar TEXT,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
  }
}
