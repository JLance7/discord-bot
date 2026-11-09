# Fred Privacy Policy

Effective November 9, 2026

Fred is a Discord bot operated by the person who installed and configured it for your private server. This policy describes how Fred handles information when you use its slash commands.

## Information Fred uses

- **Discord identifiers.** Fred uses your Discord user ID and server ID to check whether you can use the bot. It uses interaction IDs to identify list entries and prevent duplicate writes. Saved check-ins are associated with the Discord user ID that submitted them.
- **Shared lists and check-ins.** Fred saves the list items you enter and each approved user's latest mood and optional note. Fred processes other slash command inputs to respond to your request. It does not read ordinary channel messages or direct messages.

## Who can see your information

Fred sends replies visible to the person who ran the command. Either approved user can retrieve the shared list and both users' latest check-ins. The operator can access Fred's storage to administer the bot and handle requests. Discord delivers the commands and replies under its own [privacy policy](https://discord.com/privacy). If the operator runs Fred on AWS, AWS processes webhook requests and hosts the bot's storage. Fred uses this information to operate the bot and does not sell it or use it for advertising.

## Where data is stored and for how long

Local mode stores shared data in a file on the operator's computer. AWS mode stores it in DynamoDB. Open items remain until completed or deleted. Completing an item removes its text. A completion marker remains locally to prevent duplicate entries, or is eligible for automatic deletion after one day in AWS. Each new check-in replaces that person's previous check-in. The latest check-in remains until replaced or deleted. In AWS mode, Fred's Lambda log group retains operational logs for 14 days.

## Contact and deletion requests

Send a Discord direct message to the server owner who runs Fred to ask about your data or request access, correction, or deletion. Identify the entry or check-in if you can. You can use the same contact method to request removal from Fred's allowlist. The operator will handle requests for data Fred controls. Use Discord's own privacy controls for information Discord manages separately.
