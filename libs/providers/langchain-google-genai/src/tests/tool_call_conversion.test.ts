
import { test, expect } from "@jest/globals";
import { AIMessage } from "@langchain/core/messages";
import { convertBaseMessagesToContent } from "../utils/common.js";

test("ChatGoogleGenerativeAI correctly converts 'tool_call' content block with outputVersion: 'v1'", () => {
  // 1. Create an AIMessage simulating outputVersion: "v1" behavior
  // This structure mimics what happens when outputVersion: "v1" is set
  // and tool_calls are present in the message constructor
  const aiMessage = new AIMessage({
    content: [],
    tool_calls: [
      {
        id: "call_123",
        name: "search_tool",
        args: { query: "AppSheet documentation" },
      },
    ],
    response_metadata: {
      output_version: "v1",
    },
  });

  // 2. Verify the message structure has the problematic "tool_call" block
  // This confirms the root cause description: AIMessage creates "tool_call" type blocks
  const contentBlocks = aiMessage.content as any[];
  expect(contentBlocks).toBeDefined();
  expect(contentBlocks.length).toBe(1);
  expect(contentBlocks[0].type).toBe("tool_call");
  expect(contentBlocks[0].args).toBeDefined();

  // 3. Attempt conversion (should succeed with fix)
  const result = convertBaseMessagesToContent(
    [aiMessage],
    false,
    undefined,
    "gemini-1.5-flash"
  );

  // 4. Verify correct conversion to Google GenAI format
  expect(result).toBeDefined();
  expect(result.length).toBe(1);
  const part = result[0].parts[0];
  
  // Should produce a functionCall part
  expect(part.functionCall).toBeDefined();
  expect(part.functionCall?.name).toBe("search_tool");
  expect(part.functionCall?.args).toEqual({ query: "AppSheet documentation" });
});
