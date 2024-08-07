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
import {
  convertToConverseMessages,
  handleConverseStreamContentBlockDelta,
} from "../common.js";

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
