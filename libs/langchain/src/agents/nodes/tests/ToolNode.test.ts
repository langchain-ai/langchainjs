import { describe, expect, it, vi } from "vitest";
import { StructuredTool, tool } from "@langchain/core/tools";
import type { ToolCall } from "@langchain/core/messages/tool";

import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  RemoveMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { z } from "zod/v3";
import { RunnableLambda } from "@langchain/core/runnables";
import { CallbackManager } from "@langchain/core/callbacks/manager";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import {
  Annotation,
  Command,
  GraphInterrupt,
  messagesStateReducer,
  Send,
  StateGraph,
  MessagesAnnotation,
  MessagesZodState,
} from "@langchain/langgraph";

import { ToolNode } from "../ToolNode.js";

import {
  _AnyIdAIMessage,
  _AnyIdHumanMessage,
  _AnyIdToolMessage,
  FakeToolCallingModel,
  MemorySaverAssertImmutable,
} from "../../tests/utils.js";
import { createAgent } from "../../index.js";

const searchSchema = z.object({
  query: z.string().describe("The query to search for."),
});

class SearchAPI extends StructuredTool {
  name = "search_api";

  description = "A simple API that returns the input string.";

  schema = searchSchema;

  async _call(input: z.infer<typeof searchSchema>) {
    if (input?.query === "error") {
      throw new Error("Error");
    }
    return `result for ${input?.query}`;
  }
}

describe("ToolNode", () => {
  it("Should work when nested with a callback manager passed", async () => {
    const toolNode = new ToolNode([new SearchAPI()]);
    const wrapper = RunnableLambda.from(async (_) => {
      const res = await toolNode.invoke([
        new AIMessage({
          content: "",
          tool_calls: [
            { name: "search_api", args: { query: "foo" }, id: "testid" },
          ],
        }),
      ]);
      return res;
    });
    let runnableStartCount = 0;
    const callbackManager = new CallbackManager();
    callbackManager.addHandler(
      BaseCallbackHandler.fromMethods({
        handleChainStart: () => {
          runnableStartCount += 1;
        },
        handleToolStart: () => {
          runnableStartCount += 1;
        },
      })
    );
    await wrapper.invoke({}, { callbacks: callbackManager });
    /**
     * The original test was expecting `runnableStartCount` to be 2
     * @todo(Christian): check in with @dqbd to see if this is expected behavior
     */
    expect(runnableStartCount).toEqual(1);
  });

  it("Should work in a state graph", async () => {
    const AgentAnnotation = Annotation.Root({
      messages: Annotation<BaseMessage[]>({
        reducer: messagesStateReducer,
        default: () => [],
      }),
      prop2: Annotation<string>,
    });

    const weatherTool = tool(
      async ({ query }) => {
        // This is a placeholder for the actual implementation
        if (
          query.toLowerCase().includes("sf") ||
          query.toLowerCase().includes("san francisco")
        ) {
          return "It's 60 degrees and foggy.";
        }
        return "It's 90 degrees and sunny.";
      },
      {
        name: "weather",
        description: "Call to get the current weather for a location.",
        schema: z.object({
          query: z.string().describe("The query to use in your search."),
        }),
      }
    );

    const aiMessage = new AIMessage({
      content: "",
      tool_calls: [
        {
          id: "call_1234",
          args: {
            query: "SF",
          },
          name: "weather",
          type: "tool_call",
        },
      ],
    });

    const aiMessage2 = new AIMessage({
      content: "FOO",
    });

    async function callModel(state: typeof AgentAnnotation.State) {
      // We return a list, because this will get added to the existing list
      if (state.messages.includes(aiMessage)) {
        return { messages: [aiMessage2] };
      }
      return { messages: [aiMessage] };
    }

    function shouldContinue({
      messages,
    }: typeof AgentAnnotation.State): "tools" | "__end__" {
      const lastMessage = messages[messages.length - 1];

      // If the last message isn't an AIMessage, we stop
      if (!AIMessage.isInstance(lastMessage)) {
        return "__end__";
      }
      // If the LLM makes a tool call, then we route to the "tools" node
      if ((lastMessage.tool_calls?.length ?? 0) > 0) {
        return "tools";
      }
      // Otherwise, we stop (reply to the user)
      return "__end__";
    }

    const graph = new StateGraph(AgentAnnotation)
      .addNode("agent", callModel)
      .addNode("tools", new ToolNode([weatherTool]))
      .addEdge("__start__", "agent")
      .addConditionalEdges("agent", shouldContinue)
      .addEdge("tools", "agent")
      .compile();
    const res = await graph.invoke({
      messages: [],
    });
    const toolMessageId = res.messages[1].id;
    expect(res).toEqual({
      messages: [
        aiMessage,
        expect.objectContaining({
          id: toolMessageId,
          name: "weather",
          artifact: undefined,
          content: "It's 60 degrees and foggy.",
          tool_call_id: "call_1234",
        }),
        aiMessage2,
      ],
    });
  });
});

describe("MessagesAnnotation", () => {
  it("should assign ids properly and avoid duping added messages", async () => {
    const childGraph = new StateGraph(MessagesAnnotation)
      .addNode("duper", ({ messages }) => ({ messages }))
      .addNode("duper2", ({ messages }) => ({ messages }))
      .addEdge("__start__", "duper")
      .addEdge("duper", "duper2")
      .compile({ interruptBefore: ["duper2"] });
    const graph = new StateGraph(MessagesAnnotation)
      .addNode("duper", childGraph)
      .addNode("duper2", ({ messages }) => ({ messages }))
      .addEdge("__start__", "duper")
      .addEdge("duper", "duper2")
      .compile({ checkpointer: new MemorySaverAssertImmutable() });
    const res = await graph.invoke(
      { messages: [new HumanMessage("should be only one")] },
      { configurable: { thread_id: "1" } }
    );
    const res2 = await graph.invoke(null, {
      configurable: { thread_id: "1" },
    });

    expect(res.messages.length).toEqual(1);
    expect(res2.messages.length).toEqual(1);
  });
});

describe("MessagesZodState", () => {
  it("should assign ids properly and avoid duping added messages", async () => {
    const childGraph = new StateGraph(MessagesZodState)
      .addNode("duper", ({ messages }) => ({ messages }))
      .addNode("duper2", () => ({ messages: [new AIMessage("duper2")] }))
      .addEdge("__start__", "duper")
      .addEdge("duper", "duper2")
      .compile({ interruptBefore: ["duper2"] });

    const graph = new StateGraph(MessagesZodState)
      .addNode("duper", childGraph)
      .addNode("duper2", ({ messages }) => ({ messages }))
      .addEdge("__start__", "duper")
      .addEdge("duper", "duper2")
      .compile({ checkpointer: new MemorySaverAssertImmutable() });

    const res = await graph.invoke(
      { messages: [new HumanMessage("should be only one")] },
      { configurable: { thread_id: "1" } }
    );
    expect(res.messages.length).toEqual(1);

    const res2 = await graph.invoke(null, { configurable: { thread_id: "1" } });
    expect(res2.messages.length).toEqual(2);
  });

  it("should handle message reducers correctly", async () => {
    const graph = new StateGraph(MessagesZodState)
      .addNode("add", ({ messages }) => ({
        messages: [...messages, new HumanMessage("new message")],
      }))
      .addNode("remove", ({ messages }) => {
        return {
          messages: [new RemoveMessage({ id: messages[0].id ?? "" })],
        };
      })
      .addEdge("__start__", "add")
      .addEdge("add", "remove")
      .compile();

    const result = await graph.invoke({
      messages: [new HumanMessage({ id: "test-id", content: "original" })],
    });

    expect(result.messages.length).toEqual(1);
  });

  it("should handle array updates correctly", async () => {
    const graph = new StateGraph(MessagesZodState)
      .addNode("add", () => ({
        messages: [
          new HumanMessage({ id: "msg1", content: "message 1" }),
          new HumanMessage({ id: "msg2", content: "message 2" }),
        ],
      }))
      .addNode("update", ({ messages }) => {
        const firstMessageId = messages[0]?.id;
        if (!firstMessageId) {
          throw new Error("No message ID found");
        }
        return {
          messages: [
            new HumanMessage({ id: firstMessageId, content: "updated" }),
          ],
        };
      })
      .addEdge("__start__", "add")
      .addEdge("add", "update")
      .compile();

    const result = await graph.invoke({ messages: [] });

    expect(result.messages.length).toEqual(2);
    expect(result.messages[0].content).toEqual("updated");
    expect(result.messages[1].content).toEqual("message 2");
  });
});

describe("messagesStateReducer", () => {
  it("should dedupe messages", () => {
    const deduped = messagesStateReducer(
      [new HumanMessage({ id: "foo", content: "bar" })],
      [new HumanMessage({ id: "foo", content: "bar2" })]
    );
    expect(deduped.length).toEqual(1);
    expect(deduped[0].content).toEqual("bar2");
  });

  it("should dedupe messages if there are dupes on the right", () => {
    const messages = [
      new HumanMessage({ id: "foo", content: "bar" }),
      new HumanMessage({ id: "foo", content: "bar2" }),
    ];
    const deduped = messagesStateReducer([], messages);
    expect(deduped.length).toEqual(1);
    expect(deduped[0].content).toEqual("bar2");
  });

  it("should apply right-side messages in order", () => {
    const messages = [
      new RemoveMessage({ id: "foo" }),
      new HumanMessage({ id: "foo", content: "bar" }),
      new HumanMessage({ id: "foo", content: "bar2" }),
    ];
    const deduped = messagesStateReducer(
      [new HumanMessage({ id: "foo", content: "bar3" })],
      messages
    );
    expect(deduped.length).toEqual(1);
    expect(deduped[0].content).toEqual("bar2");
  });
});

describe("ToolNode with Commands", () => {
  it("can handle tools returning commands with dict input", async () => {
    // Tool that returns a Command
    const transferToBob = tool(
      async (_, config) => {
        return new Command({
          update: {
            messages: [
              new ToolMessage({
                content: "Transferred to Bob",
                tool_call_id: config.toolCall.id,
                name: "transfer_to_bob",
              }),
            ],
          },
          goto: "bob",
          graph: Command.PARENT,
        });
      },
      {
        name: "transfer_to_bob",
        description: "Transfer to Bob",
        schema: z.object({}),
      }
    );

    // Async version of the tool
    const asyncTransferToBob = tool(
      async (_, config) => {
        return new Command({
          update: {
            messages: [
              new ToolMessage({
                content: "Transferred to Bob",
                tool_call_id: config.toolCall.id,
                name: "async_transfer_to_bob",
              }),
            ],
          },
          goto: "bob",
          graph: Command.PARENT,
        });
      },
      {
        name: "async_transfer_to_bob",
        description: "Transfer to Bob",
        schema: z.object({}),
      }
    );

    // Basic tool that doesn't return a Command
    const add = tool(({ a, b }) => `${a + b}`, {
      name: "add",
      description: "Add two numbers",
      schema: z.object({
        a: z.number(),
        b: z.number(),
      }),
    });

    // Test mixing regular tools and tools returning commands

    // Test with dict input
    const result = await new ToolNode([add, transferToBob]).invoke({
      messages: [
        new AIMessage({
          content: "",
          tool_calls: [
            { args: { a: 1, b: 2 }, id: "1", name: "add", type: "tool_call" },
            { args: {}, id: "2", name: "transfer_to_bob", type: "tool_call" },
          ],
        }),
      ],
    });

    expect(result).toMatchObject([
      {
        messages: [
          expect.objectContaining({
            content: "3",
            tool_call_id: "1",
            name: "add",
          }),
        ],
      },
      new Command({
        update: {
          messages: [
            new ToolMessage({
              content: "Transferred to Bob",
              tool_call_id: "2",
              name: "transfer_to_bob",
            }),
          ],
        },
        goto: "bob",
        graph: Command.PARENT,
      }),
    ]);

    // Test single tool returning command
    const singleToolResult = await new ToolNode([transferToBob]).invoke({
      messages: [
        new AIMessage({
          content: "",
          tool_calls: [{ args: {}, id: "1", name: "transfer_to_bob" }],
        }),
      ],
    });

    expect(singleToolResult).toMatchObject([
      new Command({
        update: {
          messages: [
            new ToolMessage({
              content: "Transferred to Bob",
              tool_call_id: "1",
              name: "transfer_to_bob",
            }),
          ],
        },
        goto: "bob",
        graph: Command.PARENT,
      }),
    ]);

    // Test async tool
    const asyncToolResult = await new ToolNode([asyncTransferToBob]).invoke({
      messages: [
        new AIMessage({
          content: "",
          tool_calls: [{ args: {}, id: "1", name: "async_transfer_to_bob" }],
        }),
      ],
    });

    expect(asyncToolResult).toMatchObject([
      new Command({
        update: {
          messages: [
            new ToolMessage({
              content: "Transferred to Bob",
              tool_call_id: "1",
              name: "async_transfer_to_bob",
            }),
          ],
        },
        goto: "bob",
        graph: Command.PARENT,
      }),
    ]);

    // Test multiple commands
    const multipleCommandsResult = await new ToolNode([
      transferToBob,
      asyncTransferToBob,
    ]).invoke({
      messages: [
        new AIMessage({
          content: "",
          tool_calls: [
            { args: {}, id: "1", name: "transfer_to_bob" },
            { args: {}, id: "2", name: "async_transfer_to_bob" },
          ],
        }),
      ],
    });

    expect(multipleCommandsResult).toMatchObject([
      new Command({
        update: {
          messages: [
            new ToolMessage({
              content: "Transferred to Bob",
              tool_call_id: "1",
              name: "transfer_to_bob",
            }),
          ],
        },
        goto: "bob",
        graph: Command.PARENT,
      }),
      new Command({
        update: {
          messages: [
            new ToolMessage({
              content: "Transferred to Bob",
              tool_call_id: "2",
              name: "async_transfer_to_bob",
            }),
          ],
        },
        goto: "bob",
        graph: Command.PARENT,
      }),
    ]);
  });

  it("can handle tools returning commands with array input", async () => {
    // Tool that returns a Command with array update
    const transferToBob = tool(
      async (_, config) => {
        return new Command({
          update: [
            // @ts-expect-error: Command typing needs to be updated properly
            new ToolMessage({
              content: "Transferred to Bob",
              tool_call_id: config.toolCall.id,
              name: "transfer_to_bob",
            }),
          ],
          goto: "bob",
          graph: Command.PARENT,
        });
      },
      {
        name: "transfer_to_bob",
        description: "Transfer to Bob",
        schema: z.object({}),
      }
    );

    // Async version of the tool
    const asyncTransferToBob = tool(
      async (_, config) => {
        return new Command({
          update: [
            // @ts-expect-error: Command typing needs to be updated properly
            new ToolMessage({
              content: "Transferred to Bob",
              tool_call_id: config.toolCall.id,
              name: "async_transfer_to_bob",
            }),
          ],
          goto: "bob",
          graph: Command.PARENT,
        });
      },
      {
        name: "async_transfer_to_bob",
        description: "Transfer to Bob",
        schema: z.object({}),
      }
    );

    // Basic tool that doesn't return a Command
    const add = tool(({ a, b }) => `${a + b}`, {
      name: "add",
      description: "Add two numbers",
      schema: z.object({
        a: z.number(),
        b: z.number(),
      }),
    });

    // Test with array input
    const result = await new ToolNode([add, transferToBob]).invoke([
      new AIMessage({
        content: "",
        tool_calls: [
          { args: { a: 1, b: 2 }, id: "1", name: "add" },
          { args: {}, id: "2", name: "transfer_to_bob" },
        ],
      }),
    ]);

    expect(result).toMatchObject([
      [
        expect.objectContaining({
          content: "3",
          tool_call_id: "1",
          name: "add",
        }),
      ],
      new Command({
        update: [
          // @ts-expect-error: Command typing needs to be updated properly
          new ToolMessage({
            content: "Transferred to Bob",
            tool_call_id: "2",
            name: "transfer_to_bob",
          }),
        ],
        goto: "bob",
        graph: Command.PARENT,
      }),
    ]);

    // Test single tool returning command
    for (const tool of [transferToBob, asyncTransferToBob]) {
      const result = await new ToolNode([tool]).invoke([
        new AIMessage({
          content: "",
          tool_calls: [{ args: {}, id: "1", name: tool.name }],
        }),
      ]);

      expect(result).toMatchObject([
        new Command({
          update: [
            // @ts-expect-error: Command typing needs to be updated properly
            new ToolMessage({
              content: "Transferred to Bob",
              tool_call_id: "1",
              name: tool.name,
            }),
          ],
          goto: "bob",
          graph: Command.PARENT,
        }),
      ]);
    }

    // Test multiple commands
    const multipleCommandsResult = await new ToolNode([
      transferToBob,
      asyncTransferToBob,
    ]).invoke([
      new AIMessage({
        content: "",
        tool_calls: [
          { args: {}, id: "1", name: "transfer_to_bob" },
          { args: {}, id: "2", name: "async_transfer_to_bob" },
        ],
      }),
    ]);

    expect(multipleCommandsResult).toMatchObject([
      new Command({
        update: [
          // @ts-expect-error: Command typing needs to be updated properly
          new ToolMessage({
            content: "Transferred to Bob",
            tool_call_id: "1",
            name: "transfer_to_bob",
          }),
        ],
        goto: "bob",
        graph: Command.PARENT,
      }),
      new Command({
        update: [
          // @ts-expect-error: Command typing needs to be updated properly
          new ToolMessage({
            content: "Transferred to Bob",
            tool_call_id: "2",
            name: "async_transfer_to_bob",
          }),
        ],
        goto: "bob",
        graph: Command.PARENT,
      }),
    ]);
  });

  it("should handle parent commands with Send", async () => {
    // Create tools that return Commands with Send
    const transferToAlice = tool(
      async (_, config) => {
        return new Command({
          goto: [
            new Send("alice", {
              messages: [
                new ToolMessage({
                  content: "Transferred to Alice",
                  name: "transfer_to_alice",
                  tool_call_id: config.toolCall.id,
                }),
              ],
            }),
          ],
          graph: Command.PARENT,
        });
      },
      {
        name: "transfer_to_alice",
        description: "Transfer to Alice",
        schema: z.object({}),
      }
    );

    const transferToBob = tool(
      async (_, config) => {
        return new Command({
          goto: [
            new Send("bob", {
              messages: [
                new ToolMessage({
                  content: "Transferred to Bob",
                  name: "transfer_to_bob",
                  tool_call_id: config.toolCall.id,
                }),
              ],
            }),
          ],
          graph: Command.PARENT,
        });
      },
      {
        name: "transfer_to_bob",
        description: "Transfer to Bob",
        schema: z.object({}),
      }
    );

    const result = await new ToolNode([transferToAlice, transferToBob]).invoke([
      new AIMessage({
        content: "",
        tool_calls: [
          { args: {}, id: "1", name: "transfer_to_alice", type: "tool_call" },
          { args: {}, id: "2", name: "transfer_to_bob", type: "tool_call" },
        ],
      }),
    ]);

    expect(result).toMatchObject([
      new Command({
        goto: [
          new Send("alice", {
            messages: [
              new ToolMessage({
                content: "Transferred to Alice",
                name: "transfer_to_alice",
                tool_call_id: "1",
              }),
            ],
          }),
          new Send("bob", {
            messages: [
              new ToolMessage({
                content: "Transferred to Bob",
                name: "transfer_to_bob",
                tool_call_id: "2",
              }),
            ],
          }),
        ],
        graph: Command.PARENT,
      }),
    ]);
  });
});

describe("ToolNode error handling", () => {
  it("should raise GraphInterrupt", async () => {
    const toolWithError = tool(
      async (_) => {
        throw new GraphInterrupt();
      },
      {
        name: "tool_with_interrupt",
        description: "A tool that returns an interrupt",
        schema: z.object({}),
      }
    );
    const toolNode = new ToolNode([toolWithError]);
    await expect(
      toolNode.invoke({
        messages: [
          new AIMessage({
            content: "",
            tool_calls: [
              { name: "tool_with_interrupt", args: {}, id: "testid" },
            ],
          }),
        ],
      })
    ).rejects.toThrow(GraphInterrupt);
  });

  it("should handle tool errors by default", async () => {
    const toolWithError = tool(
      async (_) => {
        throw new Error("some error");
      },
      {
        name: "tool_with_interrupt",
        description: "A tool that returns an interrupt",
        schema: z.object({}),
      }
    );
    const toolNode = new ToolNode([toolWithError]);
    const result = await toolNode.invoke({
      messages: [
        new AIMessage({
          content: "",
          tool_calls: [{ name: "tool_with_interrupt", args: {}, id: "testid" }],
        }),
      ],
    });
    expect(result.messages[0].content).toBe(
      "Error: some error\n Please fix your mistakes."
    );
  });

  it("should throw if handleToolErrors is false", async () => {
    const toolWithError = tool(
      async (_) => {
        throw new Error("some error");
      },
      {
        name: "tool_with_interrupt",
        description: "A tool that returns an interrupt",
        schema: z.object({}),
      }
    );
    const toolNode = new ToolNode([toolWithError], {
      handleToolErrors: false,
    });
    await expect(
      toolNode.invoke({
        messages: [
          new AIMessage({
            content: "",
            tool_calls: [
              { name: "tool_with_interrupt", args: {}, id: "testid" },
            ],
          }),
        ],
      })
    ).rejects.toThrow(/some error/);
  });

  it("should allow to handle tool errors with a function", async () => {
    const errorToThrow = new Error("some error");
    const toolCall = { name: "tool_with_interrupt", args: {}, id: "testid" };
    const toolWithError = tool(
      async (_) => {
        throw errorToThrow;
      },
      {
        name: "tool_with_interrupt",
        description: "A tool that returns an interrupt",
        schema: z.object({}),
      }
    );
    const handleToolErrors = vi.fn();
    const toolNode = new ToolNode([toolWithError], {
      handleToolErrors,
    });
    await expect(
      toolNode.invoke({
        messages: [
          new AIMessage({
            content: "",
            tool_calls: [toolCall],
          }),
        ],
      })
    ).rejects.toThrow(/some error/);
    expect(handleToolErrors).toHaveBeenCalledWith(errorToThrow, toolCall);
  });

  it("should return a ToolMessage if handleToolErrors returns a ToolMessage", async () => {
    const toolWithError = tool(
      async (_) => {
        throw new Error("some error");
      },
      {
        name: "tool_with_error",
      }
    );
    const toolNode = new ToolNode([toolWithError], {
      handleToolErrors: (_, toolCall) => {
        return new ToolMessage({
          content: "handled error",
          tool_call_id: toolCall.id!,
        });
      },
    });
    const result = await toolNode.invoke({
      messages: [
        new AIMessage({
          content: "",
          tool_calls: [{ name: "tool_with_error", args: {}, id: "testid" }],
        }),
      ],
    });
    expect(result.messages[0].content).toBe("handled error");
  });

  it("should use default error handling, only catch ToolInvocationError", async () => {
    const strictTool = tool(
      ({ value }: { value: number }) => {
        /**
         * Tool that will cause a ToolInvocationError
         */
        throw new Error(`ups ${value}`);
      },
      {
        name: "strict_tool",
        description: "A tool with strict validation",
        schema: z.object({
          value: z.number(),
        }),
      }
    );

    const model = new FakeToolCallingModel({
      toolCalls: [[{ name: "strict_tool", args: { value: 123 }, id: "1" }]],
    });

    const agent = createAgent({
      model,
      tools: [strictTool],
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("Call strict tool with invalid args")],
    });

    // Tool error should be caught and converted to ToolMessage
    const toolMessage = result.messages[2] as ToolMessage;
    expect(toolMessage.content).toContain("ups 123");
    expect(toolMessage.content).toContain("Please fix your mistakes");
  });

  /**
   * fails in dep test as it is relying on `@langchain/core` changes
   */
  if (!process.env.LC_DEPENDENCY_RANGE_TESTS) {
    it("should use send error tool message if model creates wrong args", async () => {
      const strictTool = tool(
        ({ value }: { value: number }) => `Result: ${value}`,
        {
          name: "strict_tool",
          description: "A tool with strict validation",
          schema: z.object({
            value: z.number(),
          }),
        }
      );

      const model = new FakeToolCallingModel({
        toolCalls: [
          // Invalid args - will cause ToolInvocationError
          [{ name: "strict_tool", args: { value: "123" }, id: "1" }],
        ],
      });

      const agent = createAgent({
        model,
        tools: [strictTool],
        // No middleware - testing default ToolNode behavior
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Call strict tool with invalid args")],
      });

      // Tool error should be caught and converted to ToolMessage
      const toolMessage = result.messages[2] as ToolMessage;
      expect(toolMessage.content).toContain("Expected number, received string");

      expect(toolMessage.content).toContain(
        `invoking tool 'strict_tool' with kwargs {"value":"123"}`
      );
    });
  }

  it("should handle missing tool name with default error handler", async () => {
    const getWeatherTool = tool(
      ({ location }) => `Weather in ${location}: sunny`,
      {
        name: "get_weather",
        description: "Get weather for a location",
        schema: z.object({
          location: z.string(),
        }),
      }
    );

    const toolNode = new ToolNode([getWeatherTool]);

    const messageWithInvalidTool = new AIMessage({
      content: "",
      tool_calls: [
        {
          name: "nonexistent_tool",
          args: { foo: "bar" },
          id: "call_123",
          type: "tool_call",
        },
      ],
    });

    const result = await toolNode.invoke({
      messages: [messageWithInvalidTool],
    });

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toBeInstanceOf(ToolMessage);

    const toolMessage = result.messages[0] as ToolMessage;
    expect(toolMessage.content).toContain(
      "nonexistent_tool is not a valid tool"
    );
    expect(toolMessage.content).toContain("get_weather");
    expect(toolMessage.tool_call_id).toBe("call_123");
    expect(toolMessage.name).toBe("nonexistent_tool");
    expect(toolMessage.status).toBe("error");
  });

  it("should return graceful error for missing tool even when handleToolErrors is false", async () => {
    /**
     * Missing tools always return a graceful error message (not thrown) to allow
     * the LLM to see the error and potentially retry with a valid tool name.
     * The handleToolErrors option only affects errors during tool execution.
     */
    const getWeatherTool = tool(
      ({ location }) => `Weather in ${location}: sunny`,
      {
        name: "get_weather",
        description: "Get weather for a location",
        schema: z.object({
          location: z.string(),
        }),
      }
    );

    const toolNode = new ToolNode([getWeatherTool], {
      handleToolErrors: false,
    });

    const messageWithInvalidTool = new AIMessage({
      content: "",
      tool_calls: [
        {
          name: "nonexistent_tool",
          args: { foo: "bar" },
          id: "call_789",
          type: "tool_call",
        },
      ],
    });

    // Missing tools return a graceful error message instead of throwing
    const result = await toolNode.invoke({
      messages: [messageWithInvalidTool],
    });

    expect(result.messages).toHaveLength(1);
    const toolMessage = result.messages[0] as ToolMessage;
    expect(toolMessage.content).toContain(
      "nonexistent_tool is not a valid tool"
    );
    expect(toolMessage.status).toBe("error");
  });

  it("should return graceful error for missing tool regardless of custom error handler", async () => {
    /**
     * Missing tools are handled before the custom error handler is invoked.
     * Custom error handlers are for tool execution errors, not missing tools.
     */
    const getWeatherTool = tool(
      ({ location }) => `Weather in ${location}: sunny`,
      {
        name: "get_weather",
        description: "Get weather for a location",
        schema: z.object({
          location: z.string(),
        }),
      }
    );

    const customErrorHandler = (error: unknown, toolCall: ToolCall) => {
      return new ToolMessage({
        content: `Custom error: ${error}`,
        tool_call_id: toolCall.id!,
        name: toolCall.name,
      });
    };

    const toolNode = new ToolNode([getWeatherTool], {
      handleToolErrors: customErrorHandler,
    });

    const messageWithInvalidTool = new AIMessage({
      content: "",
      tool_calls: [
        {
          name: "missing_tool",
          args: { x: "y" },
          id: "call_custom",
          type: "tool_call",
        },
      ],
    });

    const result = await toolNode.invoke({
      messages: [messageWithInvalidTool],
    });

    // Missing tools get a standard error message, not passed to custom handler
    expect(result.messages).toHaveLength(1);
    const toolMessage = result.messages[0] as ToolMessage;
    expect(toolMessage.content).toContain("missing_tool is not a valid tool");
    expect(toolMessage.content).toContain("get_weather");
    expect(toolMessage.tool_call_id).toBe("call_custom");
    expect(toolMessage.status).toBe("error");
  });
});
