#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_BASE = "https://discord.com/api/v10";
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = path.join(ROOT_DIR, ".env");

loadDotEnv();

function fail(message) {
  console.error(message);
  process.exit(1);
}

function env(name) {
  const value = process.env[name];
  if (!value) fail(`Missing ${name}`);
  return value;
}

function usage() {
  fail(
    [
      "Usage:",
      "  node scripts/discord-helper.mjs list-channels",
      "  node scripts/discord-helper.mjs send <channelId> <content>",
      "  node scripts/discord-helper.mjs react <channelId> <messageId> <emoji>",
      "  node scripts/discord-helper.mjs messages <channelId> [limit]",
      "  node scripts/discord-helper.mjs tally <channelId> <messageId> <emojiA> <emojiB>",
    ].join("\n")
  );
}

function loadDotEnv() {
  if (!existsSync(ENV_PATH)) return;

  const raw = readFileSync(ENV_PATH, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();
    if (!key || process.env[key]) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function encodeEmoji(emoji) {
  return encodeURIComponent(emoji);
}

async function discord(path, options = {}) {
  const token = env("DISCORD_TOKEN");
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    fail(`Discord API ${res.status} ${res.statusText}: ${text}`);
  }

  if (res.status === 204) {
    return null;
  }

  return res.json();
}

async function listChannels() {
  const guildId = env("DISCORD_GUILD_ID");
  const channels = await discord(`/guilds/${guildId}/channels`);
  const textChannels = channels
    .filter((channel) => channel.type === 0)
    .map((channel) => ({
      id: channel.id,
      name: channel.name,
      topic: channel.topic ?? "",
      parent_id: channel.parent_id ?? "",
    }));
  console.log(JSON.stringify(textChannels, null, 2));
}

async function sendMessage(channelId, content) {
  const message = await discord(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
  console.log(JSON.stringify({ id: message.id, channel_id: message.channel_id }, null, 2));
}

async function addReaction(channelId, messageId, emoji) {
  await discord(
    `/channels/${channelId}/messages/${messageId}/reactions/${encodeEmoji(emoji)}/@me`,
    { method: "PUT", headers: { "Content-Length": "0" } }
  );
  console.log(JSON.stringify({ ok: true, message_id: messageId, emoji }, null, 2));
}

async function listMessages(channelId, limit = "10") {
  const count = Number(limit);
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    fail("limit must be an integer between 1 and 100");
  }
  const messages = await discord(`/channels/${channelId}/messages?limit=${count}`);
  console.log(JSON.stringify(messages, null, 2));
}

async function tally(channelId, messageId, emojiA, emojiB) {
  const message = await discord(`/channels/${channelId}/messages/${messageId}`);
  const counts = new Map();
  for (const reaction of message.reactions ?? []) {
    counts.set(reaction.emoji.name, reaction.count_details?.normal ?? reaction.count ?? 0);
  }

  const seededAdjustment = 1;
  const a = Math.max((counts.get(emojiA) ?? 0) - seededAdjustment, 0);
  const b = Math.max((counts.get(emojiB) ?? 0) - seededAdjustment, 0);
  const winner = a === b ? "tie" : a > b ? emojiA : emojiB;

  console.log(
    JSON.stringify(
      {
        message_id: messageId,
        options: {
          [emojiA]: a,
          [emojiB]: b,
        },
        winner,
      },
      null,
      2
    )
  );
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command) usage();

  switch (command) {
    case "list-channels":
      return listChannels();
    case "send":
      if (args.length < 2) usage();
      return sendMessage(args[0], args.slice(1).join(" "));
    case "react":
      if (args.length !== 3) usage();
      return addReaction(args[0], args[1], args[2]);
    case "messages":
      if (args.length < 1 || args.length > 2) usage();
      return listMessages(args[0], args[1] ?? "10");
    case "tally":
      if (args.length !== 4) usage();
      return tally(args[0], args[1], args[2], args[3]);
    default:
      usage();
  }
}

await main();
