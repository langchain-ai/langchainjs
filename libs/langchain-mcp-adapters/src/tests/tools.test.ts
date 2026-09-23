import { describe, test, expect, beforeEach, vi, MockedObject } from "vitest";
import type {
  Client,
  EmbeddedResource,
  ImageContent,
  TextContent,
  Tool,
} from "@modelcontextprotocol/client";
import {
  StructuredTool,
  ToolInputParsingException,
} from "@langchain/core/tools";
import type {
  AIMessage,
  MessageContentComplex,
  ToolMessage,
} from "@langchain/core/messages";

import { z } from "zod";
import { loadMcpTools } from "../tools.js";

vi.mock(
  "@modelcontextprotocol/client",
  () => import("./__mocks__/@modelcontextprotocol/client.js")
);
vi.mock(
  "@modelcontextprotocol/client/stdio",
  () => import("./__mocks__/@modelcontextprotocol/client/stdio.js")
);

// Create a mock client
describe("Simplified Tool Adapter Tests", () => {
  let mockClient: MockedObject<Client>;

  beforeEach(() => {
    mockClient = {
      callTool: vi.fn(),
      listTools: vi.fn(),
      getProtocolEra: vi.fn(() => "legacy"),
    } as MockedObject<Client>;

    vi.clearAllMocks();
  });

  test.each([
    { defaultToolTimeout: -1 },
    { defaultToolTimeout: 1000, timeoutTypo: 1000 },
  ])("rejects invalid loader options before discovery: %j", async (options) => {
    mockClient.listTools.mockResolvedValue({ tools: [] });

    await expect(loadMcpTools("test", mockClient, options)).rejects.toThrow(
      z.ZodError
    );
    expect(mockClient.listTools).not.toHaveBeenCalled();
  });

  test("schema parsing preserves boolean schemas and extension values", async () => {
    const inputSchema = {
      type: "object",
      properties: {
        anything: true,
        never: false,
        value: { type: ["string", "null"] },
      },
      "x-provider": { choices: [1, "two", null, { enabled: true }] },
    } satisfies Tool["inputSchema"];

    mockClient.listTools.mockResolvedValue({
      tools: [{ name: "schema", inputSchema }],
    });
    const [tool] = await loadMcpTools("test", mockClient);
    expect(tool.schema).toEqual(inputSchema);
  });

  test("preserves malformed constraints and rejects their input without a wire call", async () => {
    mockClient.listTools.mockResolvedValue({
      tools: [
        {
          name: "schema",
          inputSchema: {
            type: "object",
            properties: {},
            allOf: [{ required: [42] }],
          },
        },
      ],
    });
    const [tool] = await loadMcpTools("test", mockClient);
    // Rejected by the preserved constraint, not by some unrelated failure.
    await expect(tool.invoke({})).rejects.toThrow(ToolInputParsingException);
    expect(mockClient.callTool).not.toHaveBeenCalled();
  });

  test.each([
    {
      name: "legacy default",
      era: "legacy",
      elicitation: undefined,
      answers: false,
    },
    {
      name: "legacy explicit opt-in",
      era: "legacy",
      elicitation: true,
      answers: false,
    },
    {
      name: "modern default",
      era: "modern",
      elicitation: undefined,
      answers: true,
    },
    {
      name: "modern explicit opt-in",
      era: "modern",
      elicitation: true,
      answers: true,
    },
    {
      name: "modern explicit opt-out",
      era: "modern",
      elicitation: false,
      answers: false,
    },
  ] as const)(
    "handles an incomplete response for $name",
    async ({ era, elicitation, answers }) => {
      // `allowInputRequired` makes this a resolved value rather than a throw.
      const pending = {
        resultType: "input_required",
        inputRequests: {
          confirm: {
            method: "elicitation/create",
            params: {
              mode: "form",
              message: "Confirm?",
              requestedSchema: {
                type: "object",
                properties: { confirmed: { type: "boolean" } },
                required: ["confirmed"],
              },
            },
          },
        },
        requestState: "opaque-state",
      };

      const client = {
        callTool: vi.fn().mockResolvedValue(pending),
        listTools: vi.fn().mockResolvedValue({
          tools: [{ name: "echo", inputSchema: { type: "object" } }],
        }),
        getProtocolEra: vi.fn(() => era),
      } as unknown as MockedObject<Client>;

      const [tool] = await loadMcpTools(
        "test",
        client,
        elicitation === undefined ? undefined : { elicitation }
      );

      // A legacy server never returns an `input_required` result, so the
      // elicitation path stays out of its way even when the server opted in.
      // Outside a graph the modern path reports how to answer; the legacy path
      // refuses the result by name rather than raising an interrupt.
      await expect(tool.invoke({})).rejects.toThrow(
        answers
          ? /Invoke it inside a LangGraph/
          : /asked for input, which only a modern server with elicitation enabled can answer/
      );
      expect(client.callTool).toHaveBeenCalledTimes(1);
      expect(client.callTool.mock.calls[0][0]).toMatchObject({
        _meta: answers
          ? {
              "io.modelcontextprotocol/clientCapabilities": {
                elicitation: { form: {}, url: {} },
              },
            }
          : undefined,
      });
      expect(client.callTool.mock.calls[0][1]).toMatchObject(
        answers ? { allowInputRequired: true } : {}
      );
      if (!answers)
        expect(client.callTool.mock.calls[0][1]).not.toHaveProperty(
          "allowInputRequired"
        );
    }
  );

  // A conforming server validates its own structured output before sending it,
  // so these only arise from a server that does not — which is exactly what the
  // SDK's own validator covered before the rounds withheld the schema from it.
  test.each([
    {
      name: "content that violates the schema",
      result: {
        content: [{ type: "text", text: "done" }],
        structuredContent: { approved: "yes" },
      },
      errors: ["data/approved must be boolean", "at structuredContent"],
    },
    {
      name: "no structured content at all",
      result: { content: [{ type: "text", text: "done" }] },
      errors: ["data must be object", "at structuredContent"],
    },
  ])(
    "validates the terminal result itself when a tool elicits: $name",
    async ({ result, errors }) => {
      const client = {
        callTool: vi.fn().mockResolvedValue(result),
        listTools: vi.fn().mockResolvedValue({
          tools: [
            {
              name: "approve",
              inputSchema: { type: "object" },
              outputSchema: {
                type: "object",
                properties: { approved: { type: "boolean" } },
                required: ["approved"],
              },
            },
          ],
        }),
        getProtocolEra: vi.fn(() => "modern" as const),
      } as unknown as MockedObject<Client>;

      const [tool] = await loadMcpTools("test", client, { elicitation: true });

      const failure = await tool.invoke({}).catch((thrown: unknown) => thrown);

      expect(failure).toBeInstanceOf(Error);
      expect((failure as Error).message).toContain(
        'MCP tool "approve" on server "test" returned output its schema rejects'
      );
      // Each case names its own defect, attributed to `structuredContent`.
      for (const error of errors)
        expect((failure as Error).message).toContain(error);

      // The schema is withheld from the round so an `input_required` survives.
      expect(client.callTool.mock.calls[0][1]).toMatchObject({
        allowInputRequired: true,
      });
      expect(
        client.callTool.mock.calls[0][1]?.toolDefinition
      ).not.toHaveProperty("outputSchema");
    }
  );

  test("reports a client that cannot rebind headers", async () => {
    const client = {
      callTool: vi.fn().mockResolvedValue({ content: [] }),
      listTools: vi.fn().mockResolvedValue({
        tools: [{ name: "echo", inputSchema: { type: "object" } }],
      }),
      getProtocolEra: vi.fn(() => "modern" as const),
    } as unknown as MockedObject<Client>;

    const [tool] = await loadMcpTools("test", client, {
      beforeToolCall: () => ({ headers: { "X-Tenant": "a" } }),
    });

    await expect(tool.invoke({})).rejects.toThrow(
      /does not support header changes/
    );
    expect(client.callTool).not.toHaveBeenCalled();
  });

  test("refuses a forked connection that changed protocol era", async () => {
    const forked = {
      callTool: vi.fn().mockResolvedValue({ content: [] }),
      getProtocolEra: vi.fn(() => "legacy" as const),
    };
    const client = {
      callTool: vi.fn().mockResolvedValue({ content: [] }),
      listTools: vi.fn().mockResolvedValue({
        tools: [{ name: "echo", inputSchema: { type: "object" } }],
      }),
      getProtocolEra: vi.fn(() => "modern" as const),
      fork: vi.fn(async () => forked),
    } as unknown as MockedObject<Client>;

    const [tool] = await loadMcpTools("test", client, {
      beforeToolCall: () => ({ headers: { "X-Tenant": "a" } }),
    });

    // Tool schemas and the elicitation decision were both fixed at discovery.
    await expect(tool.invoke({})).rejects.toThrow(
      /changed protocol era after tool discovery/
    );
    expect(forked.callTool).not.toHaveBeenCalled();
  });

  test("leaves an error result to the adapter rather than schema validation", async () => {
    const client = {
      callTool: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "upstream exploded" }],
        isError: true,
      }),
      listTools: vi.fn().mockResolvedValue({
        tools: [
          {
            name: "approve",
            inputSchema: { type: "object" },
            outputSchema: {
              type: "object",
              properties: { approved: { type: "boolean" } },
              required: ["approved"],
            },
          },
        ],
      }),
      getProtocolEra: vi.fn(() => "modern" as const),
    } as unknown as MockedObject<Client>;

    const [tool] = await loadMcpTools("test", client, { elicitation: true });

    // An error result carries no structured content by design; reporting a
    // schema violation would bury the server's own message.
    await expect(tool.invoke({})).rejects.toThrow(/upstream exploded/);
  });

  describe("hook return validation", () => {
    beforeEach(() => {
      mockClient.listTools.mockResolvedValue({
        tools: [
          { name: "echo", inputSchema: { type: "object", properties: {} } },
        ],
      });
      mockClient.callTool.mockResolvedValue({
        content: [{ type: "text", text: "original" }],
      });
    });

    test("does not mutate the arguments previously passed to a hook", async () => {
      let observed: unknown;

      const [tool] = await loadMcpTools("test", mockClient, {
        beforeToolCall: ({ args }) => {
          observed = args;

          return { args: { value: "effective" } };
        },
      });

      await tool.invoke({});
      expect(observed).toEqual({});
      expect(mockClient.callTool).toHaveBeenCalledWith(
        {
          name: "echo",
          arguments: { value: "effective" },
        },
        expect.objectContaining({
          toolDefinition: expect.objectContaining({ name: "echo" }),
        })
      );
    });

    test("rejects scalar argument overrides before issuing a request", async () => {
      const [tool] = await loadMcpTools("test", mockClient, {
        // @ts-expect-error Invalid JavaScript callback input is rejected at runtime too.
        beforeToolCall: () => ({ args: "invalid" }),
      });

      await expect(tool.invoke({})).rejects.toMatchObject({
        message: expect.stringContaining(
          "Invalid input: expected record, received string"
        ),
      });
      expect(mockClient.callTool).not.toHaveBeenCalled();
    });

    test("rejects invalid effective arguments with a ZodError cause", async () => {
      mockClient.listTools.mockResolvedValue({
        tools: [
          {
            name: "echo",
            inputSchema: {
              type: "object",
              properties: { value: { type: "integer", minimum: 1 } },
            },
          },
        ],
      });
      const [tool] = await loadMcpTools("test", mockClient, {
        beforeToolCall: () => ({ args: { value: -1 } }),
      });

      await expect(tool.invoke({ value: 1 })).rejects.toMatchObject({
        message: expect.stringContaining(
          'Invalid arguments for MCP tool "echo"'
        ),
        cause: expect.any(z.ZodError),
      });
      expect(mockClient.callTool).not.toHaveBeenCalled();
    });

    test.each([false, true])(
      "handles progress observer failures without failing the tool (async=%s)",
      async (asyncObserver) => {
        const fail = () => {
          throw new Error("progress observer failed");
        };
        const onProgress = vi.fn(asyncObserver ? async () => fail() : fail);
        mockClient.callTool.mockImplementation(async (_request, options) => {
          options?.onprogress?.({ progress: 1, total: 1 });
          return { content: [{ type: "text", text: "completed" }] };
        });

        const [tool] = await loadMcpTools("test", mockClient, { onProgress });
        await expect(tool.invoke({})).resolves.toBe("completed");
        expect(onProgress).toHaveBeenCalledWith(
          { progress: 1, total: 1 },
          { type: "tool", name: "echo", args: {}, server: "test" }
        );
      }
    );

    test.each([false, true])(
      "validates before hooks after awaiting them (async=%s)",
      async (asyncHook) => {
        const invalid = { headers: { test: 42 } };
        const beforeToolCall = asyncHook ? async () => invalid : () => invalid;

        const [tool] = await loadMcpTools("test", mockClient, {
          // @ts-expect-error Exercise malformed JavaScript callback results.
          beforeToolCall,
        });

        await expect(tool.invoke({})).rejects.toThrow(/string/);
        expect(mockClient.callTool).not.toHaveBeenCalled();
      }
    );

    test.each([false, true])(
      "validates after hooks after awaiting them (async=%s)",
      async (asyncHook) => {
        const afterToolCall = asyncHook
          ? async () => ({ result: 42 })
          : () => ({ result: 42 });

        const [tool] = await loadMcpTools("test", mockClient, {
          // @ts-expect-error Exercise malformed JavaScript callback results.
          afterToolCall,
        });

        // The wire call already happened; only the hook's result is refused.
        await expect(tool.invoke({})).rejects.toThrow(
          /expected string, received number/
        );
        expect(mockClient.callTool).toHaveBeenCalledTimes(1);
      }
    );

    test("preserves successful async modifications and formats Zod4 hook failures", async () => {
      const [tool] = await loadMcpTools("test", mockClient, {
        beforeToolCall: async () => ({ args: { value: "effective" } }),
        afterToolCall: async () => ({ result: "changed" }),
      });

      expect(await tool.invoke({})).toBe("changed");
      expect(mockClient.callTool).toHaveBeenCalledWith(
        {
          name: "echo",
          arguments: { value: "effective" },
        },
        expect.objectContaining({
          toolDefinition: expect.objectContaining({ name: "echo" }),
        })
      );

      const [invalid] = await loadMcpTools("test", mockClient, {
        beforeToolCall: () => {
          z.string().parse(123);
        },
      });

      await expect(invalid.invoke({})).rejects.toThrow(/string/);
    });
  });

  describe("loadMcpTools", () => {
    test("should load all tools from client", async () => {
      // Set up mock response
      mockClient.listTools.mockReturnValueOnce(
        Promise.resolve({
          tools: [
            {
              name: "tool1",
              description: "Tool 1",
              inputSchema: { type: "object", properties: {}, required: [] },
            },
            {
              name: "tool2",
              description: "Tool 2",
              inputSchema: { type: "object", properties: {}, required: [] },
            },
          ],
        })
      );

      // Load tools
      const tools = await loadMcpTools(
        "mockServer(should load all tools)",
        mockClient as Client
      );

      // Verify results
      expect(tools.length).toBe(2);
      expect(tools[0].name).toBe("tool1");
      expect(tools[1].name).toBe("tool2");
    });

    test("should validate tool input against input schema", async () => {
      // Set up mock response
      mockClient.listTools.mockReturnValueOnce(
        Promise.resolve({
          tools: [
            {
              name: "weather",
              description: "Get the weather for a given city",
              inputSchema: {
                type: "object",
                properties: {
                  city: { type: "string" },
                },
                required: ["city"],
              },
            },
          ],
        })
      );

      mockClient.callTool.mockImplementation((params) => {
        // should not be called if input is invalid
        const args = params.arguments as { city: string };
        expect(args.city).toBeDefined();
        expect(typeof args.city).toBe("string");

        return Promise.resolve({
          content: [
            {
              type: "text",
              text: `It is currently 70 degrees and cloudy in ${args.city}.`,
            },
          ],
        });
      });

      // Load tools
      const tools = await loadMcpTools(
        "mockServer(should validate tool input against input schema)",
        mockClient as Client
      );

      // Verify results
      expect(tools.length).toBe(1);
      expect(tools[0].name).toBe("weather");

      const weatherTool = tools[0];

      // should not invoke the tool when input is invalid
      await expect(
        weatherTool.invoke({ location: "New York" })
      ).rejects.toThrow(ToolInputParsingException);

      expect(mockClient.callTool).not.toHaveBeenCalled();

      // should invoke the tool when input is valid
      await expect(weatherTool.invoke({ city: "New York" })).resolves.toEqual(
        "It is currently 70 degrees and cloudy in New York."
      );

      expect(mockClient.callTool).toHaveBeenCalledWith(
        {
          arguments: {
            city: "New York",
          },
          name: "weather",
        },
        expect.objectContaining({
          toolDefinition: expect.objectContaining({ name: "weather" }),
        })
      );
    });

    test("should load tool with no input parameters", async () => {
      // Set up mock response
      mockClient.listTools.mockReturnValueOnce(
        Promise.resolve({
          tools: [
            {
              name: "weather",
              description: "Get the current weather",
              inputSchema: {
                type: "object",
              },
            },
          ],
        })
      );

      mockClient.callTool.mockImplementation((_params) => {
        return Promise.resolve({
          content: [
            {
              type: "text",
              text: `It is currently 70 degrees and cloudy.`,
            },
          ],
        });
      });

      // Load tools
      const tools = await loadMcpTools(
        "mockServer(should load tool with no input parameters)",
        mockClient as Client
      );

      // Verify results
      expect(tools.length).toBe(1);
      expect(tools[0].name).toBe("weather");

      const weatherTool = tools[0];

      // should invoke the tool when input is valid
      await expect(weatherTool.invoke({})).resolves.toEqual(
        "It is currently 70 degrees and cloudy."
      );

      expect(mockClient.callTool).toHaveBeenCalledWith(
        {
          arguments: {},
          name: "weather",
        },
        expect.objectContaining({
          toolDefinition: expect.objectContaining({ name: "weather" }),
        })
      );
    });

    test("should handle empty tool list", async () => {
      // Set up mock response
      mockClient.listTools.mockReturnValueOnce(
        Promise.resolve({
          tools: [],
        })
      );

      // Load tools
      const tools = await loadMcpTools(
        "mockServer(should handle empty tool list)",
        mockClient as Client
      );

      // Verify results
      expect(tools.length).toBe(0);
    });

    test("should filter out tools without names", async () => {
      // Set up mock response
      mockClient.listTools.mockReturnValueOnce(
        // @ts-expect-error - Purposefully dropped name field on one of the tools, should be type error.
        Promise.resolve({
          tools: [
            {
              name: "tool1",
              description: "Tool 1",
              inputSchema: { type: "object", properties: {}, required: [] },
            },
            {
              description: "No name tool",
              inputSchema: { type: "object", properties: {}, required: [] },
            },
            {
              name: "tool2",
              description: "Tool 2",
              inputSchema: { type: "object", properties: {}, required: [] },
            },
          ],
        })
      );

      // Load tools
      const tools = await loadMcpTools(
        "mockServer(should filter out tools without names)",
        mockClient as Client
      );

      // Verify results
      expect(tools.length).toBe(2);
      expect(tools[0].name).toBe("tool1");
      expect(tools[1].name).toBe("tool2");
    });

    test("should handle JSON schemas with $defs references (Pydantic v2 style)", async () => {
      // This schema is similar to what Pydantic v2 generates with nested models
      const pydanticV2Schema = {
        type: "object" as const,
        properties: {
          items: {
            type: "array",
            items: {
              $ref: "#/$defs/DataItem",
            },
            description: "List of items",
          },
          metadata: {
            $ref: "#/$defs/Metadata",
            description: "Response metadata",
          },
        },
        required: ["items", "metadata"],
        $defs: {
          DataItem: {
            type: "object",
            properties: {
              id: { type: "string", description: "Item ID" },
              name: { type: "string", description: "Item name" },
              value: { type: "number", description: "Item value" },
            },
            required: ["id", "name", "value"],
          },
          Metadata: {
            type: "object",
            properties: {
              total_count: { type: "integer", description: "Total count" },
              timestamp: { type: "string", description: "Timestamp" },
            },
            required: ["total_count", "timestamp"],
          },
        },
      };

      mockClient.listTools.mockReturnValueOnce(
        Promise.resolve({
          tools: [
            {
              name: "query_data",
              description: "Query tool that returns nested response",
              inputSchema: pydanticV2Schema,
            },
          ],
        })
      );

      mockClient.callTool.mockImplementation((params) => {
        const args = params.arguments as {
          items: Array<{ id: string; name: string; value: number }>;
          metadata: { total_count: number; timestamp: string };
        };
        return Promise.resolve({
          content: [
            {
              type: "text",
              text: `Received ${args.items.length} items with total_count=${args.metadata.total_count}`,
            },
          ],
        });
      });

      // Load tools - this should not throw even though schema has $defs
      const tools = await loadMcpTools(
        "mockServer(should handle $defs)",
        mockClient as Client
      );

      expect(tools.length).toBe(1);
      expect(tools[0].name).toBe("query_data");

      // Invoke the tool with valid input matching the referenced schema.
      const result = await tools[0].invoke({
        items: [{ id: "1", name: "Test", value: 100.0 }],
        metadata: { total_count: 1, timestamp: "2024-01-01" },
      });

      expect(result).toBe("Received 1 items with total_count=1");
      expect(mockClient.callTool).toHaveBeenCalledWith(
        {
          name: "query_data",
          arguments: {
            items: [{ id: "1", name: "Test", value: 100.0 }],
            metadata: { total_count: 1, timestamp: "2024-01-01" },
          },
        },
        expect.objectContaining({
          toolDefinition: expect.objectContaining({ name: "query_data" }),
        })
      );
    });

    test("should handle JSON schemas with definitions (older JSON Schema style)", async () => {
      // Some tools use 'definitions' instead of '$defs'
      const schemaWithDefinitions = {
        type: "object" as const,
        properties: {
          user: {
            $ref: "#/definitions/User",
          },
        },
        required: ["user"],
        definitions: {
          User: {
            type: "object",
            properties: {
              name: { type: "string" },
              email: { type: "string" },
            },
            required: ["name", "email"],
          },
        },
      };

      mockClient.listTools.mockReturnValueOnce(
        Promise.resolve({
          tools: [
            {
              name: "create_user",
              description: "Create a user",
              inputSchema: schemaWithDefinitions,
            },
          ],
        })
      );

      mockClient.callTool.mockImplementation((params) => {
        const args = params.arguments as {
          user: { name: string; email: string };
        };
        return Promise.resolve({
          content: [
            {
              type: "text",
              text: `Created user: ${args.user.name}`,
            },
          ],
        });
      });

      const tools = await loadMcpTools(
        "mockServer(should handle definitions)",
        mockClient as Client
      );

      expect(tools.length).toBe(1);

      const result = await tools[0].invoke({
        user: { name: "John", email: "john@example.com" },
      });

      expect(result).toBe("Created user: John");
    });

    test("should handle deeply nested $ref references", async () => {
      const deeplyNestedSchema = {
        type: "object" as const,
        properties: {
          order: {
            $ref: "#/$defs/Order",
          },
        },
        required: ["order"],
        $defs: {
          Order: {
            type: "object",
            properties: {
              id: { type: "string" },
              customer: {
                $ref: "#/$defs/Customer",
              },
              items: {
                type: "array",
                items: {
                  $ref: "#/$defs/OrderItem",
                },
              },
            },
            required: ["id", "customer", "items"],
          },
          Customer: {
            type: "object",
            properties: {
              name: { type: "string" },
              address: {
                $ref: "#/$defs/Address",
              },
            },
            required: ["name", "address"],
          },
          Address: {
            type: "object",
            properties: {
              street: { type: "string" },
              city: { type: "string" },
            },
            required: ["street", "city"],
          },
          OrderItem: {
            type: "object",
            properties: {
              product: { type: "string" },
              quantity: { type: "integer" },
            },
            required: ["product", "quantity"],
          },
        },
      };

      mockClient.listTools.mockReturnValueOnce(
        Promise.resolve({
          tools: [
            {
              name: "create_order",
              description: "Create an order",
              inputSchema: deeplyNestedSchema,
            },
          ],
        })
      );

      mockClient.callTool.mockImplementation(() => {
        return Promise.resolve({
          content: [
            {
              type: "text",
              text: "Order created successfully",
            },
          ],
        });
      });

      const tools = await loadMcpTools(
        "mockServer(should handle deeply nested refs)",
        mockClient as Client
      );

      expect(tools.length).toBe(1);

      const result = await tools[0].invoke({
        order: {
          id: "order-123",
          customer: {
            name: "Jane Doe",
            address: {
              street: "123 Main St",
              city: "Springfield",
            },
          },
          items: [
            { product: "Widget", quantity: 2 },
            { product: "Gadget", quantity: 1 },
          ],
        },
      });

      expect(result).toBe("Order created successfully");
    });

    test("should load tools with specified response format", async () => {
      // Set up mock response with input schema
      mockClient.listTools.mockReturnValueOnce(
        Promise.resolve({
          tools: [
            {
              name: "tool1",
              description: "Tool 1",
              inputSchema: {
                type: "object",
                properties: {
                  input: { type: "string" },
                },
                required: ["input"],
              },
            },
          ],
        })
      );

      // Load tools with content_and_artifact response format
      const tools = await loadMcpTools(
        "mockServer(should load tools with specified response format)",
        mockClient,
        {}
      );

      // Verify tool was loaded
      expect(tools.length).toBe(1);
      expect((tools[0] as StructuredTool).responseFormat).toBe(
        "content_and_artifact"
      );

      // Mock the call result to check response format handling
      const mockImageContent: ImageContent = {
        type: "image",
        data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", // valid grayscale PNG image
        mimeType: "image/png",
      };

      const mockTextContent: TextContent = {
        type: "text",
        text: "Here is your image",
      };

      const mockEmbeddedResourceContent: EmbeddedResource = {
        type: "resource",
        resource: {
          text: "Here is your image",
          uri: "test-data://test-artifact",
          mimeType: "text/plain",
        },
      };

      const mockContent = [
        mockTextContent,
        mockImageContent,
        mockEmbeddedResourceContent,
      ];

      const expectedContentBlocks: MessageContentComplex[] = [
        {
          type: "text",
          text: "Here is your image",
        },
        {
          type: "image",
          mimeType: "image/png",
          data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        },
      ];

      const expectedArtifacts = [
        {
          type: "resource",
          resource: {
            text: "Here is your image",
            uri: "test-data://test-artifact",
            mimeType: "text/plain",
          },
        },
      ];

      mockClient.callTool.mockReturnValue(
        Promise.resolve({
          content: mockContent,
        })
      );

      // Invoke the tool with proper input matching the schema
      const result = await tools[0].invoke({ input: "test input" });

      // Verify the result
      expect(result).toEqual(expectedContentBlocks);

      const toolCall: NonNullable<AIMessage["tool_calls"]>[number] = {
        args: { input: "test input" },
        name: "mcp__mockServer(should load tools with specified response format)__tool1",
        id: "tool_call_id_123",
        type: "tool_call",
      };

      // call the tool directly via invoke
      const toolMessageResult: ToolMessage = await tools[0].invoke(toolCall);

      expect(toolMessageResult.tool_call_id).toBe(toolCall.id);
      expect(toolMessageResult.content).toEqual(expectedContentBlocks);
      expect(toolMessageResult.artifact).toEqual(expectedArtifacts);
    });

    test("preserves allOf and conditional schemas", async () => {
      // Schema with allOf containing if/then/else (like the bug report)
      const schemaWithAllOf = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object" as const,
        additionalProperties: false,
        allOf: [
          {
            if: {
              properties: {
                allDay: { const: true },
              },
              required: ["allDay"],
            },
            then: {
              properties: {
                endDate: {
                  description: "End date (format yyyy-mm-dd)",
                  type: "string",
                },
                startDate: {
                  description: "Start date (format yyyy-mm-dd)",
                  type: "string",
                },
              },
            },
            else: {
              properties: {
                endDate: {
                  description: "End date & time (RFC3339)",
                  type: "string",
                },
                startDate: {
                  description: "Start date & time (RFC3339)",
                  type: "string",
                },
              },
            },
          },
        ],
        properties: {
          allDay: {
            default: false,
            description: "All day event",
            type: "boolean",
          },
          summary: {
            description: "Title of the event",
            type: "string",
          },
        },
        required: ["summary"],
        unevaluatedProperties: false,
      };

      mockClient.listTools.mockReturnValueOnce(
        Promise.resolve({
          tools: [
            {
              name: "create_event",
              description: "Create calendar event",
              inputSchema: schemaWithAllOf,
            },
          ],
        })
      );

      mockClient.callTool.mockImplementation(() => {
        return Promise.resolve({
          content: [{ type: "text", text: "Event created" }],
        });
      });

      // Discovery preserves the server schema without rewriting it.
      const tools = await loadMcpTools(
        "mockServer(allOf)",
        mockClient as Client
      );

      expect(tools.length).toBe(1);
      expect(tools[0].name).toBe("create_event");

      // Verify the tool works with valid input
      const result = await tools[0].invoke({
        summary: "Test Event",
        allDay: true,
      });

      expect(result).toBe("Event created");
    });

    test("preserves anyOf schemas", async () => {
      // Test anyOf at the TOP level (where OpenAI restriction applies)
      // Note: type: "object" is added to the anyOf items, and the final schema
      // retains the server's top-level object type and alternatives
      const schemaWithAnyOf = {
        type: "object" as const,
        anyOf: [
          {
            type: "object",
            properties: {
              mode: { type: "string" },
              value: { type: "string" },
            },
          },
          {
            type: "object",
            properties: {
              mode: { type: "string" },
              options: { type: "array", items: { type: "string" } },
            },
          },
        ],
      };

      mockClient.listTools.mockReturnValueOnce(
        Promise.resolve({
          tools: [
            {
              name: "configure",
              description: "Configure something",
              inputSchema: schemaWithAnyOf,
            },
          ],
        })
      );

      mockClient.callTool.mockImplementation(() => {
        return Promise.resolve({
          content: [{ type: "text", text: "Configured" }],
        });
      });

      const tools = await loadMcpTools(
        "mockServer(anyOf)",
        mockClient as Client
      );

      expect(tools.length).toBe(1);

      // The input satisfies one of the original schema alternatives.
      const result = await tools[0].invoke({
        mode: "simple",
        value: "test",
      });

      expect(result).toBe("Configured");
    });

    test("preserves exclusive oneOf schemas", async () => {
      // Test oneOf at the TOP level (where OpenAI restriction applies)
      const schemaWithOneOf = {
        type: "object" as const,
        oneOf: [
          {
            type: "object",
            properties: {
              paymentType: { type: "string" },
              cardNumber: { type: "string" },
            },
          },
          {
            type: "object",
            properties: {
              paymentType: { type: "string" },
              accountNumber: { type: "string" },
            },
          },
        ],
      };

      mockClient.listTools.mockReturnValueOnce(
        Promise.resolve({
          tools: [
            {
              name: "process_payment",
              description: "Process a payment",
              inputSchema: schemaWithOneOf,
            },
          ],
        })
      );

      mockClient.callTool.mockImplementation(() => {
        return Promise.resolve({
          content: [{ type: "text", text: "Payment processed" }],
        });
      });

      const tools = await loadMcpTools(
        "mockServer(oneOf)",
        mockClient as Client
      );

      expect(tools.length).toBe(1);

      // Projection can merge variants, but invocation must satisfy exactly one.
      await expect(
        tools[0].invoke({
          paymentType: "credit_card",
          cardNumber: "1234-5678-9012-3456",
        })
      ).rejects.toThrow(ToolInputParsingException);
      expect(mockClient.callTool).not.toHaveBeenCalled();
    });

    test("preserves $schema and unevaluatedProperties in tool schemas", async () => {
      const schemaWithMetadata = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        properties: {
          name: { type: "string" },
        },
        required: ["name"],
        unevaluatedProperties: false,
      } satisfies Tool["inputSchema"];

      mockClient.listTools.mockReturnValueOnce(
        Promise.resolve({
          tools: [
            {
              name: "greet",
              description: "Greet someone",
              inputSchema: schemaWithMetadata,
            },
          ],
        })
      );

      mockClient.callTool.mockImplementation(() => {
        return Promise.resolve({
          content: [{ type: "text", text: "Hello!" }],
        });
      });

      const tools = await loadMcpTools(
        "mockServer(schema preservation)",
        mockClient
      );

      expect(tools.length).toBe(1);
      expect(tools[0].schema).toEqual(schemaWithMetadata);

      const result = await tools[0].invoke({ name: "World" });
      expect(result).toBe("Hello!");
    });

    test("should handle complex real-world schema from bug report #9804", async () => {
      // This is a simplified version of the actual schema from the bug report
      const googleCalendarSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        additionalProperties: false,
        allOf: [
          {
            else: {
              properties: {
                endDate: {
                  description: "End time (RFC3339 format)",
                  title: "End date & time",
                  type: "string",
                },
                startDate: {
                  description: "Start time (RFC3339 format)",
                  title: "Start date & time",
                  type: "string",
                },
              },
            },
            if: {
              properties: {
                allDay: { const: true },
              },
              required: ["allDay"],
            },
            then: {
              properties: {
                endDate: {
                  description: "End date (yyyy-mm-dd format)",
                  title: "End date",
                  type: "string",
                },
                startDate: {
                  description: "Start date (yyyy-mm-dd format)",
                  title: "Start date",
                  type: "string",
                },
              },
            },
          },
        ],
        properties: {
          allDay: {
            default: false,
            description: "All day event",
            title: "All day",
            type: "boolean",
          },
          attendees: {
            description: "The attendees of the event",
            items: {
              additionalProperties: false,
              properties: {
                email: { type: "string" },
                displayName: { type: "string" },
              },
              type: "object",
            },
            type: "array",
          },
          calendarId: {
            description: "The calendar ID",
            type: "string",
          },
          summary: {
            description: "Title of the event",
            type: "string",
          },
          status: {
            description: "Status of the event",
            enum: ["confirmed", "tentative", "cancelled"],
            type: "string",
          },
        },
        required: ["calendarId", "summary", "startDate", "endDate"],
        type: "object" as const,
        unevaluatedProperties: false,
      };

      mockClient.listTools.mockReturnValueOnce(
        Promise.resolve({
          tools: [
            {
              name: "createEvent",
              description: "Create calendar event",
              inputSchema: googleCalendarSchema,
            },
          ],
        })
      );

      mockClient.callTool.mockImplementation(() => {
        return Promise.resolve({
          content: [{ type: "text", text: "Event created successfully" }],
        });
      });

      // This should NOT throw - previously it would fail with OpenAI
      const tools = await loadMcpTools(
        "mockServer(google calendar)",
        mockClient as Client
      );

      expect(tools.length).toBe(1);
      expect(tools[0].name).toBe("createEvent");

      // Projection loads, but the original additionalProperties constraint rejects dates.
      await expect(
        tools[0].invoke({
          calendarId: "primary",
          summary: "Team Meeting",
          startDate: "2024-01-15T10:00:00Z",
          endDate: "2024-01-15T11:00:00Z",
          allDay: false,
          attendees: [{ email: "test@example.com", displayName: "Test User" }],
          status: "confirmed",
        })
      ).rejects.toThrow(ToolInputParsingException);
      expect(mockClient.callTool).not.toHaveBeenCalled();
    });

    test("should handle allOf with multiple schemas to merge", async () => {
      const schemaWithMultipleAllOf = {
        type: "object" as const,
        allOf: [
          {
            properties: {
              firstName: { type: "string" },
            },
            required: ["firstName"],
          },
          {
            properties: {
              lastName: { type: "string" },
            },
            required: ["lastName"],
          },
          {
            properties: {
              email: { type: "string" },
            },
          },
        ],
        properties: {
          id: { type: "string" },
        },
      };

      mockClient.listTools.mockReturnValueOnce(
        Promise.resolve({
          tools: [
            {
              name: "create_user",
              description: "Create a user",
              inputSchema: schemaWithMultipleAllOf,
            },
          ],
        })
      );

      mockClient.callTool.mockImplementation(() => {
        return Promise.resolve({
          content: [{ type: "text", text: "User created" }],
        });
      });

      const tools = await loadMcpTools(
        "mockServer(multiple allOf)",
        mockClient as Client
      );

      expect(tools.length).toBe(1);

      // All properties from allOf should be available
      const result = await tools[0].invoke({
        id: "123",
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      });

      expect(result).toBe("User created");
    });
  });
});
