import { test } from "@jest/globals";
import type { HarmBlockThreshold, HarmCategory } from "@google/generative-ai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "../chat_models.js";
import { removeAdditionalProperties } from "../utils/zod_to_genai_parameters.js";
import {
  convertBaseMessagesToContent,
  convertMessageContentToParts,
} from "../utils/common.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractKeys(obj: Record<string, any>, keys: string[] = []) {
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      keys.push(key);
      if (typeof obj[key] === "object" && obj[key] !== null) {
        extractKeys(obj[key], keys);
      }
    }
  }
  return keys;
}

test("Google AI - `temperature` must be in range [0.0,2.0]", async () => {
  expect(
    () =>
      new ChatGoogleGenerativeAI({
        temperature: -1.0,
        model: "gemini-2.0-flash",
      })
  ).toThrow();
  expect(
    () =>
      new ChatGoogleGenerativeAI({
        temperature: 2.1,
        model: "gemini-2.0-flash",
      })
  ).toThrow();
});

test("Google AI - `maxOutputTokens` must be positive", async () => {
  expect(
    () =>
      new ChatGoogleGenerativeAI({
        maxOutputTokens: -1,
        model: "gemini-2.0-flash",
      })
  ).toThrow();
});

test("Google AI - `topP` must be positive", async () => {
  expect(
    () =>
      new ChatGoogleGenerativeAI({
        topP: -1,
        model: "gemini-2.0-flash",
      })
  ).toThrow();
});

test("Google AI - `topP` must be in the range [0,1]", async () => {
  expect(
    () =>
      new ChatGoogleGenerativeAI({
        topP: 3,
        model: "gemini-2.0-flash",
      })
  ).toThrow();
});

test("Google AI - `topK` must be positive", async () => {
  expect(
    () =>
      new ChatGoogleGenerativeAI({
        topK: -1,
        model: "gemini-2.0-flash",
      })
  ).toThrow();
});

test("Google AI - `safetySettings` category array must be unique", async () => {
  expect(
    () =>
      new ChatGoogleGenerativeAI({
        model: "gemini-2.0-flash",
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT" as HarmCategory,
            threshold: "BLOCK_MEDIUM_AND_ABOVE" as HarmBlockThreshold,
          },
          {
            category: "HARM_CATEGORY_HARASSMENT" as HarmCategory,
            threshold: "BLOCK_LOW_AND_ABOVE" as HarmBlockThreshold,
          },
          {
            category: "HARM_CATEGORY_DEROGATORY" as HarmCategory,
            threshold: "BLOCK_ONLY_HIGH" as HarmBlockThreshold,
          },
        ],
      })
  ).toThrow();
});

test("removeAdditionalProperties can remove all instances of additionalProperties", async () => {
  const idealResponseSchema = z.object({
    idealResponse: z
      .string()
      .optional()
      .describe("The ideal response to the question"),
  });
  const questionSchema = z.object({
    question: z.string().describe("Question text"),
    type: z.enum(["singleChoice", "multiChoice"]).describe("Question type"),
    options: z.array(z.string()).describe("List of possible answers"),
    correctAnswer: z
      .string()
      .optional()
      .describe("correct answer from the possible answers"),
    idealResponses: z
      .array(idealResponseSchema)
      .describe("Array of ideal responses to the question"),
  });

  const schema = z.object({
    questions: z.array(questionSchema).describe("Array of question objects"),
  });

  const parsedSchemaArr = removeAdditionalProperties(zodToJsonSchema(schema));
  const arrSchemaKeys = extractKeys(parsedSchemaArr);
  expect(
    arrSchemaKeys.find((key) => key === "additionalProperties")
  ).toBeUndefined();
  const parsedSchemaObj = removeAdditionalProperties(
    zodToJsonSchema(questionSchema)
  );
  const arrSchemaObj = extractKeys(parsedSchemaObj);
  expect(
    arrSchemaObj.find((key) => key === "additionalProperties")
  ).toBeUndefined();

  const analysisSchema = z.object({
    decision: z.enum(["UseAPI", "UseFallback"]),
    explanation: z.string(),
    apiDetails: z
      .object({
        serviceName: z.string(),
        endpointName: z.string(),
        parameters: z.record(z.unknown()),
        extractionPath: z.string(),
      })
      .optional(),
  });
  const parsedAnalysisSchema = removeAdditionalProperties(
    zodToJsonSchema(analysisSchema)
  );
  const analysisSchemaObj = extractKeys(parsedAnalysisSchema);
  expect(
    analysisSchemaObj.find((key) => key === "additionalProperties")
  ).toBeUndefined();
});

test("convertMessageContentToParts correctly handles message types", () => {
  const messages = [
    new SystemMessage("You are a helpful assistant"),
    new HumanMessage("What's the weather like in new york?"),
    new AIMessage({
      content: "",
      tool_calls: [
        {
          name: "get_current_weather",
          args: {
            location: "New York",
          },
          id: "123",
        },
      ],
    }),
    new ToolMessage({
      content: "{ weather: '28 °C', location: 'New York, NY' }",
      name: "get_current_weather",
      tool_call_id: "123",
    }),
  ];
  const messagesAsGoogleParts = messages
    .map((msg, i) =>
      convertMessageContentToParts(msg, false, messages.slice(0, i))
    )
    .flat();
  // console.log(messagesAsGoogleParts);
  expect(messagesAsGoogleParts).toEqual([
    { text: "You are a helpful assistant" },
    { text: "What's the weather like in new york?" },
    {
      functionCall: {
        name: "get_current_weather",
        args: {
          location: "New York",
        },
      },
    },
    {
      functionResponse: {
        name: "get_current_weather",
        response: { result: "{ weather: '28 °C', location: 'New York, NY' }" },
      },
    },
  ]);
});

test("convertBaseMessagesToContent correctly creates properly formatted content", async () => {
  const toolResponse = "{ weather: '28 °C', location: 'New York, NY' }";
  const toolName = "get_current_weather";
  const toolId = "123";
  const toolArgs = {
    location: "New York",
  };
  const messages = [
    new SystemMessage("You are a helpful assistant"),
    new HumanMessage("What's the weather like in new york?"),
    new AIMessage({
      content: "",
      tool_calls: [
        {
          name: toolName,
          args: toolArgs,
          id: toolId,
        },
      ],
    }),
    new ToolMessage({
      content: toolResponse,
      name: toolName,
      tool_call_id: toolId,
    }),
  ];

  const messagesAsGoogleContent = convertBaseMessagesToContent(messages, false);
  // console.log(messagesAsGoogleContent);
  // Google Generative AI API only allows for 'model' and 'user' roles
  // This means that 'system', 'human' and 'tool' messages are converted
  // to 'user' messages, and ai messages are converted to 'model' messages.
  expect(messagesAsGoogleContent).toEqual([
    {
      role: "user",
      parts: [
        { text: "You are a helpful assistant" },
        { text: "What's the weather like in new york?" },
      ],
    },
    {
      role: "model",
      parts: [
        {
          functionCall: {
            name: toolName,
            args: toolArgs,
          },
        },
      ],
    },
    {
      role: "user",
      parts: [
        {
          functionResponse: {
            name: toolName,
            response: { result: toolResponse },
          },
        },
      ],
    },
  ]);
});

test("Input has single system message followed by one user message, convert system message is false", async () => {
  const messages = [
    new SystemMessage("You are a helpful assistant"),
    new HumanMessage("What's the weather like in new york?"),
  ];
  const messagesAsGoogleContent = convertBaseMessagesToContent(
    messages,
    false,
    false
  );

  expect(messagesAsGoogleContent).toEqual([
    {
      role: "user",
      parts: [
        { text: "You are a helpful assistant" },
        { text: "What's the weather like in new york?" },
      ],
    },
  ]);
});

test("Input has a system message that is not the first message, convert system message is false", async () => {
  const messages = [
    new HumanMessage("What's the weather like in new york?"),
    new SystemMessage("You are a helpful assistant"),
  ];
  expect(() => {
    convertBaseMessagesToContent(messages, false, false);
  }).toThrow("System message should be the first one");
});

test("Input has multiple system messages, convert system message is false", async () => {
  const messages = [
    new SystemMessage("You are a helpful assistant"),
    new SystemMessage("You are not a helpful assistant"),
  ];
  expect(() => {
    convertBaseMessagesToContent(messages, false, false);
  }).toThrow("System message should be the first one");
});

test("Input has no system message and one user message, convert system message is false", async () => {
  const messages = [new HumanMessage("What's the weather like in new york?")];
  const messagesAsGoogleContent = convertBaseMessagesToContent(
    messages,
    false,
    false
  );

  expect(messagesAsGoogleContent).toEqual([
    {
      role: "user",
      parts: [{ text: "What's the weather like in new york?" }],
    },
  ]);
});

test("Input has no system message and multiple user message, convert system message is false", async () => {
  const messages = [
    new HumanMessage("What's the weather like in new york?"),
    new HumanMessage("What's the weather like in toronto?"),
    new HumanMessage("What's the weather like in los angeles?"),
  ];
  const messagesAsGoogleContent = convertBaseMessagesToContent(
    messages,
    false,
    false
  );

  expect(messagesAsGoogleContent).toEqual([
    {
      role: "user",
      parts: [{ text: "What's the weather like in new york?" }],
    },
    {
      role: "user",
      parts: [{ text: "What's the weather like in toronto?" }],
    },
    {
      role: "user",
      parts: [{ text: "What's the weather like in los angeles?" }],
    },
  ]);
});

test("Input has single system message followed by one user message, convert system message is true", async () => {
  const messages = [
    new SystemMessage("You are a helpful assistant"),
    new HumanMessage("What's the weather like in new york?"),
  ];

  const messagesAsGoogleContent = convertBaseMessagesToContent(
    messages,
    false,
    true
  );

  expect(messagesAsGoogleContent).toEqual([
    {
      role: "system",
      parts: [{ text: "You are a helpful assistant" }],
    },
    {
      role: "user",
      parts: [{ text: "What's the weather like in new york?" }],
    },
  ]);
});

test("Input has single system message that is not the first message, convert system message is true", async () => {
  const messages = [
    new HumanMessage("What's the weather like in new york?"),
    new SystemMessage("You are a helpful assistant"),
  ];

  expect(() => convertBaseMessagesToContent(messages, false, true)).toThrow(
    "System message should be the first one"
  );
});

test("Input has multiple system message, convert system message is true", async () => {
  const messages = [
    new SystemMessage("What's the weather like in new york?"),
    new SystemMessage("You are a helpful assistant"),
  ];

  expect(() => convertBaseMessagesToContent(messages, false, true)).toThrow(
    "System message should be the first one"
  );
});

test("Input has no system message and one user message, convert system message is true", async () => {
  const messages = [new HumanMessage("What's the weather like in new york?")];

  const messagesAsGoogleContent = convertBaseMessagesToContent(
    messages,
    false,
    true
  );

  expect(messagesAsGoogleContent).toEqual([
    {
      role: "user",
      parts: [{ text: "What's the weather like in new york?" }],
    },
  ]);
});

test("Input has no system message and multiple user messages, convert system message is true", async () => {
  const messages = [
    new HumanMessage("What's the weather like in new york?"),
    new HumanMessage("Will it rain today?"),
    new HumanMessage("How about next week?"),
  ];

  const messagesAsGoogleContent = convertBaseMessagesToContent(
    messages,
    false,
    true
  );

  expect(messagesAsGoogleContent).toEqual([
    {
      role: "user",
      parts: [{ text: "What's the weather like in new york?" }],
    },
    {
      role: "user",
      parts: [{ text: "Will it rain today?" }],
    },
    {
      role: "user",
      parts: [{ text: "How about next week?" }],
    },
  ]);
});

test("convertMessageContentToParts: should handle AIMessage with mixed content and tool_calls, and HumanMessage with mixed content", () => {
  const isMultimodalModel = true;
  const base64ImageData =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="; // 1x1 black pixel

  const aiMessageWithString = new AIMessage({
    content: "This is the AI text response.",
    tool_calls: [
      { name: "get_weather", args: { location: "London" }, id: "tool_123" },
    ],
  });
  const expectedPartsAiString = [
    { text: "This is the AI text response." },
    { functionCall: { name: "get_weather", args: { location: "London" } } },
  ];
  expect(
    convertMessageContentToParts(aiMessageWithString, isMultimodalModel, [])
  ).toEqual(expectedPartsAiString);

  const aiMessageWithArray = new AIMessage({
    content: [
      { type: "text", text: "AI sees this image:" },
      {
        type: "image_url",
        image_url: `data:image/png;base64,${base64ImageData}`,
      },
    ],
    tool_calls: [{ name: "describe_image", args: {}, id: "tool_789" }],
  });
  const expectedPartsAiArray = [
    { text: "AI sees this image:" },
    { inlineData: { mimeType: "image/png", data: base64ImageData } },
    { functionCall: { name: "describe_image", args: {} } },
  ];
  expect(
    convertMessageContentToParts(aiMessageWithArray, isMultimodalModel, [])
  ).toEqual(expectedPartsAiArray);

  const humanMessageWithArray = new HumanMessage({
    content: [
      { type: "text", text: "User sees this image:" },
      {
        type: "image_url",
        image_url: `data:image/png;base64,${base64ImageData}`,
      },
    ],
  });
  const expectedPartsHumanArray = [
    { text: "User sees this image:" },
    { inlineData: { mimeType: "image/png", data: base64ImageData } },
  ];
  expect(
    convertMessageContentToParts(humanMessageWithArray, isMultimodalModel, [])
  ).toEqual(expectedPartsHumanArray);
});

test("convertMessageContentToParts: should handle messages with content only (no tool_calls)", () => {
  const isMultimodalModel = true;

  const aiMessageWithString = new AIMessage({
    content: "Just an AI text response.",
  });
  const expectedPartsAiString = [{ text: "Just an AI text response." }];
  expect(
    convertMessageContentToParts(aiMessageWithString, isMultimodalModel, [])
  ).toEqual(expectedPartsAiString);

  const humanMessageWithString = new HumanMessage({
    content: "Just a human text input.",
  });
  const expectedPartsHumanString = [{ text: "Just a human text input." }];
  expect(
    convertMessageContentToParts(humanMessageWithString, isMultimodalModel, [])
  ).toEqual(expectedPartsHumanString);

  const aiMessageWithArray = new AIMessage({
    content: [
      { type: "text", text: "AI array part 1." },
      { type: "text", text: "AI array part 2." },
    ],
  });
  const expectedPartsAiArray = [
    { text: "AI array part 1." },
    { text: "AI array part 2." },
  ];
  expect(
    convertMessageContentToParts(aiMessageWithArray, isMultimodalModel, [])
  ).toEqual(expectedPartsAiArray);

  const humanMessageWithArray = new HumanMessage({
    content: [
      { type: "text", text: "Human array part 1." },
      { type: "text", text: "Human array part 2." },
    ],
  });
  const expectedPartsHumanArray = [
    { text: "Human array part 1." },
    { text: "Human array part 2." },
  ];
  expect(
    convertMessageContentToParts(humanMessageWithArray, isMultimodalModel, [])
  ).toEqual(expectedPartsHumanArray);
});

test("convertMessageContentToParts: should handle AIMessage with tool_calls only (empty content)", () => {
  const isMultimodalModel = true;

  const messageWithEmptyString = new AIMessage({
    content: "",
    tool_calls: [{ name: "get_time", args: {}, id: "tool_abc" }],
  });
  const expectedParts = [{ functionCall: { name: "get_time", args: {} } }];
  expect(
    convertMessageContentToParts(messageWithEmptyString, isMultimodalModel, [])
  ).toEqual(expectedParts);
});

test("convertMessageContentToParts: should handle ToolMessage correctly (including name inference and errors)", () => {
  const isMultimodalModel = true;

  const previousAiMessage = new AIMessage({
    content: "",
    tool_calls: [
      { name: "get_weather", args: { location: "London" }, id: "tool_123" },
    ],
  });
  const toolMessageSuccess = new ToolMessage({
    content: '{"temperature": "15C", "conditions": "Cloudy"}',
    tool_call_id: "tool_123",
  });
  const expectedPartsSuccess = [
    {
      functionResponse: {
        name: "get_weather",
        response: { result: '{"temperature": "15C", "conditions": "Cloudy"}' },
      },
    },
  ];
  expect(
    convertMessageContentToParts(toolMessageSuccess, isMultimodalModel, [
      previousAiMessage,
    ])
  ).toEqual(expectedPartsSuccess);

  const toolMessageError = new ToolMessage({
    content: "Some result",
    tool_call_id: "unknown_tool_id",
  });
  expect(() =>
    convertMessageContentToParts(toolMessageError, isMultimodalModel, [])
  ).toThrow(
    'Google requires a tool name for each tool call response, and we could not infer a called tool name for ToolMessage "undefined" from your passed messages. Please populate a "name" field on that ToolMessage explicitly.'
  );
});
