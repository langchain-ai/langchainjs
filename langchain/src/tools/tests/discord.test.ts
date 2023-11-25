import { test } from "@jest/globals";
import { DiscordGetMessagesTool } from "../discord.js";

test("DiscordGetMessagesTool", async () => {
  const tool = new DiscordGetMessagesTool();
  try {
    const result = await tool.call('1153400523718938780')
    console.log(result)
  } catch (error) {
    console.error(error);
  }
});