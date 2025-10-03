import { vi, test, expect } from "vitest";
import {
  AIMessage,
  HumanMessage,
  ToolMessage,
  AIMessageChunk,
} from "@langchain/core/messages";
import { z } from "zod";
import { OutputParserException } from "@langchain/core/output_parsers";
import { ChatAnthropic } from "../chat_models.js";
import { _convertMessagesToAnthropicPayload } from "../utils/message_inputs.js";

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
