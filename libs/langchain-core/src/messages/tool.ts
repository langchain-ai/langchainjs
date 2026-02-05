import {
  BaseMessage,
  BaseMessageChunk,
  type BaseMessageFields,
  mergeContent,
  _mergeDicts,
  _mergeObj,
  _mergeStatus,
} from "./base.js";
import { $InferMessageContent, MessageStructure } from "./message.js";
import { Constructor } from "./utils.js";

export interface ToolMessageFields<
  TStructure extends MessageStructure = MessageStructure,
> extends BaseMessageFields<TStructure, "tool"> {
  /**
   * Artifact of the Tool execution which is not meant to be sent to the model.
   *
   * Should only be specified if it is different from the message content, e.g. if only
   * a subset of the full tool output is being passed as message content but the full
   * output is needed in other parts of the code.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  artifact?: any;
  tool_call_id: string;
  status?: "success" | "error";
  metadata?: Record<string, unknown>;
}

/**
 * Marker parameter for objects that tools can return directly.
 *
 * If a custom BaseTool is invoked with a ToolCall and the output of custom code is
 * not an instance of DirectToolOutput, the output will automatically be coerced to
 * a string and wrapped in a ToolMessage.
 */
export interface DirectToolOutput {
  readonly lc_direct_tool_output: true;
}

export function isDirectToolOutput(x: unknown): x is DirectToolOutput {
  return (
    x != null &&
    typeof x === "object" &&
    "lc_direct_tool_output" in x &&
    x.lc_direct_tool_output === true
  );
}

/**
 * Represents a tool message in a conversation.
 */
export class ToolMessage<TStructure extends MessageStructure = MessageStructure>
  extends BaseMessage<TStructure, "tool">
  implements DirectToolOutput
{
  static lc_name() {
    return "ToolMessage";
  }

  get lc_aliases(): Record<string, string> {
    // exclude snake case conversion to pascal case
    return { tool_call_id: "tool_call_id" };
  }

  lc_direct_tool_output = true as const;

  readonly type = "tool" as const;

  /**
   * Status of the tool invocation.
   * @version 0.2.19
   */
  status?: "success" | "error";

  tool_call_id: string;

  metadata?: Record<string, unknown>;

  /**
   * Artifact of the Tool execution which is not meant to be sent to the model.
   *
   * Should only be specified if it is different from the message content, e.g. if only
   * a subset of the full tool output is being passed as message content but the full
   * output is needed in other parts of the code.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  artifact?: any;

  constructor(
    fields: $InferMessageContent<TStructure, "tool"> | ToolMessageFields,
    tool_call_id: string,
    name?: string
  );

  constructor(fields: ToolMessageFields<TStructure>);

  constructor(
    fields:
      | $InferMessageContent<TStructure, "tool">
      | ToolMessageFields<TStructure>,
    tool_call_id?: string,
    name?: string
  ) {
    const toolMessageFields: ToolMessageFields<TStructure> =
      typeof fields === "string" || Array.isArray(fields)
        ? ({
            content: fields,
            name,
            tool_call_id: tool_call_id!,
          } as ToolMessageFields<TStructure>)
        : fields;
    super(toolMessageFields);
    this.tool_call_id = toolMessageFields.tool_call_id;
    this.artifact = toolMessageFields.artifact;
    this.status = toolMessageFields.status;
    this.metadata = toolMessageFields.metadata;
  }

  /**
   * Type guard to check if an object is a ToolMessage.
   * Preserves the MessageStructure type parameter when called with a typed BaseMessage.
   * @overload When called with a typed BaseMessage, preserves the TStructure type
   */
  static isInstance<T extends MessageStructure>(
    message: BaseMessage<T>
  ): message is BaseMessage<T> & ToolMessage<T>;
  /**
   * Type guard to check if an object is a ToolMessage.
   * @overload When called with unknown, returns base ToolMessage type
   */
  static isInstance(message: unknown): message is ToolMessage;
  static isInstance<T extends MessageStructure = MessageStructure>(
    message: BaseMessage<T> | unknown
  ): message is ToolMessage<T> {
    return (
      super.isInstance(message) && (message as { type: string }).type === "tool"
    );
  }

  override get _printableFields(): Record<string, unknown> {
    return {
      ...super._printableFields,
      tool_call_id: this.tool_call_id,
      artifact: this.artifact,
    };
  }
}

/**
 * Represents a chunk of a tool message, which can be concatenated
 * with other tool message chunks.
 */
export class ToolMessageChunk<
  TStructure extends MessageStructure = MessageStructure,
> extends BaseMessageChunk<TStructure, "tool"> {
  readonly type = "tool" as const;

  tool_call_id: string;

  /**
   * Status of the tool invocation.
   * @version 0.2.19
   */
  status?: "success" | "error";

  /**
   * Artifact of the Tool execution which is not meant to be sent to the model.
   *
   * Should only be specified if it is different from the message content, e.g. if only
   * a subset of the full tool output is being passed as message content but the full
   * output is needed in other parts of the code.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  artifact?: any;

  constructor(fields: ToolMessageFields<TStructure>) {
    super(fields);
    this.tool_call_id = fields.tool_call_id;
    this.artifact = fields.artifact;
    this.status = fields.status;
  }

  static lc_name() {
    return "ToolMessageChunk";
  }

  concat(chunk: ToolMessageChunk<TStructure>) {
    const Cls = this.constructor as Constructor<this>;
    return new Cls({
      content: mergeContent(this.content, chunk.content),
      additional_kwargs: _mergeDicts(
        this.additional_kwargs,
        chunk.additional_kwargs
      ),
      response_metadata: _mergeDicts(
        this.response_metadata,
        chunk.response_metadata
      ),
      artifact: _mergeObj(this.artifact, chunk.artifact),
      tool_call_id: this.tool_call_id,
      id: this.id ?? chunk.id,
      status: _mergeStatus(this.status, chunk.status),
    });
  }

  override get _printableFields(): Record<string, unknown> {
    return {
      ...super._printableFields,
      tool_call_id: this.tool_call_id,
      artifact: this.artifact,
    };
  }
}

export interface ToolCall<
  TName extends string = string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TArgs extends Record<string, any> = Record<string, any>,
> {
  readonly type?: "tool_call";
  /**
   * If provided, an identifier associated with the tool call
   */
  id?: string;
  /**
   * The name of the tool being called
   */
  name: TName;
  /**
   * The arguments to the tool call
   */
  args: TArgs;
}

/**
 * A chunk of a tool call (e.g., as part of a stream).
 * When merging ToolCallChunks (e.g., via AIMessageChunk.__add__),
 * all string attributes are concatenated. Chunks are only merged if their
 * values of `index` are equal and not None.
 *
 * @example
 * ```ts
 * const leftChunks = [
 *   {
 *     name: "foo",
 *     args: '{"a":',
 *     index: 0
 *   }
 * ];
 *
 * const leftAIMessageChunk = new AIMessageChunk({
 *   content: "",
 *   tool_call_chunks: leftChunks
 * });
 *
 * const rightChunks = [
 *   {
 *     name: undefined,
 *     args: '1}',
 *     index: 0
 *   }
 * ];
 *
 * const rightAIMessageChunk = new AIMessageChunk({
 *   content: "",
 *   tool_call_chunks: rightChunks
 * });
 *
 * const result = leftAIMessageChunk.concat(rightAIMessageChunk);
 * // result.tool_call_chunks is equal to:
 * // [
 * //   {
 * //     name: "foo",
 * //     args: '{"a":1}'
 * //     index: 0
 * //   }
 * // ]
 * ```
 */
export interface ToolCallChunk<TName extends string = string> {
  readonly type?: "tool_call_chunk";
  /**
   * If provided, a substring of an identifier for the tool call
   */
  id?: string;
  /**
   * If provided, a substring of the name of the tool to be called
   */
  name?: TName;
  /**
   * If provided, a JSON substring of the arguments to the tool call
   */
  args?: string;
  /**
   * If provided, the index of the tool call in a sequence
   */
  index?: number;
}

export interface InvalidToolCall<TName extends string = string> {
  readonly type?: "invalid_tool_call";
  /**
   * If provided, an identifier associated with the tool call
   */
  id?: string;
  /**
      /**
     * The name of the tool being called
     */
  name?: TName;
  /**
   * The arguments to the tool call
   */
  args?: string;
  /**
   * An error message associated with the tool call
   */
  error?: string;
  /**
   * Index of block in aggregate response
   */
  index?: string | number;
}

export function defaultToolCallParser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawToolCalls: Record<string, any>[]
): [ToolCall[], InvalidToolCall[]] {
  const toolCalls: ToolCall[] = [];
  const invalidToolCalls: InvalidToolCall[] = [];
  for (const toolCall of rawToolCalls) {
    if (!toolCall.function) {
      continue;
    } else {
      const functionName = toolCall.function.name;
      try {
        const functionArgs = JSON.parse(toolCall.function.arguments);
        toolCalls.push({
          name: functionName || "",
          args: functionArgs || {},
          id: toolCall.id,
        });
      } catch {
        invalidToolCalls.push({
          name: functionName,
          args: toolCall.function.arguments,
          id: toolCall.id,
          error: "Malformed args.",
        });
      }
    }
  }
  return [toolCalls, invalidToolCalls];
}

/**
 * @deprecated Use {@link ToolMessage.isInstance} instead
 */
export function isToolMessage(x: unknown): x is ToolMessage {
  return (
    typeof x === "object" &&
    x !== null &&
    "getType" in x &&
    typeof x.getType === "function" &&
    x.getType() === "tool"
  );
}

/**
 * @deprecated Use {@link ToolMessageChunk.isInstance} instead
 */
export function isToolMessageChunk(x: BaseMessageChunk): x is ToolMessageChunk {
  return x._getType() === "tool";
}
