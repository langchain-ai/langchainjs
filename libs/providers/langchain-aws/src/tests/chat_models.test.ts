import {
  SystemMessage,
  HumanMessage,
  AIMessage,
  ToolMessage,
  BaseMessage,
  BaseMessageChunk,
} from "@langchain/core/messages";
import { concat } from "@langchain/core/utils/stream";
import {
  ConversationRole as BedrockConversationRole,
  BedrockRuntimeClient,
  type Message as BedrockMessage,
  type SystemContentBlock as BedrockSystemContentBlock,
  ServiceTierType,
} from "@aws-sdk/client-bedrock-runtime";
import { z } from "zod/v3";
import { describe, expect, test, it, vi } from "vitest";
import { convertToConverseMessages } from "../utils/message_inputs.js";
import { handleConverseStreamContentBlockDelta } from "../utils/message_outputs.js";
import { ChatBedrockConverse } from "../chat_models.js";
import { load } from "@langchain/core/load";

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
            role: BedrockConversationRole.USER,
            content: [
              {
                text: "What's the weather like today in Berkeley, CA? Use weather.com to check.",
              },
            ],
          },
          {
            role: BedrockConversationRole.ASSISTANT,
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
            role: BedrockConversationRole.USER,
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
      name: "prompt caching",
      input: [
        new SystemMessage({
          content: [
            { type: "text", text: "You're an advanced AI assistant." },
            {
              type: "cache_point",
              cachePoint: {
                type: "default",
              },
            },
            {
              type: "text",
              text: "Answer the user's questions using your own knowledge or provided tool.",
            },
          ],
        }),
        new HumanMessage({
          content: [
            {
              type: "text",
              text: "What is the capital of France?",
            },
            {
              type: "cache_point",
              cachePoint: {
                type: "default",
              },
            },
            {
              type: "text",
              text: "And what is the capital of Germany?",
            },
          ],
        }),
        new AIMessage({
          content: [
            {
              type: "text",
              text: "Sure! The capital of France is Paris.",
            },
            {
              type: "cache_point",
              cachePoint: {
                type: "default",
              },
            },
            {
              type: "text",
              text: "The capital of Germany is Berlin.",
            },
          ],
        }),
      ],
      output: {
        converseMessages: [
          {
            role: BedrockConversationRole.USER,
            content: [
              {
                text: "What is the capital of France?",
              },
              {
                cachePoint: {
                  type: "default",
                },
              },
              {
                text: "And what is the capital of Germany?",
              },
            ],
          },
          {
            role: BedrockConversationRole.ASSISTANT,
            content: [
              {
                text: "Sure! The capital of France is Paris.",
              },
              {
                cachePoint: {
                  type: "default",
                },
              },
              {
                text: "The capital of Germany is Berlin.",
              },
            ],
          },
        ],
        converseSystem: [
          {
            text: "You're an advanced AI assistant.",
          },
          {
            cachePoint: {
              type: "default",
            },
          },
          {
            text: "Answer the user's questions using your own knowledge or provided tool.",
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
            role: BedrockConversationRole.USER,
            content: [
              {
                text: "What's the weather like today in Berkeley, CA and in Paris, France? Use weather.com to check.",
              },
            ],
          },
          {
            role: BedrockConversationRole.ASSISTANT,
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
            role: BedrockConversationRole.USER,
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
            role: BedrockConversationRole.USER,
            content: [
              {
                text: "What's the weather like today in Berkeley, CA and in Paris, France? Use meteofrance.com to check.",
              },
            ],
          },
          {
            role: BedrockConversationRole.ASSISTANT,
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
            role: BedrockConversationRole.USER,
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
    {
      name: "standard v1 format with tool_call blocks (e.g., from Anthropic provider)",
      input: [
        new SystemMessage("You're an advanced AI assistant."),
        new HumanMessage("What's the weather in SF?"),
        new AIMessage({
          content: [
            { type: "text", text: "Let me check the weather for you." },
            {
              type: "tool_call",
              id: "call_123",
              name: "get_weather",
              args: { location: "San Francisco" },
            },
          ],
          response_metadata: {
            output_version: "v1",
            model_provider: "anthropic",
          },
        }),
        new ToolMessage({
          tool_call_id: "call_123",
          content: "72°F and sunny",
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
            role: BedrockConversationRole.USER,
            content: [
              {
                text: "What's the weather in SF?",
              },
            ],
          },
          {
            role: BedrockConversationRole.ASSISTANT,
            content: [
              {
                text: "Let me check the weather for you.",
              },
              {
                toolUse: {
                  toolUseId: "call_123",
                  name: "get_weather",
                  input: { location: "San Francisco" },
                },
              },
            ],
          },
          {
            role: BedrockConversationRole.USER,
            content: [
              {
                toolResult: {
                  toolUseId: "call_123",
                  content: [
                    {
                      text: "72°F and sunny",
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    },
    {
      name: "standard v1 format with reasoning blocks (e.g., from Anthropic provider)",
      input: [
        new SystemMessage("You're an advanced AI assistant."),
        new HumanMessage("What is 2+2?"),
        new AIMessage({
          content: [
            {
              type: "reasoning",
              reasoning: "I need to add 2 and 2 together.",
            },
            { type: "text", text: "The answer is 4." },
          ],
          response_metadata: {
            output_version: "v1",
            model_provider: "anthropic",
          },
        }),
        new HumanMessage("Thanks! What about 3+3?"),
      ],
      output: {
        converseSystem: [
          {
            text: "You're an advanced AI assistant.",
          },
        ],
        converseMessages: [
          {
            role: BedrockConversationRole.USER,
            content: [
              {
                text: "What is 2+2?",
              },
            ],
          },
          {
            role: BedrockConversationRole.ASSISTANT,
            content: [
              {
                reasoningContent: {
                  reasoningText: {
                    text: "I need to add 2 and 2 together.",
                  },
                },
              },
              {
                text: "The answer is 4.",
              },
            ],
          },
          {
            role: BedrockConversationRole.USER,
            content: [
              {
                text: "Thanks! What about 3+3?",
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
        text: "Hello",
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
        text: " ",
      },
    },
    {
      contentBlockIndex: 0,
      delta: {
        text: "world!",
      },
    },
  ];

  let finalChunk: BaseMessageChunk | undefined;
  for (const block of contentBlocks) {
    const chunk = handleConverseStreamContentBlockDelta(block).message;
    finalChunk = !finalChunk ? chunk : concat(finalChunk, chunk);
  }

  expect(finalChunk).toBeDefined();
  if (!finalChunk) return;
  expect(finalChunk.content).toBe("Hello world!");
});

describe("applicationInferenceProfile parameter", () => {
  const baseConstructorArgs = {
    region: "us-east-1",
    credentials: {
      secretAccessKey: "test-secret-key",
      accessKeyId: "test-access-key",
    },
  };

  it("should initialize applicationInferenceProfile from constructor", () => {
    const testArn =
      "arn:aws:bedrock:eu-west-1:123456789012:application-inference-profile/test-profile";
    const model = new ChatBedrockConverse({
      ...baseConstructorArgs,
      model: "anthropic.claude-3-haiku-20240307-v1:0",
      applicationInferenceProfile: testArn,
    });
    expect(model.model).toBe("anthropic.claude-3-haiku-20240307-v1:0");
    expect(model.applicationInferenceProfile).toBe(testArn);
  });

  it("should be undefined when not provided in constructor", () => {
    const model = new ChatBedrockConverse({
      ...baseConstructorArgs,
      model: "anthropic.claude-3-haiku-20240307-v1:0",
    });

    expect(model.model).toBe("anthropic.claude-3-haiku-20240307-v1:0");
    expect(model.applicationInferenceProfile).toBeUndefined();
  });

  it("should send applicationInferenceProfile as modelId in ConverseCommand when provided", async () => {
    const testArn =
      "arn:aws:bedrock:eu-west-1:123456789012:application-inference-profile/test-profile";
    const mockSend = vi.fn().mockResolvedValue({
      output: {
        message: {
          role: "assistant",
          content: [{ text: "Test response" }],
        },
      },
      stopReason: "end_turn",
      usage: {
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
      },
    });

    const mockClient = {
      send: mockSend,
    } as unknown as BedrockRuntimeClient;

    const model = new ChatBedrockConverse({
      ...baseConstructorArgs,
      model: "anthropic.claude-3-haiku-20240307-v1:0",
      applicationInferenceProfile: testArn,
      client: mockClient,
    });

    await model.invoke([new HumanMessage("Hello")]);

    // Verify that send was called
    expect(mockSend).toHaveBeenCalledTimes(1);

    // Verify that the command was created with applicationInferenceProfile as modelId
    const commandArg = mockSend.mock.calls[0][0];
    expect(commandArg.input.modelId).toBe(testArn);
    expect(commandArg.input.modelId).not.toBe(
      "anthropic.claude-3-haiku-20240307-v1:0"
    );
  });

  it("should send model as modelId in ConverseCommand when applicationInferenceProfile is not provided", async () => {
    const mockSend = vi.fn().mockResolvedValue({
      output: {
        message: {
          role: "assistant",
          content: [{ text: "Test response" }],
        },
      },
      stopReason: "end_turn",
      usage: {
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
      },
    });

    const mockClient = {
      send: mockSend,
    } as unknown as BedrockRuntimeClient;

    const model = new ChatBedrockConverse({
      ...baseConstructorArgs,
      model: "anthropic.claude-3-haiku-20240307-v1:0",
      client: mockClient,
    });

    await model.invoke([new HumanMessage("Hello")]);

    // Verify that send was called
    expect(mockSend).toHaveBeenCalledTimes(1);

    // Verify that the command was created with model as modelId
    const commandArg = mockSend.mock.calls[0][0];
    expect(commandArg.input.modelId).toBe(
      "anthropic.claude-3-haiku-20240307-v1:0"
    );
  });

  it("should send applicationInferenceProfile as modelId in ConverseStreamCommand when provided", async () => {
    const testArn =
      "arn:aws:bedrock:eu-west-1:123456789012:application-inference-profile/test-profile";
    const mockSend = vi.fn().mockResolvedValue({
      stream: (async function* () {
        yield {
          contentBlockDelta: {
            contentBlockIndex: 0,
            delta: { text: "Test" },
          },
        };
        yield {
          metadata: {
            usage: {
              inputTokens: 10,
              outputTokens: 5,
              totalTokens: 15,
            },
          },
        };
      })(),
    });

    const mockClient = {
      send: mockSend,
    } as unknown as BedrockRuntimeClient;

    const model = new ChatBedrockConverse({
      ...baseConstructorArgs,
      model: "anthropic.claude-3-haiku-20240307-v1:0",
      applicationInferenceProfile: testArn,
      streaming: true,
      client: mockClient,
    });

    await model.invoke([new HumanMessage("Hello")]);

    expect(mockSend).toHaveBeenCalledTimes(1);

    const commandArg = mockSend.mock.calls[0][0];
    expect(commandArg.input.modelId).toBe(testArn);
    expect(commandArg.input.modelId).not.toBe(
      "anthropic.claude-3-haiku-20240307-v1:0"
    );
  });

  it("should send model as modelId in ConverseStreamCommand when applicationInferenceProfile is not provided", async () => {
    const mockSend = vi.fn().mockResolvedValue({
      stream: (async function* () {
        yield {
          contentBlockDelta: {
            contentBlockIndex: 0,
            delta: { text: "Test" },
          },
        };
        yield {
          metadata: {
            usage: {
              inputTokens: 10,
              outputTokens: 5,
              totalTokens: 15,
            },
          },
        };
      })(),
    });

    const mockClient = {
      send: mockSend,
    } as unknown as BedrockRuntimeClient;

    const model = new ChatBedrockConverse({
      ...baseConstructorArgs,
      model: "anthropic.claude-3-haiku-20240307-v1:0",
      streaming: true,
      client: mockClient,
    });

    await model.invoke([new HumanMessage("Hello")]);

    expect(mockSend).toHaveBeenCalledTimes(1);

    const commandArg = mockSend.mock.calls[0][0];
    expect(commandArg.input.modelId).toBe(
      "anthropic.claude-3-haiku-20240307-v1:0"
    );
  });
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

  it.each([
    "anthropic.claude-3-5-sonnet-20240620-v1:0",
    "anthropic.claude-sonnet-4-20250514-v1:0",
  ])(
    "should bind tool_choice when using WSO with model that supports tool choice: %s",
    (model) => {
      // Claude 3 should NOT throw is using WSO & it should have `tool_choice` bound.
      const claude3Model = new ChatBedrockConverse({
        ...baseConstructorArgs,
        model,
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
    }
  );

  it.each(["mistral.mistral-large-2407-v1:0"])(
    "should bind tool_choice when using WSO with model that doesn't support tool choice: %s",
    (model) => {
      // Mistral (not mistral large) should NOT throw is using WSO
      const mistralModel = new ChatBedrockConverse({
        ...baseConstructorArgs,
        model,
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
    }
  );
});

test("Test ChatBedrockConverse deserialization from model_id and region_name", async () => {
  delete process.env.AWS_ACCESS_KEY_ID;
  delete process.env.AWS_SECRET_ACCESS_KEY;
  delete process.env.AWS_DEFAULT_REGION;

  // Simulate a serialized ChatBedrockConverse with Python naming (model_id, region_name)
  // This matches the format that LangSmith Hub stores prompts with model configuration
  const serialized = JSON.stringify({
    lc: 1,
    type: "constructor",
    id: [
      "langchain",
      "chat_models",
      "chat_bedrock_converse",
      "ChatBedrockConverse",
    ],
    kwargs: {
      model_id: "anthropic.claude-3-sonnet-20240229-v1:0",
      region_name: "us-west-2",
      temperature: 0.7,
      credentials: {
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
      },
    },
  });

  const loaded = await load<ChatBedrockConverse>(serialized, {
    importMap: {
      chat_models__chat_bedrock_converse: { ChatBedrockConverse },
    },
  });

  // Verify deserialization correctly maps model_id -> model and region_name -> region
  expect(loaded).toBeInstanceOf(ChatBedrockConverse);
  expect(loaded.model).toBe("anthropic.claude-3-sonnet-20240229-v1:0");
  expect(loaded.region).toBe("us-west-2");
  expect(loaded.temperature).toBe(0.7);
});

describe("serviceTier configuration", () => {
  const baseConstructorArgs = {
    region: "us-east-1",
    credentials: {
      secretAccessKey: "process.env.BEDROCK_AWS_SECRET_ACCESS_KEY",
      accessKeyId: "process.env.BEDROCK_AWS_ACCESS_KEY_ID",
    },
  };

  it("should set serviceTier in constructor", () => {
    const model = new ChatBedrockConverse({
      ...baseConstructorArgs,
      serviceTier: "priority",
    });
    expect(model.serviceTier).toBe("priority");
  });

  it("should set serviceTier as undefined when not provided", () => {
    const model = new ChatBedrockConverse({
      ...baseConstructorArgs,
    });
    expect(model.serviceTier).toBeUndefined();
  });

  it.each(["priority", "default", "flex", "reserved"])(
    "should include serviceTier in invocationParams when set to %s",
    (serviceTier) => {
      const model = new ChatBedrockConverse({
        ...baseConstructorArgs,
        serviceTier: serviceTier as ServiceTierType,
      });
      const params = model.invocationParams({});
      expect(params.serviceTier).toEqual({ type: serviceTier });
    }
  );

  it("should not include serviceTier in invocationParams when not set", () => {
    const model = new ChatBedrockConverse({
      ...baseConstructorArgs,
    });
    const params = model.invocationParams({});
    expect(params.serviceTier).toBeUndefined();
  });

  it("should override serviceTier from call options in invocationParams", () => {
    const model = new ChatBedrockConverse({
      ...baseConstructorArgs,
      serviceTier: "default",
    });
    const params = model.invocationParams({
      serviceTier: "priority",
    });
    expect(params.serviceTier).toEqual({ type: "priority" });
  });

  it("should use class-level serviceTier when call options don't override it", () => {
    const model = new ChatBedrockConverse({
      ...baseConstructorArgs,
      serviceTier: "flex",
    });
    const params = model.invocationParams({});
    expect(params.serviceTier).toEqual({ type: "flex" });
  });

  it("should handle serviceTier in invocationParams with other config options", () => {
    const model = new ChatBedrockConverse({
      ...baseConstructorArgs,
      serviceTier: "reserved",
      temperature: 0.5,
      maxTokens: 100,
    });
    const params = model.invocationParams({
      stop: ["stop_sequence"],
    });
    expect(params.serviceTier).toEqual({ type: "reserved" });
    expect(params.inferenceConfig?.temperature).toBe(0.5);
    expect(params.inferenceConfig?.maxTokens).toBe(100);
    expect(params.inferenceConfig?.stopSequences).toEqual(["stop_sequence"]);
  });
});
