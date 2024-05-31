import { expect } from "@jest/globals";
import { BaseChatModelCallOptions } from "@langchain/core/language_models/chat_models";
import {
  AIMessage,
  BaseMessageChunk,
  HumanMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { z } from "zod";
import { StructuredTool } from "@langchain/core/tools";
import { BaseChatModelsTests, BaseChatModelsTestsFields } from "../base.js";

const adderSchema = /* #__PURE__ */ z
  .object({
    a: z.number().int().describe("The first integer to add."),
    b: z.number().int().describe("The second integer to add."),
  })
  .describe("Add two integers");

class AdderTool extends StructuredTool {
  name = "AdderTool";

  description = adderSchema.description ?? "description";

  schema = adderSchema;

  async _call(input: z.infer<typeof adderSchema>) {
    const sum = input.a + input.b;
    return JSON.stringify({ result: sum });
  }
}

export abstract class ChatModelIntegrationTests<
  CallOptions extends BaseChatModelCallOptions = BaseChatModelCallOptions,
  OutputMessageType extends BaseMessageChunk = BaseMessageChunk
> extends BaseChatModelsTests<CallOptions, OutputMessageType> {
  constructor(
    fields: BaseChatModelsTestsFields<CallOptions, OutputMessageType>
  ) {
    super(fields);
  }

  async testInvoke() {
    const chatModel = new this.Cls(this.constructorArgs);
    const result = await chatModel.invoke("Hello");
    expect(result).toBeDefined();
    expect(result._getType()).toBe("ai");
    expect(typeof result.content).toBe("string");
    expect(result.content.length).toBeGreaterThan(0);
  }

  async testStream() {
    const chatModel = new this.Cls(this.constructorArgs);
    let numChars = 0;

    for await (const token of await chatModel.stream("Hello")) {
      expect(token).toBeDefined();
      expect(token._getType()).toBe("ai");
      expect(typeof token.content).toBe("string");
      numChars += token.content.length;
    }

    expect(numChars).toBeGreaterThan(0);
  }

  async testBatch() {
    const chatModel = new this.Cls(this.constructorArgs);
    const batchResults = await chatModel.batch(["Hello", "Hey"]);
    expect(batchResults).toBeDefined();
    expect(Array.isArray(batchResults)).toBe(true);
    expect(batchResults.length).toBe(2);
    for (const result of batchResults) {
      expect(result).toBeDefined();
      expect(result._getType()).toBe("ai");
      expect(typeof result.content).toBe("string");
      expect(result.content.length).toBeGreaterThan(0);
    }
  }

  async testConversation() {
    const chatModel = new this.Cls(this.constructorArgs);
    const messages = [
      new HumanMessage("hello"),
      new AIMessage("hello"),
      new HumanMessage("how are you"),
    ];
    const result = await chatModel.invoke(messages);
    expect(result).toBeDefined();
    expect(result).toBeInstanceOf(AIMessage); // Test single, might want to check for _getType() === "ai" instead?
    expect(typeof result.content).toBe("string");
    expect(result.content.length).toBeGreaterThan(0);
  }

  // TODO: merge main to test this
  // async testUsageMetadata() {
  //   const chatModel = new this.Cls(this.constructorArgs);
  //   const result = await chatModel.invoke("Hello");
  //   expect(result).toBeDefined();
  //   expect(result).toBeInstanceOf(AIMessage);
  //   expect(result.usageMetadata).toBeDefined();
  //   expect(typeof result.usageMetadata.inputTokens).toBe("number");
  //   expect(typeof result.usageMetadata.outputTokens).toBe("number");
  //   expect(typeof result.usageMetadata.totalTokens).toBe("number");
  // }

  /**
   * Test that message histories are compatible with string tool contents
   * (e.g. OpenAI).
   * @returns {Promise<void>}
   */
  async testToolMessageHistoriesStringContent() {
    if (!this.chatModelHasToolCalling) {
      console.log("Test requires tool calling. Skipping...");
      return;
    }

    const model = new this.Cls(this.constructorArgs);
    const adderTool = new AdderTool();
    if (!model.bindTools) {
      throw new Error(
        "bindTools undefined. Cannot test tool message histories."
      );
    }
    const modelWithTools = model.bindTools([adderTool]);
    const functionName = adderTool.name;
    const functionArgs = { a: 1, b: 2 };

    const functionId = "abc123";
    const functionResult = await adderTool.invoke(functionArgs);

    const messagesStringContent = [
      new HumanMessage("What is 1 + 2"),
      // string content (e.g. OpenAI)
      new AIMessage({
        content: "",
        tool_calls: [
          {
            name: functionName,
            args: functionArgs,
            id: functionId,
          },
        ],
      }),
      new ToolMessage(functionResult, functionId, functionName),
    ];

    const resultStringContent = await modelWithTools.invoke(
      messagesStringContent
    );
    expect(resultStringContent).toBeInstanceOf(AIMessage);
  }

  /**
   * Test that message histories are compatible with list tool contents
   * (e.g. Anthropic).
   * @returns {Promise<void>}
   */
  async testToolMessageHistoriesListContent() {
    if (!this.chatModelHasToolCalling) {
      console.log("Test requires tool calling. Skipping...");
      return;
    }

    const model = new this.Cls(this.constructorArgs);
    const adderTool = new AdderTool();
    if (!model.bindTools) {
      throw new Error(
        "bindTools undefined. Cannot test tool message histories."
      );
    }
    const modelWithTools = model.bindTools([adderTool]);
    const functionName = adderTool.name;
    const functionArgs = { a: 1, b: 2 };

    const functionId = "abc123";
    const functionResult = await adderTool.invoke(functionArgs);

    const messagesListContent = [
      new HumanMessage("What is 1 + 2"),
      // List content (e.g., Anthropic)
      new AIMessage({
        content: [
          { type: "text", text: "some text" },
          {
            type: "tool_use",
            id: functionId,
            name: functionName,
            input: functionArgs,
          },
        ],
        tool_calls: [
          {
            name: functionName,
            args: functionArgs,
            id: functionId,
          },
        ],
      }),
      new ToolMessage(functionResult, functionId, functionName),
    ];

    const resultListContent = await modelWithTools.invoke(messagesListContent);
    expect(resultListContent).toBeInstanceOf(AIMessage);
  }

  /**
   * Test that model can process few-shot examples with tool calls.
   * @returns {Promise<void>}
   */
  async testStructuredFewShotExamples() {
    if (!this.chatModelHasToolCalling) {
      console.log("Test requires tool calling. Skipping...");
      return;
    }

    const model = new this.Cls(this.constructorArgs);
    const adderTool = new AdderTool();
    if (!model.bindTools) {
      throw new Error("bindTools undefined. Cannot test few-shot examples.");
    }
    const modelWithTools = model.bindTools([adderTool]);
    const functionName = adderTool.name;
    const functionArgs = { a: 1, b: 2 };

    const functionId = "abc123";
    const functionResult = await adderTool.invoke(functionArgs);

    const messagesStringContent = [
      new HumanMessage("What is 1 + 2"),
      new AIMessage({
        content: "",
        tool_calls: [
          {
            name: functionName,
            args: functionArgs,
            id: functionId,
          },
        ],
      }),
      new ToolMessage(functionResult, functionId, functionName),
      new AIMessage(functionResult),
      new HumanMessage("What is 3 + 4"),
    ];

    const resultStringContent = await modelWithTools.invoke(
      messagesStringContent
    );
    expect(resultStringContent).toBeInstanceOf(AIMessage);
  }

  /**
   * TODO:
   * - Add withStructuredOutput tests
   * - Add multi modal standard tests
   */

  /**
   * Run all unit tests for the chat model.
   * Each test is wrapped in a try/catch block to prevent the entire test suite from failing.
   * If a test fails, the error is logged to the console, and the test suite continues.
   * @returns {boolean}
   */
  async runTests(): Promise<boolean> {
    let allTestsPassed = true;

    try {
      await this.testInvoke();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testInvoke failed", e);
    }

    try {
      await this.testStream();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testStream failed", e);
    }

    try {
      await this.testBatch();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testBatch failed", e);
    }

    try {
      await this.testConversation();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testConversation failed", e);
    }

    // TODO: uncomment this when the test is ready
    // try {
    //   await this.testUsageMetadata();
    // } catch (e: any) {
    //   allTestsPassed = false;
    //   console.error("testUsageMetadata failed", e);
    // }

    try {
      await this.testToolMessageHistoriesStringContent();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testToolMessageHistoriesStringContent failed", e);
    }

    try {
      await this.testToolMessageHistoriesListContent();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testToolMessageHistoriesListContent failed", e);
    }

    try {
      await this.testStructuredFewShotExamples();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testStructuredFewShotExamples failed", e);
    }

    return allTestsPassed;
  }
}
