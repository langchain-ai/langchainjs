import { describe, it } from "vitest";
import { z } from "zod";
import {
  BaseChatModel,
  BaseChatModelCallOptions,
  BaseChatModelParams,
  BindToolsInput,
} from "../chat_models.js";
import { BaseMessage } from "../../messages/base.js";
import { AIMessage, AIMessageChunk } from "../../messages/ai.js";
import { ChatGenerationChunk, ChatResult } from "../../outputs.js";
import { StructuredOutputMethodOptions } from "../base.js";
import { InteropZodType } from "../../utils/types/zod.js";
import { JSONSchema } from "../../utils/json_schema.js";

interface SimpleChatModelCallOptions extends BaseChatModelCallOptions {
  tools?: BindToolsInput[];
  temperature?: number;
}

class SimpleChatModel<
  CallOptions extends SimpleChatModelCallOptions,
  Output
> extends BaseChatModel<SimpleChatModelCallOptions, Output> {
  constructor(fields: BaseChatModelParams) {
    super(fields);
  }

  _llmType() {
    return "simple_chat_model";
  }

  async _generate(
    _messages: BaseMessage[],
    _options: SimpleChatModelCallOptions
  ): Promise<ChatResult> {
    return Promise.resolve({
      generations: [
        {
          message: new AIMessage({
            content: "wassup",
          }),
          text: "wassup",
        },
      ],
    });
  }

  async *_streamResponseChunks(
    _messages: BaseMessage[],
    _options: SimpleChatModelCallOptions
  ): AsyncGenerator<ChatGenerationChunk> {
    for (const char of "wassup") {
      yield new ChatGenerationChunk({
        text: char,
        message: new AIMessageChunk({
          content: char,
        }),
      });
    }
  }

  withConfig(config: SimpleChatModelCallOptions) {
    return super.withConfig(config);
  }

  bindTools(tools: BindToolsInput[]) {
    return this.withConfig({
      tools: [...(this.defaultOptions.tools ?? []), ...tools],
    });
  }

  withStructuredOutput<Output>(
    schema: InteropZodType<Output> | JSONSchema,
    config?: StructuredOutputMethodOptions<false>
  ): SimpleChatModel<CallOptions, Output>;

  withStructuredOutput<Output>(
    schema: InteropZodType<Output> | JSONSchema,
    config?: StructuredOutputMethodOptions<true>
  ): SimpleChatModel<CallOptions, { raw: BaseMessage; parsed: Output }>;

  withStructuredOutput<Output>(
    schema: InteropZodType<Output> | JSONSchema,
    config?: StructuredOutputMethodOptions<boolean>
  ):
    | SimpleChatModel<CallOptions, Output>
    | SimpleChatModel<CallOptions, { raw: BaseMessage; parsed: Output }> {
    return super.withStructuredOutput(schema, config) as
      | SimpleChatModel<CallOptions, Output>
      | SimpleChatModel<CallOptions, { raw: BaseMessage; parsed: Output }>;
  }
}

describe("SimpleChatModel", () => {
  const toolDefinition = (name: string) => ({
    type: "function",
    function: {
      name,
      description: "A test tool",
      parameters: {
        type: "object",
      },
    },
  });

  it("can string multiple bindTools calls", () => {
    const model = new SimpleChatModel({})
      .bindTools([toolDefinition("foo")])
      .bindTools([toolDefinition("bar")])
      .withStructuredOutput(
        z.object({
          foo: z.string(),
          bar: z.string(),
        })
      );
    expect(model.defaultOptions.tools?.length).toBe(2);
    expect(model.outputParser).toBeDefined();
  });

  it("can string multiple withStructuredOutput calls", () => {
    const model = new SimpleChatModel({})
      .withStructuredOutput(
        z.object({
          foo: z.string(),
        })
      )
      .withStructuredOutput(
        z.object({
          bar: z.string(),
        })
      );
    // this should technically be 1, but `SimpleChatModel` doesn't
    // handle tools with naming collisions (pretty simply to rectify)
    expect(model.defaultOptions.tools?.length).toBe(2);
    expect(model.outputParser).toBeDefined();
  });

  it("can string multiple config modifying calls", () => {
    const model = new SimpleChatModel({})
      .withConfig({ temperature: 0.5 })
      .bindTools([toolDefinition("foo")])
      .withConfig({ temperature: 0.7 })
      .withStructuredOutput(
        z.object({
          foo: z.string(),
        })
      )
      .bindTools([toolDefinition("bar")])
      .withStructuredOutput(
        z.object({
          bar: z.string(),
        })
      );
    expect(model.defaultOptions.temperature).toBe(0.7);
    // same case here
    expect(model.defaultOptions.tools?.length).toBe(4);
    expect(model.outputParser).toBeDefined();
  });
});
