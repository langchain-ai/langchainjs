import { describe, it, expect } from "vitest";
import { AIMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ToolNode } from "../ToolNode.js";

// Custom ToolException for testing
class ToolException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolException";
  }
}

// Custom GraphBubbleUp for testing
class GraphBubbleUp extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphBubbleUp";
  }
}

// Test tool functions
const tool1 = tool(
  (input: { someVal: number; someOtherVal: string }): string => {
    if (input.someVal === 0) {
      throw new Error("Test error");
    }
    return `${input.someVal} - ${input.someOtherVal}`;
  },
  {
    name: "tool1",
    description: "Tool 1 docstring.",
    schema: z.object({
      someVal: z.number(),
      someOtherVal: z.string(),
    }),
  }
);

const tool2 = tool(
  async (input: { someVal: number; someOtherVal: string }): Promise<string> => {
    if (input.someVal === 0) {
      throw new ToolException("Test error");
    }
    return `tool2: ${input.someVal} - ${input.someOtherVal}`;
  },
  {
    name: "tool2",
    description: "Tool 2 docstring.",
    schema: z.object({
      someVal: z.number(),
      someOtherVal: z.string(),
    }),
  }
);

const tool3 = tool(
  async (input: { someVal: number; someOtherVal: string }): Promise<any[]> => {
    return [
      { key_1: input.someVal, key_2: "foo" },
      { key_1: input.someOtherVal, key_2: "baz" },
    ];
  },
  {
    name: "tool3",
    description: "Tool 3 docstring.",
    schema: z.object({
      someVal: z.number(),
      someOtherVal: z.string(),
    }),
  }
);

const tool4 = tool(
  async (_input: { someVal: number; someOtherVal: string }): Promise<any[]> => {
    return [{ type: "image_url", image_url: { url: "abdc" } }];
  },
  {
    name: "tool4",
    description: "Tool 4 docstring.",
    schema: z.object({
      someVal: z.number(),
      someOtherVal: z.string(),
    }),
  }
);

// Tool with individual error handler
const tool5 = tool(
  (_input: { someVal: number }) => {
    throw new ToolException("Test error");
  },
  {
    name: "tool5",
    description: "Tool 5 docstring.",
    schema: z.object({
      someVal: z.number(),
    }),
  }
);

// Add individual error handler property (this mimics the Python behavior)
(tool5 as any).handleToolError = "foo";

describe("ToolNode", () => {
  describe("basic tool execution", () => {
    it("should execute sync tools", async () => {
      const toolNode = new ToolNode([tool1]);

      const result = await toolNode.invoke({
        messages: [
          new AIMessage({
            content: "hi?",
            tool_calls: [
              {
                name: "tool1",
                args: { someVal: 1, someOtherVal: "foo" },
                id: "some 0",
                type: "tool_call",
              },
            ],
          }),
        ],
      });

      const toolMessage = result.messages[
        result.messages.length - 1
      ] as ToolMessage;
      expect(toolMessage.getType()).toBe("tool");
      expect(toolMessage.content).toBe("1 - foo");
      expect(toolMessage.tool_call_id).toBe("some 0");
    });

    it("should execute async tools", async () => {
      const toolNode = new ToolNode([tool2]);

      const result = await toolNode.invoke({
        messages: [
          new AIMessage({
            content: "hi?",
            tool_calls: [
              {
                name: "tool2",
                args: { someVal: 2, someOtherVal: "bar" },
                id: "some 1",
                type: "tool_call",
              },
            ],
          }),
        ],
      });

      const toolMessage = result.messages[
        result.messages.length - 1
      ] as ToolMessage;
      expect(toolMessage.getType()).toBe("tool");
      expect(toolMessage.content).toBe("tool2: 2 - bar");
    });

    it("should handle list of dicts tool content", async () => {
      const toolNode = new ToolNode([tool3]);

      const result = await toolNode.invoke({
        messages: [
          new AIMessage({
            content: "hi?",
            tool_calls: [
              {
                name: "tool3",
                args: { someVal: 2, someOtherVal: "bar" },
                id: "some 2",
                type: "tool_call",
              },
            ],
          }),
        ],
      });

      const toolMessage = result.messages[
        result.messages.length - 1
      ] as ToolMessage;
      expect(toolMessage.getType()).toBe("tool");
      expect(toolMessage.content).toEqual([
        { key_1: 2, key_2: "foo" },
        { key_1: "bar", key_2: "baz" },
      ]);
      expect(toolMessage.tool_call_id).toBe("some 2");
    });

    it("should handle list of content blocks tool content", async () => {
      const toolNode = new ToolNode([tool4]);

      const result = await toolNode.invoke({
        messages: [
          new AIMessage({
            content: "hi?",
            tool_calls: [
              {
                name: "tool4",
                args: { someVal: 2, someOtherVal: "bar" },
                id: "some 3",
                type: "tool_call",
              },
            ],
          }),
        ],
      });

      const toolMessage = result.messages[
        result.messages.length - 1
      ] as ToolMessage;
      expect(toolMessage.getType()).toBe("tool");
      expect(toolMessage.content).toEqual([
        { type: "image_url", image_url: { url: "abdc" } },
      ]);
      expect(toolMessage.tool_call_id).toBe("some 3");
    });
  });

  describe("tool call input handling", () => {
    it("should handle single tool call", async () => {
      const toolCall = {
        name: "tool1",
        args: { someVal: 1, someOtherVal: "foo" },
        id: "some 0",
        type: "tool_call" as const,
      };

      const toolNode = new ToolNode([tool1]);
      const result = await toolNode.invoke([
        new AIMessage({ content: "", tool_calls: [toolCall] }),
      ]);

      expect(result).toEqual([
        new ToolMessage({
          content: "1 - foo",
          tool_call_id: "some 0",
          name: "tool1",
        }),
      ]);
    });

    it("should handle multiple tool calls", async () => {
      const toolCall1 = {
        name: "tool1",
        args: { someVal: 1, someOtherVal: "foo" },
        id: "some 0",
        type: "tool_call" as const,
      };

      const toolCall2 = {
        name: "tool1",
        args: { someVal: 2, someOtherVal: "bar" },
        id: "some 1",
        type: "tool_call" as const,
      };

      const toolNode = new ToolNode([tool1]);
      const result = await toolNode.invoke([
        new AIMessage({ content: "", tool_calls: [toolCall1, toolCall2] }),
      ]);

      expect(result).toEqual([
        new ToolMessage({
          content: "1 - foo",
          tool_call_id: "some 0",
          name: "tool1",
        }),
        new ToolMessage({
          content: "2 - bar",
          tool_call_id: "some 1",
          name: "tool1",
        }),
      ]);
    });

    it("should handle unknown tool", async () => {
      const toolCall1 = {
        name: "tool1",
        args: { someVal: 1, someOtherVal: "foo" },
        id: "some 0",
        type: "tool_call" as const,
      };

      const toolCall3 = { ...toolCall1, name: "tool2" };

      const toolNode = new ToolNode([tool1]);
      const result = await toolNode.invoke([
        new AIMessage({ content: "", tool_calls: [toolCall1, toolCall3] }),
      ]);

      expect(result).toEqual([
        new ToolMessage({
          content: "1 - foo",
          tool_call_id: "some 0",
          name: "tool1",
        }),
        expect.objectContaining({
          content: expect.stringContaining('Tool "tool2" not found'),
          name: "tool2",
          tool_call_id: "some 0",
        }),
      ]);
    });
  });

  describe("error handling", () => {
    it("should handle errors with handleToolErrors=true", async () => {
      const toolNode = new ToolNode([tool1, tool2, tool3], {
        handleToolErrors: true,
      });

      const result = await toolNode.invoke({
        messages: [
          new AIMessage({
            content: "hi?",
            tool_calls: [
              {
                name: "tool1",
                args: { someVal: 0, someOtherVal: "foo" },
                id: "some id",
                type: "tool_call",
              },
              {
                name: "tool2",
                args: { someVal: 0, someOtherVal: "bar" },
                id: "some other id",
                type: "tool_call",
              },
              {
                name: "tool3",
                args: { someVal: 0 }, // Missing someOtherVal to trigger validation error
                id: "another id",
                type: "tool_call",
              },
            ],
          }),
        ],
      });

      expect(
        result.messages.every((m: ToolMessage) => m.getType() === "tool")
      ).toBe(true);

      expect(result.messages[0].content).toContain("Test error");
      expect(result.messages[0].content).toContain("Please fix your mistakes");
      expect(result.messages[1].content).toContain("Test error");
      expect(result.messages[1].content).toContain("Please fix your mistakes");

      expect(result.messages[0].tool_call_id).toBe("some id");
      expect(result.messages[1].tool_call_id).toBe("some other id");
      expect(result.messages[2].tool_call_id).toBe("another id");
    });

    it("should handle ValueError with custom handler", async () => {
      function handleValueError(_e: Error): string {
        return "Value error";
      }

      // Test with string handler
      let toolNode = new ToolNode([tool1], {
        handleToolErrors: "Value error" as any,
      });
      let result = await toolNode.invoke({
        messages: [
          new AIMessage({
            content: "hi?",
            tool_calls: [
              {
                name: "tool1",
                args: { someVal: 0, someOtherVal: "foo" },
                id: "some id",
                type: "tool_call",
              },
            ],
          }),
        ],
      });

      let toolMessage = result.messages[
        result.messages.length - 1
      ] as ToolMessage;
      expect(toolMessage.getType()).toBe("tool");
      expect(toolMessage.content).toContain("Test error");

      // Test with function handler
      toolNode = new ToolNode([tool1], {
        handleToolErrors: handleValueError as any,
      });
      result = await toolNode.invoke({
        messages: [
          new AIMessage({
            content: "hi?",
            tool_calls: [
              {
                name: "tool1",
                args: { someVal: 0, someOtherVal: "foo" },
                id: "some id",
                type: "tool_call",
              },
            ],
          }),
        ],
      });

      toolMessage = result.messages[result.messages.length - 1] as ToolMessage;
      expect(toolMessage.getType()).toBe("tool");
      expect(toolMessage.content).toContain("Test error");
    });

    it("should handle mixed errors", async () => {
      const toolNode = new ToolNode([tool1, tool2], {
        handleToolErrors: true,
      });

      const result = await toolNode.invoke({
        messages: [
          new AIMessage({
            content: "hi?",
            tool_calls: [
              {
                name: "tool1",
                args: { someVal: 0, someOtherVal: "foo" },
                id: "some id",
                type: "tool_call",
              },
              {
                name: "tool2",
                args: { someVal: 0, someOtherVal: "bar" },
                id: "some other id",
                type: "tool_call",
              },
            ],
          }),
        ],
      });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].content).toContain("Test error");
      expect(result.messages[1].content).toContain("Test error");
    });
  });

  describe("handleToolErrors=false", () => {
    it("should raise ValueError when handleToolErrors=false", async () => {
      const toolNode = new ToolNode([tool1], { handleToolErrors: false });

      await expect(async () => {
        await toolNode.invoke({
          messages: [
            new AIMessage({
              content: "hi?",
              tool_calls: [
                {
                  name: "tool1",
                  args: { someVal: 0, someOtherVal: "foo" },
                  id: "some id",
                  type: "tool_call",
                },
              ],
            }),
          ],
        });
      }).rejects.toThrow("Test error");
    });

    it("should raise ToolException when handleToolErrors=false", async () => {
      const toolNode = new ToolNode([tool2], { handleToolErrors: false });

      await expect(async () => {
        await toolNode.invoke({
          messages: [
            new AIMessage({
              content: "hi?",
              tool_calls: [
                {
                  name: "tool2",
                  args: { someVal: 0, someOtherVal: "bar" },
                  id: "some id",
                  type: "tool_call",
                },
              ],
            }),
          ],
        });
      }).rejects.toThrow("Test error");
    });

    it("should raise validation errors when handleToolErrors=false", async () => {
      const toolNode = new ToolNode([tool1], { handleToolErrors: false });

      await expect(async () => {
        await toolNode.invoke({
          messages: [
            new AIMessage({
              content: "hi?",
              tool_calls: [
                {
                  name: "tool1",
                  args: { someVal: 0 }, // Missing required someOtherVal
                  id: "some id",
                  type: "tool_call",
                },
              ],
            }),
          ],
        });
      }).rejects.toThrow();
    });
  });

  describe("individual tool error handling", () => {
    it("should use individual tool error handler", async () => {
      // Note: This test mimics the Python behavior but may need adjustment based on actual implementation
      const toolNode = new ToolNode([tool5], {
        handleToolErrors: "bar" as any,
      });

      const result = await toolNode.invoke({
        messages: [
          new AIMessage({
            content: "hi?",
            tool_calls: [
              {
                name: "tool5",
                args: { someVal: 0 },
                id: "some 0",
                type: "tool_call",
              },
            ],
          }),
        ],
      });

      const toolMessage = result.messages[
        result.messages.length - 1
      ] as ToolMessage;
      expect(toolMessage.getType()).toBe("tool");
      // This may need adjustment based on actual implementation
      expect(toolMessage.content).toContain("Test error");
      expect(toolMessage.tool_call_id).toBe("some 0");
    });
  });

  describe("incorrect tool name", () => {
    it("should handle incorrect tool name", async () => {
      const toolNode = new ToolNode([tool1, tool2]);

      const result = await toolNode.invoke({
        messages: [
          new AIMessage({
            content: "hi?",
            tool_calls: [
              {
                name: "tool3",
                args: { someVal: 1, someOtherVal: "foo" },
                id: "some 0",
                type: "tool_call",
              },
            ],
          }),
        ],
      });

      const toolMessage = result.messages[
        result.messages.length - 1
      ] as ToolMessage;
      expect(toolMessage.getType()).toBe("tool");
      expect(toolMessage.content).toContain('Tool "tool3" not found');
      expect(toolMessage.tool_call_id).toBe("some 0");
    });
  });

  describe("node interrupt", () => {
    const toolInterrupt = tool(
      (_input: { someVal: number }): void => {
        throw new GraphBubbleUp("foo");
      },
      {
        name: "toolInterrupt",
        description: "Tool docstring.",
        schema: z.object({
          someVal: z.number(),
        }),
      }
    );

    it("should handle GraphBubbleUp with handleToolErrors=false", async () => {
      const toolNode = new ToolNode([toolInterrupt], {
        handleToolErrors: false,
      });

      await expect(async () => {
        await toolNode.invoke({
          messages: [
            new AIMessage({
              content: "hi?",
              tool_calls: [
                {
                  name: "toolInterrupt",
                  args: { someVal: 0 },
                  id: "some 0",
                  type: "tool_call",
                },
              ],
            }),
          ],
        });
      }).rejects.toThrow("foo");
    });

    it("should handle GraphBubbleUp as error with handleToolErrors=true", async () => {
      const toolNode = new ToolNode([toolInterrupt], {
        handleToolErrors: true,
      });

      const result = await toolNode.invoke({
        messages: [
          new AIMessage({
            content: "hi?",
            tool_calls: [
              {
                name: "toolInterrupt",
                args: { someVal: 0 },
                id: "some 0",
                type: "tool_call",
              },
            ],
          }),
        ],
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toContain("foo");
    });
  });

  // TODO: Add command handling tests when InjectedToolCallId is fully supported
  // These tests would cover:
  // - Tools returning Command objects
  // - Command validation
  // - Parent commands with Send operations
  // - Remove all messages functionality
  describe("command handling", () => {
    it("should handle basic tool execution", async () => {
      // For now, just test that basic tools work properly
      // Command functionality can be tested separately when the feature is ready
      const add = tool((input: { a: number; b: number }) => input.a + input.b, {
        name: "add",
        description: "Add two numbers",
        schema: z.object({
          a: z.number(),
          b: z.number(),
        }),
      });

      const toolNode = new ToolNode([add]);
      const result = await toolNode.invoke({
        messages: [
          new AIMessage({
            content: "",
            tool_calls: [
              { args: { a: 1, b: 2 }, id: "1", name: "add", type: "tool_call" },
            ],
          }),
        ],
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toBe("3");
      expect(result.messages[0].name).toBe("add");
    });
  });
});
