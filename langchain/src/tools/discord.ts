import { getEnvironmentVariable } from "../util/env.js";
import { Tool } from "./base.js";
import { Client, TextChannel, GatewayIntentBits, Message } from "discord.js";

/*
 * A tool for retrieving messages from a discord channel using a bot.
 * It extends the base Tool class and implements the _call method to
 * perform the retrieve operation. Requires an bot token which can be set
 * in the environment variables, and a limit on how many messages to retrieve.
 * The _call method takes the discord channel ID as the input argument.
 * The bot must have read permissions to the given channel. It returns the
 * message content, author, and time the message was created for each message.
 */

export class DiscordGetMessagesTool extends Tool {
  static lc_name() {
    return "DiscordGetMessagesTool";
  }

  name = "discord-get-messages";

  description = `a discord tool. useful for reading messages from a discord channel. 
    input should be the discord channel ID. the bot should have read 
    permissions for the channel`;

  protected botToken: string;
  protected messageLimit: number;

  client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  });

  constructor(
    botToken: string | undefined = getEnvironmentVariable("DiscordBotToken"),
    messageLimit: number | undefined = 100
  ) {
    super(...arguments);

    if (!botToken) {
      throw new Error(
        "Discord API key not set. You can set it as DiscordBotToken in your .env file."
      );
    }

    this.botToken = botToken;
    this.messageLimit = messageLimit;
  }

  /** @ignore */
  async _call(input: string): Promise<string> {
    await this.client.login(this.botToken);

    const channel = (await this.client.channels.fetch(input)) as TextChannel;

    if (!channel) {
      return "Channel not found";
    }

    const messages = await channel.messages.fetch({ limit: this.messageLimit });
    this.client.destroy();
    const results =
      messages.map((message: Message) => ({
        author: message.author.tag,
        content: message.content,
        timestamp: message.createdAt,
      })) ?? [];

    return JSON.stringify(results);
  }
}
