/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from "@jest/globals";
import { ChatModelIntegrationTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatCerebras, ChatCerebrasCallOptions } from "../chat_models.js";

class ChatCerebrasStandardIntegrationTests extends ChatModelIntegrationTests<
  ChatCerebrasCallOptions,
  AIMessageChunk
> {
  constructor() {
    if (!process.env.CEREBRAS_API_KEY) {
      throw new Error(
        "Can not run Cerebras integration tests because CEREBRAS_API_KEY_API_KEY is not set"
      );
    }
    super({
      Cls: ChatCerebras as any,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {
        model: "llama3.1-8b",
        maxRetries: 1,
        temperature: 0,
      },
    });
  }
}

const testClass = new ChatCerebrasStandardIntegrationTests();

test("ChatCerebrasStandardIntegrationTests", async () => {
  console.warn = (..._args: unknown[]) => {
    // no-op
  };
  const testResults = await testClass.runTests();
  expect(testResults).toBe(true);
});
