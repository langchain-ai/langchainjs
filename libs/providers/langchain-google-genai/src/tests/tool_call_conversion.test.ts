import { test, expect } from "@jest/globals";
import { AIMessage } from "@langchain/core/messages";
import { convertBaseMessagesToContent } from "../utils/common.js";

test("converts standard tool_call content blocks to Google functionCall format", () => {
  // Create AIMessage with standard tool_call content block
  const aiMessage = new AIMessage({
    contentBlocks: [
      {
        type: "tool_call",
        id: "call_123",
        name: "calculator",
        args: {
          operation: "add",
          number1: 2,
          number2: 3,
        },
      },
    ],
  });

  // Convert to Google GenAI format
  const result = convertBaseMessagesToContent(
    [aiMessage],
    false, // isMultimodalModel
    undefined,
    "gemini-1.5-flash"
  );

  // Verify correct conversion
  expect(result).toBeDefined();
  expect(result.length).toBe(1);
  const part = result[0].parts[0];

  expect(part.functionCall).toBeDefined();
  expect(part.functionCall?.name).toBe("calculator");
  expect(part.functionCall?.args).toEqual({
    operation: "add",
    number1: 2,
    number2: 3,
  });
});
