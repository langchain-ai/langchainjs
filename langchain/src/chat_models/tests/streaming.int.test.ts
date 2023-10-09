import { expect, test } from "@jest/globals";
import { ChatOpenAI } from "../openai.js";
import { HumanMessage } from "../../schema/index.js";

// Temporary testing file, test cases here should be merged into other testing files
// before PR.

test("Test OpenAIChat token usage reporting for streaming function calls", async () => {
  let streamingTokenUsed = -1;
  let nonStreamingTokenUsed = -1;

  const humanMessage = "What a beautiful day!";
  const extractionFunctionSchema = {
    name: "extractor",
    description: "Extracts fields from the input.",
    parameters: {
      type: "object",
      properties: {
        tone: {
          type: "string",
          enum: ["positive", "negative"],
          description: "The overall tone of the input",
        },
        word_count: {
          type: "number",
          description: "The number of words in the input",
        },
        chat_response: {
          type: "string",
          description: "A response to the human's input",
        },
      },
      required: ["tone", "word_count", "chat_response"],
    },
  }

  const streamingModel = new ChatOpenAI({
    modelName: "gpt-4",
    streaming: true,
    maxRetries: 10,
    maxConcurrency: 10,
    temperature: 0,
    callbacks: [
      {
        handleLLMEnd: async (output) => {
          streamingTokenUsed = output.llmOutput?.tokenUsage?.totalTokens;
          console.log("Estimated usage: ", output.llmOutput?.tokenUsage);
        },
        handleLLMError: async (err) => {
          console.error(err);
        },
      },
    ],
  }).bind({
    functions: [extractionFunctionSchema],
    function_call: { name: "extractor" },
  });

  const nonStreamingModel = new ChatOpenAI({
    modelName: "gpt-4",
    streaming: false,
    maxRetries: 10,
    maxConcurrency: 10,
    temperature: 0,
    callbacks: [
      {
        handleLLMEnd: async (output) => {
          nonStreamingTokenUsed = output.llmOutput?.tokenUsage?.totalTokens;
          console.log("Actual usage: ", output.llmOutput?.tokenUsage);
        },
        handleLLMError: async (err) => {
          console.error(err);
        },
      },
    ],
  }).bind({
    functions: [extractionFunctionSchema],
    function_call: { name: "extractor" },
  });

  await Promise.all([
    nonStreamingModel.invoke([new HumanMessage(humanMessage)]),
    streamingModel.invoke([new HumanMessage(humanMessage)]),
  ]);

  expect(streamingTokenUsed).toEqual(nonStreamingTokenUsed);
});

test("Test OpenAIChat token usage reporting for streaming calls", async () => {
  let streamingTokenUsed = -1;
  let nonStreamingTokenUsed = -1;
  const question = "What is the color of the night sky?";

  const streamingModel = new ChatOpenAI({
    modelName: "gpt-3.5-turbo-0301",
    streaming: true,
    maxRetries: 10,
    maxConcurrency: 10,
    temperature: 0,
    callbacks: [
      {
        handleLLMEnd: async (output) => {
          streamingTokenUsed = output.llmOutput?.tokenUsage?.totalTokens;
        },
        handleLLMError: async (err) => {
          console.error(err);
        },
      },
    ],
  });

  const nonStreamingModel = new ChatOpenAI({
    modelName: "gpt-3.5-turbo-0301",
    streaming: false,
    maxRetries: 10,
    maxConcurrency: 10,
    temperature: 0,
    callbacks: [
      {
        handleLLMEnd: async (output) => {
          nonStreamingTokenUsed = output.llmOutput?.tokenUsage?.totalTokens;
        },
        handleLLMError: async (err) => {
          console.error(err);
        },
      },
    ],
  });

  await Promise.all([
    nonStreamingModel.generate([[new HumanMessage(question)]]),
    streamingModel.generate([[new HumanMessage(question)]]),
  ]);

  expect(streamingTokenUsed).toEqual(nonStreamingTokenUsed);
});
