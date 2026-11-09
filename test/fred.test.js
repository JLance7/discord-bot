const assert = require("node:assert/strict");
const { generateKeyPairSync, sign } = require("node:crypto");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const test = require("node:test");
const { createHandler, readConfig } = require("../handler");
const { makeLocalStore } = require("../local-store");

const keys = generateKeyPairSync("ed25519");
const guild = "100000000000000001";
const pair = ["100000000000000002", "100000000000000003"];
const outsider = "100000000000000004";
const now = Date.parse("2026-11-08T15:00:00Z");
const config = readConfig({
  DISCORD_PUBLIC_KEY: keys.publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("hex"),
  DISCORD_GUILD_ID: guild,
  PAIR_USER_IDS: pair.join(","),
});

function event(payload, timestamp = String(now / 1000), base64 = false) {
  const body = Buffer.from(JSON.stringify(payload));
  return {
    requestContext: { http: { method: "POST" } },
    body: body.toString(base64 ? "base64" : "utf8"),
    isBase64Encoded: base64,
    headers: {
      "x-signature-timestamp": timestamp,
      "x-signature-ed25519": sign(null, Buffer.concat([Buffer.from(timestamp), body]), keys.privateKey).toString("hex"),
    },
  };
}

function command(id, user, server, action, values = {}) {
  return event({
    type: 2, id, guild_id: server, member: { user: { id: user } },
    data: { name: "together", options: [{ name: action, options: Object.entries(values).map(([name, value]) => ({ name, value })) }] },
  });
}

test("responds to Discord's signed ping and rejects tampering or stale signatures", async () => {
  const handler = createHandler(config, {}, () => now);
  assert.deepEqual(JSON.parse((await handler(event({ type: 1 }, undefined, true))).body), { type: 1 });
  const tampered = event({ type: 1 });
  tampered.body += " ";
  assert.equal((await handler(tampered)).statusCode, 401);
  assert.equal((await handler(event({ type: 1 }, String(now / 1000 - 301)))).statusCode, 401);
});

test("only the configured pair in the configured server can reach shared storage", async () => {
  let calls = 0;
  const handler = createHandler(config, { list: () => { calls++; return []; } }, () => now);
  for (const [user, server] of [[outsider, guild], [pair[0], outsider], [pair[0], null]]) {
    const result = await handler(command("100000000000000010", user, server, "list"));
    assert.match(JSON.parse(result.body).data.content, /reserved/);
  }
  const result = JSON.parse((await handler(command("100000000000000010", pair[1], guild, "list"))).body);
  assert.equal(calls, 1);
  assert.equal(result.data.flags, 64);
  assert.deepEqual(result.data.allowed_mentions.parse, []);
});

test("local data persists, completed items stay complete and newer check-ins win", t => {
  const directory = mkdtempSync(join(tmpdir(), "fred-test-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const id = "100000000000000010";
  const first = makeLocalStore(guild, directory);
  first.add(id, "Popcorn");
  const second = makeLocalStore(guild, directory);
  assert.deepEqual(second.list(), [{ id, text: "Popcorn" }]);
  assert.equal(second.done(id), true);
  first.add(id, "Popcorn");
  assert.deepEqual(second.list(), []);
  first.checkin(pair[0], "100000000000000013", "Good", "Ready for movie night");
  second.checkin(pair[0], "100000000000000012", "Tired", "");
  assert.equal(first.moods()[0].note, "Ready for movie night");
});
