import { test } from "@jest/globals";
import { DiscordGetMessagesTool, DiscordGetGuildsTool, DiscordGetTextChannelsTool } from "../discord.js";

test("DiscordGetMessagesTool", async () => {
  const tool = new DiscordGetMessagesTool();
  try {
    const result = await tool.call('1153400523718938780')
    console.log(result)
  } catch (error) {
    console.error(error);
  }
});

test("DiscordGetGuildsTool", async () => {
  const tool = new DiscordGetGuildsTool();
  try {
    const result = await tool.call(undefined);
    console.log(result);
  } catch (error) {
    console.error(error);
  }
});

test("DiscordGetTextChannelsTool", async () => {
  const tool = new DiscordGetTextChannelsTool();
  try {
    const result = await tool.call('1153400523718938775');
    console.log(result);
  } catch (error) {
    console.error(error);
  }
});
