import {
  SystemMessage,
  HumanMessage,
  AIMessage,
  ToolMessage,
  AIMessageChunk,
  BaseMessage,
} from "@langchain/core/messages";
import { concat } from "@langchain/core/utils/stream";
import type {
  Message as BedrockMessage,
  SystemContentBlock as BedrockSystemContentBlock,
} from "@aws-sdk/client-bedrock-runtime";
import { z } from "zod";
import { describe, expect, test } from "@jest/globals";
import {
  convertToConverseMessages,
  handleConverseStreamContentBlockDelta,
} from "../common.js";
import { ChatBedrockConverse } from "../chat_models.js";

describe("convertToConverseMessages", () => {
  const testCases: {
    name: string;
    input: BaseMessage[];
    output: {
      converseMessages: BedrockMessage[];
      converseSystem: BedrockSystemContentBlock[];
    };
  }[] = [
    {
      name: "empty input",
      input: [],
      output: {
        converseMessages: [],
        converseSystem: [],
      },
    },
    {
      name: "simple messages",
      input: [
        new SystemMessage("You're an advanced AI assistant."),
        new HumanMessage(
          "What's the weather like today in Berkeley, CA? Use weather.com to check."
        ),
        new AIMessage({
          content: "",
          tool_calls: [
            {
              name: "retrieverTool",
              args: {
                url: "https://weather.com",
              },
              id: "123_retriever_tool",
            },
          ],
        }),
        new ToolMessage({
          tool_call_id: "123_retriever_tool",
          content: "The weather in Berkeley, CA is 70 degrees and sunny.",
        }),
      ],
      output: {
        converseMessages: [
          {
            role: "user",
            content: [
              {
                text: "What's the weather like today in Berkeley, CA? Use weather.com to check.",
              },
            ],
          },
          {
            role: "assistant",
            content: [
              {
                toolUse: {
                  name: "retrieverTool",
                  toolUseId: "123_retriever_tool",
                  input: {
                    url: "https://weather.com",
                  },
                },
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                toolResult: {
                  toolUseId: "123_retriever_tool",
                  content: [
                    {
                      text: "The weather in Berkeley, CA is 70 degrees and sunny.",
                    },
                  ],
                },
              },
            ],
          },
        ],
        converseSystem: [
          {
            text: "You're an advanced AI assistant.",
          },
        ],
      },
    },
    {
      name: "consecutive user tool messages",
      input: [
        new SystemMessage("You're an advanced AI assistant."),
        new HumanMessage(
          "What's the weather like today in Berkeley, CA and in Paris, France? Use weather.com to check."
        ),
        new AIMessage({
          content: "",
          tool_calls: [
            {
              name: "retrieverTool",
              args: {
                url: "https://weather.com",
              },
              id: "123_retriever_tool",
            },
            {
              name: "retrieverTool",
              args: {
                url: "https://weather.com",
              },
              id: "456_retriever_tool",
            },
          ],
        }),
        new ToolMessage({
          tool_call_id: "123_retriever_tool",
          content: "The weather in Berkeley, CA is 70 degrees and sunny.",
        }),
        new ToolMessage({
          tool_call_id: "456_retriever_tool",
          content: "The weather in Paris, France is perfect.",
        }),
        new HumanMessage(
          "What's the weather like today in Berkeley, CA and in Paris, France? Use meteofrance.com to check."
        ),
        new AIMessage({
          content: "",
          tool_calls: [
            {
              name: "retrieverTool",
              args: {
                url: "https://meteofrance.com",
              },
              id: "321_retriever_tool",
            },
            {
              name: "retrieverTool",
              args: {
                url: "https://meteofrance.com",
              },
              id: "654_retriever_tool",
            },
          ],
        }),
        new ToolMessage({
          tool_call_id: "321_retriever_tool",
          content: "Why don't you check yourself?",
        }),
        new ToolMessage({
          tool_call_id: "654_retriever_tool",
          content: "The weather in Paris, France is horrible.",
        }),
      ],
      output: {
        converseSystem: [
          {
            text: "You're an advanced AI assistant.",
          },
        ],
        converseMessages: [
          {
            role: "user",
            content: [
              {
                text: "What's the weather like today in Berkeley, CA and in Paris, France? Use weather.com to check.",
              },
            ],
          },
          {
            role: "assistant",
            content: [
              {
                toolUse: {
                  name: "retrieverTool",
                  toolUseId: "123_retriever_tool",
                  input: {
                    url: "https://weather.com",
                  },
                },
              },
              {
                toolUse: {
                  name: "retrieverTool",
                  toolUseId: "456_retriever_tool",
                  input: {
                    url: "https://weather.com",
                  },
                },
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                toolResult: {
                  toolUseId: "123_retriever_tool",
                  content: [
                    {
                      text: "The weather in Berkeley, CA is 70 degrees and sunny.",
                    },
                  ],
                },
              },
              {
                toolResult: {
                  toolUseId: "456_retriever_tool",
                  content: [
                    {
                      text: "The weather in Paris, France is perfect.",
                    },
                  ],
                },
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                text: "What's the weather like today in Berkeley, CA and in Paris, France? Use meteofrance.com to check.",
              },
            ],
          },
          {
            role: "assistant",
            content: [
              {
                toolUse: {
                  name: "retrieverTool",
                  toolUseId: "321_retriever_tool",
                  input: {
                    url: "https://meteofrance.com",
                  },
                },
              },
              {
                toolUse: {
                  name: "retrieverTool",
                  toolUseId: "654_retriever_tool",
                  input: {
                    url: "https://meteofrance.com",
                  },
                },
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                toolResult: {
                  toolUseId: "321_retriever_tool",
                  content: [
                    {
                      text: "Why don't you check yourself?",
                    },
                  ],
                },
              },
              {
                toolResult: {
                  toolUseId: "654_retriever_tool",
                  content: [
                    {
                      text: "The weather in Paris, France is horrible.",
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    },
  ];

  it.each(testCases.map((tc) => [tc.name, tc]))(
    "convertToConverseMessages: case %s",
    (_, tc) => {
      const { converseMessages, converseSystem } = convertToConverseMessages(
        tc.input
      );
      expect(converseMessages).toEqual(tc.output.converseMessages);
      expect(converseSystem).toEqual(tc.output.converseSystem);
    }
  );
});

test("Streaming supports empty string chunks", async () => {
  const contentBlocks = [
    {
      contentBlockIndex: 0,
      delta: {
        text: "Hello ",
      },
    },
    {
      contentBlockIndex: 0,
      delta: {
        text: "",
      },
    },
    {
      contentBlockIndex: 0,
      delta: {
        text: "world!",
      },
    },
  ];

  let finalChunk: AIMessageChunk | undefined;
  for (const block of contentBlocks) {
    const chunk = handleConverseStreamContentBlockDelta(block).message;
    finalChunk = !finalChunk ? chunk : concat(finalChunk, chunk);
  }

  expect(finalChunk).toBeDefined();
  if (!finalChunk) return;
  expect(finalChunk.content).toBe("Hello world!");
});

describe("tool_choice works for supported models", () => {
  const tool = {
    name: "weather",
    schema: z.object({
      location: z.string(),
    }),
  };
  const baseConstructorArgs = {
    region: "us-east-1",
    credentials: {
      secretAccessKey: "process.env.BEDROCK_AWS_SECRET_ACCESS_KEY",
      accessKeyId: "process.env.BEDROCK_AWS_ACCESS_KEY_ID",
    },
  };
  const supportsToolChoiceValuesClaude3: Array<"auto" | "any" | "tool"> = [
    "auto",
    "any",
    "tool",
  ];
  const supportsToolChoiceValuesMistralLarge: Array<"auto" | "any" | "tool"> = [
    "auto",
    "any",
  ];

  it("throws an error if passing tool_choice with unsupported models", async () => {
    // Claude 2 should throw
    const claude2Model = new ChatBedrockConverse({
      ...baseConstructorArgs,
      model: "anthropic.claude-v2",
    });
    const claude2WithTool = claude2Model.bindTools([tool], {
      tool_choice: tool.name,
    });
    await expect(claude2WithTool.invoke("foo")).rejects.toThrow();

    // Cohere should throw
    const cohereModel = new ChatBedrockConverse({
      ...baseConstructorArgs,
      model: "cohere.command-text-v14",
    });
    const cohereModelWithTool = cohereModel.bindTools([tool], {
      tool_choice: tool.name,
    });
    await expect(cohereModelWithTool.invoke("foo")).rejects.toThrow();

    // Mistral (not mistral large) should throw
    const mistralModel = new ChatBedrockConverse({
      ...baseConstructorArgs,
      model: "mistral.mistral-7b-instruct-v0:2",
    });
    const mistralModelWithTool = mistralModel.bindTools([tool], {
      tool_choice: tool.name,
    });
    await expect(mistralModelWithTool.invoke("foo")).rejects.toThrow();
  });

  it("does NOT throw and binds tool_choice when calling bindTools with supported models", async () => {
    // Claude 3 should NOT throw
    const claude3Model = new ChatBedrockConverse({
      ...baseConstructorArgs,
      model: "anthropic.claude-3-5-sonnet-20240620-v1:0",
      supportsToolChoiceValues: supportsToolChoiceValuesClaude3,
    });
    const claude3ModelWithTool = claude3Model.bindTools([tool], {
      tool_choice: tool.name,
    });
    expect(claude3ModelWithTool).toBeDefined();
    const claude3ModelWithToolAsJSON = claude3ModelWithTool.toJSON();
    if (!("kwargs" in claude3ModelWithToolAsJSON)) {
      throw new Error("kwargs not found in claude3ModelWithToolAsJSON");
    }
    expect(claude3ModelWithToolAsJSON.kwargs.config).toHaveProperty(
      "tool_choice"
    );
    const { tool_choice: claude3ToolChoice } = claude3ModelWithToolAsJSON.kwargs
      .config as {
      tool_choice: string;
    };
    expect(claude3ToolChoice).toBe(tool.name);

    // Mistral large should NOT throw
    const mistralModel = new ChatBedrockConverse({
      ...baseConstructorArgs,
      model: "mistral.mistral-large-2407-v1:0",
      supportsToolChoiceValues: supportsToolChoiceValuesMistralLarge,
    });
    const mistralModelWithTool = mistralModel.bindTools([tool], {
      tool_choice: tool.name,
    });
    expect(mistralModelWithTool).toBeDefined();
    const mistralModelWithToolAsJSON = mistralModelWithTool.toJSON();
    if (!("kwargs" in mistralModelWithToolAsJSON)) {
      throw new Error("kwargs not found in mistralModelWithToolAsJSON");
    }
    expect(mistralModelWithToolAsJSON.kwargs.config).toHaveProperty(
      "tool_choice"
    );

    const { tool_choice } = mistralModelWithToolAsJSON.kwargs.config as {
      tool_choice: string;
    };
    expect(tool_choice).toBe(tool.name);
  });

  it("should NOT bind and NOT throw when using WSO with unsupported models", async () => {
    // Claude 2 should NOT throw is using WSO
    const claude2Model = new ChatBedrockConverse({
      ...baseConstructorArgs,
      model: "anthropic.claude-v2",
    });
    const claude2ModelWSO = claude2Model.withStructuredOutput(tool.schema, {
      name: tool.name,
    });
    expect(claude2ModelWSO).toBeDefined();
    const claude2ModelWSOAsJSON = claude2ModelWSO.toJSON();
    if (!("kwargs" in claude2ModelWSOAsJSON)) {
      throw new Error("kwargs not found in claude2ModelWSOAsJSON");
    }
    expect(claude2ModelWSOAsJSON.kwargs.bound.first.kwargs).not.toHaveProperty(
      "tool_choice"
    );

    // Cohere should NOT throw is using WSO
    const cohereModel = new ChatBedrockConverse({
      ...baseConstructorArgs,
      model: "cohere.command-text-v14",
    });
    const cohereModelWSO = cohereModel.withStructuredOutput(tool.schema, {
      name: tool.name,
    });
    expect(cohereModelWSO).toBeDefined();
    const cohereModelWSOAsJSON = cohereModelWSO.toJSON();
    if (!("kwargs" in cohereModelWSOAsJSON)) {
      throw new Error("kwargs not found in cohereModelWSOAsJSON");
    }
    expect(cohereModelWSOAsJSON.kwargs.bound.first.kwargs).not.toHaveProperty(
      "tool_choice"
    );

    // Mistral (not mistral large) should NOT throw is using WSO
    const mistralModel = new ChatBedrockConverse({
      ...baseConstructorArgs,
      model: "mistral.mistral-7b-instruct-v0:2",
    });
    const mistralModelWSO = mistralModel.withStructuredOutput(tool.schema, {
      name: tool.name,
    });
    expect(mistralModelWSO).toBeDefined();
    const mistralModelWSOAsJSON = mistralModelWSO.toJSON();
    if (!("kwargs" in mistralModelWSOAsJSON)) {
      throw new Error("kwargs not found in mistralModelWSOAsJSON");
    }
    expect(mistralModelWSOAsJSON.kwargs.bound.first.kwargs).not.toHaveProperty(
      "tool_choice"
    );
  });

  it("should bind tool_choice when using WSO with supported models", async () => {
    // Claude 3 should NOT throw is using WSO & it should have `tool_choice` bound.
    const claude3Model = new ChatBedrockConverse({
      ...baseConstructorArgs,
      model: "anthropic.claude-3-5-sonnet-20240620-v1:0",
      // We are not passing the `supportsToolChoiceValues` arg here as
      // it should be inferred from the model name.
    });
    const claude3ModelWSO = claude3Model.withStructuredOutput(tool.schema, {
      name: tool.name,
    });
    expect(claude3ModelWSO).toBeDefined();
    const claude3ModelWSOAsJSON = claude3ModelWSO.toJSON();
    if (!("kwargs" in claude3ModelWSOAsJSON)) {
      throw new Error("kwargs not found in claude3ModelWSOAsJSON");
    }
    expect(claude3ModelWSOAsJSON.kwargs.bound.first.config).toHaveProperty(
      "tool_choice"
    );
    expect(claude3ModelWSOAsJSON.kwargs.bound.first.config.tool_choice).toBe(
      tool.name
    );

    // Mistral (not mistral large) should NOT throw is using WSO
    const mistralModel = new ChatBedrockConverse({
      ...baseConstructorArgs,
      model: "mistral.mistral-large-2407-v1:0",
      // We are not passing the `supportsToolChoiceValues` arg here as
      // it should be inferred from the model name.
    });
    const mistralModelWSO = mistralModel.withStructuredOutput(tool.schema, {
      name: tool.name,
    });
    expect(mistralModelWSO).toBeDefined();
    const mistralModelWSOAsJSON = mistralModelWSO.toJSON();
    if (!("kwargs" in mistralModelWSOAsJSON)) {
      throw new Error("kwargs not found in mistralModelWSOAsJSON");
    }
    expect(mistralModelWSOAsJSON.kwargs.bound.first.config).toHaveProperty(
      "tool_choice"
    );
    // Mistral large only supports "auto" and "any" for tool_choice, not the actual tool name
    expect(mistralModelWSOAsJSON.kwargs.bound.first.config.tool_choice).toBe(
      "any"
    );
  });
});
