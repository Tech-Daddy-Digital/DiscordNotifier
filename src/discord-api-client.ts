export type DiscordOAuthToken = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
};

export type DiscordUser = {
  id: string;
  username: string;
  discriminator: string | null;
  avatar: string | null;
};

export type DiscordUserGuild = {
  id: string;
  name: string;
  owner: boolean;
  permissions: string;
};

export type DiscordGuildMember = {
  userId: string;
  roleIds: string[];
  permissions: string;
};

export type DiscordChannelOption = { id: string; name: string; type: number };
export type DiscordRoleOption = { id: string; name: string; managed?: boolean };

export interface DiscordApiClient {
  exchangeCodeForToken(code: string, redirectUri: string): Promise<DiscordOAuthToken>;
  fetchCurrentUser(accessToken: string): Promise<DiscordUser>;
  fetchCurrentUserGuilds(accessToken: string): Promise<DiscordUserGuild[]>;
  fetchGuildMember(accessToken: string, guildId: string): Promise<DiscordGuildMember>;
  fetchGuildChannels(botToken: string, guildId: string): Promise<DiscordChannelOption[]>;
  fetchGuildRoles(botToken: string, guildId: string): Promise<DiscordRoleOption[]>;
}

export class FetchDiscordApiClient implements DiscordApiClient {
  constructor(private readonly clientId: string, private readonly clientSecret: string | undefined) {}

  async exchangeCodeForToken(code: string, redirectUri: string): Promise<DiscordOAuthToken> {
    if (!this.clientSecret) throw new Error('DISCORD_CLIENT_SECRET is required for OAuth callbacks');
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });
    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const json = (await parseDiscordResponse(response)) as Record<string, unknown>;
    return {
      accessToken: String(json.access_token),
      refreshToken: typeof json.refresh_token === 'string' ? json.refresh_token : null,
      expiresAt: Date.now() + Number(json.expires_in ?? 0) * 1000,
    };
  }

  async fetchCurrentUser(accessToken: string): Promise<DiscordUser> {
    const json = (await this.discordFetch('/users/@me', `Bearer ${accessToken}`)) as Record<string, unknown>;
    return { id: String(json.id), username: String(json.username), discriminator: json.discriminator ? String(json.discriminator) : null, avatar: json.avatar ? String(json.avatar) : null };
  }

  async fetchCurrentUserGuilds(accessToken: string): Promise<DiscordUserGuild[]> {
    const json = (await this.discordFetch('/users/@me/guilds', `Bearer ${accessToken}`)) as unknown[];
    return json.map((guild) => {
      const row = guild as Record<string, unknown>;
      return { id: String(row.id), name: String(row.name), owner: Boolean(row.owner), permissions: String(row.permissions ?? '0') };
    });
  }

  async fetchGuildMember(accessToken: string, guildId: string): Promise<DiscordGuildMember> {
    const json = (await this.discordFetch(`/users/@me/guilds/${guildId}/member`, `Bearer ${accessToken}`)) as Record<string, unknown>;
    const user = (json.user ?? {}) as Record<string, unknown>;
    return { userId: String(user.id), roleIds: ((json.roles as unknown[]) ?? []).map(String), permissions: String(json.permissions ?? '0') };
  }

  async fetchGuildChannels(botToken: string, guildId: string): Promise<DiscordChannelOption[]> {
    const json = (await this.discordFetch(`/guilds/${guildId}/channels`, `Bot ${botToken}`)) as unknown[];
    return json.map((channel) => {
      const row = channel as Record<string, unknown>;
      return { id: String(row.id), name: String(row.name), type: Number(row.type) };
    });
  }

  async fetchGuildRoles(botToken: string, guildId: string): Promise<DiscordRoleOption[]> {
    const json = (await this.discordFetch(`/guilds/${guildId}/roles`, `Bot ${botToken}`)) as unknown[];
    return json.map((role) => {
      const row = role as Record<string, unknown>;
      return { id: String(row.id), name: String(row.name), managed: Boolean(row.managed) };
    });
  }

  private async discordFetch(path: string, authorization: string): Promise<unknown> {
    const response = await fetch(`https://discord.com/api/v10${path}`, { headers: { authorization } });
    return parseDiscordResponse(response);
  }
}

async function parseDiscordResponse(response: Response): Promise<unknown> {
  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const message = typeof json.message === 'string' ? json.message : 'Discord API request failed';
    throw new Error(message);
  }
  return json;
}
