import { CallbackManagerForLLMRun } from "../../callbacks/manager.js";
import {
  BaseChatModel,
  BaseChatModelCallOptions,
  BaseChatModelParams,
} from "../../language_models/chat_models.js";
import { BaseLLMParams } from "../../language_models/llms.js";
import {
  BaseMessage,
  AIMessage,
  AIMessageChunk,
} from "../../messages/index.js";
import { type ChatResult, ChatGenerationChunk } from "../../outputs.js";
import { Runnable, RunnableLambda } from "../../runnables/base.js";
import { StructuredTool } from "../../tools/index.js";
import {
  StructuredOutputMethodParams,
  BaseLanguageModelInput,
  StructuredOutputMethodOptions,
} from "../../language_models/base.js";

import { toJsonSchema } from "../json_schema.js";
import { InteropZodType } from "../types/zod.js";

/** Minimal shape actually needed by `bindTools` */
export interface ToolSpec {
  name: string;
  description?: string;
  schema: InteropZodType | Record<string, unknown>; // Either a Zod schema *or* a plain JSON-Schema object
}

/**
 * Interface specific to the Fake Streaming Chat model.
 */
export interface FakeStreamingChatModelCallOptions
  extends BaseChatModelCallOptions {}
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

export class FakeStreamingChatModel extends BaseChatModel<FakeStreamingChatModelCallOptions> {
  sleep = 50;

  responses: BaseMessage[] = [];

  chunks: AIMessageChunk[] = [];

  toolStyle: "openai" | "anthropic" | "bedrock" | "google" = "openai";

  thrownErrorString?: string;

  private tools: (StructuredTool | ToolSpec)[] = [];

  constructor({
    sleep = 50,
    responses = [],
    chunks = [],
    toolStyle = "openai",
    thrownErrorString,
    ...rest
  }: FakeStreamingChatModelFields & BaseLLMParams) {
    super(rest);
    this.sleep = sleep;
    this.responses = responses;
    this.chunks = chunks;
    this.toolStyle = toolStyle;
    this.thrownErrorString = thrownErrorString;
  }

  _llmType() {
    return "fake";
  }

  bindTools(tools: (StructuredTool | ToolSpec)[]) {
    const merged = [...this.tools, ...tools];

    const toolDicts = merged.map((t) => {
      switch (this.toolStyle) {
        case "openai":
          return {
            type: "function",
            function: {
              name: t.name,
              description: t.description,
              parameters: toJsonSchema(t.schema),
            },
          };
        case "anthropic":
          return {
            name: t.name,
            description: t.description,
            input_schema: toJsonSchema(t.schema),
          };
        case "bedrock":
          return {
            toolSpec: {
              name: t.name,
              description: t.description,
              inputSchema: toJsonSchema(t.schema),
            },
          };
        case "google":
          return {
            name: t.name,
            description: t.description,
            parameters: toJsonSchema(t.schema),
          };
        default:
          throw new Error(`Unsupported tool style: ${this.toolStyle}`);
      }
    });

    const wrapped =
      this.toolStyle === "google"
        ? [{ functionDeclarations: toolDicts }]
        : toolDicts;

    /* creating a *new* instance – mirrors LangChain .bind semantics for type-safety and avoiding noise */
    const next = new FakeStreamingChatModel({
      sleep: this.sleep,
      responses: this.responses,
      chunks: this.chunks,
      toolStyle: this.toolStyle,
      thrownErrorString: this.thrownErrorString,
    });
    next.tools = merged;

    return next.withConfig({ tools: wrapped } as BaseChatModelCallOptions);
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
}

/**
 * Interface for the input parameters specific to the Fake List Chat model.
 */
export interface FakeChatInput extends BaseChatModelParams {
  /** Responses to return */
  responses: string[];

  /** Time to sleep in milliseconds between responses */
  sleep?: number;

  emitCustomEvent?: boolean;

  /**
   * Generation info to include on the last chunk during streaming.
   * This gets merged into response_metadata by the base chat model.
   * Useful for testing response_metadata propagation (e.g., finish_reason).
   */
  generationInfo?: Record<string, unknown>;
}

export interface FakeListChatModelCallOptions extends BaseChatModelCallOptions {
  thrownErrorString?: string;
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
export class FakeListChatModel extends BaseChatModel<FakeListChatModelCallOptions> {
  static lc_name() {
    return "FakeListChatModel";
  }

  lc_serializable = true;

  responses: string[];

  i = 0;

  sleep?: number;

  emitCustomEvent = false;

  generationInfo?: Record<string, unknown>;

  private tools: (StructuredTool | ToolSpec)[] = [];

  toolStyle: "openai" | "anthropic" | "bedrock" | "google" = "openai";

  constructor(params: FakeChatInput) {
    super(params);
    const { responses, sleep, emitCustomEvent, generationInfo } = params;
    this.responses = responses;
    this.sleep = sleep;
    this.emitCustomEvent = emitCustomEvent ?? this.emitCustomEvent;
    this.generationInfo = generationInfo;
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
    if (options?.thrownErrorString) {
      throw new Error(options.thrownErrorString);
    }
    if (this.emitCustomEvent) {
      await runManager?.handleCustomEvent("some_test_event", {
        someval: true,
      });
    }

    if (options?.stop?.length) {
      return {
        generations: [this._formatGeneration(options.stop[0])],
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
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const response = this._currentResponse();
    this._incrementResponse();
    if (this.emitCustomEvent) {
      await runManager?.handleCustomEvent("some_test_event", {
        someval: true,
      });
    }

    const responseChars = [...response];
    for (let i = 0; i < responseChars.length; i++) {
      const text = responseChars[i];
      const isLastChunk = i === responseChars.length - 1;
      await this._sleepIfRequested();
      if (options?.thrownErrorString) {
        throw new Error(options.thrownErrorString);
      }
      // Include generationInfo on the last chunk (like real providers do)
      // This gets merged into response_metadata by the base chat model
      const chunk = this._createResponseChunk(
        text,
        isLastChunk ? this.generationInfo : undefined
      );
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

  _createResponseChunk(
    text: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generationInfo?: Record<string, any>
  ): ChatGenerationChunk {
    return new ChatGenerationChunk({
      message: new AIMessageChunk({ content: text }),
      text,
      generationInfo,
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

  bindTools(tools: (StructuredTool | ToolSpec)[]) {
    const merged = [...this.tools, ...tools];

    const toolDicts = merged.map((t) => {
      switch (this.toolStyle) {
        case "openai":
          return {
            type: "function",
            function: {
              name: t.name,
              description: t.description,
              parameters: toJsonSchema(t.schema),
            },
          };
        case "anthropic":
          return {
            name: t.name,
            description: t.description,
            input_schema: toJsonSchema(t.schema),
          };
        case "bedrock":
          return {
            toolSpec: {
              name: t.name,
              description: t.description,
              inputSchema: toJsonSchema(t.schema),
            },
          };
        case "google":
          return {
            name: t.name,
            description: t.description,
            parameters: toJsonSchema(t.schema),
          };
        default:
          throw new Error(`Unsupported tool style: ${this.toolStyle}`);
      }
    });

    const wrapped =
      this.toolStyle === "google"
        ? [{ functionDeclarations: toolDicts }]
        : toolDicts;

    const next = new FakeListChatModel({
      responses: this.responses,
      sleep: this.sleep,
      emitCustomEvent: this.emitCustomEvent,
      generationInfo: this.generationInfo,
    });
    next.tools = merged;
    next.toolStyle = this.toolStyle;
    next.i = this.i;

    return next.withConfig({ tools: wrapped } as BaseChatModelCallOptions);
  }

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    _params:
      | StructuredOutputMethodParams<RunOutput, false>
      | InteropZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<false>
  ): Runnable<BaseLanguageModelInput, RunOutput>;

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    _params:
      | StructuredOutputMethodParams<RunOutput, true>
      | InteropZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<true>
  ): Runnable<BaseLanguageModelInput, { raw: BaseMessage; parsed: RunOutput }>;

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    _params:
      | StructuredOutputMethodParams<RunOutput, boolean>
      | InteropZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    _config?: StructuredOutputMethodOptions<boolean>
  ):
    | Runnable<BaseLanguageModelInput, RunOutput>
    | Runnable<
        BaseLanguageModelInput,
        { raw: BaseMessage; parsed: RunOutput }
      > {
    return RunnableLambda.from(async (input) => {
      const message = await this.invoke(input);
      if (message.tool_calls?.[0]?.args) {
        return message.tool_calls[0].args as RunOutput;
      }
      if (typeof message.content === "string") {
        return JSON.parse(message.content);
      }
      throw new Error("No structured output found");
    }) as Runnable;
  }
}
