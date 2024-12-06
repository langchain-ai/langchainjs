import { test } from "@jest/globals";
import {
  SlackGetChannelsTool,
  SlackGetMessagesTool,
  SlackScheduleMessageTool,
  SlackPostMessageTool,
} from "../slack.js";

test.skip("SlackGetMessagesTool", async () => {
  const tool = new SlackGetMessagesTool();

  const result = await tool.invoke("Hi");
  // console.log(result);
  expect(result).toBeTruthy();
  expect(result).not.toContain("Error getting messages.");
});

test.skip("SlackGetChannelsTool", async () => {
  const tool = new SlackGetChannelsTool();
  const result = await tool.invoke("");
  // console.log(result);
  expect(result).toBeTruthy();
  expect(result).not.toContain("Error getting channel information.");
});

test.skip("SlackScheduleMessageTool", async () => {
  const tool = new SlackScheduleMessageTool();
  const result = await tool.invoke(
    JSON.stringify({
      text: "Test",
      channel_id: "C1234567890",
      post_at: "2024-12-09T10:30:00+03:00",
    })
  );
  // console.log(result);
  expect(result).toBeTruthy();
  expect(result).not.toContain("Error scheduling message.");
});

test.skip("SlackPostMessageTool", async () => {
  const tool = new SlackPostMessageTool();
  const result = await tool.invoke(
    JSON.stringify({
      text: "Test",
      channel_id: "C1234567890",
    })
  );
  // console.log(result);
  expect(result).not.toContain("Error posting message.");
});
