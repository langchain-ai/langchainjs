/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelUnitTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { LangSmithParams } from "@langchain/core/language_models/chat_models";
import {
  ChatWatsonx,
  ChatWatsonxInput,
  WatsonxCallOptionsChat,
  WatsonxCallParams,
} from "../ibm.js";
import { WatsonxAuth } from "../../types/ibm.js";

class ChatWatsonxStandardTests extends ChatModelUnitTests<
  WatsonxCallOptionsChat,
  AIMessageChunk,
  ChatWatsonxInput &
    WatsonxAuth &
    Partial<Omit<WatsonxCallParams, "tool_choice">>
> {
  constructor() {
    super({
      Cls: ChatWatsonx,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {
        model: "mistralai/mistral-medium-2505",
        watsonxAIApikey: "testString",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
        watsonxAIAuthType: "iam",
      },
    });
  }

  expectedLsParams(): Partial<LangSmithParams> {
    console.warn(
      "ChatWatsonx does not support stop sequences. Overwrite params."
    );
    return {
      ls_provider: "watsonx",
      ls_model_name: "string",
      ls_model_type: "chat",
      ls_temperature: 0,
      ls_max_tokens: 0,
    };
  }

  async testChatModelInitApiKey() {
    this.skipTestMessage(
      "testChatModelInitApiKey",
      "ChatWatsonx",
      "Watsonx does not support init with apiKey parameter" +
        "Watsonx only supports watsonxApiKey."
    );
  }
}

const testClass = new ChatWatsonxStandardTests();

test("ChatWatsonxStandardTests", () => {
  const testResults = testClass.runTests();
  expect(testResults).toBe(true);
});
