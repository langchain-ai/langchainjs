import { CallbackManagerForLLMRun } from "../../callbacks/manager.js";
import {
  BaseChatModel,
  BaseChatModelCallOptions,
  BaseChatModelParams,
  BindToolsInput,
  ChatModelOutputParser,
} from "../../language_models/chat_models.js";
import { BaseLLMParams } from "../../language_models/llms.js";
import {
  BaseMessage,
  AIMessage,
  AIMessageChunk,
} from "../../messages/index.js";
import { type ChatResult, ChatGenerationChunk } from "../../outputs.js";
import {
  AnyAIMessage,
  StructuredOutputMethodOptions,
} from "../../language_models/base.js";
import { JSONSchema, toJsonSchema } from "../json_schema.js";
import { InteropZodType } from "../types/zod.js";
import { RunnableLambda } from "../../runnables/base.js";

/**
 * Interface specific to the Fake Streaming Chat model.
 */
export interface FakeStreamingChatModelCallOptions
  extends BaseChatModelCallOptions {
  /** Tools to bind to the model for function calling */
  tools?: BindToolsInput[];
  /** This key doesn't do anything, but is here to test example call options */
  temperature?: number;
}

/**
 * Interface for the Constructor-field specific to the Fake Streaming Chat model (all optional because we fill in defaults).
 */
export interface FakeStreamingChatModelFields extends BaseChatModelParams {
  /** Milliseconds to pause between fallback char-by-char chunks */
  sleep?: number;

  /** Full AI messages to fall back to when no `chunks` supplied */
  responses?: BaseMessage[];

  /** Exact chunks to emit (can include tool-call deltas) */
  chunks?: AIMessageChunk[];

  /** How tool specs are formatted in `bindTools` */
  toolStyle?: "openai" | "anthropic" | "bedrock" | "google";

  /** Throw this error instead of streaming (useful in tests) */
  thrownErrorString?: string;
}

export class FakeStreamingChatModel<
  CallOptions extends FakeStreamingChatModelCallOptions = FakeStreamingChatModelCallOptions,
  TOutput = AIMessageChunk
> extends BaseChatModel<CallOptions, TOutput> {
  sleep = 50;

  responses: BaseMessage[] = [];

  chunks: AIMessageChunk[] = [];

  toolStyle: "openai" | "anthropic" | "bedrock" | "google" = "openai";

  thrownErrorString?: string;

  constructor(protected fields: FakeStreamingChatModelFields & BaseLLMParams) {
    super(fields);
    this.sleep = fields.sleep ?? 50;
    this.responses = fields.responses ?? [];
    this.chunks = fields.chunks ?? [];
    this.toolStyle = fields.toolStyle ?? "openai";
    this.thrownErrorString = fields.thrownErrorString;
  }

  _llmType() {
    return "fake";
  }

  bindTools(tools: BindToolsInput[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolDicts = tools.map((tool: Record<string, any>) => {
      switch (this.toolStyle) {
        case "openai":
          return {
            type: "function",
            function: {
              name: tool.name,
              description: tool.description,
              parameters: toJsonSchema(tool.schema),
            },
          };
        case "anthropic":
          return {
            name: tool.name,
            description: tool.description,
            input_schema: toJsonSchema(tool.schema),
          };
        case "bedrock":
          return {
            toolSpec: {
              name: tool.name,
              description: tool.description,
              inputSchema: toJsonSchema(tool.schema),
            },
          };
        case "google":
          return {
            name: tool.name,
            description: tool.description,
            parameters: toJsonSchema(tool.schema),
          };
        default:
          return tool;
      }
    });

    const mergedTools = [...(this.defaultOptions.tools ?? []), ...toolDicts];
    return this.withConfig({ tools: mergedTools } as Partial<CallOptions>);
  }

  async _generate(
    messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    if (this.thrownErrorString) {
      throw new Error(this.thrownErrorString);
    }

    const content = this.responses?.[0]?.content ?? messages[0].content ?? "";

    const generation: ChatResult = {
      generations: [
        {
          text: "",
          message: new AIMessage({
            content,
            tool_calls: this.chunks?.[0]?.tool_calls,
          }),
        },
      ],
    };

    return generation;
  }

  async *_streamResponseChunks(
    _messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    if (this.thrownErrorString) {
      throw new Error(this.thrownErrorString);
    }
    if (this.chunks?.length) {
      for (const msgChunk of this.chunks) {
        const cg = new ChatGenerationChunk({
          message: new AIMessageChunk({
            content: msgChunk.content,
            tool_calls: msgChunk.tool_calls,
            additional_kwargs: msgChunk.additional_kwargs ?? {},
          }),
          text: msgChunk.content?.toString() ?? "",
        });

        yield cg;
        await runManager?.handleLLMNewToken(
          msgChunk.content as string,
          undefined,
          undefined,
          undefined,
          undefined,
          { chunk: cg }
        );
      }
      return;
    }

    const fallback =
      this.responses?.[0] ??
      new AIMessage(
        typeof _messages[0].content === "string" ? _messages[0].content : ""
      );
    const text = typeof fallback.content === "string" ? fallback.content : "";

    for (const ch of text) {
      await new Promise((r) => setTimeout(r, this.sleep));
      const cg = new ChatGenerationChunk({
        message: new AIMessageChunk({ content: ch }),
        text: ch,
      });
      yield cg;
      await runManager?.handleLLMNewToken(
        ch,
        undefined,
        undefined,
        undefined,
        undefined,
        { chunk: cg }
      );
    }
  }

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    TOutput extends Record<string, any> = Record<string, any>
  >(
    schema: InteropZodType<TOutput> | JSONSchema,
    config?: StructuredOutputMethodOptions<false>
  ): FakeStreamingChatModel<CallOptions, TOutput>;

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    TOutput extends Record<string, any> = Record<string, any>
  >(
    schema: InteropZodType<TOutput> | JSONSchema,
    config?: StructuredOutputMethodOptions<true>
  ): FakeStreamingChatModel<
    CallOptions,
    { raw: AnyAIMessage; parsed: TOutput }
  >;

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    TOutput extends Record<string, any> = Record<string, any>
  >(
    schema: InteropZodType<TOutput> | JSONSchema,
    config?: StructuredOutputMethodOptions<boolean>
  ):
    | FakeStreamingChatModel<CallOptions, TOutput>
    | FakeStreamingChatModel<
        CallOptions,
        { raw: AnyAIMessage; parsed: TOutput }
      > {
    return super.withStructuredOutput(schema, config) as
      | FakeStreamingChatModel<CallOptions, TOutput>
      | FakeStreamingChatModel<
          CallOptions,
          { raw: AnyAIMessage; parsed: TOutput }
        >;
  }
}

/**
 * Interface for call options specific to the Fake List Chat model.
 */
export interface FakeListChatModelCallOptions extends BaseChatModelCallOptions {
  /** Error string to throw instead of returning a response (useful in tests) */
  thrownErrorString?: string;

  /** Tools to bind to the model for function calling */
  tools?: BindToolsInput[];

  /** This key doesn't do anything, but is here to test example call options */
  temperature?: number;
}

/**
 * Interface for the input parameters specific to the Fake List Chat model.
 */
export interface FakeListChatModelFields extends BaseChatModelParams {
  /** Responses to return */
  responses: string[];

  /** Time to sleep in milliseconds between responses */
  sleep?: number;

  emitCustomEvent?: boolean;
}

/**
 * A fake Chat Model that returns a predefined list of responses. It can be used
 * for testing purposes.
 * @example
 * ```typescript
 * const chat = new FakeListChatModel({
 *   responses: ["I'll callback later.", "You 'console' them!"]
 * });
 *
 * const firstMessage = new HumanMessage("You want to hear a JavaScript joke?");
 * const secondMessage = new HumanMessage("How do you cheer up a JavaScript developer?");
 *
 * // Call the chat model with a message and log the response
 * const firstResponse = await chat.call([firstMessage]);
 * console.log({ firstResponse });
 *
 * const secondResponse = await chat.call([secondMessage]);
 * console.log({ secondResponse });
 * ```
 */
export class FakeListChatModel<
  CallOptions extends FakeListChatModelCallOptions = FakeListChatModelCallOptions,
  TOutput = AIMessageChunk
> extends BaseChatModel<CallOptions, TOutput> {
  static lc_name() {
    return "FakeListChatModel";
  }

  lc_serializable = true;

  responses: string[];

  i = 0;

  sleep?: number;

  emitCustomEvent = false;

  constructor(params: FakeListChatModelFields) {
    super(params);
    const { responses, sleep, emitCustomEvent } = params;
    this.responses = responses;
    this.sleep = sleep;
    this.emitCustomEvent = emitCustomEvent ?? this.emitCustomEvent;
  }

  _combineLLMOutput() {
    return [];
  }

  _llmType(): string {
    return "fake-list";
  }

  async _generate(
    _messages: BaseMessage[],
    options?: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    await this._sleepIfRequested();
    const combinedOptions = this._combineCallOptions(options);
    if (combinedOptions?.thrownErrorString) {
      throw new Error(combinedOptions.thrownErrorString);
    }
    if (this.emitCustomEvent) {
      await runManager?.handleCustomEvent("some_test_event", {
        someval: true,
      });
    }

    if (combinedOptions?.stop?.length) {
      return {
        generations: [this._formatGeneration(combinedOptions.stop[0])],
      };
    } else {
      const response = this._currentResponse();
      this._incrementResponse();

      return {
        generations: [this._formatGeneration(response)],
        llmOutput: {},
      };
    }
  }

  _formatGeneration(text: string) {
    return {
      message: new AIMessage(text),
      text,
    };
  }

  async *_streamResponseChunks(
    _messages: BaseMessage[],
    options: CallOptions,
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const combinedOptions = this._combineCallOptions(options);
    const response = this._currentResponse();
    this._incrementResponse();
    if (this.emitCustomEvent) {
      await runManager?.handleCustomEvent("some_test_event", {
        someval: true,
      });
    }

    for await (const text of response) {
      await this._sleepIfRequested();
      if (combinedOptions?.thrownErrorString) {
        throw new Error(combinedOptions.thrownErrorString);
      }
      const chunk = this._createResponseChunk(text);
      yield chunk;
      // eslint-disable-next-line no-void
      void runManager?.handleLLMNewToken(text);
    }
  }

  async _sleepIfRequested() {
    if (this.sleep !== undefined) {
      await this._sleep();
    }
  }

  async _sleep() {
    return new Promise<void>((resolve) => {
      setTimeout(() => resolve(), this.sleep);
    });
  }

  _createResponseChunk(text: string): ChatGenerationChunk {
    return new ChatGenerationChunk({
      message: new AIMessageChunk({ content: text }),
      text,
    });
  }

  _currentResponse() {
    return this.responses[this.i];
  }

  _incrementResponse() {
    if (this.i < this.responses.length - 1) {
      this.i += 1;
    } else {
      this.i = 0;
    }
  }

  bindTools(tools: BindToolsInput[]) {
    const mergedTools = [...(this.defaultOptions.tools ?? []), ...tools];
    return this.withConfig({ tools: mergedTools } as Partial<CallOptions>);
  }

  protected withOutputParser<TOutput extends Record<string, unknown>>(
    outputParser: ChatModelOutputParser<TOutput>
  ): FakeListChatModel<CallOptions, TOutput> {
    return super.withOutputParser(outputParser) as FakeListChatModel<
      CallOptions,
      TOutput
    >;
  }

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    TOutput extends Record<string, any> = Record<string, any>
  >(
    schema: InteropZodType<TOutput> | JSONSchema,
    config?: StructuredOutputMethodOptions<false>
  ): FakeListChatModel<CallOptions, TOutput>;

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    TOutput extends Record<string, any> = Record<string, any>
  >(
    schema: InteropZodType<TOutput> | JSONSchema,
    config?: StructuredOutputMethodOptions<true>
  ): FakeListChatModel<CallOptions, { raw: AnyAIMessage; parsed: TOutput }>;

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    TOutput extends Record<string, any> = Record<string, any>
  >(
    _schema: InteropZodType<TOutput> | JSONSchema,
    _config?: StructuredOutputMethodOptions<boolean>
  ):
    | FakeListChatModel<CallOptions, TOutput>
    | FakeListChatModel<CallOptions, { raw: AnyAIMessage; parsed: TOutput }> {
    return this.withOutputParser(
      RunnableLambda.from<AIMessage, TOutput>((input) => {
        if (input.tool_calls?.[0]?.args) {
          return input.tool_calls[0].args as TOutput;
        }
        if (typeof input.content === "string") {
          return JSON.parse(input.content);
        }
        throw new Error("No structured output found");
      })
    );
  }
}

export class FakeChatModel extends BaseChatModel {
  _combineLLMOutput() {
    return [];
  }

  _llmType(): string {
    return "fake";
  }

  async _generate(
    messages: BaseMessage[],
    options?: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    if (options?.stop?.length) {
      return {
        generations: [
          {
            message: new AIMessage(options.stop[0]),
            text: options.stop[0],
          },
        ],
      };
    }
    const text = messages
      .map((m) => {
        if (typeof m.content === "string") {
          return m.content;
        }
        return JSON.stringify(m.content, null, 2);
      })
      .join("\n");
    await runManager?.handleLLMNewToken(text);
    return {
      generations: [
        {
          message: new AIMessage(text),
          text,
        },
      ],
      llmOutput: {},
    };
  }
}
