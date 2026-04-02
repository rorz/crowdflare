# CrowdFlare

CrowdFlare is a clean single-plugin Cursor scaffold for hackathon work. It is a Cursor plugin, not a VS Code extension, so there is nothing to compile or package before your teammate starts dropping in the funny stuff.

## What is here

| Path | Purpose |
|------|---------|
| `.cursor-plugin/plugin.json` | Plugin manifest and metadata |
| `rules/crowdflare.mdc` | Base rule stub |
| `skills/crowdflare/SKILL.md` | Reusable workflow stub |
| `agents/crowdflare.md` | Agent persona stub |
| `commands/crowdflare.md` | Command stub |
| `assets/logo.svg` | Placeholder logo |
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
