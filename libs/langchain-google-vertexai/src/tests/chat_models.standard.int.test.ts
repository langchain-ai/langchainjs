/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelIntegrationTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { GoogleAIBaseLanguageModelCallOptions } from "@langchain/google-common";
import { ChatVertexAI } from "../chat_models.js";

class ChatVertexAIStandardIntegrationTests extends ChatModelIntegrationTests<
  GoogleAIBaseLanguageModelCallOptions,
  AIMessageChunk
> {
  constructor() {
    const superValues = {
      Cls: ChatVertexAI,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      supportsParallelToolCalls: true,
      invokeResponseType: AIMessageChunk,
      constructorArgs: {
        model: "gemini-1.5-pro",
      },
    }
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS === "hello") {
      super({
        ...superValues,
        constructorArgs: {
          ...superValues.constructorArgs,
          keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        }
      })
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      // We can not pass in a path to `GOOGLE_APPLICATION_CREDENTIALS` in Github Actions, so instead
      // we must parse it and pass in the credential values directly.
      try {
        const parsedCredentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
        super({
          ...superValues,
          constructorArgs: {
            ...superValues.constructorArgs,
            credentials: {
              client_email: parsedCredentials.client_email,
              private_key: parsedCredentials.private_key,
            }
          }
        })
      } catch (e) {
        console.error("Error parsing GOOGLE_APPLICATION_CREDENTIALS_JSON");
        throw e;
      }
    } else {
      throw new Error(
        "Missing secrets for Google VertexAI standard tests."
      );
    }    
  }

  async testToolMessageHistoriesListContent() {
    this.skipTestMessage(
      "testToolMessageHistoriesListContent",
      "ChatVertexAI",
      "Not implemented."
    );
  }

  async testInvokeMoreComplexTools() {
    this.skipTestMessage(
      "testInvokeMoreComplexTools",
      "ChatVertexAI",
      "Google VertexAI does not support tool schemas which contain object with unknown/any parameters." +
        "Google VertexAI only supports objects in schemas when the parameters are defined."
    );
  }

  async testParallelToolCalling() {
    // Pass `true` in the second argument to only verify it can support parallel tool calls in the message history.
    // This is because the model struggles to actually call parallel tools.
    await super.testParallelToolCalling(undefined, true);
  }
}

const testClass = new ChatVertexAIStandardIntegrationTests();

test("ChatVertexAIStandardIntegrationTests", async () => {
  const testResults = await testClass.runTests();
  expect(testResults).toBe(true);
});
