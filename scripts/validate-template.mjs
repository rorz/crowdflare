#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const errors = [];
const warnings = [];

const pluginNamePattern = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
const marketplaceNamePattern = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

function addError(message) {
  errors.push(message);
}

function addWarning(message) {
  warnings.push(message);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDirectory(targetPath, context) {
  try {
    const stat = await fs.stat(targetPath);
    if (!stat.isDirectory()) {
      addError(`${context} exists but is not a directory: ${targetPath}`);
      return false;
    }
    return true;
  } catch {
    addError(`${context} directory is missing: ${targetPath}`);
    return false;
  }
}

async function readJsonFile(filePath, context) {
  let raw;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch {
    addError(`${context} is missing: ${filePath}`);
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    addError(`${context} contains invalid JSON (${filePath}): ${error.message}`);
    return null;
  }
}

function normalizeNewlines(content) {
  return content.replace(/\r\n/g, "\n");
}

function parseFrontmatter(content) {
  const normalized = normalizeNewlines(content);
  if (!normalized.startsWith("---\n")) {
    return null;
  }

  const closingIndex = normalized.indexOf("\n---\n", 4);
  if (closingIndex === -1) {
    return null;
  }

  const frontmatterBlock = normalized.slice(4, closingIndex);
  const fields = {};

  for (const line of frontmatterBlock.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    fields[key] = value;
  }

  return fields;
}

async function walkFiles(dirPath) {
  const files = [];
  const stack = [dirPath];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
      } else if (entry.isFile()) {
        files.push(entryPath);
      }
    }
  }

  return files;
}

function isSafeRelativePath(value) {
  if (!isNonEmptyString(value)) {
    return false;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return true;
  }

  if (path.isAbsolute(value)) {
    return false;
  }

  const normalized = path.posix.normalize(value.replace(/\\/g, "/"));
  return !normalized.startsWith("../") && normalized !== "..";
}

function extractPathValues(value) {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => extractPathValues(entry));
  }

  if (value && typeof value === "object") {
    const candidates = [];
    if (typeof value.path === "string") {
      candidates.push(value.path);
    }
    if (typeof value.file === "string") {
      candidates.push(value.file);
    }
    return candidates;
  }

  return [];
}

function validateRequiredPluginFields(pluginManifest, pluginName) {
  for (const field of ["name", "displayName", "version", "description", "logo"]) {
    if (!isNonEmptyString(pluginManifest[field])) {
      addError(`${pluginName}: "${field}" in plugin.json must be a non-empty string.`);
    }
  }

  if (!pluginManifest.author || typeof pluginManifest.author !== "object") {
    addError(`${pluginName}: "author" in plugin.json is required.`);
    return;
  }

  if (!isNonEmptyString(pluginManifest.author.name)) {
    addError(`${pluginName}: "author.name" in plugin.json must be a non-empty string.`);
  }
}

async function validateReferencedPath(pluginDir, fieldName, pathValue, pluginName) {
  if (pathValue.startsWith("http://") || pathValue.startsWith("https://")) {
    return;
  }

  if (!isSafeRelativePath(pathValue)) {
    addError(
      `${pluginName}: field "${fieldName}" has invalid path "${pathValue}". Use a relative path without ".." or absolute prefixes.`
    );
    return;
  }

  const resolved = path.resolve(pluginDir, pathValue);
  if (!(await pathExists(resolved))) {
    addError(`${pluginName}: field "${fieldName}" references missing path "${pathValue}".`);
  }
}

async function validateFrontmatterFile(filePath, componentName, requiredKeys, pluginName) {
  const content = await fs.readFile(filePath, "utf8");
  const parsed = parseFrontmatter(content);
  const relativeFile = path.relative(repoRoot, filePath);

  if (!parsed) {
    addError(`${pluginName}: ${componentName} file missing YAML frontmatter: ${relativeFile}`);
    return;
  }

  for (const key of requiredKeys) {
    if (!isNonEmptyString(parsed[key])) {
      addError(`${pluginName}: ${componentName} file missing "${key}" in frontmatter: ${relativeFile}`);
    }
  }
}

async function validateComponentFrontmatter(pluginDir, pluginName) {
  const componentChecks = [
    { dir: "rules", match: (file) => [".md", ".mdc", ".markdown"].includes(path.extname(file).toLowerCase()), type: "rule", required: ["description"] },
    { dir: "skills", match: (file) => path.basename(file) === "SKILL.md", type: "skill", required: ["name", "description"] },
    { dir: "agents", match: (file) => [".md", ".mdc", ".markdown"].includes(path.extname(file).toLowerCase()), type: "agent", required: ["name", "description"] },
    { dir: "commands", match: (file) => [".md", ".mdc", ".markdown", ".txt"].includes(path.extname(file).toLowerCase()), type: "command", required: ["name", "description"] },
  ];

  for (const check of componentChecks) {
    const targetDir = path.join(pluginDir, check.dir);
    if (!(await pathExists(targetDir))) {
      continue;
    }

    const files = await walkFiles(targetDir);
    for (const file of files) {
      if (check.match(file)) {
        await validateFrontmatterFile(file, check.type, check.required, pluginName);
      }
    }
  }
}

async function validatePlugin(pluginDir, pluginName, pluginManifest, expectedMarketplaceName) {
  validateRequiredPluginFields(pluginManifest, pluginName);

  if (!isNonEmptyString(pluginManifest.name) || !pluginNamePattern.test(pluginManifest.name)) {
    addError(
      `${pluginName}: "name" in plugin.json must be lowercase and use only alphanumerics, hyphens, and periods.`
    );
  }

  if (
    isNonEmptyString(expectedMarketplaceName) &&
    isNonEmptyString(pluginManifest.name) &&
    pluginManifest.name !== expectedMarketplaceName
  ) {
    addError(
      `${pluginName}: marketplace entry name does not match plugin.json name ("${pluginManifest.name}").`
    );
  }

  for (const field of ["logo", "rules", "skills", "agents", "commands", "hooks", "mcpServers"]) {
    const values = extractPathValues(pluginManifest[field]);
    for (const value of values) {
      await validateReferencedPath(pluginDir, field, value, pluginName);
    }
  }

  await validateComponentFrontmatter(pluginDir, pluginName);

  if (pluginManifest.hooks !== undefined) {
    const hooksPath = path.join(pluginDir, "hooks", "hooks.json");
    if (!(await pathExists(hooksPath))) {
      addWarning(`${pluginName}: manifest includes hooks, but hooks/hooks.json was not found.`);
    }
  }

  if (pluginManifest.mcpServers !== undefined) {
    const mcpPath = path.join(pluginDir, "mcp.json");
    if (!(await pathExists(mcpPath))) {
      addWarning(`${pluginName}: manifest includes MCP servers, but mcp.json was not found.`);
    }
  }
}

function resolveMarketplaceSource(source, pluginRoot) {
  if (!isNonEmptyString(source)) {
    return null;
  }

  if (!pluginRoot) {
    return source;
  }

  const normalizedRoot = pluginRoot.replace(/\\/g, "/").replace(/\/+$/, "");
  const normalizedSource = source.replace(/\\/g, "/");
  if (normalizedSource === normalizedRoot || normalizedSource.startsWith(`${normalizedRoot}/`)) {
    return normalizedSource;
  }

  return `${normalizedRoot}/${normalizedSource}`;
}

async function validateSinglePluginRepo() {
  const manifestPath = path.join(repoRoot, ".cursor-plugin", "plugin.json");
  const pluginManifest = await readJsonFile(manifestPath, "Plugin manifest");
  if (!pluginManifest) {
    summarizeAndExit();
    return;
  }

  const pluginName = isNonEmptyString(pluginManifest.name) ? pluginManifest.name : "plugin";
  await validatePlugin(repoRoot, pluginName, pluginManifest);
  summarizeAndExit();
}

async function validateMarketplaceRepo() {
  const marketplacePath = path.join(repoRoot, ".cursor-plugin", "marketplace.json");
  const marketplace = await readJsonFile(marketplacePath, "Marketplace manifest");
  if (!marketplace) {
    summarizeAndExit();
    return;
  }

  if (!isNonEmptyString(marketplace.name) || !marketplaceNamePattern.test(marketplace.name)) {
    addError(
      'Marketplace "name" must be lowercase kebab-case and start/end with an alphanumeric character.'
    );
  }

  if (!marketplace.owner || !isNonEmptyString(marketplace.owner.name)) {
    addError('Marketplace "owner.name" is required.');
  }

  if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length === 0) {
    addError('Marketplace "plugins" must be a non-empty array.');
    summarizeAndExit();
    return;
  }

  const pluginRoot = marketplace.metadata?.pluginRoot;
  if (pluginRoot !== undefined) {
    if (!isSafeRelativePath(pluginRoot)) {
      addError('Marketplace "metadata.pluginRoot" must be a safe relative path.');
    } else {
      await ensureDirectory(path.join(repoRoot, pluginRoot), 'Marketplace "metadata.pluginRoot"');
    }
  }

  const seenNames = new Set();
  for (const [index, entry] of marketplace.plugins.entries()) {
    const label = `plugins[${index}]`;

    if (!entry || typeof entry !== "object") {
      addError(`${label} must be an object.`);
      continue;
    }

    if (!isNonEmptyString(entry.name) || !pluginNamePattern.test(entry.name)) {
      addError(`${label}.name must be lowercase and use only alphanumerics, hyphens, and periods.`);
      continue;
    }

    if (seenNames.has(entry.name)) {
      addError(`Duplicate plugin name in marketplace manifest: "${entry.name}"`);
    }
    seenNames.add(entry.name);

    const sourcePath = resolveMarketplaceSource(entry.source, pluginRoot ?? "");
    if (!sourcePath) {
      addError(`${label}.source must be a string path.`);
      continue;
    }

    if (!isSafeRelativePath(sourcePath)) {
      addError(`${label}.source is not a safe relative path: "${sourcePath}"`);
      continue;
    }

    const pluginDir = path.join(repoRoot, sourcePath);
    if (!(await ensureDirectory(pluginDir, `${label}.source`))) {
      continue;
    }

    const manifestPath = path.join(pluginDir, ".cursor-plugin", "plugin.json");
    const pluginManifest = await readJsonFile(manifestPath, `${entry.name} plugin manifest`);
    if (!pluginManifest) {
      continue;
    }

    await validatePlugin(pluginDir, entry.name, pluginManifest, entry.name);
  }

  summarizeAndExit();
}

async function main() {
  const marketplacePath = path.join(repoRoot, ".cursor-plugin", "marketplace.json");
  if (await pathExists(marketplacePath)) {
    await validateMarketplaceRepo();
    return;
  }

  await validateSinglePluginRepo();
}

function summarizeAndExit() {
  if (warnings.length > 0) {
    console.log("Warnings:");
    for (const warning of warnings) {
      console.log(`- ${warning}`);
    }
    console.log("");
  }

  if (errors.length > 0) {
    console.error("Validation failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("Validation passed.");
}

await main();
