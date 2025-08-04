/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelIntegrationTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { RunnableLambda } from "@langchain/core/runnables";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import { z } from "zod";
import { ChatOllama, ChatOllamaCallOptions } from "../chat_models.js";

const currentWeatherName = "get_current_weather";
const currentWeatherDescription =
  "Get the current weather for a given location.";
const currentWeatherSchema = z
  .object({
    location: z
      .string()
      .describe("The city to get the weather for, e.g. San Francisco"),
  })
  .describe(currentWeatherDescription);

// The function calling tests can be flaky due to the model not invoking a tool.
// If the tool calling tests fail because a tool was not called, retry them.
// If they fail for another reason, there is an actual issue.
class ChatOllamaStandardIntegrationTests extends ChatModelIntegrationTests<
  ChatOllamaCallOptions,
  AIMessageChunk
> {
  constructor() {
    super({
      Cls: ChatOllama,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {
        model: "llama3-groq-tool-use",
      },
    });
  }

  /**
   * Overriding base method because Ollama requires a different
   * prompting method to reliably invoke tools.
   */
  async testWithStructuredOutput() {
    if (!this.chatModelHasStructuredOutput) {
      console.log("Test requires withStructuredOutput. Skipping...");
      return;
    }

    const model = new this.Cls(this.constructorArgs);
    if (!model.withStructuredOutput) {
      throw new Error(
        "withStructuredOutput undefined. Cannot test tool message histories."
      );
    }
    const modelWithTools = model.withStructuredOutput(currentWeatherSchema, {
      name: currentWeatherName,
    });

    const result = await modelWithTools.invoke(
      "What's the weather like today in San Francisco? Use the 'get_current_weather' tool to respond."
    );
    expect(result.location).toBeDefined();
    expect(typeof result.location).toBe("string");
  }

  /**
   * Overriding base method because Ollama requires a different
   * prompting method to reliably invoke tools.
   */
  async testBindToolsWithRunnableToolLike() {
    const model = new ChatOllama(this.constructorArgs);
    const runnableLike = RunnableLambda.from((_) => {
      // no-op
    }).asTool({
      name: currentWeatherName,
      description: currentWeatherDescription,
      schema: currentWeatherSchema,
    });

    const modelWithTools = model.bindTools([runnableLike]);

    const result = await modelWithTools.invoke(
      "What's the weather like today in San Francisco? Use the 'get_current_weather' tool to respond."
    );
    expect(result.tool_calls).toHaveLength(1);
    if (!result.tool_calls) {
      throw new Error("result.tool_calls is undefined");
    }
    const { tool_calls } = result;
    expect(tool_calls[0].name).toBe(currentWeatherName);
  }

  /**
   * Overriding base method because Ollama requires a different
   * prompting method to reliably invoke tools.
   */
  async testBindToolsWithOpenAIFormattedTools() {
    const model = new ChatOllama(this.constructorArgs);

    const modelWithTools = model.bindTools([
      {
        type: "function",
        function: {
          name: currentWeatherName,
          description: currentWeatherDescription,
          parameters: toJsonSchema(currentWeatherSchema),
        },
      },
    ]);

    const result = await modelWithTools.invoke(
      "What's the weather like today in San Francisco? Use the 'get_current_weather' tool to respond."
    );
    expect(result.tool_calls).toHaveLength(1);
    if (!result.tool_calls) {
      throw new Error("result.tool_calls is undefined");
    }
    const { tool_calls } = result;
    expect(tool_calls[0].name).toBe(currentWeatherName);
  }

  /**
   * Overriding base method because Ollama requires a different
   * prompting method to reliably invoke tools.
   */
  async testWithStructuredOutputIncludeRaw() {
    const model = new ChatOllama(this.constructorArgs);

    const modelWithTools = model.withStructuredOutput(currentWeatherSchema, {
      includeRaw: true,
      name: currentWeatherName,
    });

    const result = await modelWithTools.invoke(
      "What's the weather like today in San Francisco? Use the 'get_current_weather' tool to respond."
    );
    expect(result.raw).toBeInstanceOf(this.invokeResponseType);
    expect(result.parsed.location).toBeDefined();
    expect(typeof result.parsed.location).toBe("string");
  }
}

const testClass = new ChatOllamaStandardIntegrationTests();

test("ChatOllamaStandardIntegrationTests", async () => {
  const testResults = await testClass.runTests();
  expect(testResults).toBe(true);
});
