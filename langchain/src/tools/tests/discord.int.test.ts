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
    const result = await tool.invoke("1153400523718938780");
    console.log(result);
  } catch (error) {
    console.error(error);
  }
});

test.skip("DiscordGetGuildsTool", async () => {
  const tool = new DiscordGetGuildsTool();
  try {
    const result = await tool.invoke("");
    console.log(result);
  } catch (error) {
    console.error(error);
  }
});

test.skip("DiscordChannelSearchTool", async () => {
  const tool = new DiscordChannelSearchTool();
  try {
    const result = await tool.invoke("Test");
    console.log(result);
  } catch (error) {
    console.error(error);
  }
});

test.skip("DiscordGetTextChannelsTool", async () => {
  const tool = new DiscordGetTextChannelsTool();
  try {
    const result = await tool.invoke("1153400523718938775");
    console.log(result);
  } catch (error) {
    console.error(error);
  }
});

test.skip("DiscordSendMessagesTool", async () => {
  const tool = new DiscordSendMessagesTool();
  try {
    const result = await tool.invoke("test message from new code");
    console.log(result);
  } catch (err) {
    console.log(err);
  }
});
