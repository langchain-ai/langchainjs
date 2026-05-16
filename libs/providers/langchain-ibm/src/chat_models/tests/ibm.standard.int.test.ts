import { ChatModelIntegrationTests } from "@langchain/standard-tests/vitest";
import { AIMessageChunk } from "@langchain/core/messages";
import {
  ChatWatsonx,
  ChatWatsonxCallOptions,
  ChatWatsonxInput,
} from "../ibm.js";

class ChatWatsonxStandardIntegrationTests extends ChatModelIntegrationTests<
  ChatWatsonxCallOptions,
  AIMessageChunk,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ChatWatsonxInput & Record<string, any>
> { 
  constructor() {
    if (!process.env.WATSONX_AI_APIKEY) {
      throw new Error("Cannot run tests. Api key not provided");
    }
    super({
      Cls: ChatWatsonx,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {
        model: "ibm/granite-4-h-small",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
        temperature: 0,
      },
    });
  }

  async testWithStructuredOutput() {
    this.skipTestMessage(
      "testWithStructuredOutput",
      "ChatWatsonx",
      "Assertion ```expect(handler.extraParams)``` is not valid in ChatWatsonx",
    );
  }

  async testWithStructuredOutputIncludeRaw() {
    this.skipTestMessage(
      "testWithStructuredOutputIncludeRaw",
      "ChatWatsonx",
      "Assertion ```expect(handler.extraParams)``` is not valid in ChatWatsonx",
    );
  }
  async testBindToolsWithRunnableToolLike() {
    this.skipTestMessage(
      "testBindToolsWithRunnableToolLike",
      "ChatWatsonx",
      "",
    );
  }
}

const testClass = new ChatWatsonxStandardIntegrationTests();

testClass.runTests();
