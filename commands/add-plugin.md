---
name: add-plugin
description: Add a plugin under plugins/ and register it in .cursor-plugin/marketplace.json (or wire in CrowdFlare from this repo).
---

# Add a plugin

The first message may name the plugin (for example `crowdflare`). Normalize it to **kebab-case** for folder and manifest `name`.

## 1. Target layout (marketplace repo)

If the workspace is a **multi-plugin** Cursor marketplace repo:

1. Create `plugins/<plugin-name>/` (or the path given by `metadata.pluginRoot` in `.cursor-plugin/marketplace.json`).
2. Add `plugins/<plugin-name>/.cursor-plugin/plugin.json` with required fields: `name`, `displayName`, `version`, `description`, `author`, `logo`, plus any paths for `rules`, `skills`, `agents`, `commands`, etc.
3. Add components only as needed (rules with frontmatter `description`, skills/agents/commands with frontmatter `name` + `description`, and so on).
4. Append to `.cursor-plugin/marketplace.json` `plugins[]`:

```json
{
  "name": "<plugin-name>",
  "source": "./plugins/<plugin-name>",
  "description": "Short description for the marketplace list"
}
```

`source` must be relative to the repo root and match the folder you created.

## 2. Adding CrowdFlare specifically

When the plugin name is **crowdflare** (this scaffold):

- Copy or subtree-merge this repository’s plugin content into the marketplace repo at `plugins/crowdflare/` (preserve `.cursor-plugin/plugin.json` and folders like `rules/`, `skills/`, `agents/`, `commands/`, `assets/`).
- Register `crowdflare` in `.cursor-plugin/marketplace.json` as above with `source` pointing at that folder.
- Run `node scripts/validate-template.mjs` from the **marketplace** repo root and fix any reported issues.

## 3. Single-plugin repos

If there is **no** `.cursor-plugin/marketplace.json` and the repo root already is one plugin (this repo’s layout), you are done: there is nothing to “add” under `plugins/`—only customize and validate:

```bash
node scripts/validate-template.mjs
```

## 4. Common pitfalls

- `name` in `plugin.json` and marketplace entry must match and stay kebab-case.
- `source` path must exist and match the plugin folder name.
- Rules need frontmatter `description`; skills, agents, and commands need `name` and `description`.
