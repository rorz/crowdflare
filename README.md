# CrowdFlare

<p align="center">
  <img src="./assets/logo.png" alt="CrowdFlare logo" width="360" />
</p>

<p align="center">
  <strong>CrowdFlare is a Cursor Plugin for crowdsourcing your agentic development sessions.</strong>
</p>

CrowdFlare turns a solo AI coding run into a crowd-steered build loop. Your Cursor agent keeps shipping, your audience votes on the forks that matter, and every decision is captured so judges can see the process, not just the final demo.

## Why This Is Hackathon-Strong

- Live audience participation: people shape product direction in real time.
- Faster high-signal decisions: poll only at meaningful forks, then keep momentum.
- Transparent execution: every vote is recorded in [`DECISIONS.md`](./DECISIONS.md).
- Built for demos: optimized for a focused 30-90 minute build sprint.

## How CrowdFlare Works

1. Start a Cursor session with a broad brief (for example: "build a tiny multiplayer party game").
2. The agent builds until it reaches a real decision point.
3. CrowdFlare posts a Discord poll using [`scripts/discord-helper.mjs`](./scripts/discord-helper.mjs).
4. Before the next coding iteration, CrowdFlare re-polls any non-bot channel messages posted after the latest CrowdFlare message via `steering-batch` and builds weighted steering context.
5. The winning option is applied and logged in [`DECISIONS.md`](./DECISIONS.md).
6. The session continues until you have a shippable demo and a visible decision trail.

## What Ships In This Plugin

- [`.cursor/rules/crowd-driven-agent.mdc`](./.cursor/rules/crowd-driven-agent.mdc): the crowd-vote operating loop for the agent.
- [`scripts/discord-helper.mjs`](./scripts/discord-helper.mjs): no-dependency Discord helper (list channels, send poll, react, tally, `steering-batch`).
- `.crowdflare/discord-steering-state.json`: local persisted checkpoint and signal log for delta message ingest.
- [`DECISIONS.md`](./DECISIONS.md): append-only vote and outcome log.
- [`commands/crowdflare.md`](./commands/crowdflare.md): starter Cursor command to kick off the workflow.
- [`agents/crowdflare.md`](./agents/crowdflare.md): starter CrowdFlare agent persona.
- [`skills/crowdflare/SKILL.md`](./skills/crowdflare/SKILL.md): starter skill you can tune to your team style.

## Quick Start

1. Create a `.env` file in repo root with:
   - `DISCORD_TOKEN=<your-bot-token>`
   - `DISCORD_GUILD_ID=<your-server-id>`
2. Open this repo in Cursor.
3. Run:
   ```bash
   node scripts/validate-template.mjs
   ```
4. Start Cursor Agent in this repo and give it a brief.
5. Let CrowdFlare drive decision polls and continue building from each crowd result.
6. Before each iteration, run `node scripts/discord-helper.mjs steering-batch <channelId>` and feed `steering_text` into the next prompt.

## Judge-Friendly Demo Script

1. Start with one sentence: "This is CrowdFlare, a Cursor plugin that lets a crowd steer an agentic build in real time."
2. Show the agent coding.
3. Trigger one visible fork and launch a Discord vote.
4. Show tally + automatic decision logging.
5. Ship the winning branch and highlight the decision history as proof of human-in-the-loop product direction.

## Practical Constraint

If you cannot install a bot in the target Discord server, direct posting will fail. In that case, relay polls manually and continue logging outcomes in [`DECISIONS.md`](./DECISIONS.md).
