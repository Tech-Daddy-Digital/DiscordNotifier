export type GuildAuthorizationInput = {
  userId: string;
  guildOwnerId?: string | null;
  permissions: string | number | bigint;
  memberRoleIds: readonly string[];
  configuredAdminRoleIds: readonly string[];
};

const ADMINISTRATOR_PERMISSION = 1n << 3n;
const MANAGE_GUILD_PERMISSION = 1n << 5n;

export function canManageGuild(input: GuildAuthorizationInput): boolean {
  if (input.guildOwnerId && input.guildOwnerId === input.userId) return true;

  const permissions = BigInt(input.permissions || 0);
  if ((permissions & ADMINISTRATOR_PERMISSION) === ADMINISTRATOR_PERMISSION) return true;
  if ((permissions & MANAGE_GUILD_PERMISSION) === MANAGE_GUILD_PERMISSION) return true;

  const memberRoles = new Set(input.memberRoleIds);
  return input.configuredAdminRoleIds.some((roleId) => memberRoles.has(roleId));
}
