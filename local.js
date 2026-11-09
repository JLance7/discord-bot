const { Client, Events, GatewayIntentBits, MessageFlags } = require("discord.js");
const { createCommandHandler, readPairConfig } = require("./handler");
const { makeLocalStore } = require("./local-store");

async function main() {
  const config = readPairConfig(process.env);
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("Set DISCORD_BOT_TOKEN in .env first.");
  const runCommand = createCommandHandler(config, makeLocalStore(config.guild));
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once(Events.ClientReady, ready => {
    console.log(`Fred is online as ${ready.user.tag}. Press Ctrl+C to stop.`);
  });

  client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== "together") return;
    try {
      const result = await runCommand({
        id: interaction.id,
        guild_id: interaction.guildId,
        member: { user: { id: interaction.user.id } },
        data: { name: interaction.commandName, options: interaction.options.data },
      });
      const { content } = JSON.parse(result.body).data;
      await interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    } catch (error) {
      console.warn("Fred could not reply", error.name);
    }
  });

  client.on(Events.Error, error => console.warn("Discord connection error", error.name));
  await client.login(token);
}

main().catch(error => {
  console.error(error.name === "Error" ? error.message : `Could not start Fred (${error.name}). Check your setup.`);
  process.exitCode = 1;
});
