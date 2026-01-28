import { ChatModelIntegrationTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import {
  ChatWatsonx,
  ChatWatsonxCallOptions,
  ChatWatsonxConstructorInput,
} from "../ibm.js";

class ChatWatsonxStandardIntegrationTests extends ChatModelIntegrationTests<
  ChatWatsonxCallOptions,
  AIMessageChunk,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ChatWatsonxConstructorInput & Record<string, any>
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
        model: "ibm/granite-3-2-8b-instruct",
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
      "Assertion ```expect(handler.extraParams)``` is not valid in ChatWatsonx"
    );
  }

  async testWithStructuredOutputIncludeRaw() {
    this.skipTestMessage(
      "testWithStructuredOutputIncludeRaw",
      "ChatWatsonx",
      "Assertion ```expect(handler.extraParams)``` is not valid in ChatWatsonx"
    );
  }
}

const testClass = new ChatWatsonxStandardIntegrationTests();

test("ChatWatsonxStandardIntegrationTests", async () => {
  const testResults = await testClass.runTests();
  expect(testResults).toBe(true);
});
