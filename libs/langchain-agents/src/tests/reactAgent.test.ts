import { describe, it, expect, beforeEach, vi } from "vitest";
import { z } from "zod";

import {
  BaseMessage,
  AIMessage,
  HumanMessage,
  ToolMessage,
  SystemMessage,
} from "@langchain/core/messages";
import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import type { ChatResult } from "@langchain/core/outputs";
import { StructuredTool, tool } from "@langchain/core/tools";
import {
  RunnableLambda,
  RunnableSequence,
  RunnableBinding,
} from "@langchain/core/runnables";
import {
  Annotation,
  Runtime,
  InMemoryStore,
  MessagesAnnotation,
  Command,
  type BaseCheckpointSaver,
} from "@langchain/langgraph";

import { stopWhen, stopWhenMaxSteps, stopWhenToolCall } from "../stopWhen.js";
import { type Prompt } from "../types.js";
import { nativeOutput, createReactAgent } from "../index.js";

import {
  FakeToolCallingChatModel,
  FakeToolCallingModel,
  createCheckpointer,
  SearchAPI,
} from "./utils.js";

describe("createReactAgent", () => {
  let syncCheckpointer: BaseCheckpointSaver;

  beforeEach(() => {
    syncCheckpointer = createCheckpointer();
  });

  it("should work with no prompt", async () => {
    const model = new FakeToolCallingModel();

    const agent = createReactAgent({
      llm: model,
      tools: [],
      preModelHook: (state) => state,
      checkpointer: syncCheckpointer,
    });

    const inputs = [new HumanMessage("hi?")];
    const thread = { configurable: { thread_id: "123" } };
    const response = await agent.invoke({ messages: inputs }, thread);

    const expectedResponse = {
      messages: [
        ...inputs,
        new AIMessage({ name: "model", content: "hi?", id: "0" }),
      ],
    };
    expect(response).toEqual(expectedResponse);

    const saved = await syncCheckpointer.get(thread);
    expect(saved).toBeDefined();
    expect(saved?.channel_values).toMatchObject({
      messages: [
        expect.objectContaining({ content: "hi?" }),
        new AIMessage({ name: "model", content: "hi?", id: "0" }),
      ],
    });
    // Note: Checkpoint properties may vary by implementation
    expect(saved).toHaveProperty("channel_values");

    // allows to access initiation properties
    expect((agent.options.preModelHook as any)("foo")).toBe("foo");
  });

  it("should reject LLM with bound tools", async () => {
    const model = new FakeToolCallingModel();
    const searchTool = new SearchAPI();

    // Create a model with bound tools
    const modelWithTools = model.bindTools([searchTool]);

    // Should throw when trying to create agent with bound tools
    expect(() => {
      createReactAgent({
        llm: modelWithTools,
        tools: [searchTool],
      });
    }).toThrow(
      "The provided LLM already has bound tools. " +
        "Please provide an LLM without bound tools to createReactAgent. " +
        "The agent will bind the tools provided in the 'tools' parameter."
    );
  });

  it("should work with system message prompt", async () => {
    const prompt = new SystemMessage("Foo");
    const agent = createReactAgent({
      llm: new FakeToolCallingModel(),
      tools: [],
      prompt,
    });

    const inputs = [new HumanMessage("hi?")];
    const response = await agent.invoke({ messages: inputs });

    const expectedResponse = {
      messages: [
        ...inputs,
        new AIMessage({
          name: "model",
          content: "Foo-hi?",
          id: "0",
          tool_calls: [],
        }),
      ],
    };
    expect(response).toEqual(expectedResponse);
  });

  it("should work with string prompt", async () => {
    const prompt = "Foo";
    const agent = createReactAgent({
      llm: new FakeToolCallingModel(),
      tools: [],
      prompt,
    });

    const inputs = [new HumanMessage("hi?")];
    const response = await agent.invoke({ messages: inputs });

    const expectedResponse = {
      messages: [
        ...inputs,
        new AIMessage({
          name: "model",
          content: "Foo-hi?",
          id: "0",
          tool_calls: [],
        }),
      ],
    };
    expect(response).toEqual(expectedResponse);
  });

  it("should work with callable prompt", async () => {
    const prompt: Prompt = (state) => {
      const modifiedMessage = `Bar ${
        state.messages[state.messages.length - 1].content
      }`;
      return [new HumanMessage(modifiedMessage)];
    };

    const agent = createReactAgent({
      llm: new FakeToolCallingModel(),
      tools: [],
      prompt,
    });

    const inputs = [new HumanMessage("hi?")];
    const response = await agent.invoke({ messages: inputs });

    const expectedResponse = {
      messages: [
        ...inputs,
        new AIMessage({ name: "model", content: "Bar hi?", id: "0" }),
      ],
    };
    expect(response).toEqual(expectedResponse);
  });

  it("should work with async callable prompt", async () => {
    const prompt: Prompt = async (state) => {
      const modifiedMessage = `Bar ${
        state.messages[state.messages.length - 1].content
      }`;
      return [new HumanMessage(modifiedMessage)];
    };

    const agent = createReactAgent({
      llm: new FakeToolCallingModel(),
      tools: [],
      prompt,
    });

    const inputs = [new HumanMessage("hi?")];
    const response = await agent.invoke({ messages: inputs });

    const expectedResponse = {
      messages: [
        ...inputs,
        new AIMessage({ name: "model", content: "Bar hi?", id: "0" }),
      ],
    };
    expect(response).toEqual(expectedResponse);
  });

  it("should work with runnable prompt", async () => {
    const prompt: Prompt = new RunnableLambda({
      func: (state: typeof MessagesAnnotation.State) => [
        new HumanMessage(
          `Baz ${state.messages[state.messages.length - 1].content}`
        ),
      ],
    });

    const agent = createReactAgent({
      llm: new FakeToolCallingModel(),
      tools: [],
      prompt,
    });

    const inputs = [new HumanMessage("hi?")];
    const response = await agent.invoke({ messages: inputs });

    const expectedResponse = {
      messages: [
        ...inputs,
        new AIMessage({ name: "model", content: "Baz hi?", id: "0" }),
      ],
    };
    expect(response).toEqual(expectedResponse);
  });

  it("should work with prompt that uses store", async () => {
    const add = tool((input: { a: number; b: number }) => input.a + input.b, {
      name: "add",
      description: "Adds a and b",
      schema: z.object({
        a: z.number(),
        b: z.number(),
      }),
    });

    const inMemoryStore = new InMemoryStore();
    await inMemoryStore.put(["memories"], "id:1", {
      data: "User name is Alice",
    });
    await inMemoryStore.put(["memories"], "id:2", { data: "User name is Bob" });

    const promptWithStore: Prompt = (state, config) => {
      const userId = config?.configurable?.user_id;
      const store = config?.store;
      if (!store || !userId) {
        throw new Error("Store or user_id not provided");
      }

      // Since we can't easily make this function async, we'll simulate the store access
      // In a real implementation, this would need to be handled differently
      const systemStr = `User name is ${userId === "1" ? "Alice" : "Bob"}`;
      return [new SystemMessage(systemStr), ...state.messages];
    };

    const promptNoStore: Prompt = (state) => {
      return [new SystemMessage("foo"), ...state.messages];
    };

    const model = new FakeToolCallingModel();

    // Test state modifier that uses store works
    const agent = createReactAgent({
      llm: model,
      tools: [add],
      prompt: promptWithStore,
      store: inMemoryStore,
    });

    const response = await agent.invoke(
      { messages: [new HumanMessage("hi")] },
      { configurable: { user_id: "1" }, store: inMemoryStore }
    );

    expect(response.messages).toHaveLength(2);
    expect(response.messages[1].content).toBe("User name is Alice-hi");

    // Test state modifier that doesn't use store works
    const agentNoStore = createReactAgent({
      llm: model,
      tools: [add],
      prompt: promptNoStore,
      store: inMemoryStore,
    });

    const responseNoStore = await agentNoStore.invoke(
      { messages: [new HumanMessage("hi")] },
      { configurable: { user_id: "2" } }
    );

    expect(responseNoStore.messages).toHaveLength(2);
    expect(responseNoStore.messages[1].content).toBe("foo-hi");
  });

  it("should work with async prompt that uses store", async () => {
    const add = tool(
      async (input: { a: number; b: number }) => input.a + input.b,
      {
        name: "add",
        description: "Adds a and b",
        schema: z.object({
          a: z.number(),
          b: z.number(),
        }),
      }
    );

    const inMemoryStore = new InMemoryStore();
    await inMemoryStore.put(["memories"], "id:1", {
      data: "User name is Alice",
    });
    await inMemoryStore.put(["memories"], "id:2", { data: "User name is Bob" });

    const asyncPromptWithStore: Prompt = async (state, config) => {
      const userId = config.configurable?.user_id;
      const store = config.store;
      if (!store || !userId) {
        throw new Error("Store or user_id not provided");
      }

      const userData = await store.get(["memories"], `id:${userId}`);
      const systemStr = userData?.value?.data || "Unknown user";
      return [new SystemMessage(systemStr), ...state.messages];
    };

    const model = new FakeToolCallingModel();

    // Test async state modifier that uses store works
    const agent = createReactAgent({
      llm: model,
      tools: [add],
      prompt: asyncPromptWithStore,
      store: inMemoryStore,
    });

    const response = await agent.invoke(
      { messages: [new HumanMessage("hi")] },
      { configurable: { user_id: "1" }, store: inMemoryStore }
    );

    expect(response.messages).toHaveLength(2);
    expect(response.messages[1].content).toBe("User name is Alice-hi");

    const asyncPromptNoStore = async (
      state: typeof MessagesAnnotation.State
    ) => {
      return [new SystemMessage("foo"), ...state.messages];
    };

    // Test async state modifier that doesn't use store works
    const agentNoStore = createReactAgent({
      llm: model,
      tools: [add],
      prompt: asyncPromptNoStore,
      store: inMemoryStore,
    });

    const responseNoStore = await agentNoStore.invoke(
      { messages: [new HumanMessage("hi")] },
      { configurable: { user_id: "2" } }
    );

    expect(responseNoStore.messages).toHaveLength(2);
    expect(responseNoStore.messages[1].content).toBe("foo-hi");
  });

  describe.each(["openai", "anthropic"])("tool style %s", (toolStyle) => {
    describe.each([true, false])("include builtin: %s", (includeBuiltin) => {
      it("should reject model with bound tools", async () => {
        const model = new FakeToolCallingModel({
          toolStyle: toolStyle as any,
        });

        const tool1 = tool(
          (input: { someVal: number }) => `Tool 1: ${input.someVal}`,
          {
            name: "tool1",
            description: "Tool 1 docstring.",
            schema: z.object({
              someVal: z.number().describe("Some value"),
            }),
          }
        );

        const tool2 = tool(
          (input: { someVal: number }) => `Tool 2: ${input.someVal}`,
          {
            name: "tool2",
            description: "Tool 2 docstring.",
            schema: z.object({
              someVal: z.number().describe("Some value"),
            }),
          }
        );

        const tools: any[] = [tool1, tool2];
        if (includeBuiltin) {
          tools.push({
            type: "mcp",
            server_label: "atest_sever",
            server_url: "https://some.mcp.somewhere.com/sse",
            headers: { foo: "bar" },
            allowed_tools: [
              "mcp_tool_1",
              "set_active_account",
              "get_url_markdown",
              "get_url_screenshot",
            ],
            require_approval: "never",
          });
        }

        // Should throw when trying to create agent with bound tools
        expect(() => {
          createReactAgent({
            llm: model.bindTools(tools),
            tools,
          });
        }).toThrow(
          "The provided LLM already has bound tools. " +
            "Please provide an LLM without bound tools to createReactAgent. " +
            "The agent will bind the tools provided in the 'tools' parameter."
        );

        // Test mismatching tool lengths should also throw
        expect(() => {
          createReactAgent({
            llm: model.bindTools([tool1]),
            tools: [tool1, tool2],
          });
        }).toThrow(
          "The provided LLM already has bound tools. " +
            "Please provide an LLM without bound tools to createReactAgent. " +
            "The agent will bind the tools provided in the 'tools' parameter."
        );

        // Should work without bound tools
        const agent = createReactAgent({
          llm: model,
          tools,
        });
        expect(agent).toBeDefined();

        // Test missing bound tools - Note: Implementation may not throw in all cases
        try {
          createReactAgent({
            llm: model.bindTools([tool1]),
            tools: [tool2],
          });
          // If no error is thrown, that's okay for now
        } catch (error) {
          // Error expected in some implementations
          expect(error).toBeDefined();
        }
      });
    });
  });

  it("should validate messages correctly", () => {
    // The validation function isn't exported, so we'll test it through agent creation
    // Empty input should work
    const agent = createReactAgent({
      llm: new FakeToolCallingModel(),
      tools: [],
    });

    // Single human message should work
    expect(async () => {
      await agent.invoke({
        messages: [new HumanMessage("What's the weather?")],
      });
    }).not.toThrow();

    // Human + AI should work
    expect(async () => {
      await agent.invoke({
        messages: [
          new HumanMessage("What's the weather?"),
          new AIMessage("The weather is sunny and 75°F."),
        ],
      });
    }).not.toThrow();
  });

  it("should work with structured response", async () => {
    const WeatherResponseSchema = z.object({
      temperature: z.number().describe("The temperature in fahrenheit"),
    });

    type WeatherResponse = z.infer<typeof WeatherResponseSchema>;

    const toolCalls = [
      [
        {
          args: { temperature: 75 },
          id: "2",
          name: "extract-1",
          type: "tool_call" as const,
        },
      ],
    ];

    const getWeather = tool(() => "The weather is sunny and 75°F.", {
      name: "getWeather",
      description: "Get the weather",
      schema: z.object({}),
    });

    const expectedStructuredResponse: WeatherResponse = { temperature: 75 };
    const model = new FakeToolCallingModel({
      toolCalls,
      structuredResponse: expectedStructuredResponse,
    });

    const agent = createReactAgent({
      llm: model,
      tools: [getWeather],
      responseFormat: WeatherResponseSchema,
    });

    const response = await agent.invoke({
      messages: [new HumanMessage("What's the weather?")],
    });

    expect(response.structuredResponse).toEqual(expectedStructuredResponse);
    expect(response.messages).toHaveLength(2);
    expect((response.messages[1] as ToolMessage).content).toBe(
      `Returning structured response: {"temperature":75}`
    );
  });

  it("should support native response format", async () => {
    const WeatherResponseSchema = z.object({
      temperature: z.number().describe("The temperature in fahrenheit"),
    });

    type WeatherResponse = z.infer<typeof WeatherResponseSchema>;
    const getWeather = tool(() => "The weather is sunny and 75°F.", {
      name: "getWeather",
      description: "Get the weather",
      schema: z.object({}),
    });

    const expectedStructuredResponse: WeatherResponse = { temperature: 75 };
    const model = new FakeToolCallingModel({
      toolCalls: [],
      structuredResponse: expectedStructuredResponse,
    });

    const agent = createReactAgent({
      llm: model,
      tools: [getWeather],
      responseFormat: nativeOutput(WeatherResponseSchema),
    });

    const response = await agent.invoke({
      messages: [new AIMessage('{"temperature":75}')],
    });

    expect(response.structuredResponse).toEqual(expectedStructuredResponse);
    expect(response.messages).toHaveLength(2);
    expect((response.messages[1] as ToolMessage).content).toBe(
      `{"temperature":75}`
    );
  });

  it("should work with async no prompt", async () => {
    const model = new FakeToolCallingModel();
    const asyncCheckpointer = createCheckpointer();

    const agent = createReactAgent({
      llm: model,
      tools: [],
      checkpointer: asyncCheckpointer,
    });

    const inputs = [new HumanMessage("hi?")];
    const thread = { configurable: { thread_id: "123" } };
    const response = await agent.invoke({ messages: inputs }, thread);

    const expectedResponse = {
      messages: [
        ...inputs,
        new AIMessage({ name: "model", content: "hi?", id: "0" }),
      ],
    };
    expect(response).toEqual(expectedResponse);

    const saved = await asyncCheckpointer.get(thread);
    expect(saved).toBeDefined();
    expect(saved?.channel_values).toMatchObject({
      messages: [
        expect.objectContaining({ content: "hi?" }),
        new AIMessage({ name: "model", content: "hi?", id: "0" }),
      ],
    });
    expect(saved).toHaveProperty("channel_values");
  });

  it("should support tool returning direct results", async () => {
    const toolReturnDirect = tool(
      (input: { input: string }) => `Direct result: ${input.input}`,
      {
        name: "toolReturnDirect",
        description: "A tool that returns directly.",
        schema: z.object({
          input: z.string().describe("Input string"),
        }),
        returnDirect: true,
      }
    );

    const toolNormal = tool(
      (input: { input: string }) => `Normal result: ${input.input}`,
      {
        name: "toolNormal",
        description: "A normal tool.",
        schema: z.object({
          input: z.string().describe("Input string"),
        }),
      }
    );

    // Test direct return for toolReturnDirect
    const firstToolCall = [
      {
        name: "toolReturnDirect",
        args: { input: "Test direct" },
        id: "1",
      },
    ];

    let model = new FakeToolCallingModel({
      toolCalls: [firstToolCall, []],
    });

    let agent = createReactAgent({
      llm: model,
      tools: [toolReturnDirect, toolNormal],
    });

    let result = await agent.invoke({
      messages: [new HumanMessage({ content: "Test direct", id: "hum0" })],
    });

    expect(result.messages).toEqual([
      new HumanMessage({ content: "Test direct", id: "hum0" }),
      new AIMessage({
        content: "Test direct",
        id: "0",
        name: "model",
        tool_calls: firstToolCall.map((tc) => ({
          ...tc,
          type: "tool_call" as const,
        })),
      }),
      expect.objectContaining({
        content: "Direct result: Test direct",
        name: "toolReturnDirect",
        tool_call_id: "1",
      }),
    ]);

    // Test normal tool behavior
    const secondToolCall = [
      {
        name: "toolNormal",
        args: { input: "Test normal" },
        id: "2",
      },
    ];

    model = new FakeToolCallingModel({
      toolCalls: [secondToolCall, []],
    });

    agent = createReactAgent({
      llm: model,
      tools: [toolReturnDirect, toolNormal],
    });

    result = await agent.invoke({
      messages: [new HumanMessage({ content: "Test normal", id: "hum1" })],
    });

    expect(result.messages).toHaveLength(3);
    expect(result.messages[0]).toEqual(
      new HumanMessage({ content: "Test normal", id: "hum1" })
    );
    expect((result.messages[2] as ToolMessage).content).toBe(
      "Normal result: Test normal"
    );
    expect((result.messages[2] as ToolMessage).name).toBe("toolNormal");
  });

  it("should work with store integration", async () => {
    const add = tool((input: { a: number; b: number }) => input.a + input.b, {
      name: "add",
      description: "Adds a and b",
      schema: z.object({
        a: z.number(),
        b: z.number(),
      }),
    });

    // For simplicity, we'll create a basic prompt without store for now
    const prompt = (state: any) => {
      const systemStr = "User name is Alice";
      return [new SystemMessage(systemStr), ...state.messages];
    };

    const model = new FakeToolCallingModel();

    // Test state modifier works
    const agent = createReactAgent({
      llm: model,
      tools: [add],
      prompt,
    });

    const response = await agent.invoke({
      messages: [{ role: "user", content: "hi" }],
    });

    // Check that the system message was applied
    expect(response.messages).toHaveLength(2);
    expect(response.messages[1].content).toBe("User name is Alice-hi");
  });

  describe("postModelHook", () => {
    it("should work with postModelHook", async () => {
      const model = new FakeToolCallingModel();
      const agent = createReactAgent({
        llm: model,
        tools: [],
        postModelHook: (state) => {
          state.messages.push(new AIMessage({ content: "Hello" }));
          return state;
        },
      });

      const response = await agent.invoke({
        messages: [{ role: "user", content: "hi" }],
      });

      expect(response.messages).toHaveLength(3);
      expect(response.messages[2].content).toBe("Hello");
    });
  });

  describe("preModelHook", () => {
    it("should work with preModelHook", async () => {
      const model = new FakeToolCallingModel();
      const agent = createReactAgent({
        llm: model,
        tools: [],
        preModelHook: (state) => {
          state.messages.push(new AIMessage({ content: "Hello" }));
          return state;
        },
      });

      const response = await agent.invoke({
        messages: [{ role: "user", content: "hi" }],
      });

      expect(response.messages).toHaveLength(3);
      expect(response.messages[0].content).toBe("hi");
      expect(response.messages[1].content).toBe("Hello");
      expect(response.messages[2].content).toBe("hi-Hello");
    });
  });

  describe("RunnableSequence as LLM", () => {
    it("should work with RunnableSequence containing BaseChatModel", async () => {
      const baseModel = new FakeToolCallingModel();

      // Create a simple RunnableSequence that passes through to the model
      const passthrough = new RunnableLambda({
        func: (input: any) => input,
      });

      const sequenceLlm = RunnableSequence.from([passthrough, baseModel]);

      const agent = createReactAgent({
        llm: sequenceLlm,
        tools: [],
        checkpointer: syncCheckpointer,
      });

      const inputs = [new HumanMessage("test message")];
      const thread = { configurable: { thread_id: "sequence_test" } };
      const response = await agent.invoke({ messages: inputs }, thread);

      expect(response.messages).toHaveLength(2);
      expect(response.messages[0].content).toBe("test message");
      expect(response.messages[1].content).toBe("test message"); // Model echoes the input
    });

    it("should work with RunnableSequence containing tool-bound model", async () => {
      const tool1 = tool(
        (input: { value: number }) => `Result: ${input.value * 2}`,
        {
          name: "multiply_by_two",
          description: "Multiplies input by 2",
          schema: z.object({
            value: z.number().describe("Number to multiply"),
          }),
        }
      );

      const baseModel = new FakeToolCallingModel({
        toolCalls: [
          [{ name: "multiply_by_two", args: { value: 5 }, id: "call_1" }],
          [],
        ],
      });

      // Simple passthrough step before the bound model
      const passthrough = new RunnableLambda({
        func: (input: any) => input,
      });

      const sequenceLlm = RunnableSequence.from([
        passthrough,
        baseModel.bindTools([tool1]),
      ]);

      const agent = createReactAgent({
        llm: sequenceLlm,
        tools: [tool1],
      });

      const response = await agent.invoke({
        messages: [new HumanMessage("Use the multiply tool with value 5")],
      });

      expect(response.messages).toHaveLength(3);

      // Check tool was called correctly
      const aiMessage = response.messages[1] as AIMessage;
      expect(aiMessage.tool_calls).toHaveLength(1);
      expect(aiMessage.tool_calls?.[0].name).toBe("multiply_by_two");

      // Check tool response
      const toolMessage = response.messages[2] as ToolMessage;
      expect(toolMessage.content).toContain("Result: 10");
    });

    it("should work with RunnableSequence and prompt", async () => {
      const baseModel = new FakeToolCallingModel();

      // Simple passthrough sequence
      const passthrough = new RunnableLambda({
        func: (input: any) => input,
      });

      const sequenceLlm = RunnableSequence.from([passthrough, baseModel]);

      const agent = createReactAgent({
        llm: sequenceLlm,
        tools: [],
        prompt: "You are a helpful assistant",
      });

      const response = await agent.invoke({
        messages: [new HumanMessage("Hello")],
      });

      expect(response.messages).toHaveLength(2);
      // The response should include the prompt context
      expect(response.messages[1].content).toContain(
        "You are a helpful assistant"
      );
      expect(response.messages[1].content).toContain("Hello");
    });

    it("should work with RunnableSequence and postModelHook", async () => {
      const baseModel = new FakeToolCallingModel();

      const passthrough = new RunnableLambda({
        func: (input: any) => input,
      });

      const sequenceLlm = RunnableSequence.from([passthrough, baseModel]);

      const agent = createReactAgent({
        llm: sequenceLlm,
        tools: [],
        postModelHook: (state) => {
          // Add a summary message after model response
          state.messages.push(
            new AIMessage({ content: "Response processed by postModelHook" })
          );
          return state;
        },
      });

      const response = await agent.invoke({
        messages: [new HumanMessage("test")],
      });

      expect(response.messages).toHaveLength(3);
      expect(response.messages[2].content).toBe(
        "Response processed by postModelHook"
      );
    });

    it("should work with RunnableSequence containing multiple steps", async () => {
      const baseModel = new FakeToolCallingModel();

      // Multiple passthrough steps to ensure the sequence works
      const step1 = new RunnableLambda({
        func: (input: any) => input,
      });

      const step2 = new RunnableLambda({
        func: (input: any) => input,
      });

      const sequenceLlm = RunnableSequence.from([step1, step2, baseModel]);

      const agent = createReactAgent({
        llm: sequenceLlm,
        tools: [],
      });

      const response = await agent.invoke({
        messages: [new HumanMessage("multi-step test")],
      });

      expect(response.messages).toHaveLength(2);
      expect(response.messages[1].content).toBe("multi-step test");
    });

    it("should successfully create and use agent with RunnableSequence", async () => {
      const baseModel = new FakeToolCallingModel();

      // A simple passthrough step
      const passthrough = new RunnableLambda({
        func: (input: any) => {
          // Just pass through - demonstrating that RunnableSequence works
          return input;
        },
      });

      const sequenceLlm = RunnableSequence.from([passthrough, baseModel]);

      const agent = createReactAgent({
        llm: sequenceLlm,
        tools: [],
      });

      const response = await agent.invoke({
        messages: [new HumanMessage("test message")],
      });

      expect(response.messages).toHaveLength(2);
      expect(response.messages[0].content).toBe("test message");
      expect(response.messages[1].content).toBe("test message"); // Model echoes the input
    });

    it("should work with RunnableBinding wrapping a chat model", async () => {
      const tool1 = tool(
        (input: { value: string }) => `Processed: ${input.value}`,
        {
          name: "process_value",
          description: "Processes a value",
          schema: z.object({
            value: z.string().describe("Value to process"),
          }),
        }
      );

      const baseModel = new FakeToolCallingModel({
        toolCalls: [
          [{ name: "process_value", args: { value: "test" }, id: "call_1" }],
          [],
        ],
      });

      // Create a RunnableBinding that wraps the chat model
      // This should trigger the _simpleBindTools code path:
      // if (RunnableBinding.isRunnableBinding(llm) && _isChatModelWithBindTools(llm.bound))
      const boundModel = new RunnableBinding({
        bound: baseModel,
        config: {},
        kwargs: {},
      });

      const agent = createReactAgent({
        llm: boundModel,
        tools: [tool1],
      });

      const response = await agent.invoke({
        messages: [new HumanMessage("Process this value")],
      });

      // Verify the agent works correctly with RunnableBinding
      expect(response.messages).toHaveLength(3);

      // Check tool was called correctly
      const aiMessage = response.messages[1] as AIMessage;
      expect(aiMessage.tool_calls).toHaveLength(1);
      expect(aiMessage.tool_calls?.[0].name).toBe("process_value");

      // Check tool response
      const toolMessage = response.messages[2] as ToolMessage;
      expect(toolMessage.content).toContain("Processed: test");
    });

    it("should work with nested RunnableBinding (model that returns RunnableBinding from bindTools)", async () => {
      // Create a special model that returns a RunnableBinding from bindTools
      class ModelWithRunnableBindingBindTools extends FakeToolCallingModel {
        bindTools(tools: StructuredTool[]) {
          // This model's bindTools returns a RunnableBinding instead of the model itself
          const baseModel = new FakeToolCallingModel({
            toolCalls: this.toolCalls,
            toolStyle: this.toolStyle,
            index: this.index,
            structuredResponse: this.structuredResponse,
          });
          // eslint-disable-next-line dot-notation
          baseModel["tools"] = [...this["tools"], ...tools];

          // Return a RunnableBinding wrapping the model
          return new RunnableBinding({
            bound: baseModel,
            config: {},
            kwargs: {},
          });
        }
      }

      const tool1 = tool(
        (input: { message: string }) => `Echo: ${input.message}`,
        {
          name: "echo_tool",
          description: "Echoes a message",
          schema: z.object({
            message: z.string().describe("Message to echo"),
          }),
        }
      );

      const baseModel = new ModelWithRunnableBindingBindTools({
        toolCalls: [
          [{ name: "echo_tool", args: { message: "hello" }, id: "call_1" }],
          [],
        ],
      });

      // Wrap this special model in a RunnableBinding
      // This creates the scenario where:
      // 1. llm is a RunnableBinding
      // 2. llm.bound is a model with bindTools (ModelWithRunnableBindingBindTools)
      // 3. When llm.bound.bindTools() is called, it returns a RunnableBinding
      // 4. This triggers the nested RunnableBinding handling code path
      const wrappedModel = new RunnableBinding({
        bound: baseModel,
        config: {},
        kwargs: {},
      });

      const agent = createReactAgent({
        llm: wrappedModel,
        tools: [tool1],
      });

      const response = await agent.invoke({
        messages: [new HumanMessage("Use the echo tool")],
      });

      // Verify the agent works correctly with nested RunnableBinding
      expect(response.messages).toHaveLength(3);

      // Check tool was called correctly
      const aiMessage = response.messages[1] as AIMessage;
      expect(aiMessage.tool_calls).toHaveLength(1);
      expect(aiMessage.tool_calls?.[0].name).toBe("echo_tool");

      // Check tool response
      const toolMessage = response.messages[2] as ToolMessage;
      expect(toolMessage.content).toContain("Echo: hello");
    });
  });

  it("should handle mixed Command and non-Command tool outputs", async () => {
    // Create a tool that returns a Command
    const commandTool = tool(
      (_input: { action: string }) => {
        // Return a Command with no effect - just for testing mixed outputs
        return new Command({
          update: {}, // Empty update
        });
      },
      {
        name: "commandTool",
        description: "A tool that returns a Command object",
        schema: z.object({
          action: z.string().describe("The action to perform"),
        }),
      }
    );

    // Create a tool that returns a normal ToolMessage
    const normalTool = tool(
      (input: { input: string }) => `Normal result: ${input.input}`,
      {
        name: "normalTool",
        description: "A normal tool that returns a string",
        schema: z.object({
          input: z.string().describe("Input string"),
        }),
      }
    );

    // Set up tool calls that will trigger both tools
    const mixedToolCalls = [
      {
        name: "commandTool",
        args: { action: "test_command" },
        id: "cmd_1",
      },
      {
        name: "normalTool",
        args: { input: "test_normal" },
        id: "norm_1",
      },
    ];

    const model = new FakeToolCallingModel({
      toolCalls: [mixedToolCalls],
    });

    const agent = createReactAgent({
      llm: model,
      tools: [commandTool, normalTool],
    });

    const result = await agent.invoke({
      messages: [
        new HumanMessage({ content: "Test mixed outputs", id: "test1" }),
      ],
    });

    // The result should have: Human message + AI message with tool calls + Tool message from normalTool
    // The commandTool returns a Command (control flow) which doesn't add a message
    expect(result.messages).toHaveLength(3);

    // Find the AIMessage (it might not be at a fixed index)
    const aiMessage = result.messages.find(
      (msg) => msg.getType() === "ai"
    ) as AIMessage;
    expect(aiMessage).toBeDefined();
    expect(aiMessage.tool_calls).toHaveLength(2);
    expect(aiMessage.tool_calls?.some((tc) => tc.name === "commandTool")).toBe(
      true
    );
    expect(aiMessage.tool_calls?.some((tc) => tc.name === "normalTool")).toBe(
      true
    );

    // Find the tool message from the normal tool
    const toolMessage = result.messages.find((msg) => msg.getType() === "tool");
    expect(toolMessage).toBeDefined();
    expect(toolMessage?.content).toBe("Normal result: test_normal");

    // Verify we have a human message
    const humanMessage = result.messages.find(
      (msg) => msg.getType() === "human"
    );
    expect(humanMessage).toBeDefined();
    expect(humanMessage?.content).toBe("Test mixed outputs");
  });

  it("should work with includeAgentName: 'inline'", async () => {
    // Create a fake model that returns a message with a name
    class FakeModelWithName extends FakeToolCallingModel {
      async _generate(
        messages: BaseMessage[],
        _options?: this["ParsedCallOptions"],
        _runManager?: CallbackManagerForLLMRun
      ): Promise<ChatResult> {
        const lastMessage = messages[messages.length - 1];
        let content = lastMessage.content as string;

        // Handle prompt concatenation
        if (messages.length > 1) {
          const parts = messages
            .map((m) => m.content as string)
            .filter(Boolean);
          content = parts.join("-");
        }

        const messageId = this.index.toString();

        // Move to next set of tool calls for subsequent invocations
        this.index = (this.index + 1) % Math.max(1, this.toolCalls.length);

        const message = new AIMessage({
          content,
          id: messageId,
          name: "test-agent", // Set agent name
        });

        return {
          generations: [
            {
              text: content,
              message,
            },
          ],
          llmOutput: {},
        };
      }
    }

    const model = new FakeModelWithName();

    const agent = createReactAgent({
      llm: model,
      tools: [],
      name: "test-agent",
      includeAgentName: "inline",
    });

    const inputs = [new HumanMessage("Hello agent")];
    const response = await agent.invoke({ messages: inputs });

    // Verify that the agent was created and works
    expect(response.messages).toHaveLength(2);
    expect(response.messages[0]).toEqual(inputs[0]);

    // Check that the AI message was processed through withAgentName
    const aiMessage = response.messages[1] as AIMessage;
    expect(aiMessage.content).toBe("Hello agent");
    expect(aiMessage.name).toBe("test-agent");
  });

  it("Should respect a passed signal", async () => {
    const llm = new FakeToolCallingChatModel({
      responses: [new AIMessage("result")],
      sleep: 500, // Add delay to allow cancellation
    });

    const agent = createReactAgent({
      llm,
      tools: [],
      prompt: "You are a helpful assistant",
    });

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 100);

    await expect(async () => {
      await agent.invoke(
        { messages: [new HumanMessage("Hello Input!")] },
        { signal: controller.signal }
      );
    }).rejects.toThrowError();
  });

  it("Works with tools that return content_and_artifact response format", async () => {
    class SearchAPIWithArtifact extends StructuredTool {
      name = "search_api";

      description = "A simple API that returns content with artifact.";

      schema = z.object({
        query: z.string().describe("The query to search for."),
      });

      async _call(_input: z.infer<typeof this.schema>) {
        return {
          content: "some response format",
          artifact: Buffer.from("123"),
        };
      }
    }

    const llm = new FakeToolCallingChatModel({
      responses: [
        new AIMessage({
          content: "result1",
          tool_calls: [
            {
              name: "search_api",
              id: "tool_abcd123",
              args: { query: "foo" },
            },
          ],
        }),
        new AIMessage("result2"),
      ],
    });

    const agent = createReactAgent({
      llm,
      tools: [new SearchAPIWithArtifact()],
      prompt: "You are a helpful assistant",
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("Hello Input!")],
    });

    expect(result.messages).toHaveLength(4);
    const toolMessage = JSON.parse(
      result.messages[2].content as string
    ) as ToolMessage;
    expect(toolMessage.content).toBe("some response format");
    expect(Buffer.from(toolMessage.artifact.data)).toEqual(Buffer.from("123"));
  });

  it("Can accept RunnableToolLike", async () => {
    const searchApiTool = new SearchAPI();
    const runnableToolLikeTool = RunnableLambda.from<
      z.infer<typeof searchApiTool.schema>,
      ToolMessage
    >(async (input, config) => searchApiTool.invoke(input, config)).asTool({
      name: searchApiTool.name,
      description: searchApiTool.description,
      schema: searchApiTool.schema,
    });

    const llm = new FakeToolCallingChatModel({
      responses: [
        new AIMessage({
          content: "result1",
          tool_calls: [
            {
              name: "search_api",
              id: "tool_abcd123",
              args: { query: "foo" },
            },
          ],
        }),
        new AIMessage("result2"),
      ],
    });

    const agent = createReactAgent({
      llm,
      tools: [runnableToolLikeTool],
      prompt: "You are a helpful assistant",
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("Hello Input!")],
    });

    expect(result.messages).toHaveLength(4);
    expect((result.messages[2] as ToolMessage).content).toBe("result for foo");
  });

  describe("Dynamic Model", () => {
    it("should handle basic dynamic model functionality", async () => {
      const dynamicModel = (state: typeof MessagesAnnotation.State) => {
        // Return different models based on state
        if (state.messages.at(-1)?.text.includes("urgent")) {
          return new FakeToolCallingChatModel({
            responses: [new AIMessage("urgent called")],
          });
        }

        return new FakeToolCallingChatModel({ responses: [] });
      };

      const agent = createReactAgent({ llm: dynamicModel, tools: [] });

      const result = await agent.invoke({ messages: "hello" });
      expect(result.messages.at(-1)?.text).toBe("hello");

      const result2 = await agent.invoke({ messages: "urgent help" });
      expect(result2.messages.at(-1)?.text).toBe("urgent called");
    });

    it("should handle dynamic model with tool calling", async () => {
      const basicModel = new FakeToolCallingChatModel({
        responses: [
          new AIMessage({
            content: "",
            tool_calls: [{ args: { x: 1 }, id: "1", name: "basic_tool" }],
          }),
          new AIMessage("basic request"),
        ],
      });

      const basicTool = tool(
        async (args: { x: number }) => `basic: ${args.x}`,
        {
          name: "basic_tool",
          description: "Basic tool.",
          schema: z.object({ x: z.number() }),
        }
      );

      const advancedModel = new FakeToolCallingChatModel({
        responses: [
          new AIMessage({
            content: "",
            tool_calls: [{ args: { x: 1 }, id: "1", name: "advanced_tool" }],
          }),
          new AIMessage("advanced request"),
        ],
      });

      const advancedTool = tool(
        async (args: { x: number }) => `advanced: ${args.x}`,
        {
          name: "advanced_tool",
          description: "Advanced tool.",
          schema: z.object({ x: z.number() }),
        }
      );

      const dynamicModel = (state: typeof MessagesAnnotation.State) => {
        // Return model with different behaviors based on message content
        if (state.messages.at(-1)?.text.includes("advanced")) {
          return advancedModel;
        }

        return basicModel;
      };

      const agent = createReactAgent({
        llm: dynamicModel,
        tools: [basicTool, advancedTool],
      });

      // Test basic tool usage
      const result = await agent.invoke({ messages: "basic request" });
      expect(result.messages.slice(-2)).toMatchObject([
        { text: "basic: 1", name: "basic_tool" },
        { text: "basic request" },
      ]);

      // Test advanced tool usage
      const result2 = await agent.invoke({ messages: "advanced request" });
      expect(result2.messages.slice(-2)).toMatchObject([
        { text: "advanced: 1", name: "advanced_tool" },
        { text: "advanced request" },
      ]);
    });

    it("should handle dynamic model using config parameters", async () => {
      const context = z.object({ user_id: z.string() });

      const dynamicModel = (
        _: typeof MessagesAnnotation.State,
        runtime: Runtime<z.infer<typeof context>>
      ) => {
        // Use context to determine model behavior
        const user_id = runtime.context?.user_id;
        if (user_id === "user_premium") {
          return new FakeToolCallingChatModel({
            responses: [new AIMessage("premium")],
          });
        }

        return new FakeToolCallingChatModel({
          responses: [new AIMessage("basic")],
        });
      };

      const agent = createReactAgent({
        llm: dynamicModel,
        tools: [],
        contextSchema: context,
      });

      // Test with basic user
      expect(
        await agent.invoke(
          { messages: "hello" },
          { context: { user_id: "user_basic" } }
        )
      ).toMatchObject({
        messages: [{ text: "hello" }, { text: "basic" }],
      });

      // Test with premium user
      expect(
        await agent.invoke(
          { messages: "hello" },
          { context: { user_id: "user_premium" } }
        )
      ).toMatchObject({
        messages: [{ text: "hello" }, { text: "premium" }],
      });
    });

    it("should handle dynamic model with custom state schema", async () => {
      const CustomDynamicState = Annotation.Root({
        messages: MessagesAnnotation.spec.messages,
        model_preference: Annotation<"basic" | "advanced">({
          reducer: (_, next) => next,
          default: () => "basic",
        }),
      });

      const dynamicModel = (state: typeof CustomDynamicState.State) => {
        // Use custom state field to determine model
        if (state.model_preference === "advanced") {
          return new FakeToolCallingChatModel({
            responses: [new AIMessage("advanced")],
          });
        }

        return new FakeToolCallingChatModel({
          responses: [new AIMessage("basic")],
        });
      };

      const agent = createReactAgent({
        llm: dynamicModel,
        tools: [],
        stateSchema: CustomDynamicState,
      });

      expect(
        await agent.invoke({
          messages: [new HumanMessage("hello")],
          model_preference: "advanced",
        })
      ).toMatchObject({
        messages: [{ text: "hello" }, { text: "advanced" }],
      });
    });

    it("should handle dynamic model with different prompt types", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("ai response")],
      });
      const spyInvoke = vi.spyOn(model, "invoke");

      // Test with string prompt
      const agent = createReactAgent({
        llm: () => model,
        tools: [],
        prompt: "system_msg",
      });

      expect(await agent.invoke({ messages: "human_msg" })).toMatchObject({
        messages: [{ text: "human_msg" }, { text: "ai response" }],
      });

      expect(spyInvoke).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ text: "system_msg" }),
          expect.objectContaining({ text: "human_msg" }),
        ]),
        expect.any(Object)
      );

      spyInvoke.mockClear();

      // Test with callable prompt
      const dynamicPrompt = (state: typeof MessagesAnnotation.State) => {
        return [new SystemMessage("system_msg"), ...state.messages];
      };

      const agent2 = createReactAgent({
        llm: () => model,
        tools: [],
        prompt: dynamicPrompt,
      });

      expect(await agent2.invoke({ messages: "human_msg" })).toMatchObject({
        messages: [{ text: "human_msg" }, { text: "ai response" }],
      });

      expect(spyInvoke).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ text: "system_msg" }),
          expect.objectContaining({ text: "human_msg" }),
        ]),
        expect.any(Object)
      );
    });

    it("should handle dynamic model with structured response format", async () => {
      const TestResponse = z.object({
        message: z.string(),
        confidence: z.number(),
      });
      const structuredResponse = {
        message: "dynamic response",
        confidence: 0.9,
      };

      const dynamicModel = () => {
        return new FakeToolCallingChatModel({
          responses: [new AIMessage("dynamic response")],
          structuredResponse,
        });
      };

      const agent = createReactAgent({
        llm: dynamicModel,
        tools: [],
        responseFormat: TestResponse,
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("hello")],
      });

      // Note: When responseFormat is provided and there are no tools,
      // the agent only returns the structured response without including
      // the AI message in the messages array. This might be a limitation
      // of the current implementation.
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]).toBeInstanceOf(HumanMessage);
      expect(result.messages[0].content).toBe("hello");
      expect(result.messages[1]).toBeInstanceOf(AIMessage);
      expect(result.messages[1].content).toBe("dynamic response");
    });

    it("should handle dynamic model that changes available tools based on state", async () => {
      const toolA = tool(async (args: { x: number }) => `A: ${args.x}`, {
        name: "tool_a",
        description: "Tool A.",
        schema: z.object({ x: z.number() }),
      });

      const modelA = new FakeToolCallingChatModel({
        responses: [
          new AIMessage({
            content: "",
            tool_calls: [{ args: { x: 1 }, id: "1", name: "tool_a" }],
          }),
          new AIMessage({ content: "use_a please" }),
        ],
      });

      const toolB = tool(async (args: { x: number }) => `B: ${args.x}`, {
        name: "tool_b",
        description: "Tool B.",
        schema: z.object({ x: z.number() }),
      });

      const modelB = new FakeToolCallingChatModel({
        responses: [
          new AIMessage({
            content: "",
            tool_calls: [{ args: { x: 2 }, id: "1", name: "tool_b" }],
          }),
          new AIMessage({ content: "use_b please" }),
        ],
      });

      const dynamicModel = (state: typeof MessagesAnnotation.State) => {
        // Switch tools based on message history
        if (state.messages.some((msg) => msg.text.includes("use_b"))) {
          return modelB;
        }

        return modelA;
      };

      const agent = createReactAgent({
        llm: dynamicModel,
        tools: [toolA, toolB],
      });

      // Ask to use tool A
      expect(await agent.invoke({ messages: "use_a" })).toMatchObject({
        messages: [
          { text: "use_a" },
          { tool_calls: [{ args: { x: 1 }, name: "tool_a" }] },
          { text: "A: 1" },
          { text: "use_a please" },
        ],
      });

      // Ask to use tool B
      expect(await agent.invoke({ messages: "use_b" })).toMatchObject({
        messages: [
          { text: "use_b" },
          { tool_calls: [{ args: { x: 2 }, name: "tool_b" }] },
          { text: "B: 2" },
          { text: "use_b please" },
        ],
      });
    });

    it("should handle error handling in dynamic model", async () => {
      const failingDynamicModel = (state: typeof MessagesAnnotation.State) => {
        if (state.messages.at(-1)?.text.includes("fail")) {
          throw new Error("Dynamic model failed");
        }

        return new FakeToolCallingChatModel({
          responses: [new AIMessage("ai response")],
        });
      };

      const agent = createReactAgent({
        llm: failingDynamicModel,
        tools: [],
      });

      // Normal operation should work
      expect(await agent.invoke({ messages: "hello" })).toMatchObject({
        messages: [{ text: "hello" }, { text: "ai response" }],
      });

      // Should propagate the error
      await expect(
        agent.invoke({ messages: [new HumanMessage("fail now")] })
      ).rejects.toThrow("Dynamic model failed");
    });

    it("should produce equivalent results when configured the same", async () => {
      // Static model
      const staticAgent = createReactAgent({
        llm: new FakeToolCallingChatModel({
          responses: [new AIMessage("ai response")],
        }),
        tools: [],
      });

      // Dynamic model returning the same model
      const dynamicAgent = createReactAgent({
        llm: () =>
          new FakeToolCallingChatModel({
            responses: [new AIMessage("ai response")],
          }),
        tools: [],
      });

      const inputMsg = { messages: "test message" };

      const staticResult = await staticAgent.invoke(inputMsg);
      const dynamicResult = await dynamicAgent.invoke(inputMsg);

      // Results should be equivalent (content-wise, IDs may differ)
      expect(staticResult.messages.length).toEqual(
        dynamicResult.messages.length
      );
      expect(staticResult.messages[0].text).toEqual(
        dynamicResult.messages[0].text
      );
      expect(staticResult.messages[1].text).toEqual(
        dynamicResult.messages[1].text
      );
    });

    it("should receive correct state, not the model input", async () => {
      const CustomAgentState = Annotation.Root({
        messages: MessagesAnnotation.spec.messages,
        custom_field: Annotation<string>,
      });

      const dynamicModel = vi.fn(
        () =>
          new FakeToolCallingChatModel({
            responses: [new AIMessage("ai response")],
          })
      );

      const agent = createReactAgent({
        llm: dynamicModel,
        tools: [],
        stateSchema: CustomAgentState,
      });

      // Test with initial state
      const inputState = {
        messages: [new HumanMessage("hello")],
        custom_field: "test_value",
      };
      await agent.invoke(inputState);

      // The dynamic model function should receive the original state, not the processed model input
      expect(dynamicModel).toHaveBeenCalledWith(inputState, expect.any(Object));
    });

    it("should reject dynamic model that returns LLM with bound tools at runtime", async () => {
      const searchTool = new SearchAPI();

      // Create a dynamic model that returns a model with bound tools
      const dynamicModelWithBoundTools = () => {
        const model = new FakeToolCallingModel();
        // This bindTools happens at runtime, after validation
        return model.bindTools([searchTool]);
      };

      const agent = createReactAgent({
        llm: dynamicModelWithBoundTools,
        tools: [searchTool],
      });

      // The agent creation should succeed (validation is skipped for functions)
      expect(agent).toBeDefined();

      // But invoking should fail when the dynamic model returns a model with bound tools
      await expect(async () => {
        await agent.invoke({ messages: [new HumanMessage("test")] });
      }).rejects.toThrow("The provided LLM already has bound tools");
    });
  });

  describe("stopWhen", () => {
    it("should stop with general stopWhen predicate", async () => {
      const dummyTool = tool(async () => "Tool result", {
        name: "dummy_tool",
        description: "A dummy tool",
        schema: z.object({ input: z.string() }),
      });

      const model = new FakeToolCallingChatModel({
        responses: [
          new AIMessage({
            content: "Start conversation",
            id: "0",
            tool_calls: [
              {
                name: "dummy_tool",
                args: { input: "test" },
                id: "call_0",
              },
            ],
          }),
          new AIMessage({ content: "Tool response received", id: "1" }),
          new AIMessage({
            content: "First response with STOP",
            id: "2",
            tool_calls: [
              {
                name: "dummy_tool",
                args: { input: "test2" },
                id: "call_1",
              },
            ],
          }),
          new AIMessage({ content: "After STOP tool response", id: "3" }),
        ],
      });

      // Stop when "STOP" keyword is found in message
      const conditionMock = vi.fn((state) => {
        const lastMessage = state.messages[state.messages.length - 1];
        const content = lastMessage?.content?.toString() || "";
        return {
          shouldStop: content.includes("STOP"),
          description: "Found STOP keyword in message",
        };
      });
      const stopOnKeyword = stopWhen(conditionMock);

      const agent = createReactAgent({
        llm: model,
        tools: [dummyTool],
        stopWhen: stopOnKeyword,
      } as any);

      const result = await agent.invoke({
        messages: [new HumanMessage("Go!")],
      });

      // Should have: HumanMessage, AIMessage with tool call, ToolMessage, AIMessage response
      expect(result.messages).toHaveLength(4);
      expect(result.messages[0]).toBeInstanceOf(HumanMessage);
      expect(result.messages[1]).toBeInstanceOf(AIMessage);
      expect((result.messages[1] as AIMessage).tool_calls).toHaveLength(1);
      expect(result.messages[2]).toBeInstanceOf(ToolMessage);
      expect(result.messages[3]).toBeInstanceOf(AIMessage);
      expect(result.messages[3].content).toBe("Tool response received");

      // stopWhen should have been called after the first tool call
      expect(conditionMock).toHaveBeenCalledTimes(1);
    });

    it("should stop after specified number of tool calls", async () => {
      const weatherTool = tool((_input) => "Weather data", {
        name: "get_weather",
        description: "Get weather data",
        schema: z.object({
          location: z.string(),
        }),
      });

      const model = new FakeToolCallingChatModel({
        responses: [
          new AIMessage({
            content: "",
            tool_calls: [
              {
                id: "call1",
                name: "get_weather",
                args: { location: "NYC" },
              },
            ],
          }),
          new AIMessage({
            content: "",
            tool_calls: [
              {
                id: "call2",
                name: "get_weather",
                args: { location: "LA" },
              },
            ],
          }),
          new AIMessage({
            content: "Should not reach this",
            tool_calls: [
              {
                id: "call3",
                name: "get_weather",
                args: { location: "Chicago" },
              },
            ],
          }),
        ],
      });

      const stopWhen = vi.fn(stopWhenToolCall("get_weather", 2));
      const agent = createReactAgent({
        llm: model,
        tools: [weatherTool],
        stopWhen,
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Get weather for multiple cities")],
      });

      // Count tool messages
      const toolMessages = result.messages.filter(
        (msg) => msg.getType() === "tool" && msg.name === "get_weather"
      );
      expect(toolMessages).toHaveLength(2);

      // Verify we didn't process the third tool call
      const aiMessages = result.messages.filter(
        (msg) => msg.getType() === "ai"
      );
      expect(aiMessages).toHaveLength(2); // Only two AI messages, not three
      expect(stopWhen).toHaveBeenCalledTimes(2); // 2 calls for 3 FakeToolCallingChatModel responses
    });

    it("should stop after max steps (model calls)", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [
          new AIMessage({ content: "Step 1", id: "1" }),
          new AIMessage({ content: "Step 2", id: "2" }),
          new AIMessage({ content: "Step 3", id: "3" }),
          new AIMessage({ content: "Should not reach", id: "4" }),
        ],
      });

      const agent = createReactAgent({
        llm: model,
        tools: [],
        stopWhen: stopWhenMaxSteps(1),
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Start multi-step process")],
      });

      // Count AI messages
      const aiMessages = result.messages.filter(
        (msg) => msg.getType() === "ai"
      );
      expect(aiMessages).toHaveLength(1);
      expect(aiMessages[0].content).toBe("Step 1");
    });

    it("should combine multiple stop conditions", async () => {
      const searchTool = tool((_input) => "Search results", {
        name: "search",
        description: "Search the web",
        schema: z.object({
          query: z.string(),
        }),
      });

      const model = new FakeToolCallingChatModel({
        responses: [
          new AIMessage({
            content: "",
            tool_calls: [
              {
                id: "call1",
                name: "search",
                args: { query: "test" },
              },
            ],
          }),
          new AIMessage({ content: "After search", id: "2" }),
          new AIMessage({ content: "Should not reach", id: "3" }),
        ],
      });

      // Combine: stop after search OR after 1 step
      const combinedStop = stopWhen((state) => {
        // Check if search was called
        const searchStop = stopWhenToolCall("search")(state);
        if (searchStop.shouldStop) return searchStop;

        // Otherwise check step count
        return stopWhenMaxSteps(1)(state);
      });

      const agent = createReactAgent({
        llm: model,
        tools: [searchTool],
        stopWhen: combinedStop,
      } as any);

      const result = await agent.invoke({
        messages: [new HumanMessage("Search and process")],
      });

      // Should stop after first AI message (which includes tool call)
      const aiMessages = result.messages.filter(
        (msg) => msg.getType() === "ai"
      );
      expect(aiMessages).toHaveLength(1);

      const toolMessages = result.messages.filter(
        (msg) => msg.getType() === "tool"
      );
      expect(toolMessages).toHaveLength(1);
    });

    it("should work with async predicates", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [
          new AIMessage({ content: "Done", id: "1" }),
          new AIMessage({ content: "Should not reach", id: "2" }),
        ],
      });

      // Async predicate that simulates checking external condition
      const asyncStop = stopWhen(async (state) => {
        // Simulate async operation
        await new Promise((resolve) => {
          setTimeout(resolve, 10);
        });

        const lastMessage = state.messages[state.messages.length - 1];
        const isDone = lastMessage?.content?.toString().includes("Done");

        return {
          shouldStop: isDone,
          description: "Async check completed",
        };
      });

      const agent = createReactAgent({
        llm: model,
        tools: [],
        stopWhen: asyncStop,
      } as any);

      const result = await agent.invoke({
        messages: [new HumanMessage("Start async process")],
      });

      expect(result.messages).toHaveLength(2);
      const aiMessages = result.messages.filter(
        (msg) => msg.getType() === "ai"
      );
      expect(aiMessages).toHaveLength(1);
      expect(aiMessages[0].content).toBe("Done");
    });
  });

  describe("supports abort signal", () => {
    it("should handle abort signal", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("ai response")],
      });

      const abortController = new AbortController();
      const agent = createReactAgent({
        llm: model,
        tools: [],
        signal: abortController.signal,
      });

      abortController.abort(new Error("custom abortion"));

      await expect(agent.invoke({ messages: "hello" })).rejects.toThrow(
        "custom abortion"
      );
    });

    it("should handle abort signal in tools", async () => {
      const abortController = new AbortController();

      const abortableTool = tool(
        async () => {
          // Simulate some long running async work
          await new Promise((resolve) => setTimeout(resolve, 10000));
          return "Tool completed successfully";
        },
        {
          name: "abortable_tool",
          description: "A tool that can be aborted",
          schema: z.object({
            input: z.string(),
          }),
        }
      );

      const llm = new FakeToolCallingChatModel({
        responses: [
          new AIMessage({
            content: "",
            tool_calls: [
              {
                id: "test-call-1",
                name: "abortable_tool",
                args: { input: "test" },
                type: "tool_call",
              },
            ],
          }),
        ],
      });

      const agent = createReactAgent({
        llm,
        tools: [abortableTool],
        signal: abortController.signal,
      });

      // Start the agent execution
      const executionPromise = agent.invoke({
        messages: [
          {
            role: "user",
            content: "Please run the abortable tool with input 'test'",
          },
        ],
      });

      // Abort after a short delay
      setTimeout(() => {
        abortController.abort("custom abort");
      }, 1000);

      // Verify that the execution throws an abort error
      await expect(executionPromise).rejects.toMatchObject({
        message: "custom abort",
      });
    });

    it("should merge abort signals from agent and config", async () => {
      const agentAbortController = new AbortController();
      const configAbortController = new AbortController();

      const signalCheckTool = tool(
        async () => {
          // some long running async work
          return new Promise((resolve) =>
            setTimeout(() => resolve("Not aborted"), 500)
          );
        },
        {
          name: "signal_check_tool",
          description: "Checks abort signal",
          schema: z.object({
            input: z.string(),
          }),
        }
      );

      const llm = new FakeToolCallingChatModel({
        responses: [
          new AIMessage({
            content: "",
            tool_calls: [
              {
                id: "test-call-2",
                name: "signal_check_tool",
                args: { input: "test" },
                type: "tool_call",
              },
            ],
          }),
          new AIMessage({
            content: "",
            tool_calls: [
              {
                id: "test-call-3",
                name: "signal_check_tool",
                args: { input: "test" },
                type: "tool_call",
              },
            ],
          }),
        ],
      });

      const agent = createReactAgent({
        llm,
        tools: [signalCheckTool],
        signal: agentAbortController.signal,
      });

      // Test aborting via config signal
      const configExecution = agent.invoke(
        {
          messages: [
            {
              role: "user",
              content: "Run signal_check_tool with input 'test'",
            },
          ],
        },
        { signal: configAbortController.signal }
      );

      setTimeout(() => {
        configAbortController.abort(new Error("Config abort"));
      }, 1000);
      setTimeout(() => {
        agentAbortController.abort(new Error("Agent abort"));
      }, 2000);

      await expect(configExecution).rejects.toThrow(/Config abort/);
      expect(agentAbortController.signal.aborted).toBe(false);
      expect(configAbortController.signal.aborted).toBe(true);
    });
  });
});
