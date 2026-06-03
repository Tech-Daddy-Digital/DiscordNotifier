import { describe, expect, it } from 'vitest';
import { renderGuildAdminShell } from '../src/admin-ui.js';

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
});
