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
import { StreamEvent } from "@langchain/core/tracers/log_stream";
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
  /**
   * Whether or not the model supports parallel tool calling.
   * @default false
   */
  supportsParallelToolCalls?: boolean;
}

export abstract class ChatModelIntegrationTests<
  CallOptions extends BaseChatModelCallOptions = BaseChatModelCallOptions,
  OutputMessageType extends BaseMessageChunk = BaseMessageChunk,
  ConstructorArgs extends RecordStringAny = RecordStringAny
> extends BaseChatModelsTests<CallOptions, OutputMessageType, ConstructorArgs> {
  functionId = "abc123";

  invokeResponseType: typeof AIMessage | typeof AIMessageChunk = AIMessage;

  supportsParallelToolCalls = false;

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
    this.supportsParallelToolCalls =
      fields.supportsParallelToolCalls ?? this.supportsParallelToolCalls;
  }

  /**
   * Tests the basic `invoke` method of the chat model.
   * This test ensures that the model can process a simple input and return a valid response.
   *
   * It verifies that:
   * 1. The result is defined and is an instance of the correct type.
   * 2. The content of the response is a non-empty string.
   *
   * @param {InstanceType<this["Cls"]>["ParsedCallOptions"] | undefined} callOptions Optional call options to pass to the model.
   *  These options will be applied to the model at runtime.
   */
  async testInvoke(
    callOptions?: InstanceType<this["Cls"]>["ParsedCallOptions"]
  ) {
    // Create a new instance of the chat model
    const chatModel = new this.Cls(this.constructorArgs);

    // Invoke the model with a simple "Hello" message
    const result = await chatModel.invoke("Hello", callOptions);

    // Verify that the result is defined
    expect(result).toBeDefined();

    // Check that the result is an instance of the expected response type
    expect(result).toBeInstanceOf(this.invokeResponseType);

    // Ensure that the content of the response is a string
    expect(typeof result.content).toBe("string");

    // Verify that the response content is not empty
    expect(result.content).not.toBe("");
  }

  /**
   * Tests the streaming capability of the chat model.
   * This test ensures that the model can properly stream responses
   * and that each streamed token is a valid AIMessageChunk.
   *
   * It verifies that:
   * 1. Each streamed token is defined and is an instance of AIMessageChunk.
   * 2. The content of each token is a string.
   * 3. The total number of characters streamed is greater than zero.
   *
   * @param {InstanceType<this["Cls"]>["ParsedCallOptions"] | undefined} callOptions Optional call options to pass to the model.
   *  These options will be applied to the model at runtime.
   */
  async testStream(
    callOptions?: InstanceType<this["Cls"]>["ParsedCallOptions"]
  ) {
    const chatModel = new this.Cls(this.constructorArgs);
    let numChars = 0;

    // Stream the response for a simple "Hello" prompt
    for await (const token of await chatModel.stream("Hello", callOptions)) {
      // Verify each token is defined and of the correct type
      expect(token).toBeDefined();
      expect(token).toBeInstanceOf(AIMessageChunk);

      // Ensure the content of each token is a string
      expect(typeof token.content).toBe("string");

      // Keep track of the total number of characters
      numChars += token.content.length;
    }

    // Verify that some content was actually streamed
    expect(numChars).toBeGreaterThan(0);
  }

  /**
   * Tests the batch processing capability of the chat model.
   * This test ensures that the model can handle multiple inputs simultaneously
   * and return appropriate responses for each.
   *
   * It verifies that:
   * 1. The batch results are defined and in array format.
   * 2. The number of results matches the number of inputs.
   * 3. Each result is of the correct type and has non-empty content.
   *
   * @param {InstanceType<this["Cls"]>["ParsedCallOptions"] | undefined} callOptions Optional call options to pass to the model.
   *  These options will be applied to the model at runtime.
   */
  async testBatch(
    callOptions?: InstanceType<this["Cls"]>["ParsedCallOptions"]
  ) {
    const chatModel = new this.Cls(this.constructorArgs);

    // Process two simple prompts in batch
    const batchResults = await chatModel.batch(["Hello", "Hey"], callOptions);

    // Verify that results are returned
    expect(batchResults).toBeDefined();

    // Check that the results are in array format
    expect(Array.isArray(batchResults)).toBe(true);

    // Ensure the number of results matches the number of inputs
    expect(batchResults.length).toBe(2);

    // Validate each result individually
    for (const result of batchResults) {
      // Check that the result is defined
      expect(result).toBeDefined();

      // Verify the result is of the expected type
      expect(result).toBeInstanceOf(this.invokeResponseType);

      // Ensure the content is a non-empty string
      expect(typeof result.content).toBe("string");
      expect(result.content).not.toBe("");
    }
  }

  /**
   * Tests the model can properly use the `.streamEvents` method.
   * This test ensures the `.streamEvents` method yields at least
   * three event types: `on_chat_model_start`, `on_chat_model_stream`,
   * and `on_chat_model_end`.
   *
   * It also verifies the first chunk is an `on_chat_model_start` event,
   * and the last chunk is an `on_chat_model_end` event. The middle chunk
   * should be an `on_chat_model_stream` event.
   *
   * Finally, it verifies the final chunk's `event.data.output` field
   * matches the concatenated content of all `on_chat_model_stream` events.
   * @param {InstanceType<this["Cls"]>["ParsedCallOptions"] | undefined} callOptions Optional call options to pass to the model.
   *  These options will be applied to the model at runtime.
   */
  async testStreamEvents(
    callOptions?: InstanceType<this["Cls"]>["ParsedCallOptions"]
  ) {
    const chatModel = new this.Cls(this.constructorArgs);

    const stream = chatModel.streamEvents("Hello", {
      ...callOptions,
      version: "v2",
    } as Partial<CallOptions> & { version: "v2" | "v1" });

    const events: StreamEvent[] = [];
    for await (const chunk of stream) {
      events.push(chunk);
    }

    // It must have at least 3: on_chat_model_start, on_chat_model_stream, and on_chat_model_end
    expect(events.length).toBeGreaterThanOrEqual(3);

    expect(events[0].event).toBe("on_chat_model_start");
    expect(events[events.length - 1].event).toBe("on_chat_model_end");

    const middleItem = events[Math.floor(events.length / 2)];
    expect(middleItem.event).toBe("on_chat_model_stream");

    // The last event should contain the final content via the `event.data.output` field
    const endContent = events[events.length - 1].data.output;
    let endContentText = "";
    if (typeof endContent === "string") {
      endContentText = endContent;
    } else if (Array.isArray(endContent) && "text" in endContent[0]) {
      endContentText = endContent[0].text;
    } else {
      throw new Error(
        `Invalid final chunk received from .streamEvents:${endContent}`
      );
    }

    // All of the `*_stream` events should contain the content via the `event.data.output` field
    // When concatenated, this chunk should equal the final chunk.
    const allChunks = events.flatMap((e) => {
      if (e.event === "on_chat_model_stream") {
        return e.data.output;
      }
      return [];
    });
    const allChunksText: string = allChunks
      .flatMap((c) => {
        if (typeof c === "string") {
          return c;
        } else if (Array.isArray(c) && "text" in c[0]) {
          return c[0].text;
        }
        return [];
      })
      .join("");

    expect(endContentText).toBe(allChunksText);
  }

  /**
   * Tests the chat model's ability to handle a conversation with multiple messages.
   * This test ensures that the model can process a sequence of messages from different roles
   * (Human and AI) and generate an appropriate response.
   *
   * It verifies that:
   * 1. The result is defined and is an instance of the correct response type.
   * 2. The content of the response is a non-empty string.
   *
   * @param {InstanceType<this["Cls"]>["ParsedCallOptions"] | undefined} callOptions Optional call options to pass to the model.
   *  These options will be applied to the model at runtime.
   */
  async testConversation(
    callOptions?: InstanceType<this["Cls"]>["ParsedCallOptions"]
  ) {
    // Create a new instance of the chat model
    const chatModel = new this.Cls(this.constructorArgs);

    // Prepare a conversation history with alternating Human and AI messages
    const messages = [
      new HumanMessage("hello"),
      new AIMessage("hello"),
      new HumanMessage("how are you"),
    ];

    // Invoke the model with the conversation history
    const result = await chatModel.invoke(messages, callOptions);

    // Verify that the result is defined
    expect(result).toBeDefined();

    // Check that the result is an instance of the expected response type
    expect(result).toBeInstanceOf(this.invokeResponseType);

    // Ensure that the content of the response is a string
    expect(typeof result.content).toBe("string");

    // Verify that the response content is not empty
    expect(result.content).not.toBe("");
  }

  /**
   * Tests the usage metadata functionality of the chat model.
   * This test ensures that the model returns proper usage metadata
   * after invoking it with a simple message.
   *
   * It verifies that:
   * 1. The result is defined and is an instance of the correct response type.
   * 2. The result contains the `usage_metadata` field.
   * 3. The `usage_metadata` field contains `input_tokens`, `output_tokens`, and `total_tokens`,
   *    all of which are numbers.
   *
   * @param {InstanceType<this["Cls"]>["ParsedCallOptions"] | undefined} callOptions Optional call options to pass to the model.
   *  These options will be applied to the model at runtime.
   */
  async testUsageMetadata(
    callOptions?: InstanceType<this["Cls"]>["ParsedCallOptions"]
  ) {
    // Create a new instance of the chat model
    const chatModel = new this.Cls(this.constructorArgs);

    // Invoke the model with a simple "Hello" message
    const result = await chatModel.invoke("Hello", callOptions);

    // Verify that the result is defined
    expect(result).toBeDefined();

    // Check that the result is an instance of the expected response type
    expect(result).toBeInstanceOf(this.invokeResponseType);

    // Ensure that the result contains usage_metadata
    if (!("usage_metadata" in result)) {
      throw new Error("result is not an instance of AIMessage");
    }

    // Extract the usage metadata from the result
    const usageMetadata = result.usage_metadata as UsageMetadata;

    // Verify that usage metadata is defined
    expect(usageMetadata).toBeDefined();

    // Check that input_tokens is a number
    expect(typeof usageMetadata.input_tokens).toBe("number");

    // Check that output_tokens is a number
    expect(typeof usageMetadata.output_tokens).toBe("number");

    // Check that total_tokens is a number
    expect(typeof usageMetadata.total_tokens).toBe("number");
  }

  /**
   * Tests the usage metadata functionality for streaming responses from the chat model.
   * This test ensures that the model returns proper usage metadata
   * after streaming a response for a simple message.
   *
   * It verifies that:
   * 1. Each streamed chunk is defined and is an instance of AIMessageChunk.
   * 2. The final concatenated result contains the `usage_metadata` field.
   * 3. The `usage_metadata` field contains `input_tokens`, `output_tokens`, and `total_tokens`,
   *    all of which are numbers.
   *
   * @param {InstanceType<this["Cls"]>["ParsedCallOptions"] | undefined} callOptions Optional call options to pass to the model.
   *  These options will be applied to the model at runtime.
   */
  async testUsageMetadataStreaming(
    callOptions?: InstanceType<this["Cls"]>["ParsedCallOptions"]
  ) {
    const chatModel = new this.Cls(this.constructorArgs);
    let finalChunks: AIMessageChunk | undefined;

    // Stream the response for a simple "Hello" prompt
    for await (const chunk of await chatModel.stream("Hello", callOptions)) {
      // Verify each chunk is defined and of the correct type
      expect(chunk).toBeDefined();
      expect(chunk).toBeInstanceOf(AIMessageChunk);

      // Concatenate chunks to get the final result
      if (!finalChunks) {
        finalChunks = chunk;
      } else {
        finalChunks = finalChunks.concat(chunk);
      }
    }

    // Ensure we received at least one chunk
    if (!finalChunks) {
      throw new Error("finalChunks is undefined");
    }

    // Extract usage metadata from the final concatenated result
    const usageMetadata = finalChunks.usage_metadata;
    expect(usageMetadata).toBeDefined();

    // Ensure usage metadata is present
    if (!usageMetadata) {
      throw new Error("usageMetadata is undefined");
    }

    // Verify that input_tokens, output_tokens, and total_tokens are numbers
    expect(typeof usageMetadata.input_tokens).toBe("number");
    expect(typeof usageMetadata.output_tokens).toBe("number");
    expect(typeof usageMetadata.total_tokens).toBe("number");
  }

  /**
   * Tests the chat model's ability to handle message histories with string tool contents.
   * This test is specifically designed for models that support tool calling with string-based content,
   * such as OpenAI's GPT models.
   *
   * The test performs the following steps:
   * 1. Creates a chat model and binds an AdderTool to it.
   * 2. Constructs a message history that includes a HumanMessage, an AIMessage with string content
   *    (simulating a tool call), and a ToolMessage with the tool's response.
   * 3. Invokes the model with this message history.
   * 4. Verifies that the result is of the expected type (AIMessage or AIMessageChunk).
   *
   * This test ensures that the model can correctly process and respond to complex message
   * histories that include tool calls with string-based content structures.
   *
   * @param {InstanceType<this["Cls"]>["ParsedCallOptions"] | undefined} callOptions Optional call options to pass to the model.
   *  These options will be applied to the model at runtime.
   */
  async testToolMessageHistoriesStringContent(
    callOptions?: InstanceType<this["Cls"]>["ParsedCallOptions"]
  ) {
    // Skip the test if the model doesn't support tool calling
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
    // Bind the AdderTool to the model
    const modelWithTools = model.bindTools([adderTool]);
    const functionName = adderTool.name;
    const functionArgs = { a: 1, b: 2 };

    const { functionId } = this;
    // Invoke the tool to get the result
    const functionResult = await adderTool.invoke(functionArgs);

    // Construct a message history with string-based content
    const messagesStringContent = [
      new HumanMessage("What is 1 + 2"),
      // AIMessage with string content (simulating OpenAI's format)
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
      // ToolMessage with the result of the tool call
      new ToolMessage(functionResult, functionId, functionName),
    ];

    // Invoke the model with the constructed message history
    const result = await modelWithTools.invoke(
      messagesStringContent,
      callOptions
    );

    // Verify that the result is of the expected type
    expect(result).toBeInstanceOf(this.invokeResponseType);
  }

  /**
   * Tests the chat model's ability to handle message histories with list tool contents.
   * This test is specifically designed for models that support tool calling with list-based content,
   * such as Anthropic's Claude.
   *
   * The test performs the following steps:
   * 1. Creates a chat model and binds an AdderTool to it.
   * 2. Constructs a message history that includes a HumanMessage, an AIMessage with list content
   *    (simulating a tool call), and a ToolMessage with the tool's response.
   * 3. Invokes the model with this message history.
   * 4. Verifies that the result is of the expected type (AIMessage or AIMessageChunk).
   *
   * This test ensures that the model can correctly process and respond to complex message
   * histories that include tool calls with list-based content structures.
   *
   * @param {InstanceType<this["Cls"]>["ParsedCallOptions"] | undefined} callOptions Optional call options to pass to the model.
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

    // Construct a message history with list-based content
    const messagesListContent = [
      new HumanMessage("What is 1 + 2"),
      // AIMessage with list content (simulating Anthropic's format)
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
      // ToolMessage with the result of the tool call
      new ToolMessage(functionResult, functionId, functionName),
    ];

    // Invoke the model with the constructed message history
    const resultListContent = await modelWithTools.invoke(
      messagesListContent,
      callOptions
    );

    // Verify that the result is of the expected type
    expect(resultListContent).toBeInstanceOf(this.invokeResponseType);
  }

  /**
   * Tests the chat model's ability to process few-shot examples with tool calls.
   * This test ensures that the model can correctly handle and respond to a conversation
   * that includes tool calls within the context of few-shot examples.
   *
   * The test performs the following steps:
   * 1. Creates a chat model and binds an AdderTool to it.
   * 2. Constructs a message history that simulates a few-shot example scenario:
   *    - A human message asking about addition
   *    - An AI message with a tool call to the AdderTool
   *    - A ToolMessage with the result of the tool call
   *    - An AI message with the result
   *    - A new human message asking about a different addition
   * 3. Invokes the model with this message history.
   * 4. Verifies that the result is of the expected type (AIMessage or AIMessageChunk).
   *
   * This test is crucial for ensuring that the model can learn from and apply
   * the patterns demonstrated in few-shot examples, particularly when those
   * examples involve tool usage.
   *
   * @param {InstanceType<this["Cls"]>["ParsedCallOptions"] | undefined} callOptions Optional call options to pass to the model.
   *  These options will be applied to the model at runtime.
   */
  async testStructuredFewShotExamples(
    callOptions?: InstanceType<this["Cls"]>["ParsedCallOptions"]
  ) {
    // Skip the test if the model doesn't support tool calling
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

    // Construct a message history that simulates a few-shot example scenario
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
      new HumanMessage("What is 3 + 4"), // New question to test if the model learned from the example
    ];

    // Invoke the model with the constructed message history
    const result = await modelWithTools.invoke(
      messagesStringContent,
      callOptions
    );

    // Verify that the result is of the expected type
    expect(result).toBeInstanceOf(this.invokeResponseType);
  }

  /**
   * Tests the chat model's ability to generate structured output using the `withStructuredOutput` method.
   * This test ensures that the model can correctly process a prompt and return a response
   * that adheres to a predefined schema (adderSchema).
   *
   * It verifies that:
   * 1. The model supports structured output functionality.
   * 2. The result contains the expected fields ('a' and 'b') from the adderSchema.
   * 3. The values of these fields are of the correct type (number).
   *
   * This test is crucial for ensuring that the model can generate responses
   * in a specific format, which is useful for tasks requiring structured data output.
   *
   * @param {InstanceType<this["Cls"]>["ParsedCallOptions"] | undefined} callOptions Optional call options to pass to the model.
   *  These options will be applied to the model at runtime.
   */
  async testWithStructuredOutput(
    callOptions?: InstanceType<this["Cls"]>["ParsedCallOptions"]
  ) {
    // Skip the test if the model doesn't support structured output
    if (!this.chatModelHasStructuredOutput) {
      console.log("Test requires withStructuredOutput. Skipping...");
      return;
    }

    // Create a new instance of the chat model
    const model = new this.Cls(this.constructorArgs);

    // Ensure the model has the withStructuredOutput method
    if (!model.withStructuredOutput) {
      throw new Error(
        "withStructuredOutput undefined. Cannot test structured output."
      );
    }

    // Create a new model instance with structured output capability
    const modelWithTools = model.withStructuredOutput(adderSchema, {
      name: "math_addition",
    });

    // Invoke the model with a predefined prompt
    const result = await MATH_ADDITION_PROMPT.pipe(modelWithTools).invoke(
      {
        toolName: "math_addition",
      },
      callOptions
    );

    // Verify that the 'a' field is present and is a number
    expect(result.a).toBeDefined();
    expect(typeof result.a).toBe("number");

    // Verify that the 'b' field is present and is a number
    expect(result.b).toBeDefined();
    expect(typeof result.b).toBe("number");
  }

  /**
   * Tests the chat model's ability to generate structured output with raw response included.
   * This test ensures that the model can correctly process a prompt and return a response
   * that adheres to a predefined schema (adderSchema) while also including the raw model output.
   *
   * It verifies that:
   * 1. The model supports structured output functionality with raw response inclusion.
   * 2. The result contains both 'raw' and 'parsed' properties.
   * 3. The 'raw' property is an instance of the expected response type.
   * 4. The 'parsed' property contains the expected fields ('a' and 'b') from the adderSchema.
   * 5. The values of these fields in the 'parsed' property are of the correct type (number).
   *
   * This test is crucial for ensuring that the model can generate responses in a specific format
   * while also providing access to the original, unprocessed model output.
   *
   * @param {InstanceType<this["Cls"]>["ParsedCallOptions"] | undefined} callOptions Optional call options to pass to the model.
   *  These options will be applied to the model at runtime.
   */
  async testWithStructuredOutputIncludeRaw(
    callOptions?: InstanceType<this["Cls"]>["ParsedCallOptions"]
  ) {
    // Skip the test if the model doesn't support structured output
    if (!this.chatModelHasStructuredOutput) {
      console.log("Test requires withStructuredOutput. Skipping...");
      return;
    }

    // Create a new instance of the chat model
    const model = new this.Cls(this.constructorArgs);

    // Ensure the model has the withStructuredOutput method
    if (!model.withStructuredOutput) {
      throw new Error(
        "withStructuredOutput undefined. Cannot test tool message histories."
      );
    }

    // Create a new model instance with structured output capability, including raw output
    const modelWithTools = model.withStructuredOutput(adderSchema, {
      includeRaw: true,
      name: "math_addition",
    });

    // Invoke the model with a predefined prompt
    const result = await MATH_ADDITION_PROMPT.pipe(modelWithTools).invoke(
      {
        toolName: "math_addition",
      },
      callOptions
    );

    // Verify that the raw output is of the expected type
    expect(result.raw).toBeInstanceOf(this.invokeResponseType);

    // Verify that the parsed 'a' field is present and is a number
    expect(result.parsed.a).toBeDefined();
    expect(typeof result.parsed.a).toBe("number");

    // Verify that the parsed 'b' field is present and is a number
    expect(result.parsed.b).toBeDefined();
    expect(typeof result.parsed.b).toBe("number");
  }

  /**
   * Tests the chat model's ability to bind and use OpenAI-formatted tools.
   * This test ensures that the model can correctly process and use tools
   * formatted in the OpenAI function calling style.
   *
   * It verifies that:
   * 1. The model supports tool calling functionality.
   * 2. The model can successfully bind an OpenAI-formatted tool.
   * 3. The model invokes the bound tool correctly when prompted.
   * 4. The result contains a tool call with the expected name.
   *
   * This test is crucial for ensuring compatibility with OpenAI's function
   * calling format, which is a common standard in AI tool integration.
   *
   * @param {InstanceType<this["Cls"]>["ParsedCallOptions"] | undefined} callOptions Optional call options to pass to the model.
   *  These options will be applied to the model at runtime.
   */
  async testBindToolsWithOpenAIFormattedTools(
    callOptions?: InstanceType<this["Cls"]>["ParsedCallOptions"]
  ) {
    // Skip the test if the model doesn't support tool calling
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

    // Bind an OpenAI-formatted tool to the model
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

    // Invoke the model with a prompt that should trigger the tool use
    const result: AIMessage = await MATH_ADDITION_PROMPT.pipe(
      modelWithTools
    ).invoke(
      {
        toolName: "math_addition",
      },
      callOptions
    );

    // Verify that a tool call was made
    expect(result.tool_calls?.[0]).toBeDefined();
    if (!result.tool_calls?.[0]) {
      throw new Error("result.tool_calls is undefined");
    }
    const { tool_calls } = result;

    // Check that the correct tool was called
    expect(tool_calls[0].name).toBe("math_addition");
  }

  /**
   * Tests the chat model's ability to bind and use Runnable-like tools.
   * This test ensures that the model can correctly process and use tools
   * that are created from Runnable objects using the `asTool` method.
   *
   * It verifies that:
   * 1. The model supports tool calling functionality.
   * 2. The model can successfully bind a Runnable-like tool.
   * 3. The model invokes the bound tool correctly when prompted.
   * 4. The result contains a tool call with the expected name.
   *
   * This test is crucial for ensuring compatibility with tools created
   * from Runnable objects, which provides a flexible way to integrate
   * custom logic into the model's tool-calling capabilities.
   *
   * @param {InstanceType<this["Cls"]>["ParsedCallOptions"] | undefined} callOptions Optional call options to pass to the model.
   *  These options will be applied to the model at runtime.
   */
  async testBindToolsWithRunnableToolLike(
    callOptions?: InstanceType<this["Cls"]>["ParsedCallOptions"]
  ) {
    // Skip the test if the model doesn't support tool calling
    if (!this.chatModelHasToolCalling) {
      console.log("Test requires tool calling. Skipping...");
      return;
    }

    const model = new this.Cls(this.constructorArgs);
    if (!model.bindTools) {
      throw new Error(
        "bindTools undefined. Cannot test Runnable-like tool calls."
      );
    }

    // Create a Runnable-like tool using RunnableLambda and asTool
    const runnableLike = RunnableLambda.from((_) => {
      // no-op implementation for testing purposes
    }).asTool({
      name: "math_addition",
      description: adderSchema.description,
      schema: adderSchema,
    });

    // Bind the Runnable-like tool to the model
    const modelWithTools = model.bindTools([runnableLike]);

    // Invoke the model with a prompt that should trigger the tool use
    const result: AIMessage = await MATH_ADDITION_PROMPT.pipe(
      modelWithTools
    ).invoke(
      {
        toolName: "math_addition",
      },
      callOptions
    );

    // Verify that a tool call was made
    expect(result.tool_calls?.[0]).toBeDefined();
    if (!result.tool_calls?.[0]) {
      throw new Error("result.tool_calls is undefined");
    }
    const { tool_calls } = result;

    // Check that the correct tool was called
    expect(tool_calls[0].name).toBe("math_addition");
  }

  /**
   * Tests the chat model's ability to cache and retrieve complex message types.
   * This test ensures that the model can correctly cache and retrieve messages
   * with complex content structures, such as arrays of content objects.
   *
   * It verifies that:
   * 1. The model can be instantiated with caching enabled.
   * 2. A complex HumanMessage can be created and invoked.
   * 3. The result is correctly cached after the first invocation.
   * 4. A subsequent invocation with the same input retrieves the cached result.
   * 5. The cached result matches the original result in both content and structure.
   * 6. No additional cache entries are created for repeated invocations.
   *
   * This test is crucial for ensuring that the caching mechanism works correctly
   * with various message structures, maintaining consistency and efficiency.
   *
   * @param {InstanceType<this["Cls"]>["ParsedCallOptions"] | undefined} callOptions Optional call options to pass to the model.
   *  These options will be applied to the model at runtime.
   */
  async testCacheComplexMessageTypes(
    callOptions?: InstanceType<this["Cls"]>["ParsedCallOptions"]
  ) {
    // Create a new instance of the chat model with caching enabled
    const model = new this.Cls({
      ...this.constructorArgs,
      cache: true,
    });
    if (!model.cache) {
      throw new Error("Cache not enabled");
    }

    // Create a complex HumanMessage with an array of content objects
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

    // Invoke the model to trigger a cache update
    await model.invoke([humanMessage], callOptions);
    const cacheValue = await model.cache.lookup(prompt, llmKey);

    // Verify that the cache contains exactly one generation
    expect(cacheValue !== null).toBeTruthy();
    if (!cacheValue) return;
    expect(cacheValue).toHaveLength(1);

    // Ensure the cached value has the expected structure
    expect("message" in cacheValue[0]).toBeTruthy();
    if (!("message" in cacheValue[0])) return;
    const cachedMessage = cacheValue[0].message as AIMessage;

    // Invoke the model again with the same prompt to trigger a cache hit
    const result = await model.invoke([humanMessage], callOptions);

    // Verify that the result matches the cached value
    expect(result.content).toBe(cacheValue[0].text);
    expect(result).toEqual(cachedMessage);

    // Ensure no additional cache entries were created
    const cacheValue2 = await model.cache.lookup(prompt, llmKey);
    expect(cacheValue2).toEqual(cacheValue);
  }

  /**
   * Tests the chat model's ability to stream tokens while using tool calls.
   * This test ensures that the model can correctly stream responses that include tool calls,
   * and that the streamed response contains the expected information.
   *
   * It verifies that:
   * 1. The model can be bound with a tool and streamed successfully.
   * 2. The streamed result contains at least one tool call.
   * 3. The usage metadata is present in the streamed result.
   * 4. Both input and output tokens are present and greater than zero in the usage metadata.
   *
   * @param {InstanceType<this["Cls"]>["ParsedCallOptions"] | undefined} callOptions Optional call options to pass to the model.
   *  These options will be applied to the model at runtime.
   */
  async testStreamTokensWithToolCalls(
    callOptions?: InstanceType<this["Cls"]>["ParsedCallOptions"]
  ) {
    const model = new this.Cls(this.constructorArgs);
    if (!model.bindTools) {
      throw new Error("bindTools is undefined");
    }

    // Create and bind the AdderTool to the model
    const adderTool = new AdderTool();
    const modelWithTools = model.bindTools([adderTool]);

    // Stream the response using the MATH_ADDITION_PROMPT
    const stream = await MATH_ADDITION_PROMPT.pipe(modelWithTools).stream(
      {
        toolName: "math_addition",
      },
      callOptions
    );

    // Concatenate all chunks into a single result
    let result: AIMessageChunk | undefined;
    for await (const chunk of stream) {
      if (!result) {
        result = chunk;
      } else {
        result = result.concat(chunk);
      }
    }

    expect(result).toBeDefined();
    if (!result) return;

    // Verify a tool was actually called.
    // We only check for the presence of the first tool call, not the exact number,
    // as some models might call the tool multiple times.
    expect(result.tool_calls?.[0]).toBeDefined();

    // Verify usage metadata is present and contains expected fields
    expect(result.usage_metadata).toBeDefined();
    expect(result.usage_metadata?.input_tokens).toBeDefined();
    expect(result.usage_metadata?.input_tokens).toBeGreaterThan(0);
    expect(result.usage_metadata?.output_tokens).toBeDefined();
    expect(result.usage_metadata?.output_tokens).toBeGreaterThan(0);
  }

  /**
   * Tests the chat model's ability to use tool calls in a multi-turn conversation.
   * This test verifies that the model can:
   * 1. Invoke a tool in response to a user query.
   * 2. Use the AIMessage containing the tool call in a followup request.
   * 3. Process the tool's response and generate a final answer.
   *
   * This capability is crucial for building agents or other pipelines that involve tool usage.
   *
   * The test follows these steps:
   * 1. Bind a weather tool to the model.
   * 2. Send an initial query about the weather.
   * 3. Verify the model makes a tool call.
   * 4. Simulate the tool's response.
   * 5. Send a followup request including the tool call and response.
   * 6. Verify the model generates a non-empty final response.
   *
   * @param {InstanceType<this["Cls"]>["ParsedCallOptions"] | undefined} callOptions Optional call options to pass to the model.
   *  These options will be applied to the model at runtime.
   */
  async testModelCanUseToolUseAIMessage(
    callOptions?: InstanceType<this["Cls"]>["ParsedCallOptions"]
  ) {
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

    // Define a simple weather schema for the tool
    const weatherSchema = z.object({
      location: z.string().describe("The location to get the weather for."),
    });

    // Create a mock weather tool that always returns sunny weather
    const weatherTool = tool(
      (_) => "The weather in San Francisco is 70 degrees and sunny.",
      {
        name: "get_current_weather",
        schema: weatherSchema,
        description: "Get the current weather for a location.",
      }
    );

    // Bind the weather tool to the model
    const modelWithTools = model.bindTools([weatherTool]);

    // Initialize the conversation with a weather query
    const messages = [
      new HumanMessage(
        "What's the weather like in San Francisco right now? Use the 'get_current_weather' tool to find the answer."
      ),
    ];

    // Send the initial query and expect a tool call
    const result: AIMessage = await modelWithTools.invoke(
      messages,
      callOptions
    );

    expect(result.tool_calls?.[0]).toBeDefined();
    if (!result.tool_calls?.[0]) {
      throw new Error("result.tool_calls is undefined");
    }
    const { tool_calls } = result;
    expect(tool_calls[0].name).toBe("get_current_weather");

    // Add the model's response (including tool call) to the conversation
    messages.push(result);

    // Simulate the tool's response
    const toolMessage = new ToolMessage({
      tool_call_id: tool_calls[0].id ?? "",
      name: tool_calls[0].name,
      content: await weatherTool.invoke(
        tool_calls[0].args as z.infer<typeof weatherSchema>
      ),
    });
    messages.push(toolMessage);

    // Send a followup request including the tool call and response
    const finalResult = await modelWithTools.invoke(messages, callOptions);

    // Verify that the model generated a non-empty response
    expect(finalResult.content).not.toBe("");
  }

  /**
   * Tests the chat model's ability to use tool calls in a multi-turn conversation with streaming.
   * This test verifies that the model can:
   * 1. Stream a response that includes a tool call.
   * 2. Use the AIMessage containing the tool call in a followup request.
   * 3. Stream a final response that processes the tool's output.
   *
   * This test is crucial for ensuring that the model can handle tool usage in a streaming context,
   * which is important for building responsive agents or other AI systems that require real-time interaction.
   *
   * The test follows these steps:
   * 1. Bind a weather tool to the model.
   * 2. Stream an initial query about the weather.
   * 3. Verify the streamed result contains a tool call.
   * 4. Simulate the tool's response.
   * 5. Stream a followup request including the tool call and response.
   * 6. Verify the model generates a non-empty final streamed response.
   *
   * @param {InstanceType<this["Cls"]>["ParsedCallOptions"] | undefined} callOptions Optional call options to pass to the model.
   *  These options will be applied to the model at runtime.
   */
  async testModelCanUseToolUseAIMessageWithStreaming(
    callOptions?: InstanceType<this["Cls"]>["ParsedCallOptions"]
  ) {
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

    // Define a simple weather schema for the tool
    const weatherSchema = z.object({
      location: z.string().describe("The location to get the weather for."),
    });

    // Create a mock weather tool that always returns sunny weather
    const weatherTool = tool(
      (_) => "The weather in San Francisco is 70 degrees and sunny.",
      {
        name: "get_current_weather",
        schema: weatherSchema,
        description: "Get the current weather for a location.",
      }
    );

    // Bind the weather tool to the model
    const modelWithTools = model.bindTools([weatherTool]);

    // Initialize the conversation with a weather query
    const messages = [
      new HumanMessage(
        "What's the weather like in San Francisco right now? Use the 'get_current_weather' tool to find the answer."
      ),
    ];

    // Stream the initial query and expect a tool call
    const stream = await modelWithTools.stream(messages, callOptions);
    let result: AIMessageChunk | undefined;
    for await (const chunk of stream) {
      // Concatenate chunks to build the complete response
      result = !result ? chunk : concat(result, chunk);
    }

    expect(result).toBeDefined();
    if (!result) return;

    // Verify that the streamed result contains a tool call
    expect(result.tool_calls?.[0]).toBeDefined();
    if (!result.tool_calls?.[0]) {
      throw new Error("result.tool_calls is undefined");
    }

    const { tool_calls } = result;
    expect(tool_calls[0].name).toBe("get_current_weather");

    // Add the model's response (including tool call) to the conversation
    messages.push(result);

    // Simulate the tool's response
    const toolMessage = new ToolMessage({
      tool_call_id: tool_calls[0].id ?? "",
      name: tool_calls[0].name,
      content: await weatherTool.invoke(
        tool_calls[0].args as z.infer<typeof weatherSchema>
      ),
    });
    messages.push(toolMessage);

    // Stream a followup request including the tool call and response
    const finalStream = await modelWithTools.stream(messages, callOptions);
    let finalResult: AIMessageChunk | undefined;
    for await (const chunk of finalStream) {
      // Concatenate chunks to build the complete final response
      finalResult = !finalResult ? chunk : concat(finalResult, chunk);
    }

    expect(finalResult).toBeDefined();
    if (!finalResult) return;

    // Verify that the model generated a non-empty streamed response
    expect(finalResult.content).not.toBe("");
  }

  /**
   * Tests the chat model's ability to handle a more complex tool schema.
   * This test verifies that the model can correctly process and use a tool
   * with a schema that includes a `z.record(z.unknown())` field, which
   * represents an object with unknown/any fields.
   *
   * The test performs the following steps:
   * 1. Defines a complex schema with nested objects and unknown fields.
   * 2. Creates a chat prompt template that instructs the model to use the tool.
   * 3. Invokes the model with structured output using the complex schema.
   * 4. Verifies that the result contains all expected fields and types.
   *
   * This test is particularly important for ensuring compatibility with APIs
   * that may not accept JSON schemas with unknown object fields (e.g., Google's API).
   *
   * @param {InstanceType<this["Cls"]>["ParsedCallOptions"] | undefined} callOptions Optional call options to pass to the model.
   *  These options will be applied to the model at runtime.
   */
  async testInvokeMoreComplexTools(
    callOptions?: InstanceType<this["Cls"]>["ParsedCallOptions"]
  ) {
    // Skip the test if the model doesn't support tool calling
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

    // Define a complex schema with nested objects and a record of unknown fields
    const complexSchema = z.object({
      decision: z.enum(["UseAPI", "UseFallback"]),
      explanation: z.string(),
      apiDetails: z.object({
        serviceName: z.string(),
        endpointName: z.string(),
        parameters: z.record(z.unknown()), // This field represents an object with any structure
        extractionPath: z.string(),
      }),
    });
    const toolName = "service_tool";

    // Create a chat prompt template that instructs the model to use the tool
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", "You're a helpful assistant. Always use the {toolName} tool."],
      [
        "human",
        `I want to use the UseAPI because it's faster. For the API details use the following:
Service name: {serviceName}
Endpoint name: {endpointName}
Parameters: {parameters}
Extraction path: {extractionPath}`,
      ],
    ]);

    // Bind the complex schema to the model as a structured output tool
    const modelWithTools = model.withStructuredOutput(complexSchema, {
      name: toolName,
    });

    // Invoke the model with the prompt and tool
    const result = await prompt.pipe(modelWithTools).invoke(
      {
        toolName,
        serviceName: "MyService",
        endpointName: "MyEndpoint",
        parameters: JSON.stringify({ param1: "value1", param2: "value2" }),
        extractionPath: "Users/johndoe/data",
      },
      callOptions
    );

    // Verify that all expected fields are present and of the correct type
    expect(result.decision).toBeDefined();
    expect(result.explanation).toBeDefined();
    expect(result.apiDetails).toBeDefined();
    expect(typeof result.apiDetails === "object").toBeTruthy();
  }

  /**
   * Tests the chat model's ability to handle parallel tool calls.
   * This test is specifically designed for models that support calling multiple tools
   * simultaneously in a single interaction.
   *
   * The test performs the following steps:
   * 1. Creates a chat model and binds two tools: a weather tool and a calculator tool.
   * 2. Invokes the model with a prompt that requires using both tools.
   * 3. Verifies that the model calls at least two tools in its response.
   * 4. Checks that both the weather tool and calculator tool were called.
   *
   * This test ensures that the model can correctly process and respond to prompts
   * that require multiple tool calls, demonstrating its ability to handle complex,
   * multi-tool scenarios efficiently.
   *
   * @param {InstanceType<this["Cls"]>["ParsedCallOptions"] | undefined} callOptions Optional call options to pass to the model.
   *  These options will be applied to the model at runtime.
   */
  async testParallelToolCalls(
    callOptions?: InstanceType<this["Cls"]>["ParsedCallOptions"]
  ) {
    // Skip the test if the model doesn't support tool calling
    if (!this.chatModelHasToolCalling) {
      console.log("Test requires tool calling. Skipping...");
      return;
    }
    // Skip the test if the model doesn't support parallel tool calls
    if (!this.supportsParallelToolCalls) {
      console.log("Test requires parallel tool calls. Skipping...");
      return;
    }
    const model = new this.Cls(this.constructorArgs);
    if (!model.bindTools) {
      throw new Error(
        "bindTools undefined. Cannot test OpenAI formatted tool calls."
      );
    }

    const weatherTool = tool((_) => "no-op", {
      name: "get_current_weather",
      description: "Get the current weather for a location.",
      schema: z.object({
        location: z.string().describe("The location to get the weather for."),
      }),
    });
    const calculatorTool = tool((_) => "no-op", {
      name: "calculator",
      description: "Calculate the result of a given math expression.",
      schema: z.object({
        expression: z.string().describe("The math expression to evaluate."),
      }),
    });

    const modelWithTools = model.bindTools([weatherTool, calculatorTool]);

    const result: AIMessage = await modelWithTools.invoke(
      "What is the current weather in San Francisco? Also, using a calculator tool, what is 246293 times 18462 plus 1817?",
      callOptions
    );
    // Model should call at least two tools. Using greater than or equal since it might call the calculator tool multiple times.
    expect(result.tool_calls?.length).toBeGreaterThanOrEqual(2);
    if (!result.tool_calls?.length) return;

    const weatherToolCalls = result.tool_calls.find(
      (tc) => tc.name === weatherTool.name
    );
    const calculatorToolCalls = result.tool_calls.find(
      (tc) => tc.name === calculatorTool.name
    );

    expect(weatherToolCalls).toBeDefined();
    expect(calculatorToolCalls).toBeDefined();
  }

  /**
   * Tests the chat model's ability to handle parallel tool calls while streaming.
   * This test is specifically designed for models that support calling multiple tools
   * simultaneously in a single interaction and can stream the response.
   *
   * The test performs the following steps:
   * 1. Creates a chat model and binds two tools: a weather tool and a calculator tool.
   * 2. Streams the model's response to a prompt that requires using both tools.
   * 3. Concatenates the streamed chunks into a final result.
   * 4. Verifies that the final result contains at least two tool calls.
   * 5. Checks that both the weather tool and calculator tool were called.
   *
   * This test ensures that the model can correctly process and stream responses to prompts
   * that require multiple tool calls, demonstrating its ability to handle complex,
   * multi-tool scenarios efficiently in a streaming context.
   *
   * @param {InstanceType<this["Cls"]>["ParsedCallOptions"] | undefined} callOptions Optional call options to pass to the model.
   *  These options will be applied to the model at runtime.
   */
  async testStreamingParallelToolCalls(
    callOptions?: InstanceType<this["Cls"]>["ParsedCallOptions"]
  ) {
    // Skip the test if the model doesn't support tool calling
    if (!this.chatModelHasToolCalling) {
      console.log("Test requires tool calling. Skipping...");
      return;
    }
    // Skip the test if the model doesn't support parallel tool calls
    if (!this.supportsParallelToolCalls) {
      console.log("Test requires parallel tool calls. Skipping...");
      return;
    }
    const model = new this.Cls(this.constructorArgs);
    if (!model.bindTools) {
      throw new Error(
        "bindTools undefined. Cannot test OpenAI formatted tool calls."
      );
    }

    const weatherTool = tool((_) => "no-op", {
      name: "get_current_weather",
      description: "Get the current weather for a location.",
      schema: z.object({
        location: z.string().describe("The location to get the weather for."),
      }),
    });
    const calculatorTool = tool((_) => "no-op", {
      name: "calculator",
      description: "Calculate the result of a given math expression.",
      schema: z.object({
        expression: z.string().describe("The math expression to evaluate."),
      }),
    });

    const modelWithTools = model.bindTools([weatherTool, calculatorTool]);

    const stream = await modelWithTools.stream(
      "What is the current weather in San Francisco? Also, using a calculator tool, what is 246293 times 18462 plus 1817?",
      callOptions
    );
    let finalChunk: AIMessageChunk | undefined;
    for await (const chunk of stream) {
      finalChunk = !finalChunk ? chunk : concat(finalChunk, chunk);
    }

    expect(finalChunk).toBeDefined();
    if (!finalChunk) return;

    // Model should call at least two tools. Using greater than or equal since it might call the calculator tool multiple times.
    expect(finalChunk.tool_calls?.length).toBeGreaterThanOrEqual(2);
    if (!finalChunk.tool_calls?.length) return;

    const weatherToolCalls = finalChunk.tool_calls.find(
      (tc) => tc.name === weatherTool.name
    );
    const calculatorToolCalls = finalChunk.tool_calls.find(
      (tc) => tc.name === calculatorTool.name
    );

    expect(weatherToolCalls).toBeDefined();
    expect(calculatorToolCalls).toBeDefined();
  }

  /**
   * Tests the chat model's ability to process and respond to a message history containing parallel tool calls.
   * This test is specifically designed for models that support parallel tool calling,
   * such as advanced language models with multi-tool capabilities.
   *
   * The test performs the following steps:
   * 1. Creates a chat model and binds weather and calculator tools to it.
   * 2. Constructs a message history that includes a HumanMessage, an AIMessage with parallel tool calls,
   *    and ToolMessages with the tools' responses.
   * 3. Invokes the model with this message history.
   * 4. Verifies that the result does not contain any new tool calls.
   * 5. Checks that the result contains a non-empty content response.
   *
   * This test ensures that the model can correctly process and respond to complex message
   * histories that include parallel tool calls and their responses, without making unnecessary
   * additional tool calls.
   *
   * @param {InstanceType<this["Cls"]>["ParsedCallOptions"] | undefined} callOptions Optional call options to pass to the model.
   *  These options will be applied to the model at runtime.
   */
  async testParallelToolCallResults(
    callOptions?: InstanceType<this["Cls"]>["ParsedCallOptions"]
  ) {
    // Skip the test if the model doesn't support tool calling
    if (!this.chatModelHasToolCalling) {
      console.log("Test requires tool calling. Skipping...");
      return;
    }
    // Skip the test if the model doesn't support parallel tool calls
    if (!this.supportsParallelToolCalls) {
      console.log("Test requires parallel tool calls. Skipping...");
      return;
    }
    const model = new this.Cls(this.constructorArgs);
    if (!model.bindTools) {
      throw new Error(
        "bindTools undefined. Cannot test OpenAI formatted tool calls."
      );
    }

    const weatherTool = tool((_) => "no-op", {
      name: "get_current_weather",
      description: "Get the current weather for a location.",
      schema: z.object({
        location: z.string().describe("The location to get the weather for."),
      }),
    });
    const calculatorTool = tool((_) => "no-op", {
      name: "calculator",
      description: "Calculate the result of a given math expression.",
      schema: z.object({
        expression: z.string().describe("The math expression to evaluate."),
      }),
    });
    // Even though we're not invoking these tools, we must ensure they are bound to the model
    // as most model APIs require tools to be bound if they're referenced in the chat history.
    const modelWithTools = model.bindTools([weatherTool, calculatorTool]);

    const messageHistory = [
      new HumanMessage(
        "What is the current weather in San Francisco? Also, using a calculator tool, what is 246293 times 18462 plus 1817?"
      ),
      new AIMessage({
        content: "",
        tool_calls: [
          {
            name: "get_current_weather",
            id: "weather_call",
            args: {
              location: "San Francisco",
            },
          },
          {
            name: "calculator",
            id: "calculator_call",
            args: {
              expression: "(246293 * 18462) + 1817",
            },
          },
        ],
      }),
      new ToolMessage({
        name: "get_current_weather",
        tool_call_id: "weather_call",
        content: "It is currently 24 degrees with hail in San Francisco.",
      }),
      new ToolMessage({
        name: "calculator",
        tool_call_id: "calculator_call",
        content: "(246293 * 18462) + 1817 = 4547063183",
      }),
    ];

    const result: AIMessage = await modelWithTools.invoke(
      messageHistory,
      callOptions
    );
    // The model should NOT call a tool given this message history.
    expect(result.tool_calls ?? []).toHaveLength(0);

    if (typeof result.content === "string") {
      expect(result.content).not.toBe("");
    } else {
      expect(result.content.length).toBeGreaterThan(0);
      const textOrTextDeltaContent = result.content.find(
        (c) => c.type === "text" || c.type === "text_delta"
      );
      expect(textOrTextDeltaContent).toBeDefined();
    }
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
      console.error("testInvoke failed", e.message);
    }

    try {
      await this.testStream();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testStream failed", e.message);
    }

    try {
      await this.testBatch();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testBatch failed", e.message);
    }

    try {
      await this.testConversation();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testConversation failed", e.message);
    }

    try {
      await this.testUsageMetadata();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testUsageMetadata failed", e.message);
    }

    try {
      await this.testUsageMetadataStreaming();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testUsageMetadataStreaming failed", e.message);
    }

    try {
      await this.testToolMessageHistoriesStringContent();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testToolMessageHistoriesStringContent failed", e.message);
    }

    try {
      await this.testToolMessageHistoriesListContent();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testToolMessageHistoriesListContent failed", e.message);
    }

    try {
      await this.testStructuredFewShotExamples();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testStructuredFewShotExamples failed", e.message);
    }

    try {
      await this.testWithStructuredOutput();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testWithStructuredOutput failed", e.message);
    }

    try {
      await this.testWithStructuredOutputIncludeRaw();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testWithStructuredOutputIncludeRaw failed", e.message);
    }

    try {
      await this.testBindToolsWithOpenAIFormattedTools();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testBindToolsWithOpenAIFormattedTools failed", e.message);
    }

    try {
      await this.testBindToolsWithRunnableToolLike();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testBindToolsWithRunnableToolLike failed", e.message);
    }

    try {
      await this.testCacheComplexMessageTypes();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testCacheComplexMessageTypes failed", e.message);
    }

    try {
      await this.testStreamTokensWithToolCalls();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testStreamTokensWithToolCalls failed", e.message);
    }

    try {
      await this.testModelCanUseToolUseAIMessage();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testModelCanUseToolUseAIMessage failed", e.message);
    }

    try {
      await this.testModelCanUseToolUseAIMessageWithStreaming();
    } catch (e: any) {
      allTestsPassed = false;
      console.error(
        "testModelCanUseToolUseAIMessageWithStreaming failed",
        e.message
      );
    }

    try {
      await this.testInvokeMoreComplexTools();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testInvokeMoreComplexTools failed", e.message);
    }

    try {
      await this.testParallelToolCalls();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testParallelToolCalls failed", e.message);
    }

    try {
      await this.testStreamingParallelToolCalls();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testStreamingParallelToolCalls failed", e.message);
    }

    try {
      await this.testParallelToolCallResults();
    } catch (e: any) {
      allTestsPassed = false;
      console.error("testParallelToolCallResults failed", e.message);
    }

    return allTestsPassed;
  }
}
