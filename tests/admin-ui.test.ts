import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { renderGuildAdminShell } from '../src/admin-ui.js';

function loadGuildAdminScript() {
  const shell = renderGuildAdminShell('guild-1');
  const script = shell.match(/<script>([\s\S]*)<\/script>/)?.[1];
  if (!script) throw new Error('Guild admin script not found');
  const context = vm.createContext({ document: { querySelector: () => ({}) }, fetch: async () => ({ ok: true, json: async () => ({}) }) });
  vm.runInContext(script.replace(/boot\(\)\.catch\([\s\S]*$/, ''), context);
  return context as {
    normalizeRouteSelectorOptions: (routes: unknown[]) => Array<{ value: string; label: string }>;
    routeOptions: (routes: Array<{ value: string; label: string }>, currentValue: string) => string;
    routeOptionText: (routes: Array<{ value: string; label: string }>, currentValue: string | null) => string;
  };
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

});
