import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod/v3";
import { z as z4 } from "zod/v4";

import {
  BaseMessage,
  AIMessage,
  HumanMessage,
  ToolMessage,
} from "@langchain/core/messages";
import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import type { ChatResult } from "@langchain/core/outputs";
import { StructuredTool, tool } from "@langchain/core/tools";
import { RunnableLambda } from "@langchain/core/runnables";
import {
  Command,
  getCurrentTaskInput,
  type BaseCheckpointSaver,
} from "@langchain/langgraph";

import {
  providerStrategy,
  createAgent,
  createMiddleware,
  toolStrategy,
} from "../index.js";

import {
  FakeToolCallingChatModel,
  FakeToolCallingModel,
  createCheckpointer,
  SearchAPI,
} from "./utils.js";

describe("createAgent", () => {
  let syncCheckpointer: BaseCheckpointSaver;

  beforeEach(() => {
    syncCheckpointer = createCheckpointer();
  });

  it("should work with no prompt", async () => {
    const model = new FakeToolCallingModel();

    const agent = createAgent({
      model,
      tools: [],
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
  });

  it("should reject LLM with bound tools", async () => {
    const model = new FakeToolCallingModel();
    const searchTool = new SearchAPI();

    // Create a model with bound tools
    const modelWithTools = model.bindTools([searchTool]);

    // Should throw when trying to create agent with bound tools
    expect(() =>
      createAgent({
        model: modelWithTools,
        tools: [searchTool],
      })
    ).toThrow(
      "The provided LLM already has bound tools. " +
        "Please provide an LLM without bound tools to createAgent. " +
        "The agent will bind the tools provided in the 'tools' parameter."
    );
  });

  it("should work with string prompt", async () => {
    const systemPrompt = "Foo";
    const agent = createAgent({
      model: new FakeToolCallingModel(),
      tools: [],
      systemPrompt,
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

  it("should validate messages correctly", () => {
    // The validation function isn't exported, so we'll test it through agent creation
    // Empty input should work
    const agent = createAgent({
      model: new FakeToolCallingModel(),
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

    const agent = createAgent({
      model,
      tools: [getWeather],
      responseFormat: WeatherResponseSchema,
    });

    const response = await agent.invoke({
      messages: [new HumanMessage("What's the weather?")],
    });

    expect(response.structuredResponse).toEqual(expectedStructuredResponse);
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
    const model = new FakeToolCallingChatModel({
      structuredResponse: expectedStructuredResponse,
    });

    const agent = createAgent({
      model,
      tools: [getWeather],
      responseFormat: providerStrategy(WeatherResponseSchema),
    });

    const response = await agent.invoke({
      messages: [
        new AIMessage('{"temperature":75}'),
        new AIMessage("You are a weather assistant"),
      ],
    });

    expect(response.structuredResponse).toEqual(expectedStructuredResponse);
    expect(response.messages).toHaveLength(2);
    expect((response.messages[0] as ToolMessage).content).toBe(
      `{"temperature":75}`
    );
  });

  it("should work with async no prompt", async () => {
    const model = new FakeToolCallingModel();
    const asyncCheckpointer = createCheckpointer();

    const agent = createAgent({
      model,
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

    let agent = createAgent({
      model,
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

    agent = createAgent({
      model,
      tools: [toolReturnDirect, toolNormal],
    });

    result = await agent.invoke({
      messages: [new HumanMessage({ content: "Test normal", id: "hum1" })],
    });

    expect(result.messages).toHaveLength(4);
    expect(HumanMessage.isInstance(result.messages[0])).toBe(true);
    expect(result.messages[0]).toEqual(
      new HumanMessage({ content: "Test normal", id: "hum1" })
    );
    expect(AIMessage.isInstance(result.messages[1])).toBe(true);
    expect((result.messages[1] as AIMessage).tool_calls?.length).toBe(1);
    expect(ToolMessage.isInstance(result.messages[2])).toBe(true);
    expect((result.messages[2] as ToolMessage).content).toBe(
      "Normal result: Test normal"
    );
    expect((result.messages[2] as ToolMessage).name).toBe("toolNormal");
    expect(AIMessage.isInstance(result.messages[3])).toBe(true);
    expect((result.messages[3] as AIMessage).tool_calls?.length).toBe(0);
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

    const model = new FakeToolCallingModel();

    // Test state modifier works
    const agent = createAgent({
      model,
      tools: [add],
      middleware: [
        createMiddleware({
          name: "prompt",
          wrapModelCall: (request, handler) => {
            return handler({ ...request, systemPrompt: "User name is Alice" });
          },
        }),
      ],
    });

    const response = await agent.invoke({
      messages: [{ role: "user", content: "hi" }],
    });

    // Check that the system message was applied
    expect(response.messages).toHaveLength(2);
    expect(response.messages[1].content).toBe("User name is Alice-hi");
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

    const agent = createAgent({
      model,
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

    const agent = createAgent({
      model,
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
    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("result")],
      sleep: 500, // Add delay to allow cancellation
    });

    const agent = createAgent({
      model,
      tools: [],
      systemPrompt: "You are a helpful assistant",
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

    const model = new FakeToolCallingChatModel({
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

    const agent = createAgent({
      model,
      tools: [new SearchAPIWithArtifact()],
      systemPrompt: "You are a helpful assistant",
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

    const model = new FakeToolCallingChatModel({
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

    const agent = createAgent({
      model,
      tools: [runnableToolLikeTool],
      systemPrompt: "You are a helpful assistant",
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("Hello Input!")],
    });

    expect(result.messages).toHaveLength(4);
    expect((result.messages[2] as ToolMessage).content).toBe("result for foo");
  });

  describe("supports abort signal", () => {
    it("should handle abort signal", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("ai response")],
      });

      const abortController = new AbortController();
      const agent = createAgent({
        model,
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
          await new Promise((resolve) => {
            setTimeout(resolve, 10000);
          });
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

      const model = new FakeToolCallingChatModel({
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

      const agent = createAgent({
        model,
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
          return new Promise((resolve) => {
            setTimeout(() => resolve("Not aborted"), 500);
          });
        },
        {
          name: "signal_check_tool",
          description: "Checks abort signal",
          schema: z.object({
            input: z.string(),
          }),
        }
      );

      const model = new FakeToolCallingChatModel({
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

      const agent = createAgent({
        model,
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

  describe("model option", () => {
    it("should throw if no model or llm option is provided", async () => {
      await expect(() =>
        // @ts-expect-error - model is required
        createAgent({
          tools: [],
        })
      ).toThrow("`model` option is required to create an agent.");
    });
  });

  it("should make passed in state available in context", async () => {
    const model = new FakeToolCallingChatModel({
      responses: [
        new AIMessage({
          content: "result1",
          tool_calls: [
            {
              name: "state_check_tool",
              id: "tool_abcd123",
              args: { query: "foo" },
            },
          ],
        }),
        new AIMessage("result2"),
      ],
    });

    const stateCheckTool = tool(
      async (_, config) => {
        const taskInput = await getCurrentTaskInput(config);
        return JSON.stringify(taskInput);
      },
      {
        name: "state_check_tool",
        description: "A tool that checks the current task input",
        schema: z.object({
          query: z.string(),
        }),
      }
    );

    const agent = createAgent({
      model,
      tools: [stateCheckTool],
      stateSchema: z.object({
        customField: z.string().optional(),
      }),
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("Hello Input!")],
      customField: "test-value",
    });

    expect(result.messages).toHaveLength(4);
    const toolMessage = result.messages[2] as ToolMessage;
    const taskInput = JSON.parse(toolMessage.content as string);
    expect(taskInput.customField).toBe("test-value");
  });

  // https://github.com/langchain-ai/langchainjs/issues/9299
  it("supports zod 3/4 schemas in createAgent and middleware", async () => {
    // Create middleware with Zod v3 schemas
    const middleware1 = createMiddleware({
      name: "middleware1",
      stateSchema: z.object({
        middleware1Value: z.string().default("v3-default"),
      }),
      contextSchema: z.object({
        middleware1Context: z.number(),
      }),
      beforeModel: (_state, { context }) => {
        expect(context.middleware1Context).toBe(42);
        return {
          middleware1Value: "v3-modified",
        };
      },
    });

    // Create middleware with Zod v4 schemas
    const middleware2 = createMiddleware({
      name: "middleware2",
      stateSchema: z4.object({
        middleware2Value: z4.string().default("v4-default"),
      }),
      contextSchema: z4.object({
        middleware2Context: z4.boolean(),
      }),
      beforeModel: (_state, { context }) => {
        expect(context.middleware2Context).toBe(true);
        return {
          middleware2Value: "v4-modified",
        };
      },
    });

    // Create a tool with Zod v3 schema
    const testTool = tool(async (input) => `Result: ${input.query}`, {
      name: "test_tool",
      description: "A test tool",
      schema: z.object({
        query: z.string(),
      }),
    });

    const responseFormat = toolStrategy(
      z.object({
        result: z.string(),
        score: z.number(),
      })
    );

    const expectedStructuredResponse = { result: "success", score: 95 };
    const model = new FakeToolCallingChatModel({
      responses: [
        new AIMessage({
          content: "",
          tool_calls: [
            {
              name: "test_tool",
              id: "tool_1",
              args: { query: "test" },
            },
          ],
        }),
        new AIMessage({
          content: "",
          tool_calls: [
            {
              name: responseFormat[0].tool.function.name,
              id: "extract",
              args: expectedStructuredResponse,
            },
          ],
        }),
      ],
      structuredResponse: expectedStructuredResponse,
    });

    const agent = createAgent({
      model,
      tools: [testTool],
      // Use Zod v4 for agent stateSchema
      stateSchema: z4.object({
        agentCounter: z4.number().default(0),
        agentName: z4.string().optional(),
      }),
      responseFormat,
      middleware: [middleware1, middleware2],
    });

    const result = await agent.invoke(
      {
        messages: [new HumanMessage("Test mixed schemas")],
        agentCounter: 1,
        agentName: "test-agent",
      },
      {
        context: {
          middleware1Context: 42,
          middleware2Context: true,
        },
      }
    );

    // Verify agent state schema (Zod v3)
    expect(result.agentCounter).toBe(1);
    expect(result.agentName).toBe("test-agent");

    // Verify middleware1 state (Zod v3)
    expect(result.middleware1Value).toBe("v3-modified");

    // Verify middleware2 state (Zod v4)
    expect(result.middleware2Value).toBe("v4-modified");

    // Verify structured response (Zod v4)
    expect(result.structuredResponse).toEqual(expectedStructuredResponse);
    expect(result.structuredResponse.result).toBe("success");
    expect(result.structuredResponse.score).toBe(95);

    // Verify messages were processed correctly
    expect(result.messages.length).toBeGreaterThan(0);
  });

  it("supports StateSchema in middleware stateSchema", async () => {
    const { StateSchema } = await import("@langchain/langgraph");

    // Create middleware with StateSchema instead of Zod object
    const middleware = createMiddleware({
      name: "stateSchemaMiddleware",
      stateSchema: new StateSchema({
        middlewareValue: z4.string().default("default"),
      }),
      contextSchema: z4.object({
        middlewareContext: z4.number(),
      }),
      beforeModel: (_state, { context }) => {
        expect(context.middlewareContext).toBe(42);
        return {
          middlewareValue: "modified",
        };
      },
    });

    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("Done")],
    });

    const agent = createAgent({
      model,
      tools: [],
      middleware: [middleware],
    });

    const result = await agent.invoke(
      {
        messages: [new HumanMessage("Test StateSchema middleware")],
      },
      {
        context: {
          middlewareContext: 42,
        },
      }
    );

    // Verify middleware state (StateSchema)
    expect(result.middlewareValue).toBe("modified");

    // Verify messages were processed correctly
    expect(result.messages.length).toBeGreaterThan(0);
  });
});
