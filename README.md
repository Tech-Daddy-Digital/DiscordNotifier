# PulseDaddy

PulseDaddy is the working name for the Tech Daddy Digital Discord Notification Bot: a self-hostable Discord bot for creator and service notifications.

The long-term goal is to monitor selected YouTube, Twitch, Kick, X/Twitter, Bluesky, and Instagram accounts, then post customizable Discord notifications to the channels and roles chosen by each server administrator.

This MVP connects to Discord, registers slash commands, exposes a health endpoint, and supports secured webhook delivery for both generic smoke tests and a representative mock YouTube livestream-start notification. Real third-party service adapters come next.

## Why PulseDaddy?

PulseDaddy fits the project brief: it is short, memorable, notification-themed, and still carries the Tech Daddy Digital brand voice. The prior name research recommended it as the top candidate, but this is not legal trademark clearance.

## Current features

- TypeScript + Node.js LTS project structure.
- Discord bot login via `DISCORD_TOKEN`.
- `/status` slash command with current notification-channel/auth status.
- `/setup` slash command that explains the MVP environment/webhook configuration flow.
- Fastify HTTP server with `GET /health`.
- `POST /notifications/placeholder` route for generic smoke-testing Discord delivery.
- `POST /notifications/mock/youtube-live` route that sends a representative formatted YouTube livestream-start notification while real YouTube credentials are not yet configured.
- Optional bearer-token auth for notification routes.
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

## Environment variables

Copy `.env.example` to `.env` and configure these values:

| Variable | Required | Description |
| --- | --- | --- |
| `DISCORD_TOKEN` | Yes | Bot token from the Discord Developer Portal Bot page. Keep this secret and rotate it immediately if exposed. |
| `DISCORD_CLIENT_ID` | Yes | Application ID from OAuth2 -> General in the Discord Developer Portal. |
| `DISCORD_GUILD_ID` | Recommended for testing | Test server ID. Guild command registration updates almost immediately; global commands can take up to an hour. |
| `DISCORD_NOTIFICATION_CHANNEL_ID` | Yes | Default text channel where MVP notifications are posted. |
| `HTTP_HOST` | No | Bind address for the Fastify health/webhook server. Defaults to `0.0.0.0`. |
| `HTTP_PORT` | No | HTTP port. Defaults to `3000`. |
| `NOTIFICATION_WEBHOOK_TOKEN` | Strongly recommended | Shared bearer token for notification endpoints. Required for any public/cloud deployment. |
| `LOG_LEVEL` | No | Pino log level: `fatal`, `error`, `warn`, `info`, `debug`, `trace`, or `silent`. |
| `SEND_STARTUP_PLACEHOLDER_NOTIFICATION` | No | Set `true` to post a startup check message after Discord connects. Defaults to `false`. |

### Discord permissions and intents

PulseDaddy only needs the Discord `Guilds` gateway intent for the current MVP slash-command and notification flow. No privileged intents are required yet.

Invite the bot with these OAuth2 scopes:

- `bot`
- `applications.commands`

Grant the bot these minimum permissions in the target notification channel:

- View Channels
- Send Messages
- Embed Links
- Read Message History

If notifications return `202` but no Discord message appears, check that the bot role can see and send to `DISCORD_NOTIFICATION_CHANNEL_ID`.

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
curl -X POST http://127.0.0.1:3000/notifications/placeholder \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <your-webhook-token>' \
  -d '{"title":"PulseDaddy test","message":"Discord delivery works."}'
```

Send the MVP mock YouTube livestream-start notification:

```bash
curl -X POST http://127.0.0.1:3000/notifications/mock/youtube-live \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <your-webhook-token>' \
  -d '{
    "channelName": "Tech Daddy Digital",
    "videoTitle": "Friday Homelab Stream",
    "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "startedAt": "2026-06-03T06:32:00.000Z",
    "pingRoleId": "456789012345678901"
  }'
```

`pingRoleId` is optional. If you leave `NOTIFICATION_WEBHOOK_TOKEN` blank, the notification endpoints do not require the Authorization header. For any public or cloud deployment, set a strong token.

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

## Launch validation

The completed MVP launch checklist lives at `docs/launch-test-checklist.md`. It covers bot startup, Docker health, slash-command registration, notification delivery, formatting, configuration failures, malformed request handling, restart/reconnect behavior, and remaining manual Discord UI checks.

Before handing a deployment to a new owner, run:

```bash
npm run check
npm run smoke:config
npm run discord:register
docker compose up -d --build
curl http://127.0.0.1:3000/health
```

Then send both a placeholder notification and the mock YouTube livestream-start notification from the examples above. The HTTP response should be `202`, and the messages should appear in the configured Discord channel.

## Troubleshooting

### `Invalid configuration` on startup

Run:

```bash
npm run smoke:config
```

The error names the missing or invalid environment variables. Most launch failures are caused by missing `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, or `DISCORD_NOTIFICATION_CHANNEL_ID` values.

### Slash commands do not appear

- Confirm the bot invite included the `applications.commands` scope.
- During testing, set `DISCORD_GUILD_ID` and run `npm run discord:register` again.
- Restart Discord or wait a minute. Guild commands update quickly; global commands can take up to an hour.

### Notification endpoint returns `401`

`NOTIFICATION_WEBHOOK_TOKEN` is set, so include this header:

```text
Authorization: Bearer <your-webhook-token>
```

### Notification endpoint returns `400`

The JSON body is malformed or failed validation. Check required fields, URL formatting, and date formatting. The response includes field-level issues.

### Endpoint returns `202` but Discord does not show a message

- Confirm `DISCORD_NOTIFICATION_CHANNEL_ID` points to a text channel in the server where the bot is installed.
- Confirm the bot can View Channels, Send Messages, and Embed Links in that channel.
- Check recent container logs with `docker compose logs --tail=80 pulsedaddy`.

### Restart or reconnect testing

```bash
docker compose restart pulsedaddy
docker compose ps
curl http://127.0.0.1:3000/health
docker compose logs --tail=80 pulsedaddy
```

The container should return to `healthy`, the health endpoint should respond, and logs should show the Discord bot reconnecting.

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
    commands.ts                     Slash command definitions and handlers for /status and /setup
    register-commands.ts            Discord command registration
  notifications/
    notification-router.ts          Discord notification delivery and mock YouTube formatting
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
