# Eousbot

Eousbot is a modular Discord community bot with an authenticated web dashboard. It combines social-link embed conversion, moderation, AutoMod, onboarding, community utilities, productivity commands, and content feeds.

## Features

- Social link conversion for X/Twitter, Instagram, TikTok, and Reddit, scoped to an explicit channel allowlist.
- Slash commands for suggestions, summaries, role pickers, verification setup, and moderation.
- Moderation case logging, warnings, timeouts, kicks, bans, and message cleanup.
- AutoMod for spam, caps, invite/link blocking, banned words, and escalation.
- Starboard, join-to-create voice rooms, auto-threading, greetings, and self-service roles.
- Reddit, YouTube, Twitch, and RSS feed polling.
- Discord OAuth dashboard with CSRF protection and an administrator ID allowlist.

## Requirements

- Node.js 20 or newer.
- A Discord application and bot token.
- Message Content, Guild Members, Guild Message Reactions, and Guild Voice States intents when the corresponding features are enabled.

## Local setup

```bash
npm ci
cp .env.example .env
# edit .env
npm test
npm start
```

The bot creates a `data/` directory at runtime. It contains non-secret settings, moderation cases, recorded dynamic voice channels, and starboard mappings. Credentials are read from environment variables and are never written to `data/settings.json`.

## Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DISCORD_TOKEN` | Yes | — | Bot token. |
| `DISCORD_CLIENT_ID` | For dashboard | — | Discord OAuth application client ID. |
| `DISCORD_CLIENT_SECRET` | For dashboard | — | Discord OAuth application secret. |
| `ADMIN_DISCORD_IDS` | For dashboard | — | Comma-separated Discord user IDs allowed into the dashboard. |
| `DASHBOARD_REDIRECT_URI` | No | `http://localhost:3000/api/auth/discord/callback` | OAuth callback; register the exact value in Discord. |
| `HEALTH_PORT` | No | `3000` | Dashboard and `/health` port. |
| `NODE_ENV` | No | — | Set to `production` to enable secure cookies. |
| `SOCIAL_EMBEDS_ENABLED` | No | `false` | Enable social-link conversion. Requires watched channels. |
| `TARGET_CHANNEL_IDS` | When social embeds are enabled | — | Comma-separated channel IDs. An empty list disables link processing. `TARGET_CHANNEL_ID` is accepted for compatibility. |
| `REPLACEMENT_DOMAIN` | No | `fxtwitter.com` | X/Twitter replacement hostname. |
| `DELETE_ORIGINAL` | No | `false` | Delete only messages that contain no attachment, sticker, or reply context. |
| `USE_WEBHOOK` | No | `false` | Repost social links through a channel webhook. |
| `INCLUDE_ORIGINAL_AUTHOR` | No | `true` | Mention the original author when posting as the bot. |
| `SUMMARIZER_ENABLED` | No | `true` | Enable `/summarize` and the message context summary command. |
| `CODE_HELPER_ENABLED` | No | `false` | Enable unformatted-code prompts. |
| `GEMINI_API_KEY` | No | — | Optional summary provider. |
| `OPENAI_API_KEY` | No | — | Optional summary fallback provider. |
| `VOICE_HUB_CHANNEL_IDS` | No | — | Enables voice hubs from environment configuration. |
| `VOICE_HUB_ROOM_FORMAT` | No | `Voice - {user}` | Dynamic voice room name template. |
| `STARBOARD_CHANNEL_ID` | No | — | Enables starboard in this channel. |
| `STARBOARD_THRESHOLD` | No | `3` | Stars required. |
| `SUGGESTION_CHANNEL_ID` | No | — | Enables `/suggest` in this channel. |
| `AUTO_THREAD_CHANNEL_IDS` | No | — | Enables auto-threading in these channels. |
| `VERIFIED_ROLE_ID` | No | — | Enables self-service verification. |
| `WELCOME_CHANNEL_ID` | No | — | Optional verification welcome channel. |
| `VERIFICATION_PROMPT` | No | Built-in prompt | Verification card text. |
| `MOD_LOG_CHANNEL_ID` | No | — | Moderation case log channel. |
| `GREETING_JOIN_CHANNEL_ID` | No | — | Join announcement channel. |
| `GREETING_LEAVE_CHANNEL_ID` | No | — | Leave announcement channel. |
| `GREETING_JOIN_MSG` | No | Built-in message | Join template. |
| `GREETING_LEAVE_MSG` | No | Built-in message | Leave template. |
| `GREETING_JOIN_DM` | No | Built-in message | Join DM template. |
| `TWITCH_CLIENT_ID` | For Twitch feeds | — | Twitch API client ID. |
| `TWITCH_CLIENT_SECRET` | For Twitch feeds | — | Twitch API client secret. |

RSS feed URLs are restricted to credential-free HTTP(S) URLs and private/local addresses are blocked. Feed configuration is available from the dashboard.

When an AI key is configured, `/summarize` sends the selected recent Discord message text to that provider. Do not enable an external provider for channels whose content cannot leave your organization.

## Discord permissions

Grant only the permissions required by enabled features. Moderation requires the relevant moderation permissions; social deletion requires Manage Messages; webhook reposting requires Manage Webhooks; role pickers and verification require Manage Roles; voice hubs require Manage Channels and Move Members; feeds and greetings require View Channel and Send Messages in their destinations.

Place the bot role above roles it must assign or moderate. The verification flow is self-service form gating, not CAPTCHA or moderator approval.

## Dashboard security

The dashboard is protected by Discord OAuth, `ADMIN_DISCORD_IDS`, an OAuth state nonce, HTTP-only session cookies, per-session CSRF tokens, and security response headers. Keep it behind HTTPS in production and register the exact HTTPS redirect URI.

Dashboard settings are schema-validated. The dashboard cannot change bot credentials, OAuth credentials, administrator IDs, or the listening port. Existing legacy settings files are migrated to remove persisted secrets.

## Development checks

```bash
npm test
npm audit --omit=dev
```

There is no Discord integration test environment in this repository, so validate enabled features in a disposable server before production use.
