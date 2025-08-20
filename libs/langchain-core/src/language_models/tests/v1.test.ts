import { describe, it } from "vitest";
import {
  BaseChatModelCallOptions,
  BaseChatModelInput,
  BaseChatModelParams,
  BaseChatModelV1,
  BindToolsInput,
  ChatModelOutputParser,
  StructuredOutputMethodOptions,
} from "../v1.js";
import { InteropZodType } from "../../utils/types/zod.js";
import { JSONSchema } from "../../utils/json_schema.js";
import { Runnable } from "../../runnables/base.js";
import { AIMessage, Message } from "../../_standard/message.js";
import { CallbackManagerForChatModelRun } from "../../callbacks/manager.js";
import { AIMessageChunk, MessageChunk } from "../../_standard/chunk.js";

interface SimpleChatModelParams extends BaseChatModelParams {
  tools?: BindToolsInput[];
}

interface SimpleChatModelCallOptions extends BaseChatModelCallOptions {
  tools?: BindToolsInput[];
  tool_choice?: string;
}

class SimpleChatModel<
  TOutputParser extends ChatModelOutputParser | undefined = undefined
> extends BaseChatModelV1<SimpleChatModelCallOptions, TOutputParser> {
  constructor(params: SimpleChatModelParams) {
    super(params);
  }

  _llmType(): string {
    return "simple-chat-model-v1-test";
  }

  async generate(
    input: BaseChatModelInput,
    options: SimpleChatModelCallOptions,
    runManager?: CallbackManagerForChatModelRun
  ): Promise<Message> {
    return new AIMessage("wassup");
  }

  async *streamResponseChunks(
    input: BaseChatModelInput,
    options: SimpleChatModelCallOptions,
    runManager?: CallbackManagerForChatModelRun
  ): AsyncGenerator<MessageChunk> {
    for (const char of "wassup") {
      yield new AIMessageChunk(char);
    }
  }

  bindTools(tools: BindToolsInput[]): this {
    return this.withConfig({ tools });
  }

  withStructuredOutput<Output>(
    schema: InteropZodType<Output> | JSONSchema,
    config?: StructuredOutputMethodOptions<false>
  ): SimpleChatModel<Runnable<Message, Output>>;

  withStructuredOutput<Output>(
    schema: InteropZodType<Output> | JSONSchema,
    config?: StructuredOutputMethodOptions<true>
  ): SimpleChatModel<Runnable<Message, { raw: Message; parsed: Output }>>;

  withStructuredOutput<Output>(
    schema: InteropZodType<Output> | JSONSchema,
    config?: StructuredOutputMethodOptions<boolean>
  ):
    | SimpleChatModel<Runnable<Message, Output>>
    | SimpleChatModel<Runnable<Message, { raw: Message; parsed: Output }>> {
    return super.withStructuredOutput(schema, config) as
      | SimpleChatModel<Runnable<Message, Output>>
      | SimpleChatModel<Runnable<Message, { raw: Message; parsed: Output }>>;
  }
}

const makeToolDefinition = (name: string) => {
  return {
    type: "function" as const,
    function: {
      name,
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  };
};

describe("SimpleChatModel", () => {
  it("can string multiple .bindTools() calls", () => {
    const model = new SimpleChatModel({})
      .bindTools([makeToolDefinition("tool1")])
      .bindTools([makeToolDefinition("tool2")])
      .bindTools([makeToolDefinition("tool3")]);
  });
  it("can string multiple .withStructuredOutput() calls", () => {
    const model = new SimpleChatModel({})
      .withStructuredOutput({
        type: "object",
        properties: {},
        required: [],
      })
      .withStructuredOutput({
        type: "object",
        properties: {},
        required: [],
      });
  });
  it("can string multiple config modifying calls", () => {
    const model = new SimpleChatModel({})
      .bindTools([makeToolDefinition("tool1")])
      .withStructuredOutput({
        type: "object",
        properties: {},
        required: [],
      })
      .bindTools([makeToolDefinition("tool2")])
      .withConfig({
        tool_choice: "any",
      })
      .withStructuredOutput({
        type: "object",
        properties: {},
        required: [],
      })
      .bindTools([makeToolDefinition("tool3")]);
  });
});
