import { expect } from "@jest/globals";
import { BaseChatModelCallOptions } from "@langchain/core/language_models/chat_models";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessageChunk,
  HumanMessage,
  ToolMessage,
  UsageMetadata,
  getBufferString,
} from "@langchain/core/messages";
import { z } from "zod";
import { StructuredTool, tool } from "@langchain/core/tools";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableLambda } from "@langchain/core/runnables";
import { concat } from "@langchain/core/utils/stream";
import {
  BaseChatModelsTests,
  BaseChatModelsTestsFields,
  RecordStringAny,
} from "../base.js";

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

const MATH_ADDITION_PROMPT = /* #__PURE__ */ ChatPromptTemplate.fromMessages([
  [
    "system",
    "You are bad at math and must ALWAYS call the {toolName} function.",
  ],
  ["human", "What is the sum of 1836281973 and 19973286?"],
]);

interface ChatModelIntegrationTestsFields<
  CallOptions extends BaseChatModelCallOptions = BaseChatModelCallOptions,
  OutputMessageType extends BaseMessageChunk = BaseMessageChunk,
  ConstructorArgs extends RecordStringAny = RecordStringAny
> extends BaseChatModelsTestsFields<
    CallOptions,
    OutputMessageType,
    ConstructorArgs
  > {
  /**
   * Override the default AIMessage response type
   * to check for.
   * @default AIMessage
   */
  invokeResponseType?: typeof AIMessage | typeof AIMessageChunk;
  /**
   * The ID to set for function calls.
   * Set this field to override the default function ID.
   * @default "abc123"
   */
  functionId?: string;
}

export abstract class ChatModelIntegrationTests<
  CallOptions extends BaseChatModelCallOptions = BaseChatModelCallOptions,
  OutputMessageType extends BaseMessageChunk = BaseMessageChunk,
  ConstructorArgs extends RecordStringAny = RecordStringAny
> extends BaseChatModelsTests<CallOptions, OutputMessageType, ConstructorArgs> {
  functionId = "abc123";

  invokeResponseType: typeof AIMessage | typeof AIMessageChunk = AIMessage;

  constructor(
    fields: ChatModelIntegrationTestsFields<
      CallOptions,
      OutputMessageType,
      ConstructorArgs
    >
  ) {
    super(fields);
    this.functionId = fields.functionId ?? this.functionId;
    this.invokeResponseType =
      fields.invokeResponseType ?? this.invokeResponseType;
  }

  async testInvoke(
    callOptions?: InstanceType<this["Cls"]>["ParsedCallOptions"]
  ) {
    const chatModel = new this.Cls(this.constructorArgs);
    const result = await chatModel.invoke("Hello", callOptions);
    expect(result).toBeDefined();
    expect(result).toBeInstanceOf(this.invokeResponseType);
    expect(typeof result.content).toBe("string");
    expect(result.content.length).toBeGreaterThan(0);
  }

  async testStream(
    callOptions?: InstanceType<this["Cls"]>["ParsedCallOptions"]
  ) {
    const chatModel = new this.Cls(this.constructorArgs);
    let numChars = 0;

    for await (const token of await chatModel.stream("Hello", callOptions)) {
      expect(token).toBeDefined();
      expect(token).toBeInstanceOf(AIMessageChunk);
      expect(typeof token.content).toBe("string");
      numChars += token.content.length;
    }

    expect(numChars).toBeGreaterThan(0);
  }

  async testBatch(
    callOptions?: InstanceType<this["Cls"]>["ParsedCallOptions"]
  ) {
    const chatModel = new this.Cls(this.constructorArgs);
    const batchResults = await chatModel.batch(["Hello", "Hey"], callOptions);
    expect(batchResults).toBeDefined();
    expect(Array.isArray(batchResults)).toBe(true);
    expect(batchResults.length).toBe(2);
    for (const result of batchResults) {
      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(this.invokeResponseType);
      expect(typeof result.content).toBe("string");
      expect(result.content.length).toBeGreaterThan(0);
    }
  }

  async testConversation(
    callOptions?: InstanceType<this["Cls"]>["ParsedCallOptions"]
  ) {
    const chatModel = new this.Cls(this.constructorArgs);
    const messages = [
      new HumanMessage("hello"),
      new AIMessage("hello"),
      new HumanMessage("how are you"),
    ];
    const result = await chatModel.invoke(messages, callOptions);
    expect(result).toBeDefined();
    expect(result).toBeInstanceOf(this.invokeResponseType);
    expect(typeof result.content).toBe("string");
    expect(result.content.length).toBeGreaterThan(0);
  }

  async testUsageMetadata(
    callOptions?: InstanceType<this["Cls"]>["ParsedCallOptions"]
  ) {
    const chatModel = new this.Cls(this.constructorArgs);
    const result = await chatModel.invoke("Hello", callOptions);
    expect(result).toBeDefined();
    expect(result).toBeInstanceOf(this.invokeResponseType);
    if (!("usage_metadata" in result)) {
      throw new Error("result is not an instance of AIMessage");
    }
    const usageMetadata = result.usage_metadata as UsageMetadata;
    expect(usageMetadata).toBeDefined();
    expect(typeof usageMetadata.input_tokens).toBe("number");
    expect(typeof usageMetadata.output_tokens).toBe("number");
    expect(typeof usageMetadata.total_tokens).toBe("number");
  }

  async testUsageMetadataStreaming(
    callOptions?: InstanceType<this["Cls"]>["ParsedCallOptions"]
  ) {
    const chatModel = new this.Cls(this.constructorArgs);
    let finalChunks: AIMessageChunk | undefined;
    for await (const chunk of await chatModel.stream("Hello", callOptions)) {
      expect(chunk).toBeDefined();
      expect(chunk).toBeInstanceOf(AIMessageChunk);
      if (!finalChunks) {
        finalChunks = chunk;
      } else {
        finalChunks = finalChunks.concat(chunk);
      }
    }
    if (!finalChunks) {
      throw new Error("finalChunks is undefined");
    }
    const usageMetadata = finalChunks.usage_metadata;
    expect(usageMetadata).toBeDefined();
    if (!usageMetadata) {
      throw new Error("usageMetadata is undefined");
    }
    expect(typeof usageMetadata.input_tokens).toBe("number");
    expect(typeof usageMetadata.output_tokens).toBe("number");
    expect(typeof usageMetadata.total_tokens).toBe("number");
  }

  /**
   * Test that message histories are compatible with string tool contents
   * (e.g. OpenAI).
   * @returns {Promise<void>}
   */
  async testToolMessageHistoriesStringContent(
    callOptions?: InstanceType<this["Cls"]>["ParsedCallOptions"]
  ) {
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

    const { functionId } = this;
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

    const result = await modelWithTools.invoke(
      messagesStringContent,
      callOptions
    );
    expect(result).toBeInstanceOf(this.invokeResponseType);
  }

  /**
   * Test that message histories are compatible with list tool contents
   * (e.g. Anthropic).
   * @returns {Promise<void>}
   */
  async testToolMessageHistoriesListContent(
    callOptions?: InstanceType<this["Cls"]>["ParsedCallOptions"]
  ) {
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

    const { functionId } = this;
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

    const resultListContent = await modelWithTools.invoke(
      messagesListContent,
      callOptions
    );
    expect(resultListContent).toBeInstanceOf(this.invokeResponseType);
  }

  /**
   * Test that model can process few-shot examples with tool calls.
   * @returns {Promise<void>}
   */
  async testStructuredFewShotExamples(
    callOptions?: InstanceType<this["Cls"]>["ParsedCallOptions"]
  ) {
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

    const { functionId } = this;
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

    const result = await modelWithTools.invoke(
      messagesStringContent,
      callOptions
    );
    expect(result).toBeInstanceOf(this.invokeResponseType);
  }

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
    const modelWithTools = model.withStructuredOutput(adderSchema, {
      name: "math_addition",
    });

    const result = await MATH_ADDITION_PROMPT.pipe(modelWithTools).invoke({
      toolName: "math_addition",
    });
    expect(result.a).toBeDefined();
    expect(typeof result.a).toBe("number");
    expect(result.b).toBeDefined();
    expect(typeof result.b).toBe("number");
  }

  async testWithStructuredOutputIncludeRaw() {
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
    const modelWithTools = model.withStructuredOutput(adderSchema, {
      includeRaw: true,
      name: "math_addition",
    });

    const result = await MATH_ADDITION_PROMPT.pipe(modelWithTools).invoke({
      toolName: "math_addition",
    });
    expect(result.raw).toBeInstanceOf(this.invokeResponseType);
    expect(result.parsed.a).toBeDefined();
    expect(typeof result.parsed.a).toBe("number");
    expect(result.parsed.b).toBeDefined();
    expect(typeof result.parsed.b).toBe("number");
  }

  async testBindToolsWithOpenAIFormattedTools() {
    if (!this.chatModelHasToolCalling) {
      console.log("Test requires tool calling. Skipping...");
      return;
    }

    const model = new this.Cls(this.constructorArgs);
    if (!model.bindTools) {
      throw new Error(
        "bindTools undefined. Cannot test OpenAI formatted tool calls."
      );
    }
    const modelWithTools = model.bindTools([
      {
        type: "function",
        function: {
          name: "math_addition",
          description: adderSchema.description,
          parameters: zodToJsonSchema(adderSchema),
        },
      },
    ]);

    const result: AIMessage = await MATH_ADDITION_PROMPT.pipe(
      modelWithTools
    ).invoke({
      toolName: "math_addition",
    });

    expect(result.tool_calls?.[0]).toBeDefined();
    if (!result.tool_calls?.[0]) {
      throw new Error("result.tool_calls is undefined");
    }
    const { tool_calls } = result;
    expect(tool_calls[0].name).toBe("math_addition");
  }

  async testBindToolsWithRunnableToolLike() {
    if (!this.chatModelHasToolCalling) {
      console.log("Test requires tool calling. Skipping...");
      return;
    }

    const model = new this.Cls(this.constructorArgs);
    if (!model.bindTools) {
      throw new Error(
        "bindTools undefined. Cannot test OpenAI formatted tool calls."
      );
    }

    const runnableLike = RunnableLambda.from((_) => {
      // no-op
    }).asTool({
      name: "math_addition",
      description: adderSchema.description,
      schema: adderSchema,
    });

    const modelWithTools = model.bindTools([runnableLike]);

    const result: AIMessage = await MATH_ADDITION_PROMPT.pipe(
      modelWithTools
    ).invoke({
      toolName: "math_addition",
    });

    expect(result.tool_calls?.[0]).toBeDefined();
    if (!result.tool_calls?.[0]) {
      throw new Error("result.tool_calls is undefined");
    }
    const { tool_calls } = result;
    expect(tool_calls[0].name).toBe("math_addition");
  }

  async testCacheComplexMessageTypes() {
    const model = new this.Cls({
      ...this.constructorArgs,
      cache: true,
    });
    if (!model.cache) {
      throw new Error("Cache not enabled");
    }

    const humanMessage = new HumanMessage({
      content: [
        {
          type: "text",
          text: "Hello there!",
        },
      ],
    });
    const prompt = getBufferString([humanMessage]);
    const llmKey = model._getSerializedCacheKeyParametersForCall({} as any);

    // Invoke the model to trigger a cache update.
    await model.invoke([humanMessage]);
    const cacheValue = await model.cache.lookup(prompt, llmKey);

    // Ensure only one generation was added to the cache.
    expect(cacheValue !== null).toBeTruthy();
    if (!cacheValue) return;
    expect(cacheValue).toHaveLength(1);

    expect("message" in cacheValue[0]).toBeTruthy();
    if (!("message" in cacheValue[0])) return;
    const cachedMessage = cacheValue[0].message as AIMessage;

    // Invoke the model again with the same prompt, triggering a cache hit.
    const result = await model.invoke([humanMessage]);

    expect(result.content).toBe(cacheValue[0].text);
    expect(result).toEqual(cachedMessage);

    // Verify a second generation was not added to the cache.
    const cacheValue2 = await model.cache.lookup(prompt, llmKey);
    expect(cacheValue2).toEqual(cacheValue);
  }

  /**
   * This test verifies models can invoke a tool, and use the AIMessage
   * with the tool call in a followup request. This is useful when building
   * agents, or other pipelines that invoke tools.
   */
  async testModelCanUseToolUseAIMessage() {
    if (!this.chatModelHasToolCalling) {
      console.log("Test requires tool calling. Skipping...");
      return;
    }

    const model = new this.Cls(this.constructorArgs);
    if (!model.bindTools) {
      throw new Error(
        "bindTools undefined. Cannot test OpenAI formatted tool calls."
      );
    }

    const weatherSchema = z.object({
      location: z.string().describe("The location to get the weather for."),
    });

    // Define the tool
    const weatherTool = tool(
      (_) => "The weather in San Francisco is 70 degrees and sunny.",
      {
        name: "get_current_weather",
        schema: weatherSchema,
        description: "Get the current weather for a location.",
      }
    );

    const modelWithTools = model.bindTools([weatherTool]);

    // List of messages to initially invoke the model with, and to hold
    // followup messages to invoke the model with.
    const messages = [
      new HumanMessage(
        "What's the weather like in San Francisco right now? Use the 'get_current_weather' tool to find the answer."
      ),
    ];

    const result: AIMessage = await modelWithTools.invoke(messages);

    expect(result.tool_calls?.[0]).toBeDefined();
    if (!result.tool_calls?.[0]) {
      throw new Error("result.tool_calls is undefined");
    }
    const { tool_calls } = result;
    expect(tool_calls[0].name).toBe("get_current_weather");

    // Push the result of the tool call into the messages array so we can
    // confirm in the followup request the model can use the tool call.
    messages.push(result);

    // Create a dummy ToolMessage representing the output of the tool call.
    const toolMessage = new ToolMessage({
      tool_call_id: tool_calls[0].id ?? "",
      name: tool_calls[0].name,
      content: await weatherTool.invoke(
        tool_calls[0].args as z.infer<typeof weatherSchema>
      ),
    });
    messages.push(toolMessage);

    const finalResult = await modelWithTools.invoke(messages);

    expect(finalResult.content).not.toBe("");
  }

  /**
   * Same as the above test, but streaming both model invocations.
   */
  async testModelCanUseToolUseAIMessageWithStreaming() {
    if (!this.chatModelHasToolCalling) {
      console.log("Test requires tool calling. Skipping...");
      return;
    }

    const model = new this.Cls(this.constructorArgs);
    if (!model.bindTools) {
      throw new Error(
        "bindTools undefined. Cannot test OpenAI formatted tool calls."
      );
    }

    const weatherSchema = z.object({
      location: z.string().describe("The location to get the weather for."),
    });

    // Define the tool
    const weatherTool = tool(
      (_) => "The weather in San Francisco is 70 degrees and sunny.",
      {
        name: "get_current_weather",
        schema: weatherSchema,
        description: "Get the current weather for a location.",
      }
    );

    const modelWithTools = model.bindTools([weatherTool]);

    // List of messages to initially invoke the model with, and to hold
    // followup messages to invoke the model with.
    const messages = [
      new HumanMessage(
        "What's the weather like in San Francisco right now? Use the 'get_current_weather' tool to find the answer."
      ),
    ];

    const stream = await modelWithTools.stream(messages);
    let result: AIMessageChunk | undefined;
    for await (const chunk of stream) {
      result = !result ? chunk : concat(result, chunk);
    }

    expect(result).toBeDefined();
    if (!result) return;

    expect(result.tool_calls?.[0]).toBeDefined();
    if (!result.tool_calls?.[0]) {
      throw new Error("result.tool_calls is undefined");
    }

    const { tool_calls } = result;
    expect(tool_calls[0].name).toBe("get_current_weather");

    // Push the result of the tool call into the messages array so we can
    // confirm in the followup request the model can use the tool call.
    messages.push(result);

    // Create a dummy ToolMessage representing the output of the tool call.
    const toolMessage = new ToolMessage({
      tool_call_id: tool_calls[0].id ?? "",
      name: tool_calls[0].name,
      content: await weatherTool.invoke(
        tool_calls[0].args as z.infer<typeof weatherSchema>
      ),
    });
    messages.push(toolMessage);

    const finalStream = await modelWithTools.stream(messages);
    let finalResult: AIMessageChunk | undefined;
    for await (const chunk of finalStream) {
      finalResult = !finalResult ? chunk : concat(finalResult, chunk);
    }

    expect(finalResult).toBeDefined();
    if (!finalResult) return;

    expect(finalResult.content).not.toBe("");
  }

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

    try {
      await this.testUsageMetadata();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testUsageMetadata failed", e);
    }

    try {
      await this.testUsageMetadataStreaming();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testUsageMetadataStreaming failed", e);
    }

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

    try {
      await this.testWithStructuredOutput();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testWithStructuredOutput failed", e);
    }

    try {
      await this.testWithStructuredOutputIncludeRaw();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testWithStructuredOutputIncludeRaw failed", e);
    }

    try {
      await this.testBindToolsWithOpenAIFormattedTools();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testBindToolsWithOpenAIFormattedTools failed", e);
    }

    try {
      await this.testBindToolsWithRunnableToolLike();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testBindToolsWithRunnableToolLike failed", e);
    }

    try {
      await this.testCacheComplexMessageTypes();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testCacheComplexMessageTypes failed", e);
    }

    try {
      await this.testModelCanUseToolUseAIMessage();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testModelCanUseToolUseAIMessage failed", e);
    }

    try {
      await this.testModelCanUseToolUseAIMessageWithStreaming();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testModelCanUseToolUseAIMessageWithStreaming failed", e);
    }

    return allTestsPassed;
  }
}
