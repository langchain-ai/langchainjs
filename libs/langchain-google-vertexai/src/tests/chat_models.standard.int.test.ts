/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelIntegrationTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { GoogleAIBaseLanguageModelCallOptions } from "@langchain/google-common";
import fs from "fs";
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
    };
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS === "true") {
      super({
        ...superValues,
        constructorArgs: {
          ...superValues.constructorArgs,
          keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        },
      });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      try {
        // If this env var is set we're running in a CI environment and need to
        // write the credentials to a file. The `credentials.json` file will be
        // removed at the end of the test.
        const newCredentialsPath = "./credentials.json";
        fs.writeFileSync(
          newCredentialsPath,
          process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
        );
        super({
          ...superValues,
          constructorArgs: {
            ...superValues.constructorArgs,
            keyFile: newCredentialsPath,
          },
        });
      } catch (e) {
        console.error("Error writing credentials file.");
        throw e;
      }
    } else {
      throw new Error("Missing secrets for Google VertexAI standard tests.");
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

  cleanup() {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      // If this env var is present, it means we're running in a CI
      // environment and we need to clean up the credentials file.
      fs.unlinkSync("./credentials.json");
    }
  }
}

const testClass = new ChatVertexAIStandardIntegrationTests();

test("ChatVertexAIStandardIntegrationTests", async () => {
  try {
    const testResults = await testClass.runTests();
    expect(testResults).toBe(true);
  } finally {
    testClass.cleanup();
  }
});
