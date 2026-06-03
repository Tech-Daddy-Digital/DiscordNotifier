import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { renderGuildAdminShell } from '../src/admin-ui.js';

type FakeDocument = { querySelector: (selector: string) => unknown };

type GuildAdminScript = {
  normalizeRouteSelectorOptions: (routes: unknown[]) => Array<{ value: string; label: string }>;
  routeOptions: (routes: Array<{ value: string; label: string }>, currentValue: string) => string;
  routeOptionText: (routes: Array<{ value: string; label: string }>, currentValue: string | null) => string;
  boot: () => Promise<void>;
  saveSettings: () => Promise<void>;
  saveRoute: () => Promise<void>;
  saveSource: () => Promise<void>;
};

function loadGuildAdminScript(options: { document?: FakeDocument; fetch?: typeof fetch } = {}) {
  const shell = renderGuildAdminShell('guild-1');
  const script = shell.match(/<script>([\s\S]*)<\/script>/)?.[1];
  if (!script) throw new Error('Guild admin script not found');
  const context = vm.createContext({
    document: options.document ?? { querySelector: () => ({}) },
    fetch: options.fetch ?? (async () => ({ ok: true, json: async () => ({}) })),
  });
  vm.runInContext(script.replace(/boot\(\)\.catch\([\s\S]*$/, ''), context);
  return context as GuildAdminScript;
}

describe('guild admin shell selectors', () => {
  it('renders channel and ping role controls as dropdowns without ID cross-reference lists', () => {
    const html = renderGuildAdminShell('guild-1');

    expect(html).toContain('<select id="defaultChannelId"');
    expect(html).toContain('<select id="routeChannel"');
    expect(html).toContain('<select id="routePing"');
    expect(html).not.toContain('Default channel ID<input');
    expect(html).not.toContain('Discord channels</h2><pre>');
    expect(html).not.toContain('Roles</h2><pre>');
  });

  it('includes safe option builders that preserve saved IDs missing from Discord options', () => {
    const html = renderGuildAdminShell('guild-1');

    expect(html).toContain('function selectOptions');
    expect(html).toContain('currentValue');
    expect(html).toContain('Unknown saved ID');
  });

  it('loads reusable route selector options with route IDs as values and human labels', () => {
    const html = renderGuildAdminShell('guild-1');

    expect(html).toContain('function normalizeRouteSelectorOptions');
    expect(html).toContain('value:String(route.id)');
    expect(html).toContain('label:String(route.name||route.id)');
    expect(html).toContain("api('/api/guilds/'+guildId+'/routes')");
    expect(html).toContain("routeOptions(routeSelectorOptions,'')");
  });

  it('keeps the route selector safe when the route list is empty or cannot load', () => {
    const html = renderGuildAdminShell('guild-1');

    expect(html).toContain('return (routes||[])');
    expect(html).toContain('No route');
    expect(html).toContain('Route selector is using saved routes because the route list could not be loaded');
  });

  it('displays saved monitored source route IDs through the loaded route options', () => {
    const html = renderGuildAdminShell('guild-1');

    expect(html).toContain('function routeOptionText(routeSelectorOptions,currentValue)');
    expect(html).toContain("routeOptionText(routeSelectorOptions,s.routeId)");
    expect(html).toContain("Unknown saved ID: ' + value");
  });

  it('normalizes route selector options from created routes into route ID values and human labels', () => {
    const script = loadGuildAdminScript();

    expect(script.normalizeRouteSelectorOptions([{ id: 'route-live', name: 'Livestream alerts' }, { id: 'route-fallback', name: '' }, { name: 'missing id' }, null])).toEqual([
      { value: 'route-live', label: 'Livestream alerts' },
      { value: 'route-fallback', label: 'route-fallback' },
    ]);
  });

  it('renders route dropdown labels for humans while keeping route IDs as option values', () => {
    const script = loadGuildAdminScript();
    const options = [{ value: 'route-live', label: 'Livestream alerts' }];

    expect(script.routeOptions(options, 'route-live')).toContain('<option value="route-live" selected>Livestream alerts (route-live)</option>');
    expect(script.routeOptionText(options, 'route-live')).toBe('Livestream alerts (route-live)');
  });

  it('renders a safe empty route dropdown and preserves unknown saved route IDs', () => {
    const script = loadGuildAdminScript();

    expect(script.routeOptions([], '')).toBe('<option value="" selected>No route</option>');
    expect(script.routeOptions([], 'legacy-route-id')).toContain('<option value="legacy-route-id" selected>Unknown saved ID: legacy-route-id</option>');
    expect(script.routeOptionText([], 'legacy-route-id')).toBe('Unknown saved ID: legacy-route-id');
  });

  it('loads existing admin configuration with readable dropdown labels and missing ID fallbacks', async () => {
    const app = { innerHTML: '' };
    const document: FakeDocument = { querySelector: (selector) => (selector === '#app' ? app : {}) };
    const fetchMock = (async (path: string) => ({
      ok: true,
      json: async () => {
        if (path.endsWith('/routes')) {
          return { routes: [{ id: 'route-live', name: 'Livestream alerts', channelId: 'chan-1', pingRoleId: 'role-1' }] };
        }
        return {
          guild: { id: 'guild-1', name: 'Tech Server' },
          channels: [{ id: 'chan-1', name: 'alerts' }],
          roles: [{ id: 'role-1', name: 'Ping Crew' }],
          configuration: {
            settings: { guildName: 'Tech Server', defaultChannelId: 'deleted-channel' },
            adminRoleIds: ['role-1', 'deleted-role'],
            routes: [{ id: 'route-stale', name: 'Stale route', channelId: 'deleted-channel', pingRoleId: 'deleted-role', messageTemplate: 'Legacy template' }],
            sources: [{ id: 'src-1', type: 'youtube', displayName: 'Tech Daddy', routeId: 'deleted-route' }],
          },
        };
      },
    })) as unknown as typeof fetch;
    const script = loadGuildAdminScript({ document, fetch: fetchMock });

    await script.boot();

    expect(app.innerHTML).toContain('alerts (chan-1)');
    expect(app.innerHTML).toContain('Ping Crew (role-1)');
    expect(app.innerHTML).toContain('Livestream alerts (route-live)');
    expect(app.innerHTML).toContain('Unknown saved ID: deleted-channel');
    expect(app.innerHTML).toContain('Unknown saved ID: deleted-role');
    expect(app.innerHTML).toContain('Unknown channel: deleted-channel');
    expect(app.innerHTML).toContain('Unknown role: deleted-role');
    expect(app.innerHTML).toContain('Unknown saved ID: deleted-route');
  });

  it('persists selected and cleared dropdown IDs through save calls and reloads', async () => {
    const app = { innerHTML: '' };
    const fields: Record<string, unknown> = {
      '#app': app,
      '#guildName': { value: 'Tech Server Reloaded' },
      '#defaultChannelId': { value: '' },
      '#adminRoleIds': { selectedOptions: [{ value: 'role-1' }, { value: 'deleted-role' }, { value: '' }] },
      '#routeName': { value: 'Livestreams' },
      '#routeChannel': { value: 'chan-1' },
      '#routePing': { value: '' },
      '#routeTemplate': { value: '{{displayName}} is live' },
      '#sourceType': { value: 'youtube' },
      '#sourceName': { value: 'Tech Daddy' },
      '#sourceExternal': { value: '@TechDaddy' },
      '#sourceUrl': { value: '' },
      '#sourceRoute': { value: 'route-live' },
    };
    const document: FakeDocument = { querySelector: (selector) => fields[selector] ?? {} };
    const calls: Array<{ path: string; method: string; body: unknown }> = [];
    const fetchMock = (async (path: string, options?: { method?: string; body?: string }) => {
      calls.push({ path, method: options?.method ?? 'GET', body: options?.body ? JSON.parse(options.body) : null });
      return {
        ok: true,
        json: async () => path.endsWith('/routes')
          ? { routes: [{ id: 'route-live', name: 'Livestream alerts', channelId: 'chan-1', pingRoleId: null }] }
          : {
              guild: { id: 'guild-1', name: 'Tech Server' },
              channels: [{ id: 'chan-1', name: 'alerts' }],
              roles: [{ id: 'role-1', name: 'Ping Crew' }],
              configuration: { settings: {}, adminRoleIds: [], routes: [], sources: [] },
            },
      };
    }) as unknown as typeof fetch;
    const script = loadGuildAdminScript({ document, fetch: fetchMock });

    await script.saveSettings();
    await script.saveRoute();
    await script.saveSource();
    (fields['#sourceRoute'] as { value: string }).value = '';
    await script.saveSource();

    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: '/api/guilds/guild-1/settings', method: 'PUT', body: { guildName: 'Tech Server Reloaded', defaultChannelId: null, adminRoleIds: ['role-1', 'deleted-role'] } }),
      expect.objectContaining({ path: '/api/guilds/guild-1/routes', method: 'POST', body: { name: 'Livestreams', channelId: 'chan-1', pingRoleId: null, messageTemplate: '{{displayName}} is live' } }),
      expect.objectContaining({ path: '/api/guilds/guild-1/sources', method: 'POST', body: expect.objectContaining({ routeId: 'route-live' }) }),
      expect.objectContaining({ path: '/api/guilds/guild-1/sources', method: 'POST', body: expect.objectContaining({ routeId: null }) }),
    ]));
    expect(calls.filter((call) => call.path === '/api/guilds/guild-1' && call.method === 'GET')).toHaveLength(4);
  });

});
