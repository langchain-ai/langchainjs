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
    expect(result).toBeTruthy();
    expect(result).not.toEqual("Channel not found.");
    expect(result).not.toEqual("Error getting messages.");
  } catch (error) {
    console.error(error);
  }
});

test.skip("DiscordGetGuildsTool", async () => {
  const tool = new DiscordGetGuildsTool();
  try {
    const result = await tool.invoke("");
    console.log(result);
    expect(result).toBeTruthy();
    expect(result).not.toEqual("Error getting guilds.");
  } catch (error) {
    console.error(error);
  }
});

test.skip("DiscordChannelSearchTool", async () => {
  const tool = new DiscordChannelSearchTool();
  try {
    const result = await tool.invoke("Test");
    console.log(result);
    expect(result).toBeTruthy();
    expect(result).not.toEqual("Error searching through channel.");
  } catch (error) {
    console.error(error);
  }
});

test.skip("DiscordGetTextChannelsTool", async () => {
  const tool = new DiscordGetTextChannelsTool();
  try {
    const result = await tool.invoke("1153400523718938775");
    console.log(result);
    expect(result).toBeTruthy();
    expect(result).not.toEqual("Error getting text channels.");
  } catch (error) {
    console.error(error);
  }
});

test.skip("DiscordSendMessagesTool", async () => {
  const tool = new DiscordSendMessagesTool();
  try {
    const result = await tool.invoke("test message from new code");
    console.log(result);
    expect(result).toEqual("Message sent successfully.");
  } catch (err) {
    console.log(err);
  }
});
