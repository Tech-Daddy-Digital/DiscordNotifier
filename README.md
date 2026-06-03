# PulseDaddy

PulseDaddy is the working name for the Tech Daddy Digital Discord Notification Bot: a self-hostable Discord bot for creator and service notifications.

The long-term goal is to monitor selected YouTube, Twitch, Kick, X/Twitter, Bluesky, and Instagram accounts, then post customizable Discord notifications to the channels and roles chosen by each server administrator.

This first repository commit is the clean MVP scaffold: Discord connection, slash-command registration, a health endpoint, a secured placeholder notification endpoint, Docker deployment, tests, linting, and documentation. Real third-party service adapters come next.

## Why PulseDaddy?

PulseDaddy fits the project brief: it is short, memorable, notification-themed, and still carries the Tech Daddy Digital brand voice. The prior name research recommended it as the top candidate, but this is not legal trademark clearance.

## Current features

- TypeScript + Node.js LTS project structure.
- Discord bot login via `DISCORD_TOKEN`.
- `/status` slash command.
- Fastify HTTP server with `GET /health`.
- `POST /notifications/placeholder` route for smoke-testing Discord delivery.
- Optional bearer-token auth for the placeholder route.
- Environment validation with Zod.
- Pino logging.
- Dockerfile and Docker Compose deployment.
- GitHub Actions CI.
- Unit tests for configuration, HTTP auth, and Discord notification routing.

## Planned integrations

The architecture is intentionally adapter-friendly. Planned adapters:

1. YouTube
   - Detect scheduled livestream creation.
   - Detect the actual transition to live.
   - Detect unscheduled livestreams.
   - Detect new uploaded videos.
2. Twitch
   - Detect stream start and relevant channel events.
3. Kick
   - Detect stream start and new channel activity, depending on public API stability.
4. X/Twitter
   - Detect new posts for configured accounts, subject to API access tier.
5. Bluesky
   - Detect new posts via the AT Protocol APIs.
6. Instagram
   - Detect new posts where Meta API permissions allow it.

## Prerequisites

For local development:

- Node.js 20 or newer. Node 22 LTS is recommended.
- npm.
- A Discord account.
- Permission to create a Discord application/bot.
- A Discord server where you can invite the bot.

For Docker deployment:

- Docker Engine or Docker Desktop.
- Docker Compose plugin.

## Discord setup, step by step

1. Open the Discord Developer Portal:
   https://discord.com/developers/applications

2. Click "New Application".

3. Give it a name, for example `PulseDaddy`.

4. Open the "Bot" page.

5. Click "Add Bot" if Discord has not already created one.

6. Under "Token", click "Reset Token" or "View Token" and copy it.
   This is your `DISCORD_TOKEN`. Keep it secret.

7. Open the "OAuth2" -> "General" page and copy the Application ID.
   This is your `DISCORD_CLIENT_ID`.

8. Invite the bot to your test server:
   - Open "OAuth2" -> "URL Generator".
   - Select scopes: `bot` and `applications.commands`.
   - Select bot permissions: `Send Messages`, `Embed Links`, `Read Message History`, and `View Channels`.
   - Copy the generated URL, open it in your browser, and choose your server.

9. Get your test server ID and notification channel ID:
   - In Discord, enable Developer Mode: User Settings -> Advanced -> Developer Mode.
   - Right-click your server and choose "Copy Server ID". This is `DISCORD_GUILD_ID`.
   - Right-click the target text channel and choose "Copy Channel ID". This is `DISCORD_NOTIFICATION_CHANNEL_ID`.

Using `DISCORD_GUILD_ID` is recommended during testing because slash commands update almost immediately in one server. Without it, commands are registered globally and may take up to an hour to appear.

## Local setup

```bash
git clone git@github.com:Tech-Daddy-Digital/DiscordNotifier.git
cd DiscordNotifier
cp .env.example .env
```

Edit `.env` and fill in the Discord values.

Install dependencies:

```bash
npm install
```

Run checks:

```bash
npm run check
```

Register slash commands:

```bash
npm run discord:register
```

Start the bot:

```bash
npm run dev
```

Open another terminal and check the health endpoint:

```bash
curl http://127.0.0.1:3000/health
```

Send a placeholder notification:

```bash
curl -X POST http://127.0.0.1:3000/notifications/placeholder   -H 'Content-Type: application/json'   -H 'Authorization: Bearer change-me-before-public-deploy'   -d '{"title":"PulseDaddy test","message":"Discord delivery works."}'
```

If you leave `NOTIFICATION_WEBHOOK_TOKEN` blank, the placeholder endpoint does not require the Authorization header. For any public or cloud deployment, set a strong token.

## Docker Compose setup

```bash
git clone git@github.com:Tech-Daddy-Digital/DiscordNotifier.git
cd DiscordNotifier
cp .env.example .env
# edit .env first
docker compose up -d --build
```

View logs:

```bash
docker compose logs -f
```

Stop the bot:

```bash
docker compose down
```

## Cloud or VPS deployment notes

1. Create a small Linux VPS.
2. Install Docker and the Docker Compose plugin.
3. Clone this repository.
4. Copy `.env.example` to `.env` and fill in secrets.
5. Run `docker compose up -d --build`.
6. If exposing the HTTP endpoint publicly, put it behind HTTPS with a reverse proxy such as Caddy, Traefik, Nginx Proxy Manager, or Cloudflare Tunnel.
7. Always set `NOTIFICATION_WEBHOOK_TOKEN` for exposed endpoints.

## API credentials needed later

These are not required for the current scaffold, but will be needed for future adapter work.

### YouTube

- Google Cloud project.
- YouTube Data API v3 enabled.
- API key or OAuth credentials depending on polling strategy.
- Channel IDs to monitor.

Important product requirement: YouTube livestream notifications must distinguish scheduled livestream creation from actual live start. The future YouTube adapter should track both `liveBroadcastContent`/live broadcast metadata and state transitions so scheduled streams can produce a "scheduled" alert and a separate "now live" alert.

### Twitch

- Twitch Developer application.
- Client ID.
- Client secret.
- EventSub webhook or polling credentials.
- Broadcaster/channel IDs to monitor.

### Kick

- Kick API credentials if available for the chosen endpoints.
- Channel slugs or IDs to monitor.

Kick API availability has changed over time, so implementation should verify current official options before building the adapter.

### X/Twitter

- X Developer account.
- Project/app credentials.
- API access level that permits reading target account posts.
- Account IDs or handles to monitor.

X API pricing and access rules change often. Documentation should be verified when this adapter is implemented.

### Bluesky

- Bluesky handle/DID targets.
- App password if authenticated reads are required.
- AT Protocol endpoint access.

### Instagram

- Meta Developer app.
- Instagram Graph API permissions.
- Business or Creator account linkage if needed.
- Account IDs to monitor.

Instagram is the most permission-sensitive planned integration. Personal-profile scraping should be avoided.

## Repository layout

```text
src/
  config.ts                         Environment validation
  logger.ts                         Pino logger
  index.ts                          Application entrypoint
  http-server.ts                    Fastify HTTP routes
  discord/
    bot.ts                          Discord client setup
    commands.ts                     Slash command definitions and handlers
    register-commands.ts            Discord command registration
  notifications/
    notification-router.ts          Discord notification delivery abstraction
tests/                              Vitest tests
scripts/smoke-config.ts             Safe config smoke check
Dockerfile                          Container image
compose.yaml                        Local/self-hosted deployment
.github/workflows/ci.yml            GitHub Actions CI
```

## Development workflow

```bash
npm install
npm run check
npm run dev
```

Useful commands:

```bash
npm run build
npm test
npm run lint
npm run smoke:config
npm run discord:register
```

## Security notes

- Never commit `.env`.
- Never paste Discord bot tokens into issues, logs, or chat.
- Rotate tokens immediately if they are exposed.
- Use `NOTIFICATION_WEBHOOK_TOKEN` before exposing the HTTP route to a network you do not fully control.
- Keep Discord permissions minimal until a feature actually needs more.

## License

MIT. See `LICENSE`.
