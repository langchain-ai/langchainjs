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

  const result = await tool.invoke("1153400523718938780");
  // console.log(result);
  expect(result).toBeTruthy();
  expect(result).not.toEqual("Channel not found.");
  expect(result).not.toEqual("Error getting messages.");
});

test.skip("DiscordGetGuildsTool", async () => {
  const tool = new DiscordGetGuildsTool();
  const result = await tool.invoke("");
  // console.log(result);
  expect(result).toBeTruthy();
  expect(result).not.toEqual("Error getting guilds.");
});

test.skip("DiscordChannelSearchTool", async () => {
  const tool = new DiscordChannelSearchTool();
  const result = await tool.invoke("Test");
  // console.log(result);
  expect(result).toBeTruthy();
  expect(result).not.toEqual("Error searching through channel.");
});

test.skip("DiscordGetTextChannelsTool", async () => {
  const tool = new DiscordGetTextChannelsTool();
  const result = await tool.invoke("1153400523718938775");
  // console.log(result);
  expect(result).toBeTruthy();
  expect(result).not.toEqual("Error getting text channels.");
});

test.skip("DiscordSendMessagesTool", async () => {
  const tool = new DiscordSendMessagesTool();
  const result = await tool.invoke("test message from new code");
  // console.log(result);
  expect(result).toEqual("Message sent successfully.");
});
