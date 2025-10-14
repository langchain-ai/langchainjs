/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelIntegrationTests } from "@langchain/standard-tests";
import { AIMessageChunk, BaseMessage } from "@langchain/core/messages";
import { Serialized } from "@langchain/core/load/serializable";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import { WatsonxAuth } from "../../types/ibm.js";
import {
  ChatWatsonx,
  ChatWatsonxInput,
  WatsonxCallOptionsChat,
  WatsonxCallParams,
} from "../ibm.js";

export class TestCallbackHandler extends BaseCallbackHandler {
  name = "TestCallbackHandler";

  /**
   * Internal array to store extra parameters from each chat model start event.
   * @internal
   */
  _extraParams: Array<Record<string, unknown>> = [];

  /**
   * Returns a single object containing all accumulated extra parameters,
   * merged together. If multiple runs provide extra parameters, later
   * values will overwrite earlier ones for the same keys.
   *
   * @returns {Record<string, unknown>} The merged extra parameters.
   */
  get extraParams(): Record<string, unknown> {
    return this._extraParams.reduce(Object.assign, {});
  }

  handleChatModelStart(
    _llm: Serialized,
    _messages: BaseMessage[][],
    _runId: string,
    _parentRunId?: string,
    extraParams?: Record<string, unknown>,
    _tags?: string[],
    _metadata?: Record<string, unknown>,
    _runName?: string
  ) {
    console.log(extraParams);
    if (extraParams) this._extraParams.push(extraParams);
  }
}

class ChatWatsonxStandardIntegrationTests extends ChatModelIntegrationTests<
  WatsonxCallOptionsChat,
  AIMessageChunk,
  ChatWatsonxInput &
    WatsonxAuth &
    Partial<Omit<WatsonxCallParams, "tool_choice">>
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
        model: "meta-llama/llama-3-3-70b-instruct",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL ?? "testString",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
        temperature: 0,
      },
    });
  }

  async testInvokeMoreComplexTools() {
    this.skipTestMessage(
      "testInvokeMoreComplexTools",
      "ChatWatsonx",
      "Watsonx does not support tool schemas which contain object with unknown/any parameters." +
        "Watsonx only supports objects in schemas when the parameters are defined."
    );
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
