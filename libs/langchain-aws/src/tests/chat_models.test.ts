import {
  SystemMessage,
  HumanMessage,
  AIMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { convertToConverseMessages } from "../common.js";

test("convertToConverseMessages works", () => {
  const messages = [
    new SystemMessage("You're an advanced AI assistant."),
    new HumanMessage(
      "What's the weather like today in Berkeley, CA? Use weather.com to check."
    ),
    new AIMessage({
      content: "",
      tool_calls: [
        {
          name: "retrieverTool",
          args: {
            url: "https://weather.com",
          },
          id: "123_retriever_tool",
        },
      ],
    }),
    new ToolMessage({
      tool_call_id: "123_retriever_tool",
      content: "The weather in Berkeley, CA is 70 degrees and sunny.",
    }),
  ];

  const { converseMessages, converseSystem } =
    convertToConverseMessages(messages);

  expect(converseSystem).toHaveLength(1);
  expect(converseSystem[0].text).toBe("You're an advanced AI assistant.");

  expect(converseMessages).toHaveLength(3);

  const userMsgs = converseMessages.filter((msg) => msg.role === "user");
  // Length of two because of the first user question, and tool use
  // messages will have the user role.
  expect(userMsgs).toHaveLength(2);
  const textUserMsg = userMsgs.find((msg) => msg.content?.[0].text);
  expect(textUserMsg?.content?.[0].text).toBe(
    "What's the weather like today in Berkeley, CA? Use weather.com to check."
  );

  const toolUseUserMsg = userMsgs.find((msg) => msg.content?.[0].toolResult);
  expect(toolUseUserMsg).toBeDefined();
  expect(toolUseUserMsg?.content).toHaveLength(1);
  if (!toolUseUserMsg?.content?.length) return;

  const toolResultContent = toolUseUserMsg.content[0];
  expect(toolResultContent).toBeDefined();
  expect(toolResultContent.toolResult?.toolUseId).toBe("123_retriever_tool");
  expect(toolResultContent.toolResult?.content?.[0].text).toBe(
    "The weather in Berkeley, CA is 70 degrees and sunny."
  );

  const assistantMsg = converseMessages.find((msg) => msg.role === "assistant");
  expect(assistantMsg).toBeDefined();
  if (!assistantMsg) return;

  const toolUseContent = assistantMsg.content?.find((c) => "toolUse" in c);
  expect(toolUseContent).toBeDefined();
  expect(toolUseContent?.toolUse?.name).toBe("retrieverTool");
  expect(toolUseContent?.toolUse?.toolUseId).toBe("123_retriever_tool");
  expect(toolUseContent?.toolUse?.input).toEqual({
    url: "https://weather.com",
  });
});
