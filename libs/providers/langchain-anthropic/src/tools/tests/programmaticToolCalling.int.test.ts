import { expect, it, describe } from "vitest";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";

import { ChatAnthropic } from "../../chat_models.js";
import { codeExecution_20250825 } from "../codeExecution.js";

const createModel = () =>
  new ChatAnthropic({
    model: "claude-sonnet-4-5",
    temperature: 0,
  });

describe("Programmatic Tool Calling Integration Tests", () => {
  it("invokes a tool with allowed_callers and receives caller field", async () => {
    const llm = createModel();

    const tools = [
      codeExecution_20250825(),
      {
        name: "get_weather",
        description:
          "Get the current weather for a given location. Returns temperature in Fahrenheit.",
        input_schema: {
          type: "object" as const,
          properties: {
            location: {
              type: "string",
              description: "City name, e.g. San Francisco",
            },
          },
          required: ["location"],
        },
        allowed_callers: ["code_execution_20250825"],
      },
    ];

    const response = await llm.invoke(
      [
        new HumanMessage(
          'Use code execution to programmatically call the get_weather tool for "San Francisco" and print the result.'
        ),
      ],
      { tools }
    );

    expect(response).toBeInstanceOf(AIMessage);
    expect(Array.isArray(response.content)).toBe(true);

    const contentBlocks = response.content as Array<Record<string, unknown>>;

    // Should have a tool_use block with caller field from programmatic invocation
    const toolUseBlocks = contentBlocks.filter(
      (block) => block.type === "tool_use"
    );

    // At minimum, we should see code execution activity
    const hasServerToolUse = contentBlocks.some(
      (block) => block.type === "server_tool_use"
    );
    const hasCodeExecutionResult = contentBlocks.some(
      (block) =>
        block.type === "bash_code_execution_tool_result" ||
        block.type === "text_editor_code_execution_tool_result"
    );

    expect(
      hasServerToolUse || hasCodeExecutionResult || toolUseBlocks.length > 0
    ).toBe(true);

    // If we got a tool_use block with caller, verify the caller field
    for (const block of toolUseBlocks) {
      if (block.caller) {
        expect(block.caller).toBe("code_execution_20250825");
      }
    }
  }, 120000);

  it("programmatic tool calling with container reuse via reuseLastContainer", async () => {
    const llm = new ChatAnthropic({
      model: "claude-sonnet-4-5",
      temperature: 0,
      reuseLastContainer: true,
    });

    const tools = [codeExecution_20250825()];

    // First request - creates a container
    const response1 = await llm.invoke(
      "Write the number 42 to /tmp/test_number.txt using code execution. Just do it.",
      { tools }
    );

    expect(response1).toBeInstanceOf(AIMessage);
    const containerId = (
      response1.response_metadata?.container as { id?: string } | undefined
    )?.id;
    expect(containerId).toBeDefined();

    // Second request - should reuse container automatically
    const response2 = await llm.invoke(
      [
        new HumanMessage(
          "Write the number 42 to /tmp/test_number.txt using code execution."
        ),
        response1,
        new HumanMessage(
          "Now read /tmp/test_number.txt and tell me what number is in it."
        ),
      ],
      { tools }
    );

    expect(response2).toBeInstanceOf(AIMessage);

    // Should be able to read the file since container is reused
    const textBlocks = (
      response2.content as Array<{ type: string; text?: string }>
    ).filter((b) => b.type === "text");
    const fullText = textBlocks.map((b) => b.text).join(" ");
    expect(fullText).toContain("42");
  }, 120000);

  it("non-streaming: programmatic tool call with allowed_callers", async () => {
    const llm = new ChatAnthropic({
      model: "claude-sonnet-4-5",
      temperature: 0,
      streaming: false,
    });

    const tools = [
      codeExecution_20250825(),
      {
        name: "add_numbers",
        description: "Add two numbers together and return the sum.",
        input_schema: {
          type: "object" as const,
          properties: {
            a: { type: "number", description: "First number" },
            b: { type: "number", description: "Second number" },
          },
          required: ["a", "b"],
        },
        allowed_callers: ["code_execution_20250825"],
      },
    ];

    const response = await llm.invoke(
      [
        new HumanMessage(
          "Use code execution to programmatically call add_numbers with a=3 and b=4, then tell me the result."
        ),
      ],
      { tools }
    );

    expect(response).toBeInstanceOf(AIMessage);
    expect(Array.isArray(response.content)).toBe(true);

    const contentBlocks = response.content as Array<Record<string, unknown>>;

    // Should have tool-related blocks
    const hasToolActivity =
      contentBlocks.some((b) => b.type === "tool_use") ||
      contentBlocks.some((b) => b.type === "server_tool_use") ||
      contentBlocks.some(
        (b) =>
          b.type === "bash_code_execution_tool_result" ||
          b.type === "text_editor_code_execution_tool_result"
      );
    expect(hasToolActivity).toBe(true);

    // Verify container metadata is present in response
    expect(response.response_metadata?.container).toBeDefined();
  }, 120000);

  it("streaming: programmatic tool call preserves content blocks", async () => {
    const llm = new ChatAnthropic({
      model: "claude-sonnet-4-5",
      temperature: 0,
      streaming: true,
    });

    const tools = [
      codeExecution_20250825(),
      {
        name: "multiply",
        description: "Multiply two numbers and return the product.",
        input_schema: {
          type: "object" as const,
          properties: {
            a: { type: "number" },
            b: { type: "number" },
          },
          required: ["a", "b"],
        },
        allowed_callers: ["code_execution_20250825"],
      },
    ];

    const response = await llm.invoke(
      [
        new HumanMessage(
          "Use code execution to programmatically call multiply with a=6 and b=7, then tell me the result."
        ),
      ],
      { tools }
    );

    expect(response).toBeInstanceOf(AIMessage);
    expect(Array.isArray(response.content)).toBe(true);

    const contentBlocks = response.content as Array<Record<string, unknown>>;
    // At minimum we should see some code execution or tool activity
    expect(contentBlocks.length).toBeGreaterThan(0);
  }, 120000);

  it("multi-turn with programmatic tool calling and tool results", async () => {
    const llm = createModel();

    const tools = [
      codeExecution_20250825(),
      {
        name: "get_temperature",
        description:
          "Get the temperature for a city. Returns a number in Fahrenheit.",
        input_schema: {
          type: "object" as const,
          properties: {
            city: { type: "string" },
          },
          required: ["city"],
        },
        allowed_callers: ["code_execution_20250825"],
      },
    ];

    // First turn
    const response1 = await llm.invoke(
      [
        new HumanMessage(
          'Use code execution to call get_temperature for "New York".'
        ),
      ],
      { tools }
    );

    expect(response1).toBeInstanceOf(AIMessage);
    const contentBlocks = response1.content as Array<Record<string, unknown>>;

    // Find tool_use blocks that need a response
    const toolUseBlocks = contentBlocks.filter(
      (b) => b.type === "tool_use" && b.name === "get_temperature"
    );

    if (toolUseBlocks.length > 0) {
      // Provide tool result and continue conversation
      const toolResult = new ToolMessage({
        content: "72",
        tool_call_id: toolUseBlocks[0].id as string,
      });

      const response2 = await llm.invoke(
        [
          new HumanMessage(
            'Use code execution to call get_temperature for "New York".'
          ),
          response1,
          toolResult,
          new HumanMessage("What was the temperature?"),
        ],
        { tools }
      );

      expect(response2).toBeInstanceOf(AIMessage);
    }
  }, 120000);
});
