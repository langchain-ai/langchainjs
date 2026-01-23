import { vi, test, expect, describe } from "vitest";
import {
  AIMessage,
  HumanMessage,
  ToolMessage,
  AIMessageChunk,
} from "@langchain/core/messages";
import { z } from "zod";
import { z as z4 } from "zod/v4";
import { OutputParserException } from "@langchain/core/output_parsers";
import { tool } from "@langchain/core/tools";
import { ChatAnthropic } from "../chat_models.js";
import {
  _convertMessagesToAnthropicPayload,
  applyCacheControlToPayload,
} from "../utils/message_inputs.js";
import { AnthropicToolExtrasSchema } from "../utils/tools.js";

test("withStructuredOutput with output validation", async () => {
  const model = new ChatAnthropic({
    modelName: "claude-3-haiku-20240307",
    temperature: 0,
    anthropicApiKey: "testing",
  });
  vi.spyOn(model, "invoke").mockResolvedValue(
    new AIMessageChunk({
      content: [
        {
          type: "tool_use",
          id: "notreal",
          name: "Extractor",
          input: "Incorrect string tool call input",
        },
      ],
    })
  );
  const schema = z.object({
    alerts: z
      .array(
        z.object({
          description: z.string().describe("A description of the alert."),
          severity: z
            .enum(["HIGH", "MEDIUM", "LOW"])
            .describe("How severe the alert is."),
        })
      )
      .describe(
        "Important security or infrastructure alerts present in the given text."
      ),
  });

  const modelWithStructuredOutput = model.withStructuredOutput(schema, {
    name: "Extractor",
  });

  await expect(async () => {
    await modelWithStructuredOutput.invoke(`
      Enumeration of Kernel Modules via Proc
      Prompt for Credentials with OSASCRIPT
      User Login
      Modification of Standard Authentication Module
      Suspicious Automator Workflows Execution
    `);
  }).rejects.toThrow(OutputParserException);
});

test("withStructuredOutput with proper output", async () => {
  const model = new ChatAnthropic({
    modelName: "claude-3-haiku-20240307",
    temperature: 0,
    anthropicApiKey: "testing",
  });
  vi
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .spyOn(model as any, "invoke")
    .mockResolvedValue(
      new AIMessage({
        content: [
          {
            type: "tool_use",
            id: "notreal",
            name: "Extractor",
            input: { alerts: [{ description: "test", severity: "LOW" }] },
          },
        ],
      })
    );
  const schema = z.object({
    alerts: z
      .array(
        z.object({
          description: z.string().describe("A description of the alert."),
          severity: z
            .enum(["HIGH", "MEDIUM", "LOW"])
            .describe("How severe the alert is."),
        })
      )
      .describe(
        "Important security or infrastructure alerts present in the given text."
      ),
  });

  const modelWithStructuredOutput = model.withStructuredOutput(schema, {
    name: "Extractor",
  });

  const result = await modelWithStructuredOutput.invoke(`
    Enumeration of Kernel Modules via Proc
    Prompt for Credentials with OSASCRIPT
    User Login
    Modification of Standard Authentication Module
    Suspicious Automator Workflows Execution
  `);

  expect(result).toEqual({
    alerts: [{ description: "test", severity: "LOW" }],
  });
});

test("Can properly format anthropic messages when given two tool results", async () => {
  const messageHistory = [
    new HumanMessage("What is the weather in SF? Also, what is 2 + 2?"),
    new AIMessage({
      content: "",
      tool_calls: [
        {
          name: "get_weather",
          id: "weather_call",
          args: {
            location: "SF",
          },
        },
        {
          name: "calculator",
          id: "calculator_call",
          args: {
            expression: "2 + 2",
          },
        },
      ],
    }),
    new ToolMessage({
      name: "get_weather",
      tool_call_id: "weather_call",
      content: "It is currently 24 degrees with hail in San Francisco.",
    }),
    new ToolMessage({
      name: "calculator",
      tool_call_id: "calculator_call",
      content: "2 + 2 = 4",
    }),
  ];

  const formattedMessages = _convertMessagesToAnthropicPayload(messageHistory);

  expect(formattedMessages).toEqual({
    messages: [
      {
        role: "user",
        content: "What is the weather in SF? Also, what is 2 + 2?",
      },
      {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "weather_call",
            name: "get_weather",
            input: { location: "SF" },
          },
          {
            type: "tool_use",
            id: "calculator_call",
            name: "calculator",
            input: { expression: "2 + 2" },
          },
        ],
      },
      // We passed two separate `ToolMessage`s, but Anthropic expects them to
      // be combined into a single `user` message
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            content: "It is currently 24 degrees with hail in San Francisco.",
            tool_use_id: "weather_call",
          },
          {
            type: "tool_result",
            content: "2 + 2 = 4",
            tool_use_id: "calculator_call",
          },
        ],
      },
    ],
    system: undefined,
  });
});

test("invocationParams includes container when provided in call options", () => {
  const model = new ChatAnthropic({
    modelName: "claude-3-haiku-20240307",
    temperature: 0,
    anthropicApiKey: "testing",
  });

  const params = model.invocationParams({ container: "container_123" });

  expect(params.container).toBe("container_123");
});

test("invocationParams does not include container when not provided", () => {
  const model = new ChatAnthropic({
    modelName: "claude-3-haiku-20240307",
    temperature: 0,
    anthropicApiKey: "testing",
  });

  const params = model.invocationParams({});

  expect(params.container).toBeUndefined();
});

test("invocationParams includes container with thinking enabled", () => {
  const model = new ChatAnthropic({
    modelName: "claude-3-haiku-20240307",
    temperature: 1,
    anthropicApiKey: "testing",
    thinking: { type: "enabled", budget_tokens: 1000 },
  });

  const params = model.invocationParams({ container: "container_456" });

  expect(params.container).toBe("container_456");
  expect(params.thinking).toEqual({ type: "enabled", budget_tokens: 1000 });
});

test("invocationParams returns undefined tools when tools is undefined", () => {
  const model = new ChatAnthropic({
    modelName: "claude-3-haiku",
    temperature: 0,
    apiKey: "testing",
  });

  const params = model.invocationParams({});

  expect(params.tools).toBeUndefined();
});

test("invocationParams returns empty array when tools is empty array", () => {
  const model = new ChatAnthropic({
    modelName: "claude-3-haiku",
    temperature: 0,
    apiKey: "testing",
  });

  const params = model.invocationParams({ tools: [] });

  expect(params.tools).toEqual([]);
});

test("Can properly format messages with container_upload blocks", async () => {
  const messageHistory = [
    new HumanMessage({
      content: [
        { type: "text", text: "Analyze this CSV data" },
        { type: "container_upload", file_id: "file_abc123" },
      ],
    }),
  ];

  const formattedMessages = _convertMessagesToAnthropicPayload(messageHistory);

  expect(formattedMessages).toEqual({
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Analyze this CSV data" },
          { type: "container_upload", file_id: "file_abc123" },
        ],
      },
    ],
    system: undefined,
  });
});

test("Drop content blocks that we don't know how to handle", async () => {
  const messageHistory = [
    new HumanMessage({
      content: [
        { type: "text", text: "Hello" },
        { type: "some-unexpected-block-type", some_unexpected_field: "abc123" },
      ],
    }),
  ];

  const formattedMessages = _convertMessagesToAnthropicPayload(messageHistory);

  expect(formattedMessages).toEqual({
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: "Hello" }],
      },
    ],
    system: undefined,
  });
});

test("Can properly format messages with bash_code_execution_tool_result blocks", async () => {
  const messageHistory = [
    new AIMessage({
      content: [
        {
          type: "server_tool_use",
          id: "bash_call",
          name: "bash_code_execution",
          input: { command: "echo 'hello'" },
        },
        {
          type: "bash_code_execution_tool_result",
          tool_use_id: "bash_call",
          content: {
            type: "bash_code_execution_result",
            stdout: "hello\n",
            stderr: "",
            return_code: 0,
            content: [],
          },
        },
      ],
    }),
  ];

  const formattedMessages = _convertMessagesToAnthropicPayload(messageHistory);

  expect(formattedMessages).toEqual({
    messages: [
      {
        role: "assistant",
        content: [
          {
            type: "server_tool_use",
            id: "bash_call",
            name: "bash_code_execution",
            input: { command: "echo 'hello'" },
          },
          {
            type: "bash_code_execution_tool_result",
            tool_use_id: "bash_call",
            content: {
              type: "bash_code_execution_result",
              stdout: "hello\n",
              stderr: "",
              return_code: 0,
              content: [],
            },
          },
        ],
      },
    ],
    system: undefined,
  });
});

test("Can properly format messages with text_editor_code_execution_tool_result blocks", async () => {
  const messageHistory = [
    new AIMessage({
      content: [
        {
          type: "server_tool_use",
          id: "editor_call",
          name: "text_editor_code_execution",
          input: { command: "view", path: "/tmp/test.txt" },
        },
        {
          type: "text_editor_code_execution_tool_result",
          tool_use_id: "editor_call",
          content: {
            type: "text_editor_code_execution_view_result",
            file_type: "text",
            content: "file contents here",
            num_lines: 1,
            start_line: 1,
            total_lines: 1,
          },
        },
      ],
    }),
  ];

  const formattedMessages = _convertMessagesToAnthropicPayload(messageHistory);

  expect(formattedMessages).toEqual({
    messages: [
      {
        role: "assistant",
        content: [
          {
            type: "server_tool_use",
            id: "editor_call",
            name: "text_editor_code_execution",
            input: { command: "view", path: "/tmp/test.txt" },
          },
          {
            type: "text_editor_code_execution_tool_result",
            tool_use_id: "editor_call",
            content: {
              type: "text_editor_code_execution_view_result",
              file_type: "text",
              content: "file contents here",
              num_lines: 1,
              start_line: 1,
              total_lines: 1,
            },
          },
        ],
      },
    ],
    system: undefined,
  });
});

describe("Tool extras", () => {
  test("extras with defer_loading are merged into tool definitions", () => {
    const getWeather = tool(
      async (input: { location: string }) => {
        return `Weather in ${input.location}`;
      },
      {
        name: "get_weather",
        description: "Get weather for a location.",
        schema: z.object({
          location: z.string(),
        }),
        extras: { defer_loading: true },
      }
    );

    const model = new ChatAnthropic({
      modelName: "claude-3-haiku-20240307",
      anthropicApiKey: "testing",
    });

    const formattedTools = model.formatStructuredToolToAnthropic([getWeather]);

    expect(formattedTools).toBeDefined();
    const weatherTool = formattedTools?.find(
      (t) => "name" in t && t.name === "get_weather"
    );
    expect(weatherTool).toBeDefined();
    expect(weatherTool).toHaveProperty("defer_loading", true);
  });

  test("extras with cache_control are merged into tool definitions", () => {
    const searchFiles = tool(
      async (input: { query: string }) => {
        return `Results for ${input.query}`;
      },
      {
        name: "search_files",
        description: "Search files.",
        schema: z.object({
          query: z.string(),
        }),
        extras: { cache_control: { type: "ephemeral" } },
      }
    );

    const model = new ChatAnthropic({
      modelName: "claude-3-haiku-20240307",
      anthropicApiKey: "testing",
    });

    const formattedTools = model.formatStructuredToolToAnthropic([searchFiles]);

    expect(formattedTools).toBeDefined();
    const searchTool = formattedTools?.find(
      (t) => "name" in t && t.name === "search_files"
    );
    expect(searchTool).toBeDefined();
    expect(searchTool).toHaveProperty("cache_control", { type: "ephemeral" });
  });

  test("extras with input_examples are merged into tool definitions", () => {
    const getWeather = tool(
      async (input: { location: string; unit?: string }) => {
        return `Weather in ${input.location}`;
      },
      {
        name: "get_weather",
        description: "Get weather for a location.",
        schema: z.object({
          location: z.string(),
          unit: z.string().default("fahrenheit"),
        }),
        extras: {
          input_examples: [
            { location: "San Francisco, CA", unit: "fahrenheit" },
            { location: "Tokyo, Japan", unit: "celsius" },
          ],
        },
      }
    );

    const model = new ChatAnthropic({
      modelName: "claude-3-haiku-20240307",
      anthropicApiKey: "testing",
    });

    const formattedTools = model.formatStructuredToolToAnthropic([getWeather]);

    expect(formattedTools).toBeDefined();
    const weatherTool = formattedTools?.find(
      (t) => "name" in t && t.name === "get_weather"
    );
    expect(weatherTool).toBeDefined();
    expect(weatherTool).toHaveProperty("input_examples");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inputExamples = (weatherTool as any).input_examples;
    expect(inputExamples).toHaveLength(2);
    expect(inputExamples[0]).toEqual({
      location: "San Francisco, CA",
      unit: "fahrenheit",
    });
  });

  test("multiple extra fields can be specified together", () => {
    const searchCode = tool(
      async (input: { query: string }) => {
        return `Code for ${input.query}`;
      },
      {
        name: "search_code",
        description: "Search code.",
        schema: z.object({
          query: z.string(),
        }),
        extras: {
          defer_loading: true,
          cache_control: { type: "ephemeral" },
          input_examples: [{ query: "python files" }],
        },
      }
    );

    const model = new ChatAnthropic({
      modelName: "claude-3-haiku-20240307",
      anthropicApiKey: "testing",
    });

    const formattedTools = model.formatStructuredToolToAnthropic([searchCode]);

    expect(formattedTools).toBeDefined();
    const toolDef = formattedTools?.find(
      (t) => "name" in t && t.name === "search_code"
    );
    expect(toolDef).toBeDefined();
    expect(toolDef).toHaveProperty("defer_loading", true);
    expect(toolDef).toHaveProperty("cache_control", { type: "ephemeral" });
    expect(toolDef).toHaveProperty("input_examples");
  });
});

describe("Tool extras validation", () => {
  test("defer_loading with wrong type throws error", () => {
    expect(() => {
      AnthropicToolExtrasSchema.parse({ defer_loading: "not a bool" });
    }).toThrow(z4.ZodError);
  });

  test("input_examples with wrong type throws error", () => {
    expect(() => {
      AnthropicToolExtrasSchema.parse({ input_examples: "not a list" });
    }).toThrow(z4.ZodError);
  });
});

describe("formatStructuredToolToAnthropic", () => {
  test("returns undefined when tools is undefined", () => {
    const model = new ChatAnthropic({
      modelName: "claude-3-haiku-20240307",
      anthropicApiKey: "testing",
    });

    const result = model.formatStructuredToolToAnthropic(undefined);

    expect(result).toBeUndefined();
  });

  test("returns empty array when tools is empty array", () => {
    const model = new ChatAnthropic({
      modelName: "claude-3-haiku-20240307",
      anthropicApiKey: "testing",
    });

    const result = model.formatStructuredToolToAnthropic([]);

    expect(result).toEqual([]);
  });
});

describe("Tool search beta auto-append", () => {
  test("tool_search_tool_regex adds advanced-tool-use beta", () => {
    const getWeather = tool(
      async (input: { location: string }) => {
        return `Weather in ${input.location}`;
      },
      {
        name: "get_weather",
        description: "Get weather for a location.",
        schema: z.object({
          location: z.string(),
        }),
        extras: { defer_loading: true },
      }
    );

    const model = new ChatAnthropic({
      modelName: "claude-3-haiku-20240307",
      anthropicApiKey: "testing",
    });

    // Test that tool_search_tool_regex adds the beta
    const paramsWithToolSearch = model.invocationParams({
      tools: [
        getWeather,
        {
          type: "tool_search_tool_regex_20251119",
          name: "tool_search_tool_regex",
        },
      ],
    });

    expect(paramsWithToolSearch.betas).toBeDefined();
    expect(paramsWithToolSearch.betas).toContain(
      "advanced-tool-use-2025-11-20"
    );
  });

  test("tool_search_tool_bm25 adds advanced-tool-use beta", () => {
    const getWeather = tool(
      async (input: { location: string }) => {
        return `Weather in ${input.location}`;
      },
      {
        name: "get_weather",
        description: "Get weather for a location.",
        schema: z.object({
          location: z.string(),
        }),
      }
    );

    const model = new ChatAnthropic({
      modelName: "claude-3-haiku-20240307",
      anthropicApiKey: "testing",
    });

    const paramsWithBm25 = model.invocationParams({
      tools: [
        getWeather,
        {
          type: "tool_search_tool_bm25_20251119",
          name: "tool_search_tool_bm25",
        },
      ],
    });

    expect(paramsWithBm25.betas).toBeDefined();
    expect(paramsWithBm25.betas).toContain("advanced-tool-use-2025-11-20");
  });

  test("without tool_search the beta is not added", () => {
    const getWeather = tool(
      async (input: { location: string }) => {
        return `Weather in ${input.location}`;
      },
      {
        name: "get_weather",
        description: "Get weather for a location.",
        schema: z.object({
          location: z.string(),
        }),
      }
    );

    const model = new ChatAnthropic({
      modelName: "claude-3-haiku-20240307",
      anthropicApiKey: "testing",
    });

    const paramsWithoutToolSearch = model.invocationParams({
      tools: [getWeather],
    });

    expect(
      paramsWithoutToolSearch.betas === undefined ||
        !paramsWithoutToolSearch.betas.includes("advanced-tool-use-2025-11-20")
    ).toBe(true);
  });
});

describe("Streaming tool call consolidation (input_json_delta handling)", () => {
  test("AIMessage with input_json_delta blocks uses tool_calls for input when index is missing", async () => {
    // This test covers the bug where streaming leaves input_json_delta chunks in content
    // and the index property gets lost during checkpoint serialization.
    // The fix should use tool_calls as the source of truth for tool_use input.
    const messageHistory = [
      new HumanMessage("Use my_tool with prompt 'hello'"),
      new AIMessage({
        content: [
          { type: "text", text: "I'll use the tool..." },
          // Note: no index property (as can happen after checkpoint restoration)
          { type: "tool_use", id: "toolu_01Xyz", name: "my_tool", input: "" },
          // These input_json_delta blocks would have been created during streaming
          { type: "input_json_delta", index: 2, input: '{"prompt": "hel' },
          { type: "input_json_delta", index: 2, input: 'lo"}' },
        ],
        // tool_calls is correctly consolidated from tool_call_chunks
        tool_calls: [
          { id: "toolu_01Xyz", name: "my_tool", args: { prompt: "hello" } },
        ],
      }),
    ];

    const formattedMessages =
      _convertMessagesToAnthropicPayload(messageHistory);

    // The AI message content should have 2 blocks: text and tool_use (no input_json_delta)
    expect(formattedMessages.messages[1].content).toHaveLength(2);

    const [textBlock, toolUseBlock] = formattedMessages.messages[1].content;
    expect(textBlock).toEqual({ type: "text", text: "I'll use the tool..." });
    expect(toolUseBlock).toEqual({
      type: "tool_use",
      id: "toolu_01Xyz",
      name: "my_tool",
      input: { prompt: "hello" }, // Input should come from tool_calls
    });
  });

  test("AIMessage with input_json_delta blocks falls back to index matching when tool_calls is empty", async () => {
    // This tests the fallback behavior when tool_calls is not available
    const messageHistory = [
      new HumanMessage("Use my_tool with prompt 'hello'"),
      new AIMessage({
        content: [
          { type: "text", text: "I'll use the tool..." },
          {
            type: "tool_use",
            id: "toolu_01Xyz",
            name: "my_tool",
            input: "",
            index: 2,
          },
          { type: "input_json_delta", index: 2, input: '{"prompt": "hel' },
          { type: "input_json_delta", index: 2, input: 'lo"}' },
        ],
        // No tool_calls - should fall back to index matching
        tool_calls: [],
      }),
    ];

    const formattedMessages =
      _convertMessagesToAnthropicPayload(messageHistory);

    expect(formattedMessages.messages[1].content).toHaveLength(2);

    const [textBlock, toolUseBlock] = formattedMessages.messages[1].content;
    expect(textBlock).toEqual({ type: "text", text: "I'll use the tool..." });
    expect(toolUseBlock).toEqual({
      type: "tool_use",
      id: "toolu_01Xyz",
      name: "my_tool",
      input: { prompt: "hello" }, // Input should be merged from input_json_delta blocks
    });
  });

  test("Multiple tool calls with input_json_delta blocks are correctly handled", async () => {
    const messageHistory = [
      new HumanMessage("Get weather and calculate"),
      new AIMessage({
        content: [
          { type: "text", text: "Let me help with both tasks" },
          {
            type: "tool_use",
            id: "toolu_weather",
            name: "get_weather",
            input: "",
          },
          { type: "input_json_delta", index: 1, input: '{"location": "SF' },
          { type: "input_json_delta", index: 1, input: '"}' },
          { type: "tool_use", id: "toolu_calc", name: "calculator", input: "" },
          { type: "input_json_delta", index: 2, input: '{"expr": "2+2' },
          { type: "input_json_delta", index: 2, input: '"}' },
        ],
        tool_calls: [
          {
            id: "toolu_weather",
            name: "get_weather",
            args: { location: "SF" },
          },
          { id: "toolu_calc", name: "calculator", args: { expr: "2+2" } },
        ],
      }),
    ];

    const formattedMessages =
      _convertMessagesToAnthropicPayload(messageHistory);

    // Should have 3 blocks: text, 2 tool_use (no input_json_delta blocks)
    expect(formattedMessages.messages[1].content).toHaveLength(3);

    const [textBlock, weatherTool, calcTool] =
      formattedMessages.messages[1].content;
    expect(textBlock).toEqual({
      type: "text",
      text: "Let me help with both tasks",
    });
    expect(weatherTool).toEqual({
      type: "tool_use",
      id: "toolu_weather",
      name: "get_weather",
      input: { location: "SF" },
    });
    expect(calcTool).toEqual({
      type: "tool_use",
      id: "toolu_calc",
      name: "calculator",
      input: { expr: "2+2" },
    });
  });

  test("input_json_delta blocks are filtered out even when tool_use has object input", async () => {
    // Edge case: tool_use already has parsed object input but orphan input_json_delta blocks exist
    const messageHistory = [
      new HumanMessage("Do something"),
      new AIMessage({
        content: [
          { type: "text", text: "Working on it" },
          {
            type: "tool_use",
            id: "toolu_01",
            name: "my_tool",
            input: { prompt: "hello" }, // Already parsed object
          },
          // Orphan input_json_delta blocks (should be filtered out)
          { type: "input_json_delta", index: 1, input: '{"old": "data' },
          { type: "input_json_delta", index: 1, input: '"}' },
        ],
        tool_calls: [
          { id: "toolu_01", name: "my_tool", args: { prompt: "hello" } },
        ],
      }),
    ];

    const formattedMessages =
      _convertMessagesToAnthropicPayload(messageHistory);

    // Should have 2 blocks: text and tool_use (input_json_delta filtered out)
    expect(formattedMessages.messages[1].content).toHaveLength(2);

    const [textBlock, toolUseBlock] = formattedMessages.messages[1].content;
    expect(textBlock).toEqual({ type: "text", text: "Working on it" });
    expect(toolUseBlock).toEqual({
      type: "tool_use",
      id: "toolu_01",
      name: "my_tool",
      input: { prompt: "hello" },
    });
  });
});

describe("ContentBlock.Multimodal.Image format support", () => {
  test("handles new image format with URL", () => {
    const messageHistory = [
      new HumanMessage({
        contentBlocks: [
          {
            type: "image",
            url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/RedDisc.svg/24px-RedDisc.svg.png",
          },
          { type: "text", text: "Describe this image." },
        ],
      }),
    ];

    const formattedMessages =
      _convertMessagesToAnthropicPayload(messageHistory);

    expect(formattedMessages.messages[0].content).toHaveLength(2);
    const [imageBlock, textBlock] = formattedMessages.messages[0].content;

    expect(imageBlock).toEqual({
      type: "image",
      source: {
        type: "url",
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/RedDisc.svg/24px-RedDisc.svg.png",
      },
    });
    expect(textBlock).toEqual({
      type: "text",
      text: "Describe this image.",
    });
  });

  test("handles new image format with base64 data", () => {
    const base64Data =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

    const messageHistory = [
      new HumanMessage({
        contentBlocks: [
          {
            type: "image",
            data: base64Data,
            mimeType: "image/png",
          },
          { type: "text", text: "What is this?" },
        ],
      }),
    ];

    const formattedMessages =
      _convertMessagesToAnthropicPayload(messageHistory);

    expect(formattedMessages.messages[0].content).toHaveLength(2);
    const [imageBlock, textBlock] = formattedMessages.messages[0].content;

    expect(imageBlock).toEqual({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: base64Data,
      },
    });
    expect(textBlock).toEqual({
      type: "text",
      text: "What is this?",
    });
  });

  test("handles new image format with fileId", () => {
    const messageHistory = [
      new HumanMessage({
        contentBlocks: [
          {
            type: "image",
            fileId: "file_abc123",
          },
          { type: "text", text: "Describe this image." },
        ],
      }),
    ];

    const formattedMessages =
      _convertMessagesToAnthropicPayload(messageHistory);

    expect(formattedMessages.messages[0].content).toHaveLength(2);
    const [imageBlock, textBlock] = formattedMessages.messages[0].content;

    expect(imageBlock).toEqual({
      type: "image",
      source: {
        type: "file",
        file_id: "file_abc123",
      },
    });
    expect(textBlock).toEqual({
      type: "text",
      text: "Describe this image.",
    });
  });

  test("handles new image format with Uint8Array data", () => {
    const binaryData = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG header bytes
    const expectedBase64 = Buffer.from(binaryData).toString("base64");

    const messageHistory = [
      new HumanMessage({
        contentBlocks: [
          {
            type: "image",
            data: binaryData,
            mimeType: "image/png",
          },
          { type: "text", text: "What is this?" },
        ],
      }),
    ];

    const formattedMessages =
      _convertMessagesToAnthropicPayload(messageHistory);

    expect(formattedMessages.messages[0].content).toHaveLength(2);
    const [imageBlock, textBlock] = formattedMessages.messages[0].content;

    expect(imageBlock).toEqual({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: expectedBase64,
      },
    });
    expect(textBlock).toEqual({
      type: "text",
      text: "What is this?",
    });
  });

  test("defaults to image/jpeg when mimeType is not provided", () => {
    const base64Data =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

    const messageHistory = [
      new HumanMessage({
        contentBlocks: [
          {
            type: "image",
            data: base64Data,
            // mimeType intentionally omitted
          },
          { type: "text", text: "What is this?" },
        ],
      }),
    ];

    const formattedMessages =
      _convertMessagesToAnthropicPayload(messageHistory);

    expect(formattedMessages.messages[0].content).toHaveLength(2);
    const [imageBlock] = formattedMessages.messages[0].content;

    expect(imageBlock).toEqual({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: base64Data,
      },
    });
  });

  test("preserves cache_control on new image format", () => {
    const messageHistory = [
      new HumanMessage({
        contentBlocks: [
          {
            type: "image",
            url: "https://example.com/image.png",
            cache_control: { type: "ephemeral" },
          },
        ],
      }),
    ];

    const formattedMessages =
      _convertMessagesToAnthropicPayload(messageHistory);

    expect(formattedMessages.messages[0].content).toHaveLength(1);
    const [imageBlock] = formattedMessages.messages[0].content;

    expect(imageBlock).toEqual({
      type: "image",
      source: {
        type: "url",
        url: "https://example.com/image.png",
      },
      cache_control: { type: "ephemeral" },
    });
  });
});

describe("applyCacheControlToPayload", () => {
  const cacheControl = { type: "ephemeral" as const, ttl: "5m" as const };

  test("applies cache_control to the last content block of string content", () => {
    const payload = {
      messages: [
        { role: "user" as const, content: "Hello" },
        { role: "assistant" as const, content: "Hi there!" },
        { role: "user" as const, content: "How are you?" },
      ],
    };

    const result = applyCacheControlToPayload(payload, cacheControl);

    expect(result.messages[2].content).toEqual([
      {
        type: "text",
        text: "How are you?",
        cache_control: cacheControl,
      },
    ]);
    // Other messages should be unchanged
    expect(result.messages[0].content).toBe("Hello");
    expect(result.messages[1].content).toBe("Hi there!");
  });

  test("applies cache_control to the last content block of array content", () => {
    const payload = {
      messages: [
        { role: "user" as const, content: "Hello" },
        {
          role: "assistant" as const,
          content: [
            { type: "text" as const, text: "First block" },
            { type: "text" as const, text: "Second block" },
          ],
        },
      ],
    };

    const result = applyCacheControlToPayload(payload, cacheControl);

    const lastMessage = result.messages[1];
    expect(Array.isArray(lastMessage.content)).toBe(true);
    if (Array.isArray(lastMessage.content)) {
      expect(lastMessage.content[0]).toEqual({
        type: "text",
        text: "First block",
      });
      expect(lastMessage.content[1]).toEqual({
        type: "text",
        text: "Second block",
        cache_control: cacheControl,
      });
    }
  });

  test("applies cache_control to tool_use blocks without corruption", () => {
    const payload = {
      messages: [
        { role: "user" as const, content: "Hello" },
        {
          role: "assistant" as const,
          content: [
            { type: "text" as const, text: "I'll help with that" },
            {
              type: "tool_use" as const,
              id: "tool_123",
              name: "get_weather",
              input: { location: "San Francisco" },
            },
          ],
        },
      ],
    };

    const result = applyCacheControlToPayload(payload, cacheControl);

    const lastMessage = result.messages[1];
    if (Array.isArray(lastMessage.content)) {
      const toolUseBlock = lastMessage.content[1];
      // Verify all original fields are preserved
      expect(toolUseBlock).toHaveProperty("type", "tool_use");
      expect(toolUseBlock).toHaveProperty("id", "tool_123");
      expect(toolUseBlock).toHaveProperty("name", "get_weather");
      expect(toolUseBlock).toHaveProperty("input", {
        location: "San Francisco",
      });
      // And cache_control is added
      expect(toolUseBlock).toHaveProperty("cache_control", cacheControl);
    }
  });

  test("returns unchanged payload when messages array is empty", () => {
    const payload = { messages: [] };

    const result = applyCacheControlToPayload(payload, cacheControl);

    expect(result).toEqual(payload);
  });

  test("handles 1h TTL", () => {
    const payload = {
      messages: [{ role: "user" as const, content: "Hello" }],
    };
    const hourCacheControl = { type: "ephemeral" as const, ttl: "1h" as const };

    const result = applyCacheControlToPayload(payload, hourCacheControl);

    if (Array.isArray(result.messages[0].content)) {
      expect(result.messages[0].content[0]).toHaveProperty(
        "cache_control",
        hourCacheControl
      );
    }
  });
});
