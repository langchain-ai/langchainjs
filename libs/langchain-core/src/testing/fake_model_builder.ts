/* oxlint-disable @typescript-eslint/no-explicit-any */
import { CallbackManagerForLLMRun } from "../callbacks/manager.js";
import {
  BaseChatModel,
  BaseChatModelCallOptions,
} from "../language_models/chat_models.js";
import {
  BaseLanguageModelInput,
  StructuredOutputMethodOptions,
  StructuredOutputMethodParams,
} from "../language_models/base.js";
import { BaseMessage, AIMessage } from "../messages/index.js";
import type { ToolCall } from "../messages/tool.js";
import type { ChatResult } from "../outputs.js";
import { Runnable, RunnableLambda } from "../runnables/base.js";
import { StructuredTool } from "../tools/index.js";
import type { InteropZodType } from "../utils/types/zod.js";
import type { ToolSpec } from "../utils/testing/chat_models.js";

type ResponseFactory = (messages: BaseMessage[]) => BaseMessage | Error;

type QueueEntry =
  | { kind: "message"; message: BaseMessage }
  | { kind: "toolCalls"; toolCalls: ToolCall[] }
  | { kind: "error"; error: Error }
  | { kind: "factory"; factory: ResponseFactory };

interface FakeModelCall {
  messages: BaseMessage[];
  options: any;
}

function deriveContent(messages: BaseMessage[]): string {
  return messages
    .map((m) => m.text)
    .filter(Boolean)
    .join("-");
}

let idCounter = 0;
function nextToolCallId(): string {
  idCounter += 1;
  return `fake_tc_${idCounter}`;
}

/**
 * A fake chat model for testing, created via {@link fakeModel}.
 *
 * Queue responses with `.respond()` and `.respondWithTools()`, then
 * pass the instance directly wherever a chat model is expected.
 * Responses are consumed in first-in-first-out order — one per `invoke()` call.
 * When all queued responses are consumed, further invocations throw.
 */
export class FakeBuiltModel extends BaseChatModel {
  private queue: QueueEntry[] = [];

  private _alwaysThrowError: Error | undefined;

  private _structuredResponseValue: any;

  private _tools: (StructuredTool | ToolSpec)[] = [];

  private _calls: FakeModelCall[] = [];

  /**
   * All invocations recorded by this model, in order.
   * Each entry contains the `messages` array and `options` that were
   * passed to `invoke()`.
   */
  get calls(): FakeModelCall[] {
    return this._calls;
  }

  /**
   * The number of times this model has been invoked.
   */
  get callCount(): number {
    return this._calls.length;
  }

  constructor() {
    super({});
  }

  _llmType(): string {
    return "fake-model-builder";
  }

  _combineLLMOutput() {
    return [];
  }

  /**
   * Enqueue a response that the model will return on its next invocation.
   * @param entry A {@link BaseMessage} to return, an `Error` to throw, or
   *   a factory `(messages) => BaseMessage | Error` for dynamic responses.
   * @returns `this`, for chaining.
   */
  respond(entry: BaseMessage | Error | ResponseFactory): this {
    if (typeof entry === "function") {
      this.queue.push({ kind: "factory", factory: entry });
    } else if (BaseMessage.isInstance(entry)) {
      this.queue.push({ kind: "message", message: entry });
    } else {
      this.queue.push({ kind: "error", error: entry });
    }
    return this;
  }

  /**
   * Enqueue an {@link AIMessage} that carries the given tool calls.
   * Content is derived from the input messages at invocation time.
   * @param toolCalls Array of tool calls. Each entry needs `name` and
   *   `args`; `id` is optional and auto-generated when omitted.
   * @returns `this`, for chaining.
   */
  respondWithTools(
    toolCalls: Array<{ name: string; args: Record<string, any>; id?: string }>
  ): this {
    this.queue.push({
      kind: "toolCalls",
      toolCalls: toolCalls.map((tc) => ({
        name: tc.name,
        args: tc.args,
        id: tc.id ?? nextToolCallId(),
        type: "tool_call" as const,
      })),
    });
    return this;
  }

  /**
   * Make every invocation throw the given error, regardless of the queue.
   * @param error The error to throw.
   * @returns `this`, for chaining.
   */
  alwaysThrow(error: Error): this {
    this._alwaysThrowError = error;
    return this;
  }

  /**
   * Set the value that {@link withStructuredOutput} will resolve to.
   * @param value The structured object to return.
   * @returns `this`, for chaining.
   */
  structuredResponse(value: Record<string, any>): this {
    this._structuredResponseValue = value;
    return this;
  }

  /**
   * Bind tools to the model. Returns a new model that shares the same
   * response queue and call history.
   * @param tools The tools to bind, as {@link StructuredTool} instances or
   *   plain {@link ToolSpec} objects.
   * @returns A new RunnableBinding with the tools bound.
   */
  bindTools(tools: (StructuredTool | ToolSpec)[]) {
    const merged = [...this._tools, ...tools];
    const next = new FakeBuiltModel();
    next.queue = this.queue;
    next._alwaysThrowError = this._alwaysThrowError;
    next._structuredResponseValue = this._structuredResponseValue;
    next._tools = merged;
    next._calls = this._calls;

    return next.withConfig({} as BaseChatModelCallOptions);
  }

  /**
   * Returns a {@link Runnable} that produces the {@link structuredResponse}
   * value. The schema argument is accepted for compatibility but ignored.
   * @param _params Schema or params (ignored).
   * @param _config Options (ignored).
   * @returns A Runnable that resolves to the structured response value.
   */
  withStructuredOutput<
    RunOutput extends Record<string, any> = Record<string, any>,
  >(
    _params:
      | StructuredOutputMethodParams<RunOutput, boolean>
      | InteropZodType<RunOutput>
      | Record<string, any>,
    _config?: StructuredOutputMethodOptions<boolean>
  ):
    | Runnable<BaseLanguageModelInput, RunOutput>
    | Runnable<
        BaseLanguageModelInput,
        { raw: BaseMessage; parsed: RunOutput }
      > {
    const { _structuredResponseValue } = this;
    return RunnableLambda.from(async () => {
      return _structuredResponseValue as RunOutput;
    }) as Runnable;
  }

  async _generate(
    messages: BaseMessage[],
    options?: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const currentCallIndex = this._calls.length;
    this._calls.push({ messages: [...messages], options });

    if (this._alwaysThrowError) {
      throw this._alwaysThrowError;
    }

    const entry = this.queue[currentCallIndex];
    if (!entry) {
      throw new Error(
        `FakeModel: no response queued for invocation ${currentCallIndex} (${this.queue.length} total queued).`
      );
    }

    if (entry.kind === "error") {
      throw entry.error;
    }

    if (entry.kind === "factory") {
      const result = entry.factory(messages);
      if (!BaseMessage.isInstance(result)) {
        throw result;
      }
      return {
        generations: [{ text: "", message: result }],
      };
    }

    if (entry.kind === "message") {
      return {
        generations: [{ text: "", message: entry.message }],
      };
    }

    const content = deriveContent(messages);
    const message = new AIMessage({
      content,
      id: currentCallIndex.toString(),
      tool_calls:
        entry.toolCalls.length > 0
          ? entry.toolCalls.map((tc) => ({
              ...tc,
              type: "tool_call" as const,
            }))
          : undefined,
    });

    return {
      generations: [{ text: content, message }],
      llmOutput: {},
    };
  }
}

/**
 * Creates a new {@link FakeBuiltModel} for testing.
 *
 * Returns a chainable builder — queue responses, then pass the model
 * anywhere a chat model is expected. Responses are consumed in FIFO
 * order, one per `invoke()` call.
 *
 * ## API summary
 *
 * | Method | Description |
 * | --- | --- |
 * | `fakeModel()` | Creates a new fake chat model. Returns a chainable builder. |
 * | `.respond(message)` | Queue an `AIMessage` (or any `BaseMessage`) to return on the next invocation. |
 * | `.respond(error)` | Queue an `Error` to throw on the next invocation. |
 * | `.respond(factory)` | Queue a function `(messages) => BaseMessage \| Error` for dynamic responses. |
 * | `.respondWithTools(toolCalls)` | Shorthand for `.respond()` with tool calls. Each entry needs `name` and `args`; `id` is optional. |
 * | `.alwaysThrow(error)` | Make every invocation throw this error, regardless of the queue. |
 * | `.structuredResponse(value)` | Set the value returned by `.withStructuredOutput()`. |
 * | `.bindTools(tools)` | Bind tools to the model. Returns a `RunnableBinding` that shares the response queue and call recording. |
 * | `.withStructuredOutput(schema)` | Returns a runnable that produces the `.structuredResponse()` value. |
 * | `.calls` | Array of `{ messages, options }` for every invocation (read-only). |
 * | `.callCount` | Number of times the model has been invoked. |
 *
 * @example
 * ```typescript
 * const model = fakeModel()
 *   .respondWithTools([{ name: "search", args: { query: "weather" } }])
 *   .respond(new AIMessage("Sunny and warm."));
 *
 * const r1 = await model.invoke([new HumanMessage("What's the weather?")]);
 * // r1.tool_calls[0].name === "search"
 *
 * const r2 = await model.invoke([new HumanMessage("Thanks")]);
 * // r2.content === "Sunny and warm."
 * ```
 */
export function fakeModel(): FakeBuiltModel {
  return new FakeBuiltModel();
}
