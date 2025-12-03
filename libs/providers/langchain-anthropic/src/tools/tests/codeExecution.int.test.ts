import { expect, it, describe } from "vitest";
import { AIMessage, HumanMessage } from "@langchain/core/messages";

import { ChatAnthropic } from "../../chat_models.js";
import { codeExecution_20250825 } from "../codeExecution.js";

const createModel = () =>
  new ChatAnthropic({
    model: "claude-sonnet-4-5",
    temperature: 0,
  });

describe("Anthropic Code Execution Tool Integration Tests", () => {
  it("code execution tool can be bound to ChatAnthropic and performs calculations", async () => {
    const llm = createModel();
    const llmWithCodeExecution = llm.bindTools([codeExecution_20250825()]);

    const response = await llmWithCodeExecution.invoke([
      new HumanMessage(
        "Calculate the mean of [1, 2, 3, 4, 5]. Just give me the number."
      ),
    ]);

    expect(response).toBeInstanceOf(AIMessage);
    expect(Array.isArray(response.content)).toBe(true);

    const contentBlocks = response.content as Array<{ type: string }>;

    // Should have server_tool_use for code execution
    const hasServerToolUse = contentBlocks.some(
      (block) => block.type === "server_tool_use"
    );

    // Should have code execution result
    const hasCodeExecutionResult = contentBlocks.some(
      (block) =>
        block.type === "bash_code_execution_tool_result" ||
        block.type === "text_editor_code_execution_tool_result"
    );

    expect(hasServerToolUse).toBe(true);
    expect(hasCodeExecutionResult).toBe(true);

    const [toolUse, toolResult, result] = response.content;
    expect(toolUse).toEqual(
      expect.objectContaining({
        type: "server_tool_use",
        id: expect.any(String),
        name: "bash_code_execution",
        input: {
          command:
            'python3 -c "print(sum([1, 2, 3, 4, 5]) / len([1, 2, 3, 4, 5]))"',
        },
      })
    );
    expect(toolResult).toEqual(
      expect.objectContaining({
        type: "bash_code_execution_tool_result",
        tool_use_id: expect.any(String),
        content: expect.objectContaining({
          type: "bash_code_execution_result",
          stdout: "3.0\n",
          stderr: "",
          return_code: 0,
          content: [],
        }),
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        type: "text",
        text: expect.any(String),
      })
    );
  }, 60000);

  it("code execution tool supports container reuse across requests", async () => {
    const llm = createModel();

    // First request - creates a container and writes a file
    const response1 = await llm.invoke(
      "Write the number 7 to /tmp/number.txt using bash. Just do it, no explanation needed.",
      {
        tools: [codeExecution_20250825()],
      }
    );

    expect(response1).toBeInstanceOf(AIMessage);

    // Extract container ID from response for reuse
    const containerId = (
      response1.response_metadata?.container as { id?: string } | undefined
    )?.id;
    expect(containerId).toBeDefined();
    expect(typeof containerId).toBe("string");

    // Second request - reuse container to access the file
    const response2 = await llm.invoke(
      "Read /tmp/number.txt and calculate its square. Just give me the result.",
      {
        tools: [codeExecution_20250825()],
        container: containerId,
      }
    );

    expect(response2).toBeInstanceOf(AIMessage);

    // The response should contain code execution results
    const contentBlocks = response2.content as Array<{ type: string }>;
    const hasCodeExecutionResult = contentBlocks.some(
      (block) =>
        block.type === "bash_code_execution_tool_result" ||
        block.type === "text_editor_code_execution_tool_result"
    );
    expect(hasCodeExecutionResult).toBe(true);

    // The final text response should contain 49 (7 squared)
    const textBlock = contentBlocks.find((block) => block.type === "text") as {
      type: string;
      text: string;
    };
    expect(textBlock).toBeDefined();
    expect(textBlock.text).toContain("49");
  }, 120000);
});
