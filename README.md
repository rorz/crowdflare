# Crowdflare

Crowdflare is a small Cursor-oriented scaffold for a crowd-steered coding demo:

- a project rule in `.cursor/rules/crowd-driven-agent.mdc` tells the agent when to poll
- `DECISIONS.md` stores the crowd's decisions
- the extension command copies a starter prompt into Cursor chat so each run begins consistently

## What this is good for

This is suitable for a hackathon demo where Cursor or `cursor-agent` runs on your machine for 30 to 90 minutes while Discord steers visible product decisions.

It is **not** a complete always-on backend by itself. For a true unattended service, move the Discord polling loop into an external process and treat Cursor as the development environment, not the runtime.

## Files

- `.cursor/rules/crowd-driven-agent.mdc`: agent behavior
- `.cursor/mcp.json.example`: example Discord MCP config
- `DECISIONS.md`: append-only decision log
- `src/extension.ts`: tiny extension that opens chat and copies the run prompt

## Recommended demo flow

1. Configure Discord MCP in Cursor using `.cursor/mcp.json.example`.
2. Start Cursor Agent or `cursor-agent` in this repo.
3. Paste a vague brief such as `build a snake game`.
4. Let the agent code until a real product fork appears.
5. The agent posts a two-option Discord poll, waits about 30 seconds, reads the result, logs it, and continues.

## Constraint that matters

If you do **not** have permission to add a bot or app to the target Discord server, this architecture cannot post directly into that server. In that case:

- ask an admin to install the bot once, or
- ask for a webhook in one channel, or
- relay the agent's poll manually during the demo
