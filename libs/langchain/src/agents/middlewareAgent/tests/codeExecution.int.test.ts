import { describe, it, expect } from "vitest";
import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

import { createAgent } from "../index.js";

describe("Code Execution Tool", () => {
  it("should use Anthropic code_execution tool to calculate statistics", async () => {
    // Create ChatAnthropic model with code execution beta header
    const model = new ChatAnthropic({
      model: "claude-3-5-haiku-20241022",
      temperature: 0,
      clientOptions: {
        defaultHeaders: {
          "anthropic-beta": "code-execution-2025-08-25",
        },
      },
    });

    // Define the built-in code_execution tool
    const codeExecutionTool = {
      type: "code_execution_20250825",
      name: "code_execution",
    };

    // Create agent with the built-in tool
    const agent = createAgent({
      model,
      tools: [codeExecutionTool],
    });

    // Invoke the agent with a statistics calculation task
    const result = await agent.invoke({
      messages: [
        new HumanMessage(
          "Calculate the mean and standard deviation of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]"
        ),
      ],
    });

    // Verify the result contains messages
    expect(result.messages).toBeDefined();
    expect(result.messages.length).toBeGreaterThan(0);

    // Find the final AI response
    const aiResponse = result.messages.find((msg) => msg.type === "ai") as
      | AIMessage
      | undefined;
    expect(aiResponse).toBeDefined();

    // The response should contain content blocks
    const content = Array.isArray(aiResponse?.content)
      ? aiResponse.content
      : [];
    expect(content.length).toBeGreaterThan(0);

    // Verify that code_execution tool was used (server_tool_use block)
    expect(content.some((block) => block.type === "server_tool_use")).toBe(
      true
    );

    // Verify that we got a code execution result
    expect(
      content.some((block) => block.type === "bash_code_execution_tool_result")
    ).toBe(true);

    // The response should contain text with the calculated values
    const textBlocks = content.filter((block) => block.type === "text");
    const responseText = textBlocks
      .map((block) => block.text)
      .join(" ")
      .toLowerCase();

    // The response should mention the mean (5.5) and standard deviation (~2.87)
    expect(responseText).toMatch(/mean|average/i);
    expect(responseText).toMatch(/standard deviation|std/i);
    expect(responseText).toMatch(/5\.5/); // Expected mean
    expect(responseText).toMatch(/2\.[89]|3\./); // Expected stdev (approximately 2.87)
  }, 60000); // Set timeout to 60s for API call
});
