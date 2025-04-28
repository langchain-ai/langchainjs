import {
  DiscordGetMessagesTool,
  DiscordChannelSearchTool,
  DiscordSendMessagesTool,
  DiscordGetGuildsTool,
  DiscordGetTextChannelsTool,
} from "@langchain/community/tools/discord";

// Get messages from a channel given channel ID
const getMessageTool = new DiscordGetMessagesTool();
const messageResults = await getMessageTool.invoke("1153400523718938780");
console.log(messageResults);

// Get guilds/servers
const getGuildsTool = new DiscordGetGuildsTool();
const guildResults = await getGuildsTool.invoke("");
console.log(guildResults);

// Search results in a given channel (case-insensitive)
const searchTool = new DiscordChannelSearchTool();
const searchResults = await searchTool.invoke("Test");
console.log(searchResults);

// Get all text channels of a server
const getChannelsTool = new DiscordGetTextChannelsTool();
const channelResults = await getChannelsTool.invoke("1153400523718938775");
console.log(channelResults);

// Send a message
const sendMessageTool = new DiscordSendMessagesTool();
const sendMessageResults = await sendMessageTool.invoke("test message");
console.log(sendMessageResults);
