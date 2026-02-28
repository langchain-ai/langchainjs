/* eslint-disable @typescript-eslint/no-explicit-any */
import { CallbackManagerForLLMRun } from "../../callbacks/manager.js";
import {
  BaseChatModel,
  BaseChatModelCallOptions,
} from "../../language_models/chat_models.js";
import {
  BaseLanguageModelInput,
  StructuredOutputMethodOptions,
  StructuredOutputMethodParams,
} from "../../language_models/base.js";
import { BaseMessage, AIMessage } from "../../messages/index.js";
import type { ToolCall } from "../../messages/tool.js";
import type { ChatResult } from "../../outputs.js";
import { Runnable, RunnableLambda } from "../../runnables/base.js";
import { StructuredTool } from "../../tools/index.js";
import { toJsonSchema } from "../json_schema.js";
import type { InteropZodType } from "../types/zod.js";
import type { ToolSpec } from "./chat_models.js";

type ToolStyle = "openai" | "anthropic" | "bedrock" | "google";

interface FakeModelCall {
  messages: BaseMessage[];
  options: any;
}

interface SharedRefs {
  callIndex: { current: number };
  responseIndex: { current: number };
  calls: FakeModelCall[];
}

interface FakeBuiltModelConfig {
  mode: "turns" | "responses";
  turns: ToolCall[][];
  responses: BaseMessage[];
  throwMap: Map<number, Error>;
  alwaysThrowError: Error | undefined;
  structuredResponseValue: any;
  toolStyleValue: ToolStyle;
  refs: SharedRefs;
}

function deriveContent(messages: BaseMessage[]): string {
  const lastMessage = messages[messages.length - 1];
  let content = lastMessage.content as string;

  if (messages.length > 1) {
    const parts = messages.map((m) => m.content).filter(Boolean);
    content = parts
      .map((part) => {
        if (typeof part === "string") {
          return part;
        } else if (typeof part === "object" && "text" in part) {
          return (part as { text: string }).text;
        } else if (Array.isArray(part)) {
          return part
            .map((p) => {
              if (typeof p === "string") {
                return p;
              } else if (typeof p === "object" && "text" in p) {
                return (p as { text: string }).text;
              }
              return "";
            })
            .join("-");
        } else {
          return JSON.stringify(part);
        }
      })
      .join("-");
  }

  return content;
}

function formatToolDicts(
  tools: (StructuredTool | ToolSpec)[],
  style: ToolStyle
) {
  const toolDicts = tools.map((t) => {
    switch (style) {
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
        throw new Error(`Unsupported tool style: ${style}`);
    }
  });

  return style === "google" ? [{ functionDeclarations: toolDicts }] : toolDicts;
}

class FakeBuiltModel extends BaseChatModel {
  private config: FakeBuiltModelConfig;

  private tools: (StructuredTool | ToolSpec)[] = [];

  get calls(): FakeModelCall[] {
    return this.config.refs.calls;
  }

  get callCount(): number {
    return this.config.refs.calls.length;
  }

  constructor(config: FakeBuiltModelConfig) {
    super({});
    this.config = config;
  }

  _llmType(): string {
    return "fake-model-builder";
  }

  _combineLLMOutput() {
    return [];
  }

  bindTools(tools: (StructuredTool | ToolSpec)[]) {
    const merged = [...this.tools, ...tools];
    const wrapped = formatToolDicts(merged, this.config.toolStyleValue);

    const next = new FakeBuiltModel(this.config);
    next.tools = merged;

    return next.withConfig({ tools: wrapped } as BaseChatModelCallOptions);
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
    const { structuredResponseValue } = this.config;
    return RunnableLambda.from(async () => {
      return structuredResponseValue as RunOutput;
    }) as Runnable;
  }

  async _generate(
    messages: BaseMessage[],
    options?: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const { refs } = this.config;

    refs.calls.push({ messages: [...messages], options });

    const currentCallIndex = refs.callIndex.current;
    refs.callIndex.current += 1;

    if (this.config.alwaysThrowError) {
      throw this.config.alwaysThrowError;
    }

    const throwError = this.config.throwMap.get(currentCallIndex);
    if (throwError) {
      throw throwError;
    }

    const currentResponseIndex = refs.responseIndex.current;
    refs.responseIndex.current += 1;

    if (this.config.mode === "responses") {
      const responseList = this.config.responses;
      const msg = responseList[currentResponseIndex % responseList.length];
      return {
        generations: [{ text: "", message: msg }],
      };
    }

    const content = deriveContent(messages);
    const turnList = this.config.turns;
    const currentToolCalls =
      turnList[currentResponseIndex % turnList.length] || [];
    const messageId = currentCallIndex.toString();

    const message = new AIMessage({
      content,
      id: messageId,
      tool_calls:
        currentToolCalls.length > 0
          ? currentToolCalls.map((tc) => ({
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

class FakeModelBuilder {
  private _turns: ToolCall[][] = [];

  private _responses: BaseMessage[] = [];

  private _hasTurns = false;

  private _hasResponses = false;

  private _throwMap = new Map<number, Error>();

  private _alwaysThrowError: Error | undefined;

  private _structuredResponseValue: any;

  private _toolStyleValue: ToolStyle = "openai";

  turn(
    toolCalls: Array<{ name: string; args: Record<string, any>; id?: string }>
  ): this {
    this._hasTurns = true;
    this._turns.push(
      toolCalls.map((tc) => ({
        name: tc.name,
        args: tc.args,
        id: tc.id,
        type: "tool_call" as const,
      }))
    );
    return this;
  }

  respond(message: BaseMessage): this {
    this._hasResponses = true;
    this._responses.push(message);
    return this;
  }

  throwOnTurn(callIndex: number, error: Error): this {
    this._throwMap.set(callIndex, error);
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

  toolStyle(style: ToolStyle): this {
    this._toolStyleValue = style;
    return this;
  }

  build(): FakeBuiltModel {
    if (this._hasTurns && this._hasResponses) {
      throw new Error(
        "Cannot mix .turn() and .respond() — use .turn() for tool-call sequences or .respond() for pre-built messages."
      );
    }

    if (!this._hasTurns && !this._hasResponses && !this._alwaysThrowError) {
      throw new Error(
        "Must configure at least one .turn(), .respond(), or .alwaysThrow() before calling .build()."
      );
    }

    const mode = this._hasResponses ? "responses" : "turns";

    return new FakeBuiltModel({
      mode,
      turns: this._turns,
      responses: this._responses,
      throwMap: this._throwMap,
      alwaysThrowError: this._alwaysThrowError,
      structuredResponseValue: this._structuredResponseValue,
      toolStyleValue: this._toolStyleValue,
      refs: {
        callIndex: { current: 0 },
        responseIndex: { current: 0 },
        calls: [],
      },
    });
  }
}

/**
 * Creates a builder for a fake chat model suitable for testing.
 *
 * Two modes — use one or the other, not both:
 *
 * `.turn(toolCalls[])` — script tool-call sequences per model invocation.
 * An empty array means no tool calls (terminal response).
 * Content is derived from the input messages automatically.
 *
 * `.respond(message)` — supply pre-built `BaseMessage` responses.
 * The model returns them in order.
 *
 * Additional configuration:
 * - `.throwOnTurn(callIndex, error)` — throw on a specific call (by total call count)
 * - `.alwaysThrow(error)` — every call throws
 * - `.structuredResponse(value)` — value returned by `withStructuredOutput()`
 * - `.toolStyle(style)` — how `bindTools` formats tool specs
 *
 * The built model records all invocations in `model.calls`.
 */
export function fakeModel(): FakeModelBuilder {
  return new FakeModelBuilder();
}
