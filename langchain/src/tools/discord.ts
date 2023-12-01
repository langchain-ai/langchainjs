import {
  Client,
  TextChannel,
  GatewayIntentBits,
  Message,
  ChannelType,
} from "discord.js";
import { getEnvironmentVariable } from "../util/env.js";
import { Tool } from "./base.js";

/**
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
    botToken: string | undefined = getEnvironmentVariable("DISCORD_BOT_TOKEN"),
    messageLimit: number | undefined = 10
  ) {
    super(...arguments);

    if (!botToken) {
      throw new Error(
        "Discord API key not set. You can set it as DISCORD_BOT_TOKEN in your .env file."
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
    await this.client.destroy();
    const results =
      messages.map((message: Message) => ({
        author: message.author.tag,
        content: message.content,
        timestamp: message.createdAt,
      })) ?? [];

    return JSON.stringify(results);
  }
}

/**
 * A tool for retrieving all servers a bot is a member of. It extends the
 * base `Tool` class and implements the `_call` method to perform the retrieve
 * operation. Requires a bot token which can be set in the environment
 * variables.
 */
export class DiscordGetGuildsTool extends Tool {
  static lc_name() {
    return "DiscordGetGuildsTool";
  }

  name = "discord-get-guilds";

  description = `a discord tool. useful for getting a list of all servers/guilds the bot is a member of. no input required.`;

  protected botToken: string;

  client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  constructor(
    botToken: string | undefined = getEnvironmentVariable("DISCORD_BOT_TOKEN")
  ) {
    super(...arguments);

    if (!botToken) {
      throw new Error(
        "Discord API key not set. You can set it as DISCORD_BOT_TOKEN in your .env file."
      );
    }
    this.botToken = botToken;
  }

  /** @ignore */
  async _call(_input: string): Promise<string> {
    await this.client.login(this.botToken);

    const guilds = await this.client.guilds.fetch();
    await this.client.destroy();

    const results =
      guilds.map((guild) => ({
        id: guild.id,
        name: guild.name,
        createdAt: guild.createdAt,
      })) ?? [];

    return JSON.stringify(results);
  }
}

/**
 * A tool for retrieving text channels within a server/guild a bot is a member
 * of. It extends the base `Tool` class and implements the `_call` method to
 * perform the retrieve operation. Requires a bot token which can be set in
 * the environment variables. The `_call` method takes a server/guild ID
 * to get its text channels.
 */
export class DiscordGetTextChannelsTool extends Tool {
  static lc_name() {
    return "DiscordGetTextChannelsTool";
  }

  name = "discord-get-text-channels";

  description = `a discord tool. useful for getting a list of all text channels in a server/guild. input should be a discord server/guild ID`;

  protected botToken: string;

  client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  constructor(
    botToken: string | undefined = getEnvironmentVariable("DISCORD_BOT_TOKEN")
  ) {
    super(...arguments);

    if (!botToken) {
      throw new Error(
        "Discord API key not set. You can set it as DISCORD_BOT_TOKEN in your .env file."
      );
    }
    this.botToken = botToken;
  }

  /** @ignore */
  async _call(input: string): Promise<string> {
    await this.client.login(this.botToken);

    const guild = await this.client.guilds.fetch(input);
    const channels = await guild.channels.fetch();
    await this.client.destroy();

    const results =
      channels
        .filter((channel) => channel?.type === ChannelType.GuildText)
        .map((channel) => ({
          id: channel?.id,
          name: channel?.name,
          createdAt: channel?.createdAt,
        })) ?? [];

    return JSON.stringify(results);
  }
}

/**
 * A tool for sending messages to a discord channel using a bot.
 * It extends the base Tool class and implements the _call method to
 * perform the retrieve operation. Requires a bot token which can be set
 * in the environment variables. The _call method takes the message to be
 * sent as the input argument.
 */
export class DiscordSendMessagesTool extends Tool {
  static lc_name() {
    return "DiscordSendMessagesTool";
  }

  name = "discord-send-messages";

  description = `A discord tool useful for sending messages to a discod channel.
  Input should be the discord channel message, since we will already have the channel ID.`;

  protected botToken: string;

  protected channelId: string;

  client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  });

  constructor(
    botToken: string | undefined = getEnvironmentVariable("DISCORD_BOT_TOKEN"),
    channelId: string | undefined = getEnvironmentVariable("DISCORD_CHANNEL_ID")
  ) {
    super(...arguments);

    if (!botToken) {
      throw new Error(
        "Discord API key not set. You can set it as DISCORD_BOT_TOKEN in your .env file."
      );
    }
    this.botToken = botToken;
    if (!channelId) {
      throw new Error(
        "Discord channel not set. You can set it as DISCORD_CHANNEL_ID in your .env file."
      );
    }
    this.channelId = channelId;
  }

  /** @ignore */
  async _call(message: string): Promise<string> {
    try {
      await this.client.login(this.botToken);

      const channel = (await this.client.channels.fetch(
        this.channelId
      )) as TextChannel;

      if (!channel) {
        throw new Error("Channel not found");
      }

      if (!(channel.constructor === TextChannel)) {
        throw new Error("Channel is not text channel, cannot send message");
      }

      await channel.send(message);

      await this.client.destroy();

      return "Message sent successfully";
    } catch (err) {
      await this.client.destroy();
      return "Error sending message";
    }
  }
}

/**
 * A tool for searching for messages within a discord channel using a bot.
 * It extends the base Tool class and implements the _call method to
 * perform the retrieve operation. Requires an bot token which can be set
 * in the environment variables, and the discord channel ID of the channel.
 * The _call method takes the search term as the input argument.
 * The bot must have read permissions to the given channel. It returns the
 * message content, author, and time the message was created for each message.
 */
export class DiscordChannelSearchTool extends Tool {
  static lc_name() {
    return "DiscordChannelSearchTool";
  }

  name = "discord_channel_search_tool";

  description = `a discord toolkit. useful for searching for messages 
  within a discord channel. input should be the search term. the bot 
  should have read permissions for the channel`;

  protected botToken: string;

  protected channelId: string;

  client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  });

  constructor(
    botToken: string | undefined = getEnvironmentVariable("DISCORD_BOT_TOKEN"),
    channelId: string | undefined = getEnvironmentVariable("DISCORD_CHANNEL_ID")
  ) {
    super(...arguments);

    if (!botToken) {
      throw new Error(
        "Discord API key not set. You can set it as DISCORD_BOT_TOKEN in your .env file."
      );
    }
    this.botToken = botToken;
    if (!channelId) {
      throw new Error(
        "Discord channel not set. You can set it as DISCORD_CHANNEL_ID in your .env file."
      );
    }
    this.channelId = channelId;
  }

  /** @ignore */
  async _call(searchTerm: string): Promise<string> {
    try {
      await this.client.login(this.botToken);

      const channel = (await this.client.channels.fetch(
        this.channelId
      )) as TextChannel;

      if (!channel) {
        return "Channel not found";
      }

      const messages = await channel.messages.fetch();
      await this.client.destroy();
      const filtered = messages.filter((message) =>
        message.content.toLowerCase().includes(searchTerm.toLowerCase())
      );

      const results =
        filtered.map((message) => ({
          author: message.author.tag,
          content: message.content,
          timestamp: message.createdAt,
        })) ?? [];

      return JSON.stringify(results);
    } catch (err) {
      await this.client.destroy();
      return "Error sending message";
    }
  }
}
