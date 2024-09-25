import { jest, test } from "@jest/globals";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
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
  jest
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .spyOn(model as any, "invoke")
    .mockResolvedValue(
      new AIMessage({
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
  }).rejects.toThrowError(OutputParserException);
});

test("withStructuredOutput with proper output", async () => {
  const model = new ChatAnthropic({
    modelName: "claude-3-haiku-20240307",
    temperature: 0,
    anthropicApiKey: "testing",
  });
  jest
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

  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const result = await modelWithStructuredOutput.invoke(`
    Enumeration of Kernel Modules via Proc
    Prompt for Credentials with OSASCRIPT
    User Login
    Modification of Standard Authentication Module
    Suspicious Automator Workflows Execution
  `);

  // console.log(result);
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
