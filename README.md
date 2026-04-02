# CrowdFlare

<p align="center">
  <img src="./assets/logo.png" alt="CrowdFlare logo" width="360" />
</p>

<p align="center">
  <strong>🔥 CrowdFlare is a Cursor plugin that lets your crowd steer your agentic build in real time 🔥</strong>
</p>

## 🚀 What It Does

CrowdFlare turns solo prompting into multiplayer development:

1. 🤖 Your Cursor agent builds.
2. 🛑 At big forks, CrowdFlare asks the crowd to vote in Discord.
3. ✅ The winning option becomes the next build direction.
4. 🧠 The decision gets logged in [`DECISIONS.md`](./DECISIONS.md).
5. 🔁 Repeat until the product is weird, working, and alive.

## ⚙️ How It Works (Super Simple)

1. 🧾 You give the agent a broad brief.
2. 🎯 The rule in [`.cursor/rules/crowd-driven-agent.mdc`](./.cursor/rules/crowd-driven-agent.mdc) tells it when to ask the crowd.
3. 💬 [`scripts/discord-helper.mjs`](./scripts/discord-helper.mjs) handles Discord actions:
   - list channels
   - post poll messages
   - seed reactions
   - tally winners
   - ingest weighted steering signals with `steering-batch`
4. 🗂️ Crowd memory is persisted in:
   - [`DECISIONS.md`](./DECISIONS.md)
   - `.crowdflare/discord-steering-state.json`

## 🧩 What’s In This Plugin

- [`.cursor/rules/crowd-driven-agent.mdc`](./.cursor/rules/crowd-driven-agent.mdc) -> crowd decision loop
- [`commands/crowdflare.md`](./commands/crowdflare.md) -> starter command
- [`agents/crowdflare.md`](./agents/crowdflare.md) -> starter agent persona
- [`skills/crowdflare/SKILL.md`](./skills/crowdflare/SKILL.md) -> starter skill
- [`scripts/discord-helper.mjs`](./scripts/discord-helper.mjs) -> Discord helper CLI
- [`DECISIONS.md`](./DECISIONS.md) -> append-only decision log

## 🛠️ Quick Setup

1. Create `.env` in repo root:
   - `DISCORD_TOKEN=<your-bot-token>`
   - `DISCORD_GUILD_ID=<your-server-id>`
2. Validate setup:
   ```bash
   node scripts/validate-template.mjs
   ```
3. Start Cursor Agent in this repo.
4. Give it a brief and let it build.

## 📟 Command Cheat Sheet

```bash
# list channels
node scripts/discord-helper.mjs list-channels

# post a poll message
node scripts/discord-helper.mjs send <channelId> "🔥 DECISION #1: Neon glitch or bloody minimal?"

# add reaction options
node scripts/discord-helper.mjs react <channelId> <messageId> 🟥
node scripts/discord-helper.mjs react <channelId> <messageId> 🟦

# tally winner
node scripts/discord-helper.mjs tally <channelId> <messageId> 🟥 🟦

# pull weighted steering from new crowd messages
node scripts/discord-helper.mjs steering-batch <channelId>
```

## 🎬 Slick Demo: Build A Weird Berserk Site

Use this exact flow:

1. 🗣️ Prompt:
   `"Build a weird berserk one-page site with violent typography, cursed motion, and interactive chaos."`
2. 🧪 First fork poll:
   `"😈 Visual vibe? 🟥 BLOOD ARCADE | 🟦 GLITCH RITUAL"`
3. 🎨 Second fork poll:
   `"🌀 Hero effect? 🟥 Screen tear shader | 🟦 Eye-tracking curse cursor"`
4. 🔊 Third fork poll:
   `"🎛️ Interaction style? 🟥 Hover triggers distortion | 🟦 Click summons random lore cards"`
5. 🧠 Run `steering-batch`, paste `steering_text` into the next agent prompt, keep shipping.
6. 📸 End state:
   - live weird site
   - visible vote trail in Discord
   - full decisions in [`DECISIONS.md`](./DECISIONS.md)

## 🧯 If Discord Bot Access Is Blocked

Paste poll text manually into Discord, collect the winner, then keep logging the result in [`DECISIONS.md`](./DECISIONS.md).
