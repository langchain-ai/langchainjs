import { test, expect } from "@jest/globals";
import { ChatModelUnitTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { BaseChatModelCallOptions } from "@langchain/core/language_models/chat_models";
import { OciGenAiCohereChat } from "../cohere_chat.js";
import { OciGenAiGenericChat } from "../generic_chat.js";

class OciGenAiCohereChatStandardUnitTests extends ChatModelUnitTests<
  BaseChatModelCallOptions,
  AIMessageChunk
> {
  constructor() {
    super({
      Cls: OciGenAiCohereChat,
      chatModelHasToolCalling: false,
      chatModelHasStructuredOutput: false,
      constructorArgs: {
        compartmentId: "oci.compartment.ocid",
        onDemandModelId: "oci.model.ocid",
      },
    });
  }
}

const ociGenAiCohereTestClass = new OciGenAiCohereChatStandardUnitTests();

test("OciGenAiCohereChatStandardUnitTests", () => {
  const testResults = ociGenAiCohereTestClass.runTests();
  expect(testResults).toBe(true);
});

class OciGenAiGenericChatStandardUnitTests extends ChatModelUnitTests<
  BaseChatModelCallOptions,
  AIMessageChunk
> {
  constructor() {
    super({
      Cls: OciGenAiGenericChat,
      chatModelHasToolCalling: false,
      chatModelHasStructuredOutput: false,
      constructorArgs: {
        compartmentId: "oci.compartment.ocid",
        onDemandModelId: "oci.model.ocid",
      },
    });
  }
}

const ociGenAiGenericTestClass = new OciGenAiGenericChatStandardUnitTests();

test("OciGenAiGenericChatStandardUnitTests", () => {
  const testResults = ociGenAiGenericTestClass.runTests();
  expect(testResults).toBe(true);
});