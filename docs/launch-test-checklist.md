# PulseDaddy MVP launch test checklist

Test run: 2026-06-03
Environment: GameServer Docker Compose deployment in `/home/kris/TDD_Discord_Notify`
Branch under test: `main` plus this launch-validation documentation/fix branch
Discord target: Tech Daddy Digital Discord test server and configured notification channel

Do not paste bot tokens, webhook tokens, or raw `.env` values into this file.

## Completed checks

| Area | Check | Result | Evidence |
| --- | --- | --- | --- |
| Repository quality | `npm run check` builds TypeScript, runs Vitest, and runs ESLint | Pass | 14/14 tests passing after the validation fix |
| Docker startup | `docker compose ps` shows `pulsedaddy-discord-bot` running and healthy | Pass | Container was `Up` and `healthy` on port 3000 |
| HTTP health | `GET /health` returns service JSON | Pass | `{"ok":true,"service":"PulseDaddy Discord notification bot"}` |
| Discord command registration | `npm run discord:register` registers guild commands | Pass | Registered 2 guild slash commands |
| Slash command inventory | Discord API lists `/status` and `/setup` | Pass | `status` and `setup` command definitions returned for the configured guild |
| Webhook auth | POST without bearer auth is rejected | Pass | `POST /notifications/placeholder` without auth returned 401 `Unauthorized` |
| Placeholder notification delivery | Authenticated placeholder POST reaches Discord | Pass | Discord API found the test embed in the configured channel |
| Mock YouTube live formatting | Authenticated mock YouTube livestream POST reaches Discord as a red live embed | Pass | Discord API found the embed titled `🔴 Tech Daddy Digital is live on YouTube` with `Event: Stream started` |
| Configuration smoke | Valid `.env` loads without exposing secrets | Pass | `npm run smoke:config` reported guild, channel, auth, and HTTP config present |
| Missing config behavior | Empty environment fails clearly | Pass | Missing `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, and `DISCORD_NOTIFICATION_CHANNEL_ID` are named in the error |
| Malformed payload behavior | Bad notification request returns client error, not server error | Pass after fix | Invalid YouTube URL now returns HTTP 400 with `Invalid request body` |
| Recreate/reconnect | Docker Compose rebuild/recreate returns to healthy and reconnects to Discord | Pass | `docker compose up -d --build`; health endpoint recovered and logs showed Discord connected |
| Secrets hygiene | `.env` remains ignored and docs avoid raw secrets | Pass | `.gitignore` covers `.env`; test artifacts are sanitized |

## Bugs found during validation

1. Malformed notification payloads originally returned HTTP 500 because Zod validation errors were not converted into client-facing 400 responses.
   - Status: fixed in `src/http-server.ts`.
   - Regression coverage: `tests/youtube-http.test.ts` now verifies malformed YouTube payloads return 400 and do not send a Discord message.

No critical launch blocker remains undocumented.

## Manual Discord UI checks still recommended before public launch

These require a human clicking inside Discord, because bot accounts cannot invoke slash commands through the normal user interaction path:

- Run `/status` in the test server and confirm the ephemeral response names the configured notification channel and webhook-auth state.
- Run `/setup` and confirm the ephemeral setup instructions are readable to a non-technical server owner.
- Confirm the bot role appears with only the intended permissions: View Channels, Send Messages, Embed Links, Read Message History, and application command access.

## Repeatable smoke commands

From the deployed project directory:

```bash
cd /home/kris/TDD_Discord_Notify
npm run check
npm run discord:register
docker compose up -d --build
curl http://127.0.0.1:3000/health
```

Authenticated placeholder notification:

```bash
curl -X POST http://127.0.0.1:3000/notifications/placeholder \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <your-webhook-token>' \
  -d '{"title":"PulseDaddy launch smoke test","message":"Discord delivery works."}'
```

Authenticated mock YouTube livestream-start notification:

```bash
curl -X POST http://127.0.0.1:3000/notifications/mock/youtube-live \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <your-webhook-token>' \
  -d '{
    "channelName": "Tech Daddy Digital",
    "videoTitle": "PulseDaddy launch smoke test",
    "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "startedAt": "2026-06-03T12:01:30.000Z"
  }'
```
