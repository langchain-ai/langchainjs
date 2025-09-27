import {
  Client,
  TextChannel,
  GatewayIntentBits,
  Message,
  ChannelType,
} from "discord.js";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Tool } from "@langchain/core/tools";

interface DiscordToolConfig {
  readonly VAR: string;
  readonly NAME: string;
  readonly DESCRIPTION: string;
}

interface DiscordEnvVars {
  readonly DISCORD_BOT_TOKEN: string;
  readonly DISCORD_CHANNEL_ID: string;
}


const DISCORD_CONSTANTS = {

  ENV_VARIABLES: {
    DISCORD_BOT_TOKEN: 'DISCORD_BOT_TOKEN',
    DISCORD_CHANNEL_ID: 'DISCORD_CHANNEL_ID'
  } satisfies DiscordEnvVars,

  TOOLS: {
    DISCORD_GET_MESSAGES: {
      VAR: 'DiscordGetMessagesTool',
      NAME: 'discord-get-messages',
      DESCRIPTION: `A discord tool. 
      Useful for reading messages from a discord channel. 
      Input should be the discord channel ID. The bot should have read 
      permissions for the channel.`,
    },

    DISCORD_GET_GUILDS: {
      VAR: 'DiscordGetGuildsTool',
      NAME: 'discord-get-guilds',
      DESCRIPTION: `A discord tool. 
      Useful for getting a list of all servers/guilds the bot is a member of. 
      No input required.`
    },

    DISCORD_GET_TEXT_CHANNELS: {
      VAR: 'DiscordGetTextChannelsTool',
      NAME: 'discord-get-text-channels',
      DESCRIPTION: `A discord tool. 
      Useful for getting a list of all text channels in a server/guild. 
      Input should be a discord server/guild ID.`
    },
    
    DISCORD_SEND_MESSAGES: {
      VAR: 'DiscordSendMessagesTool',
      NAME: 'discord-send-messages',
      DESCRIPTION: `A discord tool. 
      Useful for sending messages to a discod channel.
      Input should be the discord channel message, since we will already have the channel ID.`
    },

    DISCORD_CHANNEL_SEARCH: {
      VAR: 'DiscordChannelSearchTool',
      NAME: 'discord_channel_search_tool',
      DESCRIPTION: `A discord tool. 
      Useful for searching for messages within a discord channel. 
      Input should be the search term. 
      The bot should have read permissions for the channel.`,
    }

  } satisfies Record<string, DiscordToolConfig>,

  STRINGS: {
    // Environment variable error messages
    MISSING_ENV_MESSAGE: (variable: string, tool: string) => `Environment variable ${variable} missing, but is required for ${tool}.`,

    // Operation result messages
    CHANNEL_NOT_FOUND: "Channel not found.",
    MESSAGE_SENT_SUCCESSFULLY: "Message sent successfully.",
    ERROR_GETTING_MESSAGES: "Error getting messages.",
    ERROR_GETTING_GUILDS: "Error getting guilds.",
    ERROR_GETTING_TEXT_CHANNELS: "Error getting text channels.",
    ERROR_SENDING_MESSAGE: "Error sending message.",
    ERROR_SEARCHING_CHANNEL: "Error searching through channel.",

    // Specific error messages
    CHANNEL_NOT_TEXT: "Channel is not text channel, cannot send message",
  }
} as const;

/**
 * Base tool parameters for the Discord tools
 */
interface DiscordToolParams {
  botToken?: string;
  client?: Client;
}

/**
 * Tool parameters for the DiscordGetMessagesTool
 */
interface DiscordGetMessagesToolParams extends DiscordToolParams {
  messageLimit?: number;
}

/**
 * Tool parameters for the DiscordSendMessageTool
 */
interface DiscordSendMessageToolParams extends DiscordToolParams {
  channelId?: string;
}

/**
 * Tool parameters for the DiscordChannelSearch
 */
interface DiscordChannelSearchParams extends DiscordToolParams {
  channelId?: string;
}
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
    return DISCORD_CONSTANTS.TOOLS.DISCORD_GET_MESSAGES.VAR;
  }

  name = DISCORD_CONSTANTS.TOOLS.DISCORD_GET_MESSAGES.NAME;

  description = DISCORD_CONSTANTS.TOOLS.DISCORD_GET_MESSAGES.DESCRIPTION;

  protected botToken: string;

  protected messageLimit: number;

  protected client: Client;

  constructor(fields?: DiscordGetMessagesToolParams) {
    super();

    const {
      botToken = getEnvironmentVariable(DISCORD_CONSTANTS.ENV_VARIABLES.DISCORD_BOT_TOKEN),
      messageLimit = 10,
      client,
    } = fields ?? {};

    if (!botToken) {
      throw new Error(
        DISCORD_CONSTANTS.STRINGS.MISSING_ENV_MESSAGE(
          DISCORD_CONSTANTS.ENV_VARIABLES.DISCORD_BOT_TOKEN,
          DISCORD_CONSTANTS.TOOLS.DISCORD_GET_MESSAGES.VAR
        )
      );
    }

    this.client =
      client ??
      new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
      });

    this.botToken = botToken;
    this.messageLimit = messageLimit;
  }

  /** @ignore */
  async _call(input: string): Promise<string> {
    try {
      await this.client.login(this.botToken);

      const channel = (await this.client.channels.fetch(input)) as TextChannel;

      if (!channel) {
        return DISCORD_CONSTANTS.STRINGS.CHANNEL_NOT_FOUND;
      }

      const messages = await channel.messages.fetch({
        limit: this.messageLimit,
      });
      await this.client.destroy();
      const results =
        messages.map((message: Message) => ({
          author: message.author.tag,
          content: message.content,
          timestamp: message.createdAt,
        })) ?? [];

      return JSON.stringify(results);
    } catch (err) {
      await this.client.destroy();
      return DISCORD_CONSTANTS.STRINGS.ERROR_GETTING_MESSAGES;
    }
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
    return DISCORD_CONSTANTS.TOOLS.DISCORD_GET_GUILDS.VAR;
  }

  name = DISCORD_CONSTANTS.TOOLS.DISCORD_GET_GUILDS.NAME;

  description = DISCORD_CONSTANTS.TOOLS.DISCORD_GET_GUILDS.DESCRIPTION;

  protected botToken: string;

  protected client: Client;

  constructor(fields?: DiscordToolParams) {
    super();

    const { botToken = getEnvironmentVariable(DISCORD_CONSTANTS.ENV_VARIABLES.DISCORD_BOT_TOKEN), client } =
      fields ?? {};

    if (!botToken) {
      throw new Error(
        DISCORD_CONSTANTS.STRINGS.MISSING_ENV_MESSAGE(
          DISCORD_CONSTANTS.ENV_VARIABLES.DISCORD_BOT_TOKEN,
          DISCORD_CONSTANTS.TOOLS.DISCORD_GET_GUILDS.VAR
        )
      );
    }
    this.client =
      client ??
      new Client({
        intents: [GatewayIntentBits.Guilds],
      });

    this.botToken = botToken;
  }

  /** @ignore */
  async _call(_input: string): Promise<string> {
    try {
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
    } catch (err) {
      await this.client.destroy();
      return DISCORD_CONSTANTS.STRINGS.ERROR_GETTING_GUILDS;
    }
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
    return DISCORD_CONSTANTS.TOOLS.DISCORD_GET_TEXT_CHANNELS.VAR;
  }

  name = DISCORD_CONSTANTS.TOOLS.DISCORD_GET_TEXT_CHANNELS.NAME;

  description = DISCORD_CONSTANTS.TOOLS.DISCORD_GET_TEXT_CHANNELS.DESCRIPTION;

  protected botToken: string;

  protected client: Client;

  constructor(fields?: DiscordToolParams) {
    super();

    const { botToken = getEnvironmentVariable(DISCORD_CONSTANTS.ENV_VARIABLES.DISCORD_BOT_TOKEN), client } =
      fields ?? {};

    if (!botToken) {
      throw new Error(
        DISCORD_CONSTANTS.STRINGS.MISSING_ENV_MESSAGE(
          DISCORD_CONSTANTS.ENV_VARIABLES.DISCORD_BOT_TOKEN,
          DISCORD_CONSTANTS.TOOLS.DISCORD_GET_TEXT_CHANNELS.VAR
        )
      );
    }
    this.client =
      client ??
      new Client({
        intents: [GatewayIntentBits.Guilds],
      });
    this.botToken = botToken;
  }

  /** @ignore */
  async _call(input: string): Promise<string> {
    try {
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
    } catch (err) {
      await this.client.destroy();
      return DISCORD_CONSTANTS.STRINGS.ERROR_GETTING_TEXT_CHANNELS;
    }
  }
}

/**
 * A tool for sending messages to a discord channel using a bot.
 * It extends the base Tool class and implements the _call method to
 * perform the retrieve operation. Requires a bot token and channelId which can be set
 * in the environment variables. The _call method takes the message to be
 * sent as the input argument.
 */
export class DiscordSendMessagesTool extends Tool {
  static lc_name() {
    return DISCORD_CONSTANTS.TOOLS.DISCORD_SEND_MESSAGES.VAR;
  }

  name = DISCORD_CONSTANTS.TOOLS.DISCORD_SEND_MESSAGES.NAME;

  description = DISCORD_CONSTANTS.TOOLS.DISCORD_SEND_MESSAGES.DESCRIPTION;

  protected botToken: string;

  protected channelId: string;

  protected client: Client;

  constructor(fields?: DiscordSendMessageToolParams) {
    super();

    const {
      botToken = getEnvironmentVariable(DISCORD_CONSTANTS.ENV_VARIABLES.DISCORD_BOT_TOKEN),
      channelId = getEnvironmentVariable(DISCORD_CONSTANTS.ENV_VARIABLES.DISCORD_CHANNEL_ID),
      client,
    } = fields ?? {};

    if (!botToken) {
      throw new Error(
        DISCORD_CONSTANTS.STRINGS.MISSING_ENV_MESSAGE(
          DISCORD_CONSTANTS.ENV_VARIABLES.DISCORD_BOT_TOKEN,
          DISCORD_CONSTANTS.TOOLS.DISCORD_SEND_MESSAGES.VAR
        )
      );
    }

    if (!channelId) {
      throw new Error(
        DISCORD_CONSTANTS.STRINGS.MISSING_ENV_MESSAGE(
          DISCORD_CONSTANTS.ENV_VARIABLES.DISCORD_CHANNEL_ID,
          DISCORD_CONSTANTS.TOOLS.DISCORD_SEND_MESSAGES.VAR
        )
      );
    }

    this.client =
      client ??
      new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
      });

    this.botToken = botToken;
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
        throw new Error(DISCORD_CONSTANTS.STRINGS.CHANNEL_NOT_FOUND);
      }

      if (!(channel.constructor === TextChannel)) {
        throw new Error(DISCORD_CONSTANTS.STRINGS.CHANNEL_NOT_TEXT);
      }

      await channel.send(message);

      await this.client.destroy();

      return DISCORD_CONSTANTS.STRINGS.MESSAGE_SENT_SUCCESSFULLY;
    } catch (err) {
      await this.client.destroy();
      return DISCORD_CONSTANTS.STRINGS.ERROR_SENDING_MESSAGE;
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
    return DISCORD_CONSTANTS.TOOLS.DISCORD_CHANNEL_SEARCH.VAR;
  }

  name = DISCORD_CONSTANTS.TOOLS.DISCORD_CHANNEL_SEARCH.NAME;

  description = DISCORD_CONSTANTS.TOOLS.DISCORD_CHANNEL_SEARCH.DESCRIPTION;

  protected botToken: string;

  protected channelId: string;

  protected client: Client;

  constructor(fields?: DiscordChannelSearchParams) {
    super();

    const {
      botToken = getEnvironmentVariable(DISCORD_CONSTANTS.ENV_VARIABLES.DISCORD_BOT_TOKEN),
      channelId = getEnvironmentVariable(DISCORD_CONSTANTS.ENV_VARIABLES.DISCORD_CHANNEL_ID),
      client,
    } = fields ?? {};

    if (!botToken) {
      throw new Error(
        DISCORD_CONSTANTS.STRINGS.MISSING_ENV_MESSAGE(
          DISCORD_CONSTANTS.ENV_VARIABLES.DISCORD_BOT_TOKEN,
          DISCORD_CONSTANTS.TOOLS.DISCORD_CHANNEL_SEARCH.VAR
        )
      );
    }

    if (!channelId) {
      throw new Error(
        DISCORD_CONSTANTS.STRINGS.MISSING_ENV_MESSAGE(
          DISCORD_CONSTANTS.ENV_VARIABLES.DISCORD_CHANNEL_ID,
          DISCORD_CONSTANTS.TOOLS.DISCORD_CHANNEL_SEARCH.VAR
        )
      );
    }

    this.client =
      client ??
      new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
      });

    this.botToken = botToken;
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
        return DISCORD_CONSTANTS.STRINGS.CHANNEL_NOT_FOUND;
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
      return DISCORD_CONSTANTS.STRINGS.ERROR_SEARCHING_CHANNEL;
    }
  }
}
