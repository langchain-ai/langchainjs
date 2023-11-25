import { test } from "@jest/globals";
import { DiscordGetMessagesTool, DiscordChannelSearchTool } from "../discord.js";

test("DiscordGetMessagesTool", async () => {
  const tool = new DiscordGetMessagesTool();
  try {
    const result = await tool.call('1153400523718938780')
    console.log(result)
  } catch (error) {
    console.error(error);
  }
});

test("DiscordChannelSearchTool", async () => {
  const tool = new DiscordChannelSearchTool('1153400523718938780');
  try {
    const result = await tool.call('Test')
    console.log(result)
  } catch (error) {
    console.error(error);
  }
});