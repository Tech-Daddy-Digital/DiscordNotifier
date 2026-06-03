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
});
