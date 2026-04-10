import { ChatModelIntegrationTests } from "@langchain/standard-tests/vitest";
import { AIMessageChunk } from "@langchain/core/messages";
import { z } from "zod/v3";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { ChatOpenAICallOptions } from "@langchain/openai";

import { ChatBaseten } from "../chat_models.js";

const adderSchema = z
  .object({
    a: z.number().int().describe("The first integer to add."),
    b: z.number().int().describe("The second integer to add."),
  })
  .describe("Add two integers");

const MATH_ADDITION_PROMPT = ChatPromptTemplate.fromMessages([
  [
    "system",
    "You are bad at math and must ALWAYS call the {toolName} function.",
  ],
  ["human", "What is the sum of 1836281973 and 19973286?"],
]);

class ChatBasetenStandardIntegrationTests extends ChatModelIntegrationTests<
  ChatOpenAICallOptions,
  AIMessageChunk
> {
  constructor() {
    if (!process.env.BASETEN_API_KEY) {
      throw new Error(
        "BASETEN_API_KEY must be set to run standard integration tests."
      );
    }
    super({
      Cls: ChatBaseten,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      supportsParallelToolCalls: true,
      constructorArgs: {
        model: "deepseek-ai/DeepSeek-V3.1",
      },
    });
  }

  async testInvokeMoreComplexTools() {
    this.skipTestMessage(
      "testInvokeMoreComplexTools",
      "ChatBaseten",
      "Baseten models do not support tool schemas with unknown/any parameters."
    );
  }

  async testUsageMetadata() {
    this.skipTestMessage(
      "testUsageMetadata",
      "ChatBaseten",
      "Baseten does not guarantee a `model` field in response_metadata."
    );
  }

  async testWithStructuredOutput() {
    const model = new this.Cls(this.constructorArgs);
    if (!model.withStructuredOutput) {
      throw new Error(
        "withStructuredOutput undefined. Cannot test structured output."
      );
    }

    const modelWithTools = model.withStructuredOutput(adderSchema, {
      name: "math_addition",
    });

    const result = await MATH_ADDITION_PROMPT.pipe(modelWithTools).invoke({
      toolName: "math_addition",
    });

    this.expect(result.a).toBeDefined();
    this.expect(typeof result.a).toBe("number");
    this.expect(result.b).toBeDefined();
    this.expect(typeof result.b).toBe("number");
  }

  async testWithStructuredOutputIncludeRaw() {
    const model = new this.Cls(this.constructorArgs);
    if (!model.withStructuredOutput) {
      throw new Error(
        "withStructuredOutput undefined. Cannot test structured output."
      );
    }

    const modelWithTools = model.withStructuredOutput(adderSchema, {
      includeRaw: true,
      name: "math_addition",
    });

    const result = await MATH_ADDITION_PROMPT.pipe(modelWithTools).invoke({
      toolName: "math_addition",
    });

    this.expect(result.raw).toBeInstanceOf(this.invokeResponseType);
    this.expect(result.parsed.a).toBeDefined();
    this.expect(typeof result.parsed.a).toBe("number");
    this.expect(result.parsed.b).toBeDefined();
    this.expect(typeof result.parsed.b).toBe("number");
  }
}

const testClass = new ChatBasetenStandardIntegrationTests();
testClass.runTests("ChatBasetenStandardIntegrationTests");
