import { describe, expect, it } from 'vitest';
import { canManageGuild } from '../src/guild-authorization.js';

describe('canManageGuild', () => {
  it('allows guild owners', () => {
    expect(canManageGuild({ userId: 'user-1', guildOwnerId: 'user-1', permissions: '0', memberRoleIds: [], configuredAdminRoleIds: [] })).toBe(true);
  });

  it('allows users with Administrator or Manage Guild permissions', () => {
    expect(canManageGuild({ userId: 'user-2', guildOwnerId: 'owner', permissions: '8', memberRoleIds: [], configuredAdminRoleIds: [] })).toBe(true);
    expect(canManageGuild({ userId: 'user-3', guildOwnerId: 'owner', permissions: '32', memberRoleIds: [], configuredAdminRoleIds: [] })).toBe(true);
  });

  it('allows configured PulseDaddy admin roles and denies everyone else', () => {
    expect(canManageGuild({ userId: 'user-4', guildOwnerId: 'owner', permissions: '0', memberRoleIds: ['role-a'], configuredAdminRoleIds: ['role-a'] })).toBe(true);
    expect(canManageGuild({ userId: 'user-5', guildOwnerId: 'owner', permissions: '0', memberRoleIds: ['role-b'], configuredAdminRoleIds: ['role-a'] })).toBe(false);
  });
});
