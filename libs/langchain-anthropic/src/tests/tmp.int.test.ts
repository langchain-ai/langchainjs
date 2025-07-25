import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { z } from "zod";

test("Test ChatAnthropic Generate", async () => {
  const tools = [
    {
      name: "get_weather",
      description: "Get the weather in a given location",
      schema: z.object({
        location: z.string().describe("The location to get the weather for"),
      }),
    },
  ];
  const chat = new ChatAnthropic({
    modelName: "claude-3-5-sonnet-20240620",
    maxRetries: 0,
  }).bindTools(tools, {
    tool_choice: tools[0].name,
  });
  const message = new HumanMessage(
    "What's the weather in san francisco right now?"
  );
  const res = await chat.invoke([message]);
  expect(res.tool_calls?.length).toBe(1);

  const toolCall = res.tool_calls?.[0];
  if (!toolCall || !toolCall.id) {
    throw new Error("No tool call found");
  }
  const toolMessage = new ToolMessage({
    tool_call_id: toolCall.id,
    content: "",
  });
  const res2 = await chat.invoke([message, res, toolMessage]);
  console.log(res2);
});
