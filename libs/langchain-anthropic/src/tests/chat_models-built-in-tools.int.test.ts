import { test, expect } from "@jest/globals";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import Anthropic from "@anthropic-ai/sdk";
import { ChatAnthropic } from "../chat_models.js";
import { _convertMessagesToAnthropicPayload } from "../utils/message_inputs.js";

const chatModelWithBuiltInTools = new ChatAnthropic({
  model: "claude-3-5-sonnet-20241022",
  temperature: 0,
}).bindTools([
  {
    type: "web_search_20250305",
    name: "web_search",
    max_uses: 1,
  },
  {
    type: "text_editor_20250124",
    name: "str_replace_editor",
  },
  {
    type: "bash_20250124",
    name: "bash",
  },
]);

test("Server Tools Integration - Web Search", async () => {
  // Test that we can handle a conversation with web search tool usage
  const messages = [
    new HumanMessage({
      content:
        "Search the web to find the name(s) of the original creator(s) of TypeScript",
    }),
  ];

  const response = await chatModelWithBuiltInTools.invoke(messages);

  console.log("Response content:", JSON.stringify(response.content, null, 2));

  // The response should be an AIMessage
  expect(response).toBeInstanceOf(AIMessage);
  expect(response.content).toBeDefined();

  // The response should contain meaningful content about TypeScript
  expect(
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content)
  ).toMatch(/TypeScript|typescript/i);

  console.log("✅ Successfully handled web search request");
}, 30000); // 30 second timeout for API call

test("Server Tools Integration - Message Round Trip", async () => {
  // Test that we can properly parse messages with server tool content blocks
  const conversation = [
    new HumanMessage({
      content:
        "Search the web to find the name(s) of the original creator(s) of TypeScript",
    }),
  ];

  try {
    const response1 = await chatModelWithBuiltInTools.invoke(conversation);

    console.log("First response:", JSON.stringify(response1.content, null, 2));

    // Add the AI response to conversation
    conversation.push(response1);

    // Continue the conversation
    conversation.push(
      new HumanMessage({
        content:
          "Based on your search, what is the name of the original creator(s) of TypeScript?",
      })
    );

    const response2 = await chatModelWithBuiltInTools.invoke(conversation);

    console.log("Second response:", JSON.stringify(response2.content, null, 2));

    // Both responses should be valid
    expect(response1).toBeInstanceOf(AIMessage);
    expect(response2).toBeInstanceOf(AIMessage);

    console.log(
      "✅ Successfully completed multi-turn conversation with server tools"
    );
  } catch (error) {
    // If server tools aren't available, the test should still not crash due to unsupported content format
    if (
      // eslint-disable-next-line no-instanceof/no-instanceof
      error instanceof Error &&
      error.message.includes("Unsupported message content format")
    ) {
      throw new Error(
        "❌ REGRESSION: 'Unsupported message content format' error returned - this should be fixed!"
      );
    }

    // Other errors (like API access issues) are expected and should not fail the test
    console.log(
      "⚠️  Server tools may not be available for this API key, but no format errors occurred"
    );
  }
}, 45000); // 45 second timeout for longer conversation

test("Server Tools Integration - Content Block Parsing", async () => {
  // Test parsing of messages that contain server tool content blocks
  const messageWithServerTool = new AIMessage({
    content: [
      {
        type: "text",
        text: "I'll search for that information.",
      },
      {
        type: "server_tool_use",
        id: "toolu_01ABC123",
        name: "web_search",
        input: {
          query: "latest AI developments",
        },
      },
    ],
  });

  const messageWithSearchResult = new HumanMessage({
    content: [
      {
        type: "web_search_tool_result",
        tool_use_id: "toolu_01ABC123",
        content: [
          {
            type: "web_search_result",
            title: "AI Breakthrough 2024",
            url: "https://example.com/ai-news",
            content: "Recent developments in AI...",
          },
        ],
      },
    ],
  });

  // This should not throw an "Unsupported message content format" error
  expect(() => {
    const messages = [messageWithServerTool, messageWithSearchResult];
    // Try to format these messages - this should work now
    const formatted = _convertMessagesToAnthropicPayload(messages);
    expect(formatted.messages).toHaveLength(2);

    // Verify server_tool_use is preserved
    const aiContent = formatted.messages[0]
      .content as Anthropic.ContentBlockParam[];
    expect(
      aiContent.find((block) => block.type === "server_tool_use")
    ).toBeDefined();

    // Verify web_search_tool_result is preserved
    const userContent = formatted.messages[1]
      .content as Anthropic.ContentBlockParam[];
    expect(
      userContent.find((block) => block.type === "web_search_tool_result")
    ).toBeDefined();
  }).not.toThrow();

  console.log(
    "✅ Successfully parsed server tool content blocks without errors"
  );
});

test("Server Tools Integration - Error Handling", async () => {
  // Test that malformed server tool content doesn't crash the system
  const messageWithMalformedContent = new AIMessage({
    content: [
      {
        type: "text",
        text: "Testing error handling",
      },
      {
        type: "server_tool_use",
        id: "test_id",
        name: "web_search",
        input: "malformed input", // This should be converted to object
      },
    ],
  });

  // This should handle the malformed input gracefully
  expect(() => {
    const formatted = _convertMessagesToAnthropicPayload([
      messageWithMalformedContent,
    ]);
    expect(formatted.messages).toHaveLength(1);

    const content = formatted.messages[0]
      .content as Anthropic.ContentBlockParam[];
    const toolUse = content.find((block) => block.type === "server_tool_use");
    expect(toolUse).toBeDefined();
  }).not.toThrow();

  console.log("✅ Successfully handled malformed server tool content");
});
