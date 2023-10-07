import { expect, test } from "@jest/globals";
import { ChatOpenAI } from "../openai.js";
import { HumanMessage } from "../../schema/index.js";

// Temporary testing file, test cases here should be merged into other testing files
// before PR.

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
