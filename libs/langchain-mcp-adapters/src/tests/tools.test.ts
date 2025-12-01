import { describe, test, expect, beforeEach, vi, MockedObject } from "vitest";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StructuredTool,
  ToolInputParsingException,
} from "@langchain/core/tools";
import type {
  EmbeddedResource,
  ImageContent,
  TextContent,
} from "@modelcontextprotocol/sdk/types.js";
import type {
  AIMessage,
  MessageContentComplex,
  ToolMessage,
} from "@langchain/core/messages";

import { loadMcpTools } from "../tools.js";

vi.mock(
  "@modelcontextprotocol/sdk/client/index.js",
  () => import("./__mocks__/@modelcontextprotocol/sdk/client/index.js")
);
vi.mock(
  "@modelcontextprotocol/sdk/client/stdio.js",
  () => import("./__mocks__/@modelcontextprotocol/sdk/client/stdio.js")
);
vi.mock(
  "@modelcontextprotocol/sdk/client/sse.js",
  () => import("./__mocks__/@modelcontextprotocol/sdk/client/sse.js")
);
vi.mock(
  "@modelcontextprotocol/sdk/client/streamableHttp.js",
  () => import("./__mocks__/@modelcontextprotocol/sdk/client/streamableHttp.js")
);

// Create a mock client
describe("Simplified Tool Adapter Tests", () => {
  let mockClient: MockedObject<Client>;

  beforeEach(() => {
    mockClient = {
      callTool: vi.fn(),
      listTools: vi.fn(),
    } as MockedObject<Client>;

    vi.clearAllMocks();
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

      expect(mockClient.callTool).toHaveBeenCalledWith({
        arguments: {
          city: "New York",
        },
        name: "weather",
      });
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

      expect(mockClient.callTool).toHaveBeenCalledWith({
        arguments: {},
        name: "weather",
      });
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

      // Invoke the tool with valid input matching the dereferenced schema
      const result = await tools[0].invoke({
        items: [{ id: "1", name: "Test", value: 100.0 }],
        metadata: { total_count: 1, timestamp: "2024-01-01" },
      });

      expect(result).toBe("Received 1 items with total_count=1");
      expect(mockClient.callTool).toHaveBeenCalledWith({
        name: "query_data",
        arguments: {
          items: [{ id: "1", name: "Test", value: 100.0 }],
          metadata: { total_count: 1, timestamp: "2024-01-01" },
        },
      });
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
        mockClient as Client
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
          type: "image_url",
          image_url: {
            url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
          },
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
  });
});
