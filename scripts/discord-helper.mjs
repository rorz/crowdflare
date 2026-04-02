#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_BASE = "https://discord.com/api/v10";
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = path.join(ROOT_DIR, ".env");
const STEERING_STATE_DIR = path.join(ROOT_DIR, ".crowdflare");
const STEERING_STATE_PATH = path.join(STEERING_STATE_DIR, "discord-steering-state.json");

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
      "  node scripts/discord-helper.mjs steering-batch <channelId>",
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

function nowIso() {
  return new Date().toISOString();
}

function snowflakeToBigInt(value) {
  if (typeof value !== "string" || value.length === 0) return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

function compareSnowflake(a, b) {
  const aBig = snowflakeToBigInt(a);
  const bBig = snowflakeToBigInt(b);
  if (aBig === bBig) return 0;
  return aBig > bBig ? 1 : -1;
}

function maxSnowflake(values) {
  let max = null;
  for (const value of values) {
    if (typeof value !== "string" || value.length === 0) continue;
    if (max === null || compareSnowflake(value, max) > 0) {
      max = value;
    }
  }
  return max;
}

function minSnowflake(values) {
  let min = null;
  for (const value of values) {
    if (typeof value !== "string" || value.length === 0) continue;
    if (min === null || compareSnowflake(value, min) < 0) {
      min = value;
    }
  }
  return min;
}

function readSteeringState() {
  if (!existsSync(STEERING_STATE_PATH)) {
    return { channels: {} };
  }

  try {
    const parsed = JSON.parse(readFileSync(STEERING_STATE_PATH, "utf8"));
    if (!parsed || typeof parsed !== "object") {
      throw new Error("State root must be an object");
    }
    if (!parsed.channels || typeof parsed.channels !== "object") {
      parsed.channels = {};
    }
    return parsed;
  } catch (error) {
    mkdirSync(STEERING_STATE_DIR, { recursive: true });
    const backupPath = `${STEERING_STATE_PATH}.bad-${Date.now()}.json`;
    try {
      renameSync(STEERING_STATE_PATH, backupPath);
    } catch {
      /* if backup fails, continue with reset */
    }
    console.error(
      `Warning: malformed steering state; reset to empty state. Backup: ${backupPath}. Error: ${error.message}`
    );
    return { channels: {} };
  }
}

function writeSteeringState(state) {
  mkdirSync(STEERING_STATE_DIR, { recursive: true });
  const tmpPath = `${STEERING_STATE_PATH}.tmp`;
  writeFileSync(tmpPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  renameSync(tmpPath, STEERING_STATE_PATH);
}

function ensureChannelState(state, channelId) {
  if (!state.channels[channelId] || typeof state.channels[channelId] !== "object") {
    state.channels[channelId] = {};
  }
  const channelState = state.channels[channelId];
  if (typeof channelState.last_checkpoint_message_id !== "string") {
    channelState.last_checkpoint_message_id = "";
  }
  if (!Array.isArray(channelState.processed_reply_ids)) {
    channelState.processed_reply_ids = [];
  }
  if (!channelState.known_decision_ids || typeof channelState.known_decision_ids !== "object") {
    channelState.known_decision_ids = {};
  }
  if (!Array.isArray(channelState.signal_log)) {
    channelState.signal_log = [];
  }
  return channelState;
}

function reactionCounts(reactions) {
  let positive = 0;
  let down = 0;
  for (const reaction of reactions ?? []) {
    const name = reaction?.emoji?.name;
    const count = reaction?.count_details?.normal ?? reaction?.count ?? 0;
    if (!Number.isFinite(count) || count <= 0) continue;
    if (name === "👎") {
      down += count;
      continue;
    }
    positive += count;
  }
  return { positive, down };
}

function computePower({ positive, down }) {
  if (positive > 0) {
    return { suppressed: false, power: Math.min(64, 2 ** positive) };
  }
  if (down > 0) {
    return { suppressed: true, power: 0 };
  }
  return { suppressed: false, power: 1 };
}

function cleanContent(content) {
  if (typeof content !== "string") return "";
  return content.replace(/\s+/g, " ").trim();
}

function buildSteeringText(signals) {
  if (signals.length === 0) {
    return [
      "Crowd steering context:",
      "- No included crowd message signals yet.",
      "- Proceed with default implementation judgment.",
    ].join("\n");
  }

  const lines = ["Crowd steering context (weighted):"];
  for (const signal of signals) {
    const author = signal.author || "unknown";
    const content = signal.content || "(empty message)";
    lines.push(
      `- [power ${signal.power}] ${signal.decision_id} by ${author}: ${content}`
    );
  }
  lines.push(
    "- Treat higher-power signals as stronger preference guidance, not hard constraints."
  );
  return lines.join("\n");
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
  const rawA = counts.get(emojiA) ?? 0;
  const rawB = counts.get(emojiB) ?? 0;
  const a = Math.max(rawA - seededAdjustment, 0);
  const b = Math.max(rawB - seededAdjustment, 0);
  const winner = a === b ? "tie" : a > b ? emojiA : emojiB;

  console.log(
    JSON.stringify(
      {
        message_id: messageId,
        seed_adjustment: seededAdjustment,
        options: {
          [emojiA]: {
            raw: rawA,
            adjusted: a,
          },
          [emojiB]: {
            raw: rawB,
            adjusted: b,
          },
        },
        winner,
        summary:
          winner === "tie"
            ? `${emojiA} ${a} vs ${emojiB} ${b} -> tie`
            : `${winner} wins (${emojiA} ${a} vs ${emojiB} ${b})`,
      },
      null,
      2
    )
  );
}

async function fetchMessagesAfter(channelId, afterId = "") {
  const all = [];
  const seen = new Set();
  if (afterId) {
    let cursor = afterId;
    while (true) {
      const batch = await discord(`/channels/${channelId}/messages?limit=100&after=${cursor}`);
      if (!Array.isArray(batch) || batch.length === 0) {
        break;
      }

      for (const message of batch) {
        if (!message?.id || seen.has(message.id)) continue;
        seen.add(message.id);
        all.push(message);
      }

      const maxId = maxSnowflake(batch.map((message) => message?.id).filter(Boolean));
      if (!maxId || maxId === cursor) {
        break;
      }
      cursor = maxId;

      if (batch.length < 100) {
        break;
      }
    }
  } else {
    let beforeCursor = "";
    while (true) {
      const suffix = beforeCursor ? `&before=${beforeCursor}` : "";
      const batch = await discord(`/channels/${channelId}/messages?limit=100${suffix}`);
      if (!Array.isArray(batch) || batch.length === 0) {
        break;
      }

      for (const message of batch) {
        if (!message?.id || seen.has(message.id)) continue;
        seen.add(message.id);
        all.push(message);
      }

      const minId = minSnowflake(batch.map((message) => message?.id).filter(Boolean));
      if (!minId || minId === beforeCursor) {
        break;
      }
      beforeCursor = minId;

      if (batch.length < 100) {
        break;
      }
    }
  }

  all.sort((a, b) => compareSnowflake(a.id, b.id));
  return all;
}

async function getBotUserId() {
  const me = await discord("/users/@me");
  if (!me?.id) {
    fail("Could not resolve bot user id from Discord");
  }
  return me.id;
}

async function findLatestCrowdflareMessageId(channelId, botUserId) {
  let beforeCursor = "";
  while (true) {
    const suffix = beforeCursor ? `&before=${beforeCursor}` : "";
    const batch = await discord(`/channels/${channelId}/messages?limit=100${suffix}`);
    if (!Array.isArray(batch) || batch.length === 0) {
      break;
    }

    for (const message of batch) {
      if (message?.author?.id === botUserId && typeof message?.id === "string") {
        return message.id;
      }
    }

    const minId = minSnowflake(batch.map((message) => message?.id).filter(Boolean));
    if (!minId || minId === beforeCursor) {
      break;
    }
    beforeCursor = minId;

    if (batch.length < 100) {
      break;
    }
  }

  return "";
}

async function steeringBatch(channelId) {
  const state = readSteeringState();
  const channelState = ensureChannelState(state, channelId);
  const processedMessageIds = new Set(channelState.processed_reply_ids);
  const newLogEntries = [];
  const botUserId = await getBotUserId();
  const latestCrowdflareMessageId = await findLatestCrowdflareMessageId(channelId, botUserId);
  const iterationKey = latestCrowdflareMessageId
    ? `after-crowdflare-${latestCrowdflareMessageId}`
    : "after-crowdflare";

  if (!latestCrowdflareMessageId) {
    writeSteeringState(state);
    console.log(
      JSON.stringify(
        {
          channel_id: channelId,
          last_crowdflare_message_id: null,
          checkpoint_message_id: channelState.last_checkpoint_message_id || null,
          polling_mode: "after-latest-crowdflare",
          note: "No CrowdFlare bot message found in this channel yet.",
          new_messages: 0,
          included_messages: 0,
          suppressed_messages: 0,
          new_replies: 0,
          included_replies: 0,
          suppressed_replies: 0,
          signals: [],
          steering_text: buildSteeringText([]),
        },
        null,
        2
      )
    );
    return;
  }

  // Always repoll the full post-anchor window so reaction changes are reflected every run.
  const fetched = await fetchMessagesAfter(channelId, latestCrowdflareMessageId);
  let windowMessages = 0;
  let includedMessages = 0;
  let suppressedMessages = 0;
  const currentSignals = [];

  for (const message of fetched) {
    const messageId = message?.id;
    if (!messageId) continue;
    if (message?.author?.id === botUserId) continue;

    windowMessages += 1;
    const counts = reactionCounts(message.reactions ?? []);
    const powerResult = computePower(counts);
    const author =
      message?.author?.global_name ??
      message?.author?.username ??
      message?.author?.id ??
      "unknown";
    const content = cleanContent(message?.content ?? "");

    const signalEntry = {
      decision_id: iterationKey,
      decision_message_id: latestCrowdflareMessageId || null,
      reply_id: messageId,
      author,
      content,
      power: powerResult.power,
      positive_reactions: counts.positive,
      down_reactions: counts.down,
      status: powerResult.suppressed ? "suppressed" : "included",
      ingested_at: nowIso(),
    };

    newLogEntries.push(signalEntry);
    processedMessageIds.add(messageId);

    if (powerResult.suppressed) {
      suppressedMessages += 1;
      continue;
    }

    includedMessages += 1;
    currentSignals.push({
      decision_id: signalEntry.decision_id,
      decision_message_id: signalEntry.decision_message_id,
      reply_id: signalEntry.reply_id,
      author: signalEntry.author,
      content: signalEntry.content,
      power: signalEntry.power,
    });
  }

  if (newLogEntries.length > 0) {
    const loggedIds = new Set((channelState.signal_log ?? []).map((entry) => entry.reply_id));
    for (const entry of newLogEntries) {
      if (loggedIds.has(entry.reply_id)) continue;
      channelState.signal_log.push(entry);
      loggedIds.add(entry.reply_id);
    }
  }

  channelState.processed_reply_ids = Array.from(processedMessageIds);
  const maxFetchedId = maxSnowflake(fetched.map((message) => message?.id).filter(Boolean));
  if (maxFetchedId) {
    channelState.last_checkpoint_message_id =
      channelState.last_checkpoint_message_id &&
      compareSnowflake(channelState.last_checkpoint_message_id, maxFetchedId) > 0
        ? channelState.last_checkpoint_message_id
        : maxFetchedId;
  }

  writeSteeringState(state);

  currentSignals.sort((a, b) => {
    if (a.power !== b.power) return b.power - a.power;
    return compareSnowflake(b.reply_id, a.reply_id);
  });

  console.log(
    JSON.stringify(
      {
        channel_id: channelId,
        last_crowdflare_message_id: latestCrowdflareMessageId || null,
        checkpoint_message_id: channelState.last_checkpoint_message_id || null,
        polling_mode: "after-latest-crowdflare",
        new_messages: windowMessages,
        included_messages: includedMessages,
        suppressed_messages: suppressedMessages,
        new_replies: windowMessages,
        included_replies: includedMessages,
        suppressed_replies: suppressedMessages,
        signals: currentSignals,
        steering_text: buildSteeringText(currentSignals),
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
    case "steering-batch":
      if (args.length !== 1) usage();
      return steeringBatch(args[0]);
    default:
      usage();
  }
}

await main();
