const { createPublicKey, randomInt, verify } = require("node:crypto");
const { moods } = require("./commands");

const snowflake = /^\d{17,20}$/;
const ed25519Prefix = Buffer.from("302a300506032b6570032100", "hex");
const dateIdeas = {
  "At home": [
    "Make a snack board from whatever is in the kitchen, then pick a movie for each other.",
    "Build a mini playlist of songs that remind you of each other and play it over dinner.",
    "Cook the same recipe together and give your meal a ridiculous restaurant name.",
    "Do a blind taste test with three snacks and try to guess each one.",
  ],
  Outdoors: [
    "Take a photo scavenger hunt walk. Each of you picks three things to find.",
    "Get a warm drink and take the scenic route somewhere you usually hurry past.",
    "Bring a picnic and pick a place to watch the sunset.",
    "Browse a bookstore or library and choose a book the other person would enjoy.",
  ],
};
const questions = [
  "What small thing made you feel cared for recently?",
  "What ordinary day together would you like to do again?",
  "What would make this week a little easier for you?",
  "What silly tradition should we start?",
  "If we had a free afternoon with no plans, what would you want to do?",
];

function response(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    body: JSON.stringify(body),
  };
}

function privateMessage(content) {
  return response(200, { type: 4, data: { content, flags: 64, allowed_mentions: { parse: [] } } });
}

function text(value, limit) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, limit);
}

function plain(value) {
  return value.replace(/[\\`*_~|<>\[\]]/g, "\\$&");
}

function readPairConfig(env) {
  const pair = (env.PAIR_USER_IDS || "").split(",").map(id => id.trim());
  if (pair.length !== 2 || new Set(pair).size !== 2 || !pair.every(id => snowflake.test(id))) {
    throw new Error("PAIR_USER_IDS must contain two distinct Discord user IDs.");
  }
  if (!snowflake.test(env.DISCORD_GUILD_ID || "")) throw new Error("Missing Discord guild ID.");
  return { pair, guild: env.DISCORD_GUILD_ID, nextDate: env.NEXT_DATE || "" };
}

function readConfig(env) {
  const config = readPairConfig(env);
  if (!/^[0-9a-f]{64}$/i.test(env.DISCORD_PUBLIC_KEY || "")) throw new Error("Invalid Discord public key.");
  return {
    ...config,
    publicKey: createPublicKey({
      key: Buffer.concat([ed25519Prefix, Buffer.from(env.DISCORD_PUBLIC_KEY, "hex")]),
      format: "der", type: "spki",
    }),
  };
}

function validSignature(event, raw, key, now) {
  const headers = Object.fromEntries(Object.entries(event.headers || {}).map(([name, value]) => [name.toLowerCase(), value]));
  const signature = headers["x-signature-ed25519"];
  const timestamp = headers["x-signature-timestamp"];
  if (!/^[0-9a-f]{128}$/i.test(signature || "") || !/^\d{10,12}$/.test(timestamp || "")) return false;
  if (Math.abs(now - Number(timestamp) * 1000) > 300_000) return false;
  return verify(null, Buffer.concat([Buffer.from(timestamp), raw]), key, Buffer.from(signature, "hex"));
}

function countdown(value, now) {
  if (!value) return "Set NEXT_DATE to your next special date to start the countdown.";
  const target = Date.parse(value + "T00:00:00Z");
  if (!Number.isFinite(target) || new Date(target).toISOString().slice(0, 10) !== value) {
    return "NEXT_DATE needs a valid date in YYYY-MM-DD format.";
  }
  const today = Math.floor(now / 86_400_000);
  const days = target / 86_400_000 - today;
  if (days === 0) return "Your special date is today!";
  if (days < 0) return `Your special date was ${-days} day(s) ago. Set a new NEXT_DATE when you're ready.`;
  return `🗓️ ${days} ${days === 1 ? "day" : "days"} until ${value} (UTC calendar).`;
}

function choose(items) {
  return items[randomInt(items.length)];
}

function createHandler(config, store, clock = Date.now) {
  const runCommand = createCommandHandler(config, store);
  return async event => {
    if (event.requestContext?.http?.method !== "POST") return response(405, { error: "Method not allowed" });
    if (typeof event.body !== "string" || event.body.length > 100_000) return response(400, { error: "Invalid body" });
    const raw = Buffer.from(event.body, event.isBase64Encoded ? "base64" : "utf8");
    const now = clock();
    if (!validSignature(event, raw, config.publicKey, now)) return response(401, { error: "Invalid signature" });
    let interaction;
    try { interaction = JSON.parse(raw.toString("utf8")); }
    catch { return response(400, { error: "Invalid JSON" }); }
    if (interaction?.type === 1) return response(200, { type: 1 });
    if (interaction?.type !== 2) return response(400, { error: "Unsupported interaction" });
    return runCommand(interaction, now);
  };
}

function createCommandHandler(config, store) {
  return async (interaction, now = Date.now()) => {
    const userId = interaction.member?.user?.id;
    if (interaction.guild_id !== config.guild || !config.pair.includes(userId)) {
      return privateMessage("This bot is reserved for its configured pair and server.");
    }
    if (interaction.data?.name !== "together" || !snowflake.test(interaction.id || "")) {
      return privateMessage("Unknown command.");
    }
    const action = interaction.data.options?.[0];
    const input = Object.fromEntries((action?.options || []).map(option => [option.name, option.value]));
    try {
      switch (action?.name) {
        case "date": {
          const pool = Object.hasOwn(dateIdeas, input.setting) ? dateIdeas[input.setting] : Object.values(dateIdeas).flat();
          return privateMessage("💡 " + choose(pool));
        }
        case "question":
          return privateMessage("💬 " + choose(questions));
        case "countdown":
          return privateMessage(countdown(config.nextDate, now));
        case "add": {
          const item = text(input.item, 90);
          if (!item) return privateMessage("Enter something to add.");
          await store.add(interaction.id, item);
          return privateMessage(`Added to your shared list: ${plain(item)}`);
        }
        case "list": {
          const items = await store.list();
          return privateMessage(items.length ? "📋 **Shared list**\n" +
            items.map(item => `• ${plain(item.text)} · ID ${item.id}`).join("\n") : "Your shared list is empty.");
        }
        case "done":
          if (!snowflake.test(input.id || "")) return privateMessage("Enter an item ID from /together list.");
          return privateMessage(await store.done(input.id) ? "Item marked done." : "That item is already gone or was never on the list.");
        case "checkin":
          if (!moods.includes(input.mood)) return privateMessage("Choose a mood from the list.");
          await store.checkin(userId, interaction.id, input.mood, text(input.note, 150));
          return privateMessage("Check-in saved. Your partner can read it with /together moods.");
        case "moods": {
          const entries = await store.moods();
          const formatted = config.pair.map(id => {
            const label = id === userId ? "You" : "Partner";
            const entry = entries.find(item => item.userId === id);
            return entry ? `${label}: ${entry.mood}${entry.note ? " · " + plain(entry.note) : ""}` : `${label}: no check-in yet`;
          });
          return privateMessage(formatted.join("\n"));
        }
        default:
          return privateMessage("Unknown Together command.");
      }
    } catch (error) {
      console.warn("Fred command failed", error.name);
      return privateMessage("Could not reach the shared data. Please try again.");
    }
  };
}

let configuredHandler;
exports.handler = async event => {
  if (!configuredHandler) {
    const config = readConfig(process.env);
    const { makeStore } = require("./store");
    configuredHandler = createHandler(config, makeStore(process.env.TABLE_NAME, config.guild, config.pair));
  }
  return configuredHandler(event);
};
exports.createHandler = createHandler;
exports.createCommandHandler = createCommandHandler;
exports.readConfig = readConfig;
exports.readPairConfig = readPairConfig;
