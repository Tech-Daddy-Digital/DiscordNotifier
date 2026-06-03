import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { GuildSettingsStore } from '../src/settings-store.js';

const dirs: string[] = [];
function tempDb() {
  const dir = mkdtempSync(join(tmpdir(), 'pulsedaddy-store-'));
  dirs.push(dir);
  return join(dir, 'pulsedaddy.sqlite');
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('GuildSettingsStore', () => {
  it('persists guild settings, admin roles, routes, and monitored sources', () => {
    const store = new GuildSettingsStore(tempDb());
    store.upsertGuildSettings({ guildId: 'guild-1', guildName: 'Tech Server', defaultChannelId: 'chan-1' });
    store.replaceAdminRoles('guild-1', ['role-admin']);
    store.upsertNotificationRoute({ id: 'route-1', guildId: 'guild-1', name: 'Lives', channelId: 'chan-2', pingRoleId: 'role-ping', messageTemplate: 'Go watch {{title}}' });
    store.upsertMonitoredSource({ id: 'src-1', guildId: 'guild-1', type: 'youtube', displayName: 'Tech Daddy', externalId: '@TechDaddy', url: 'https://youtube.com/@TechDaddy', routeId: 'route-1', enabled: true, config: { lifecycle: ['scheduled', 'live'] } });

    const reopened = new GuildSettingsStore(store.databasePath);
    expect(reopened.getGuildConfiguration('guild-1')).toMatchObject({
      settings: { guildId: 'guild-1', guildName: 'Tech Server', defaultChannelId: 'chan-1' },
      adminRoleIds: ['role-admin'],
      routes: [{ id: 'route-1', channelId: 'chan-2', pingRoleId: 'role-ping', messageTemplate: 'Go watch {{title}}' }],
      sources: [{ id: 'src-1', type: 'youtube', displayName: 'Tech Daddy', routeId: 'route-1', enabled: true }],
    });
    reopened.close();
    store.close();
  });

  it('deletes monitored sources by guild and source id', () => {
    const store = new GuildSettingsStore(tempDb());
    store.upsertMonitoredSource({ id: 'src-1', guildId: 'guild-1', type: 'youtube', displayName: 'Tech Daddy', externalId: '@TechDaddy', url: null, routeId: null, enabled: true, config: {} });
    expect(store.deleteMonitoredSource('guild-1', 'src-1')).toBe(true);
    expect(store.getGuildConfiguration('guild-1').sources).toEqual([]);
    store.close();
  });
});
