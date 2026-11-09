const { command } = require("../commands");

async function main() {
  const { DISCORD_APPLICATION_ID: app, DISCORD_GUILD_ID: guild, DISCORD_BOT_TOKEN: token } = process.env;
  if (![app, guild].every(id => /^\d{17,20}$/.test(id || "")) || !token) {
    throw new Error("Set DISCORD_APPLICATION_ID, DISCORD_GUILD_ID, and DISCORD_BOT_TOKEN first.");
  }
  const result = await fetch(`https://discord.com/api/v10/applications/${app}/guilds/${guild}/commands`, {
    method: "POST",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(10_000),
  });
  if (!result.ok) throw new Error(`Discord rejected registration (HTTP ${result.status}). Check app ID, guild ID, token, and server installation.`);
  console.log("Registered /together in your configured server.");
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
