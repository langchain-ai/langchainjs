/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import {
  contextEditingMiddleware,
  ClearToolUsesEdit,
  type ContextEdit,
  type TokenCounter,
} from "../contextEditing.js";
import { createAgent } from "../../index.js";
import { FakeToolCallingChatModel } from "../../tests/utils.js";

describe("contextEditingMiddleware", () => {
  /**
   * Helper to create a conversation with tool calls
   */
  function createToolCallConversation() {
    const messages: BaseMessage[] = [
      new HumanMessage("Search for 'React'"),
      new AIMessage({
        content: "I'll search for that.",
        tool_calls: [
          {
            id: "call_1",
            name: "search",
            args: { query: "React" },
          },
        ],
      }),
      new ToolMessage({
        content: "x".repeat(1000), // Large result
        tool_call_id: "call_1",
      }),
      new AIMessage("Found React information."),
      new HumanMessage("Now search for 'TypeScript'"),
      new AIMessage({
        content: "I'll search for TypeScript.",
        tool_calls: [
          {
            id: "call_2",
            name: "search",
            args: { query: "TypeScript" },
          },
        ],
      }),
      new ToolMessage({
        content: "y".repeat(1000), // Large result
        tool_call_id: "call_2",
      }),
      new AIMessage("Found TypeScript information."),
      new HumanMessage("Search for 'JavaScript'"),
    ];

    return messages;
  }

  describe("default behavior", () => {
    it("should use default ClearToolUsesEdit with Anthropic defaults when no params provided", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("Final response")],
      });

      const middleware = contextEditingMiddleware();

      const agent = createAgent({
        model,
        middleware: [middleware],
      });

      // Create a conversation that doesn't exceed default 100K token threshold
      const messages = [
        new HumanMessage("Hello"),
        new AIMessage({
          content: "Let me search.",
          tool_calls: [
            { id: "call_1", name: "search", args: { query: "test" } },
          ],
        }),
        new ToolMessage({
          content: "Results",
          tool_call_id: "call_1",
        }),
        new AIMessage("Done."),
        new HumanMessage("Thanks"),
      ];

      const result = await agent.invoke({ messages });

      // With default 100K token threshold, nothing should be cleared
      const toolMessages = result.messages.filter(ToolMessage.isInstance);
      const clearedMessages = toolMessages.filter(
        (msg) => (msg.response_metadata as any)?.context_editing?.cleared
      );

      expect(clearedMessages.length).toBe(0);
    });

    it("should clear tool results when exceeding default trigger threshold", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("Final response")],
      });

      // Create middleware with low threshold to test clearing
      const middleware = contextEditingMiddleware({
        edits: [
          new ClearToolUsesEdit({
            triggerTokens: 100, // Very low threshold
            keep: 1, // Keep only 1 most recent
          }),
        ],
      });

      const agent = createAgent({
        model,
        middleware: [middleware],
      });

      const messages = createToolCallConversation();
      const result = await agent.invoke({ messages });

      // Should clear the older tool message
      const toolMessages = result.messages.filter(ToolMessage.isInstance);
      const clearedMessages = toolMessages.filter(
        (msg) => (msg.response_metadata as any)?.context_editing?.cleared
      );

      expect(clearedMessages.length).toBeGreaterThan(0);

      // Verify cleared message has placeholder
      const clearedMsg = clearedMessages[0];
      expect(clearedMsg.content).toBe("[cleared]");
      expect(
        (clearedMsg.response_metadata as any).context_editing.cleared
      ).toBe(true);
      expect(
        (clearedMsg.response_metadata as any).context_editing.strategy
      ).toBe("clear_tool_uses");
    });
  });

  describe("custom ClearToolUsesEdit configuration", () => {
    it("should respect custom triggerTokens threshold", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("Response")],
      });

      const middleware = contextEditingMiddleware({
        edits: [
          new ClearToolUsesEdit({
            triggerTokens: 50, // Very low threshold
            keep: 0, // Clear all
          }),
        ],
      });

      const agent = createAgent({
        model,
        middleware: [middleware],
      });

      const messages = createToolCallConversation();
      const result = await agent.invoke({ messages });

      const clearedMessages = result.messages.filter(
        (msg) =>
          ToolMessage.isInstance(msg) &&
          (msg.response_metadata as any)?.context_editing?.cleared
      );

      // Should clear tool messages
      expect(clearedMessages.length).toBeGreaterThan(0);
    });

    it("should keep the specified number of most recent tool results", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("Response")],
      });

      const keepCount = 1;
      const middleware = contextEditingMiddleware({
        edits: [
          new ClearToolUsesEdit({
            triggerTokens: 50,
            keep: keepCount,
          }),
        ],
      });

      const agent = createAgent({
        model,
        middleware: [middleware],
      });

      const messages = createToolCallConversation();
      const result = await agent.invoke({ messages });

      const toolMessages = result.messages.filter(ToolMessage.isInstance);
      const unclearedMessages = toolMessages.filter(
        (msg) => !(msg.response_metadata as any)?.context_editing?.cleared
      );

      // Should keep at least 'keepCount' uncleared tool messages
      expect(unclearedMessages.length).toBeGreaterThanOrEqual(keepCount);
    });

    it("should exclude specified tools from clearing", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("Response")],
      });

      const middleware = contextEditingMiddleware({
        edits: [
          new ClearToolUsesEdit({
            triggerTokens: 50,
            keep: 0,
            excludeTools: ["important_search"],
          }),
        ],
      });

      const agent = createAgent({
        model,
        middleware: [middleware],
      });

      const messages: BaseMessage[] = [
        new HumanMessage("Search"),
        new AIMessage({
          content: "Searching...",
          tool_calls: [
            {
              id: "call_1",
              name: "important_search",
              args: { query: "test" },
            },
          ],
        }),
        new ToolMessage({
          content: "x".repeat(1000),
          tool_call_id: "call_1",
          name: "important_search",
        }),
        new AIMessage("Found it."),
        new HumanMessage("Search again"),
        new AIMessage({
          content: "Searching...",
          tool_calls: [
            { id: "call_2", name: "regular_search", args: { query: "test" } },
          ],
        }),
        new ToolMessage({
          content: "y".repeat(1000),
          tool_call_id: "call_2",
          name: "regular_search",
        }),
        new AIMessage("Done."),
        new HumanMessage("One more"),
      ];

      const result = await agent.invoke({ messages });

      // Find the excluded tool message
      const excludedToolMsg = result.messages.find(
        (msg) => ToolMessage.isInstance(msg) && msg.tool_call_id === "call_1"
      ) as ToolMessage;

      // Should NOT be cleared (excluded tools are never cleared)
      expect(
        (excludedToolMsg.response_metadata as any)?.context_editing?.cleared
      ).toBeFalsy();
      expect(excludedToolMsg.content).not.toBe("[cleared]");
    });

    it("should clear tool inputs when clearToolInputs is true", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("Response")],
      });

      const middleware = contextEditingMiddleware({
        edits: [
          new ClearToolUsesEdit({
            triggerTokens: 50,
            keep: 0,
            clearToolInputs: true,
          }),
        ],
      });

      const agent = createAgent({
        model,
        middleware: [middleware],
      });

      const messages = createToolCallConversation();
      const result = await agent.invoke({ messages });

      // Find an AI message whose tool output was cleared
      const clearedToolMsg = result.messages.find(
        (msg) =>
          ToolMessage.isInstance(msg) &&
          (msg.response_metadata as any)?.context_editing?.cleared
      ) as ToolMessage;

      if (clearedToolMsg) {
        // Find the corresponding AI message
        const aiMsg = result.messages.find(
          (msg) =>
            AIMessage.isInstance(msg) &&
            msg.tool_calls?.some((tc) => tc.id === clearedToolMsg.tool_call_id)
        ) as AIMessage;

        if (aiMsg) {
          const toolCall = aiMsg.tool_calls?.find(
            (tc) => tc.id === clearedToolMsg.tool_call_id
          );
          // Tool call args should be cleared
          expect(toolCall?.args).toEqual({});
          expect(
            (aiMsg.response_metadata as any)?.context_editing
              ?.cleared_tool_inputs
          ).toContain(clearedToolMsg.tool_call_id);
        }
      }
    });

    it("should use custom placeholder text", async () => {
      const customPlaceholder = "[REDACTED]";
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("Response")],
      });

      const middleware = contextEditingMiddleware({
        edits: [
          new ClearToolUsesEdit({
            triggerTokens: 50,
            keep: 0,
            placeholder: customPlaceholder,
          }),
        ],
      });

      const agent = createAgent({
        model,
        middleware: [middleware],
      });

      const messages = createToolCallConversation();
      const result = await agent.invoke({ messages });

      const clearedMessages = result.messages.filter(
        (msg) =>
          ToolMessage.isInstance(msg) &&
          (msg.response_metadata as any)?.context_editing?.cleared
      );

      if (clearedMessages.length > 0) {
        expect(clearedMessages[0].content).toBe(customPlaceholder);
      }
    });

    it("should clear at least the specified number of tokens", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("Response")],
      });

      const middleware = contextEditingMiddleware({
        edits: [
          new ClearToolUsesEdit({
            triggerTokens: 100,
            clearAtLeast: 500,
            keep: 0,
          }),
        ],
      });

      const agent = createAgent({
        model,
        middleware: [middleware],
      });

      const messages = createToolCallConversation();
      const result = await agent.invoke({ messages });

      const clearedMessages = result.messages.filter(
        (msg) =>
          ToolMessage.isInstance(msg) &&
          (msg.response_metadata as any)?.context_editing?.cleared
      );

      // Should clear messages until clearAtLeast tokens are reclaimed
      expect(clearedMessages.length).toBeGreaterThan(0);
    });
  });

  describe("custom editing strategies", () => {
    it("should support custom ContextEdit implementation", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("Response")],
      });

      let customEditCalled = false;

      /**
       * Custom strategy that removes all human messages over threshold
       */
      class RemoveHumanMessages implements ContextEdit {
        async apply(params: {
          tokens: number;
          messages: BaseMessage[];
          countTokens: TokenCounter;
        }): Promise<number> {
          customEditCalled = true;

          if (params.tokens > 100) {
            // Remove all human messages except the last one
            const humanIndices: number[] = [];
            params.messages.forEach((msg, idx) => {
              if (HumanMessage.isInstance(msg)) {
                humanIndices.push(idx);
              }
            });

            // Keep only the last human message
            if (humanIndices.length > 1) {
              // Remove from the end backwards to maintain indices
              for (let i = humanIndices.length - 2; i >= 0; i--) {
                params.messages.splice(humanIndices[i], 1);
              }
            }

            return await params.countTokens(params.messages);
          }

          return params.tokens;
        }
      }

      const middleware = contextEditingMiddleware({
        edits: [new RemoveHumanMessages()],
      });

      const agent = createAgent({
        model,
        middleware: [middleware],
      });

      const messages = createToolCallConversation();
      const humanCountBefore = messages.filter(HumanMessage.isInstance).length;

      const result = await agent.invoke({ messages });

      expect(customEditCalled).toBe(true);

      const humanCountAfter = result.messages.filter(
        HumanMessage.isInstance
      ).length;

      // Should have fewer human messages
      expect(humanCountAfter).toBeLessThan(humanCountBefore);
    });

    it("should chain multiple editing strategies", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("Response")],
      });

      let strategy1Called = false;
      let strategy2Called = false;

      class Strategy1 implements ContextEdit {
        async apply(params: {
          tokens: number;
          messages: BaseMessage[];
          countTokens: TokenCounter;
        }): Promise<number> {
          strategy1Called = true;
          return params.tokens;
        }
      }

      class Strategy2 implements ContextEdit {
        async apply(params: {
          tokens: number;
          messages: BaseMessage[];
          countTokens: TokenCounter;
        }): Promise<number> {
          strategy2Called = true;
          return params.tokens;
        }
      }

      const middleware = contextEditingMiddleware({
        edits: [new Strategy1(), new Strategy2()],
      });

      const agent = createAgent({
        model,
        middleware: [middleware],
      });

      const messages = [new HumanMessage("Hello"), new AIMessage("Hi there!")];

      await agent.invoke({ messages });

      // Both strategies should be called in sequence
      expect(strategy1Called).toBe(true);
      expect(strategy2Called).toBe(true);
    });
  });

  describe("token counting methods", () => {
    it("should use approximate token counting by default", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("Response")],
      });

      const middleware = contextEditingMiddleware({
        tokenCountMethod: "approx",
      });

      const agent = createAgent({
        model,
        middleware: [middleware],
      });

      const messages = [
        new HumanMessage("Test message"),
        new AIMessage("Response"),
      ];

      // Should not throw even without model token counting support
      await expect(agent.invoke({ messages })).resolves.toBeDefined();
    });

    it("should handle messages with empty content", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("Response")],
      });

      const middleware = contextEditingMiddleware({
        edits: [
          new ClearToolUsesEdit({
            triggerTokens: 50,
            keep: 0,
          }),
        ],
      });

      const agent = createAgent({
        model,
        middleware: [middleware],
      });

      const messages: BaseMessage[] = [
        new HumanMessage(""),
        new AIMessage({
          content: "",
          tool_calls: [{ id: "call_1", name: "tool", args: {} }],
        }),
        new ToolMessage({
          content: "",
          tool_call_id: "call_1",
        }),
      ];

      await expect(agent.invoke({ messages })).resolves.toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("should not clear already cleared messages", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("Response")],
      });

      const middleware = contextEditingMiddleware({
        edits: [
          new ClearToolUsesEdit({
            triggerTokens: 50,
            keep: 0,
          }),
        ],
      });

      const agent = createAgent({
        model,
        middleware: [middleware],
      });

      // Create a message that's already marked as cleared
      const messages: BaseMessage[] = [
        new HumanMessage("Test"),
        new AIMessage({
          content: "Testing",
          tool_calls: [{ id: "call_1", name: "test", args: {} }],
        }),
        new ToolMessage({
          content: "[cleared]",
          tool_call_id: "call_1",
          response_metadata: {
            context_editing: {
              cleared: true,
              strategy: "clear_tool_uses",
            },
          },
        }),
        new AIMessage("Done"),
        new HumanMessage("More"),
      ];

      const result = await agent.invoke({ messages });

      // Should not try to clear an already cleared message
      const clearedMsg = result.messages.find(
        (msg) => ToolMessage.isInstance(msg) && msg.tool_call_id === "call_1"
      ) as ToolMessage;

      expect(clearedMsg.content).toBe("[cleared]");
      expect(
        (clearedMsg.response_metadata as any).context_editing.cleared
      ).toBe(true);
    });

    it("should handle messages with no corresponding AI message", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("Response")],
      });

      const middleware = contextEditingMiddleware({
        edits: [
          new ClearToolUsesEdit({
            triggerTokens: 50,
            keep: 0,
          }),
        ],
      });

      const agent = createAgent({
        model,
        middleware: [middleware],
      });

      // Tool message without a corresponding AI message (malformed conversation)
      const messages: BaseMessage[] = [
        new HumanMessage("Test"),
        new ToolMessage({
          content: "Result",
          tool_call_id: "orphan_call",
        }),
        new AIMessage("Done"),
      ];

      // Should handle gracefully without throwing
      await expect(agent.invoke({ messages })).resolves.toBeDefined();
    });
  });
});
