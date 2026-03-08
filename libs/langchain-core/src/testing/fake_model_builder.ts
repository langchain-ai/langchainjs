/* eslint-disable @typescript-eslint/no-explicit-any */
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
 *
 * Each builder method queues a model response consumed in order per `invoke()`:
 *
 * `.respond(entry)` — enqueue a `BaseMessage`, `Error`, or factory function.
 *
 * `.respondWithTools(toolCalls[])` — enqueue an `AIMessage` with the given
 * tool calls. Content is derived from the input messages automatically.
 *
 * Both can be mixed freely in one chain. When all queued responses are
 * consumed, further invocations throw.
 *
 * Additional configuration:
 * - `.alwaysThrow(error)` — every call throws (overrides the queue)
 * - `.structuredResponse(value)` — value returned by `withStructuredOutput()`
 *
 * The model records all invocations in `.calls` / `.callCount`.
 */
class FakeBuiltModel extends BaseChatModel {
  private queue: QueueEntry[] = [];

  private _alwaysThrowError: Error | undefined;

  private _structuredResponseValue: any;

  private _tools: (StructuredTool | ToolSpec)[] = [];

  private _callIndex = 0;

  private _calls: FakeModelCall[] = [];

  get calls(): FakeModelCall[] {
    return this._calls;
  }

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

  alwaysThrow(error: Error): this {
    this._alwaysThrowError = error;
    return this;
  }

  structuredResponse(value: Record<string, any>): this {
    this._structuredResponseValue = value;
    return this;
  }

  bindTools(tools: (StructuredTool | ToolSpec)[]) {
    const merged = [...this._tools, ...tools];
    const next = new FakeBuiltModel();
    next.queue = this.queue;
    next._alwaysThrowError = this._alwaysThrowError;
    next._structuredResponseValue = this._structuredResponseValue;
    next._tools = merged;
    next._calls = this._calls;
    next._callIndex = this._callIndex;

    return next.withConfig({} as BaseChatModelCallOptions);
  }

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
    this._calls.push({ messages: [...messages], options });

    const currentCallIndex = this._callIndex;
    this._callIndex += 1;

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
 * Creates a fake chat model for testing.
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
