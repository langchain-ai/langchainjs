import { describe, expect, it } from "vitest";
import { StructuredTool, tool } from "@langchain/core/tools";

import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  RemoveMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { z } from "zod/v3";
import {
  Runnable,
  RunnableLambda,
  RunnableSequence,
} from "@langchain/core/runnables";
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
import { _shouldBindTools, _bindTools, _getModel } from "../index.js";
import {
  _AnyIdAIMessage,
  _AnyIdHumanMessage,
  _AnyIdToolMessage,
  FakeConfigurableModel,
  FakeToolCallingChatModel,
  MemorySaverAssertImmutable,
} from "./utils.js";

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
  it("Should support graceful error handling", async () => {
    const toolNode = new ToolNode([new SearchAPI()]);
    const res = await toolNode.invoke([
      new AIMessage({
        content: "",
        tool_calls: [{ name: "badtool", args: {}, id: "testid" }],
      }),
    ]);
    expect(res[0].content).toEqual(
      `Error: Tool "badtool" not found.\n Please fix your mistakes.`
    );
  });

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
      const lastMessage: AIMessage = messages[messages.length - 1];

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

describe("_shouldBindTools", () => {
  it.each(["openai", "anthropic", "google", "bedrock"] as const)(
    "Should determine when to bind tools - %s style",
    async (toolStyle) => {
      const tool1 = tool((input) => `Tool 1: ${input.someVal}`, {
        name: "tool1",
        description: "Tool 1 docstring.",
        schema: z.object({
          someVal: z.number().describe("Input value"),
        }),
      });

      const tool2 = tool((input) => `Tool 2: ${input.someVal}`, {
        name: "tool2",
        description: "Tool 2 docstring.",
        schema: z.object({
          someVal: z.number().describe("Input value"),
        }),
      });

      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("test")],
        toolStyle,
      });

      // Should bind when a regular model
      expect(await _shouldBindTools(model, [])).toBe(true);
      expect(await _shouldBindTools(model, [tool1])).toBe(true);

      // Should bind when a seq
      const seq = RunnableSequence.from([
        model,
        RunnableLambda.from((message) => message),
      ]);
      expect(await _shouldBindTools(seq, [])).toBe(true);
      expect(await _shouldBindTools(seq, [tool1])).toBe(true);

      // Should not bind when a model with tools
      const modelWithTools = model.bindTools([tool1]);
      expect(await _shouldBindTools(modelWithTools, [tool1])).toBe(false);

      // Should not bind when a seq with tools
      const seqWithTools = RunnableSequence.from([
        model.bindTools([tool1]),
        RunnableLambda.from((message) => message),
      ]);
      expect(await _shouldBindTools(seqWithTools, [tool1])).toBe(false);

      // Should raise on invalid inputs
      await expect(
        async () => await _shouldBindTools(model.bindTools([tool1]), [])
      ).rejects.toThrow();
      await expect(
        async () => await _shouldBindTools(model.bindTools([tool1]), [tool2])
      ).rejects.toThrow();
      await expect(
        async () =>
          await _shouldBindTools(model.bindTools([tool1]), [tool1, tool2])
      ).rejects.toThrow();

      // test configurable model
      const configurableModel = new FakeConfigurableModel({
        model,
      });

      // Should bind when a regular model
      expect(await _shouldBindTools(configurableModel, [])).toBe(true);
      expect(await _shouldBindTools(configurableModel, [tool1])).toBe(true);

      // Should bind when a seq
      const configurableSeq = RunnableSequence.from([
        configurableModel,
        RunnableLambda.from((message) => message),
      ]);
      expect(await _shouldBindTools(configurableSeq, [])).toBe(true);
      expect(await _shouldBindTools(configurableSeq, [tool1])).toBe(true);

      // Should not bind when a model with tools
      const configurableModelWithTools = configurableModel.bindTools([tool1]);
      expect(await _shouldBindTools(configurableModelWithTools, [tool1])).toBe(
        false
      );

      // Should not bind when a seq with tools
      const configurableSeqWithTools = RunnableSequence.from([
        configurableModel.bindTools([tool1]),
        RunnableLambda.from((message) => message),
      ]);
      expect(await _shouldBindTools(configurableSeqWithTools, [tool1])).toBe(
        false
      );

      // Should raise on invalid inputs
      await expect(
        async () =>
          await _shouldBindTools(configurableModel.bindTools([tool1]), [])
      ).rejects.toThrow();
      await expect(
        async () =>
          await _shouldBindTools(configurableModel.bindTools([tool1]), [tool2])
      ).rejects.toThrow();
      await expect(
        async () =>
          await _shouldBindTools(configurableModel.bindTools([tool1]), [
            tool1,
            tool2,
          ])
      ).rejects.toThrow();
    }
  );

  it("should bind model with bindTools", async () => {
    const tool1 = tool((input) => `Tool 1: ${input.someVal}`, {
      name: "tool1",
      description: "Tool 1 docstring.",
      schema: z.object({
        someVal: z.number().describe("Input value"),
      }),
    });

    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("test")],
      toolStyle: "openai",
    });

    const confModel = new FakeConfigurableModel({ model });

    async function serialize(runnable: Runnable | Promise<Runnable>) {
      return JSON.parse(JSON.stringify(await runnable));
    }

    // Should bind when a regular model
    expect(
      await serialize((await _bindTools(model, [tool1])) as Runnable)
    ).toEqual(await serialize(model.bindTools([tool1])));

    // Should bind when model wrapped in `withConfig`
    expect(
      await serialize(
        (await _bindTools(model.withConfig({ tags: ["nostream"] }), [
          tool1,
        ])) as Runnable
      )
    ).toEqual(
      await serialize(
        model.bindTools([tool1]).withConfig({ tags: ["nostream"] })
      )
    );

    // Should bind when model wrapped in multiple `withConfig`
    expect(
      await serialize(
        (await _bindTools(
          model
            .withConfig({ tags: ["nostream"] })
            .withConfig({ metadata: { hello: "world" } }),
          [tool1]
        )) as Runnable
      )
    ).toEqual(
      await serialize(
        model
          .bindTools([tool1])
          .withConfig({ tags: ["nostream"], metadata: { hello: "world" } })
      )
    );

    // Should bind when a configurable model
    expect(
      await serialize((await _bindTools(confModel, [tool1])) as Runnable)
    ).toEqual(await serialize(confModel.bindTools([tool1])));

    // Should bind when a seq
    expect(
      await serialize(
        (await _bindTools(
          RunnableSequence.from([
            model,
            RunnableLambda.from((message) => message),
          ]),
          [tool1]
        )) as Runnable
      )
    ).toEqual(
      await serialize(
        RunnableSequence.from([
          model.bindTools([tool1]),
          RunnableLambda.from((message) => message),
        ])
      )
    );

    // Should bind when a seq with configurable model
    expect(
      await serialize(
        (await _bindTools(
          RunnableSequence.from([
            confModel,
            RunnableLambda.from((message) => message),
          ]),
          [tool1]
        )) as Runnable
      )
    ).toEqual(
      await serialize(
        RunnableSequence.from([
          confModel.bindTools([tool1]),
          RunnableLambda.from((message) => message),
        ])
      )
    );

    // Should bind when a seq with config model
    expect(
      await serialize(
        (await _bindTools(
          RunnableSequence.from([
            confModel.withConfig({ tags: ["nostream"] }),
            RunnableLambda.from((message) => message),
          ]),
          [tool1]
        )) as Runnable
      )
    ).toEqual(
      await serialize(
        RunnableSequence.from([
          confModel.bindTools([tool1]).withConfig({
            tags: ["nostream"],
          }),
          RunnableLambda.from((message) => message),
        ])
      )
    );
  });

  it("should handle bindTool with server tools", async () => {
    const tool1 = tool((input) => `Tool 1: ${input.someVal}`, {
      name: "tool1",
      description: "Tool 1 docstring.",
      schema: z.object({ someVal: z.number().describe("Input value") }),
    });

    const server = { type: "web_search_preview" };

    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("test")],
    });

    expect(await _shouldBindTools(model, [tool1, server])).toBe(true);
    expect(
      await _shouldBindTools(model.bindTools([tool1, server]), [tool1, server])
    ).toBe(false);

    await expect(
      _shouldBindTools(model.bindTools([tool1]), [tool1, server])
    ).rejects.toThrow();

    await expect(
      _shouldBindTools(model.bindTools([server]), [tool1, server])
    ).rejects.toThrow();
  });
});

describe("_getModel", () => {
  it("Should extract the model from different inputs", async () => {
    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("test")],
    });
    expect(await _getModel(model)).toBe(model);

    const tool1 = tool((input) => `Tool 1: ${input.someVal}`, {
      name: "tool1",
      description: "Tool 1 docstring.",
      schema: z.object({
        someVal: z.number().describe("Input value"),
      }),
    });

    const modelWithTools = model.bindTools([tool1]);
    expect(await _getModel(modelWithTools)).toBe(model);

    const seq = RunnableSequence.from([
      model,
      RunnableLambda.from((message) => message),
    ]);
    expect(await _getModel(seq)).toBe(model);

    const seqWithTools = RunnableSequence.from([
      model.bindTools([tool1]),
      RunnableLambda.from((message) => message),
    ]);
    expect(await _getModel(seqWithTools)).toBe(model);

    const raisingSeq = RunnableSequence.from([
      RunnableLambda.from((message) => message),
      RunnableLambda.from((message) => message),
    ]);
    await expect(async () => await _getModel(raisingSeq)).rejects.toThrow(
      Error
    );

    // test configurable model
    const configurableModel = new FakeConfigurableModel({
      model,
    });

    expect(await _getModel(configurableModel)).toBe(model);
    expect(await _getModel(configurableModel.bindTools([tool1]))).toBe(model);

    const configurableSeq = RunnableSequence.from([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      configurableModel as any,
      RunnableLambda.from((message) => message),
    ]);
    expect(await _getModel(configurableSeq)).toBe(model);

    const configurableSeqWithTools = RunnableSequence.from([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      configurableModel.bindTools([tool1]) as any,
      RunnableLambda.from((message) => message),
    ]);
    expect(await _getModel(configurableSeqWithTools)).toBe(model);

    const raisingConfigurableSeq = RunnableSequence.from([
      RunnableLambda.from((message) => message),
      RunnableLambda.from((message) => message),
    ]);
    await expect(
      async () => await _getModel(raisingConfigurableSeq)
    ).rejects.toThrow(Error);
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
          new ToolMessage({
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
        new ToolMessage({
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

describe("ToolNode should raise GraphInterrupt", () => {
  it("should raise GraphInterrupt", async () => {
    const toolWithInterrupt = tool(
      async (_) => {
        throw new GraphInterrupt();
      },
      {
        name: "tool_with_interrupt",
        description: "A tool that returns an interrupt",
        schema: z.object({}),
      }
    );
    const toolNode = new ToolNode([toolWithInterrupt]);
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
});
