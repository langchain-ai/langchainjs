import { test } from "@jest/globals";
import {
  DiscordGetMessagesTool,
  DiscordChannelSearchTool,
  DiscordSendMessagesTool,
  DiscordGetGuildsTool,
  DiscordGetTextChannelsTool,
} from "../discord.js";

test.skip("DiscordGetMessagesTool", async () => {
  const tool = new DiscordGetMessagesTool();
  try {
    const result = await tool.call("1153400523718938780");
    console.log(result);
  } catch (error) {
    console.error(error);
  }
});

test.skip("DiscordGetGuildsTool", async () => {
  const tool = new DiscordGetGuildsTool();
  try {
    const result = await tool.call(undefined);
    console.log(result);
  } catch (error) {
    console.error(error);
  }
});

test.skip("DiscordChannelSearchTool", async () => {
  const tool = new DiscordChannelSearchTool("1153400523718938780");
  try {
    const result = await tool.call("Test");
    console.log(result);
  } catch (error) {
    console.error(error);
  }
});

test.skip("DiscordGetTextChannelsTool", async () => {
  const tool = new DiscordGetTextChannelsTool();
  try {
    const result = await tool.call("1153400523718938775");
    console.log(result);
  } catch (error) {
    console.error(error);
  }
});

test.skip("DiscordSendMessagesTool", async () => {
  const tool = new DiscordSendMessagesTool("1153400523718938780");
  try {
    const result = await tool.call("test message from new code");
    console.log(result);
  } catch (err) {
    console.log(err);
  }
});
