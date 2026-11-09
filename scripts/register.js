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
  if (!result.ok) {
    const error = await result.json().catch(() => null);
    const code = Number.isInteger(error?.code) ? error.code : null;
    const hints = {
      10004: "Copy the server ID again and check Fred is installed there.",
      20012: "Check that the bot token and application ID both belong to Fred.",
      50001: "Check the server ID and install Fred into that server with applications.commands.",
      50013: "Check Fred's server installation and command scope.",
      50026: "Reauthorize Fred with the applications.commands scope.",
    };
    const status = code === null ? `HTTP ${result.status}` : `HTTP ${result.status}, Discord code ${code}`;
    const hint = hints[code] || "Check app ID, server ID, token, and server installation.";
    throw new Error(`Discord rejected registration (${status}). ${hint}`);
  }
  console.log("Registered /together in your configured server.");
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
