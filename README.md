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

# CrowdFlare

CrowdFlare is a clean single-plugin Cursor scaffold for hackathon work. It is a Cursor plugin, not a VS Code extension, so there is nothing to compile or package before your teammate starts dropping in the funny stuff.

## What is here

| Path                            | Purpose                                     |
| ------------------------------- | ------------------------------------------- |
| `.cursor-plugin/plugin.json`    | Plugin manifest and metadata                |
| `rules/crowdflare.mdc`          | Base rule stub                              |
| `skills/crowdflare/SKILL.md`    | Reusable workflow stub                      |
| `agents/crowdflare.md`          | Agent persona stub                          |
| `commands/crowdflare.md`        | Command stub                                |
| `assets/logo.svg`               | Placeholder logo                            |
| `scripts/validate-template.mjs` | Local validator for this single-plugin repo |

## First things to customize

1. Edit `.cursor-plugin/plugin.json` with the real author, URLs, version, and submission metadata.
2. Replace the starter content in `rules/`, `skills/`, `agents/`, and `commands/` with your actual hackathon flow.
3. Swap `assets/logo.svg` if you want a real brand mark before shipping.
4. Add `hooks/` or `mcp.json` only if the plugin actually needs them.

## Validate

```bash
node scripts/validate-template.mjs
```

The validator supports the official single-plugin repo layout, so this repo does not need a `.cursor-plugin/marketplace.json`.

## Official references

- [Cursor plugins docs](https://cursor.com/docs/plugins)
- [Cursor plugin reference](https://cursor.com/docs/reference/plugins)
- [Cursor plugin template](https://github.com/cursor/plugin-template)
- [Cursor add-a-plugin guide](https://github.com/cursor/plugin-template/blob/main/docs/add-a-plugin.md)
- [Official `create-plugin` manifest example](https://github.com/cursor/plugins/blob/main/create-plugin/.cursor-plugin/plugin.json)

## License

MIT. See [LICENSE](./LICENSE).
