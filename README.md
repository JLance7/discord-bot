# Fred

Fred is a two-person Discord bot for a private server. Run him on your PC while you are using him, or switch to an AWS webhook that wakes up when someone runs a slash command.

| Try in Discord | What Fred does |
| --- | --- |
| `/together date` | Picks a date idea. Choose at home or outdoors if you like. |
| `/together question` | Gives you a conversation starter. |
| `/together add` | Adds an errand, date idea, or something to watch to the shared list. |
| `/together list` | Shows the eight newest open items with IDs. |
| `/together done` | Completes an item by ID. |
| `/together checkin` | Shares a mood and optional note with your partner. |
| `/together moods` | Shows each person's latest check-in. |
| `/together countdown` | Counts down to an optional date using the UTC calendar. |

Fred responds only in the configured Discord server and only to the two configured user IDs. Replies are visible to the person who ran the command. Either partner can retrieve the shared list and moods separately.

## Set up Fred in Discord

1. Create an application named **Fred** in the [Discord Developer Portal](https://discord.com/developers/applications). Keep the bot private and install it into your server with the `bot` and `applications.commands` scopes. It needs zero requested bot permissions and no privileged intents. If the private app cannot have a default install link, set **Install Link** to **None** and use a server invite generated with the OAuth2 URL Generator.
2. Enable **Developer Mode** in Discord under **User Settings → Advanced**. Right-click your server and choose **Copy Server ID**. Right-click each person's profile and choose **Copy User ID**.
3. Copy the application ID from **General Information**. Get the bot token from the **Bot** page. Keep the token in your local `.env` file.

## Run on Windows

Install Node.js 22, open PowerShell in this folder, and run:

```powershell
npm ci
Copy-Item .env.example .env
notepad .env
```

Fill in `DISCORD_APPLICATION_ID`, `DISCORD_GUILD_ID`, `DISCORD_BOT_TOKEN`, and `PAIR_USER_IDS`. Enter the two user IDs separated by a comma. Optionally set `NEXT_DATE` as `YYYY-MM-DD`.

Leave **Interactions Endpoint URL** blank in Discord for local mode. Then run:

```powershell
npm run register
npm start
```

Registration is a one-time step, repeated when command definitions change. Wait for **Fred is online**, then try `/together question` in your server. Stop him with Ctrl+C. Start only one local process at a time. Local lists and check-ins are stored in `fred-<server-id>.json` in this folder.

## Run on demand in AWS

Install the AWS CLI and SAM CLI, configure your AWS CLI credentials, and run the following from this folder:

```powershell
& .\scripts\build-aws.ps1
sam deploy --guided
```

Use the application's **Public Key** for `DiscordPublicKey`. Enter your server ID as `DiscordGuildId`, the same comma-separated pair as `PairUserIds`, and an optional `NextDate`. Allow SAM to create the Lambda IAM role. Discord calls the public API Gateway route, and Fred verifies Discord's request signature before handling it. Paste the `InteractionsEndpoint` stack output into **Interactions Endpoint URL** in the Developer Portal. Stop the local process and run `npm run register` if you haven't registered the commands yet.

API Gateway invokes Lambda only for incoming requests. The bot token stays local and is used for registration. AWS shared data lives in DynamoDB and is separate from the local file. Each check-in replaces the previous one for that person, and completing a list item removes its text. AWS service charges may apply. Deleting the stack also deletes its DynamoDB table.

## Project checks

`npm test` exercises signed webhook requests, server and user restrictions, and local persistence without contacting Discord or AWS.

## Ideas for later

- **Memory jar** — Save a favorite moment and ask Fred to pull out a random one.
- **Surprise planner** — Keep a private list of gift hints your partner can share with you.
- **Date roulette** — Filter ideas by budget, energy, and time.
- **Pick for us** — Each person submits one movie or takeout option and Fred breaks the tie.

## References

- [Discord interactions](https://docs.discord.com/developers/interactions/receiving-and-responding)
- [Discord slash commands](https://docs.discord.com/developers/docs/interactions/slash-commands)
- [AWS SAM HTTP API](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-property-function-httpapi.html)
