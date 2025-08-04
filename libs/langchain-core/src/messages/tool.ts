import {
  BaseMessage,
  BaseMessageChunk,
  type BaseMessageFields,
  mergeContent,
  _mergeDicts,
  type MessageType,
  _mergeObj,
  _mergeStatus,
  type MessageContentComplex,
} from "./base.js";
import type { DataContentBlock } from "./content_blocks.js";

export interface ToolMessageFields extends BaseMessageFields {
  content: string | (MessageContentComplex | DataContentBlock)[];
}

export interface ToolMessageFieldsWithToolCallId extends ToolMessageFields {
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
  /**
   * Status of the tool invocation.
   * @version 0.2.19
   */
  status?: "success" | "error";
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
export class ToolMessage extends BaseMessage implements DirectToolOutput {
  declare content: string | (MessageContentComplex | DataContentBlock)[];

  static lc_name() {
    return "ToolMessage";
  }

  get lc_aliases(): Record<string, string> {
    // exclude snake case conversion to pascal case
    return { tool_call_id: "tool_call_id" };
  }

  lc_direct_tool_output = true as const;

  /**
   * Status of the tool invocation.
   * @version 0.2.19
   */
  status?: "success" | "error";

  tool_call_id: string;

  /**
   * Artifact of the Tool execution which is not meant to be sent to the model.
   *
   * Should only be specified if it is different from the message content, e.g. if only
   * a subset of the full tool output is being passed as message content but the full
   * output is needed in other parts of the code.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  artifact?: any;

  constructor(fields: ToolMessageFieldsWithToolCallId);

  constructor(
    fields: string | ToolMessageFields,
    tool_call_id: string,
    name?: string
  );

  constructor(
    fields: string | ToolMessageFieldsWithToolCallId,
    tool_call_id?: string,
    name?: string
  ) {
    if (typeof fields === "string") {
      // eslint-disable-next-line no-param-reassign, @typescript-eslint/no-non-null-assertion
      fields = { content: fields, name, tool_call_id: tool_call_id! };
    }
    super(fields);
    this.tool_call_id = fields.tool_call_id;
    this.artifact = fields.artifact;
    this.status = fields.status;
  }

  _getType(): MessageType {
    return "tool";
  }

  static isInstance(message: BaseMessage): message is ToolMessage {
    return message._getType() === "tool";
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
export class ToolMessageChunk extends BaseMessageChunk {
  declare content: string | (MessageContentComplex | DataContentBlock)[];

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

  constructor(fields: ToolMessageFieldsWithToolCallId) {
    super(fields);
    this.tool_call_id = fields.tool_call_id;
    this.artifact = fields.artifact;
    this.status = fields.status;
  }

  static lc_name() {
    return "ToolMessageChunk";
  }

  _getType(): MessageType {
    return "tool";
  }

  concat(chunk: ToolMessageChunk) {
    return new ToolMessageChunk({
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

/**
 * A call to a tool.
 * @property {string} name - The name of the tool to be called
 * @property {Record<string, any>} args - The arguments to the tool call
 * @property {string} [id] - If provided, an identifier associated with the tool call
 */
export type ToolCall = {
  name: string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: Record<string, any>;

  id?: string;

  type?: "tool_call";
};

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
 *
 * @property {string} [name] - If provided, a substring of the name of the tool to be called
 * @property {string} [args] - If provided, a JSON substring of the arguments to the tool call
 * @property {string} [id] - If provided, a substring of an identifier for the tool call
 * @property {number} [index] - If provided, the index of the tool call in a sequence
 */
export type ToolCallChunk = {
  name?: string;

  args?: string;

  id?: string;

  index?: number;

  type?: "tool_call_chunk";
};

export type InvalidToolCall = {
  name?: string;
  args?: string;
  id?: string;
  error?: string;
  type?: "invalid_tool_call";
};

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
        const parsed = {
          name: functionName || "",
          args: functionArgs || {},
          id: toolCall.id,
        };
        toolCalls.push(parsed);
      } catch (error) {
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

export function isToolMessage(x: BaseMessage): x is ToolMessage {
  return x._getType() === "tool";
}

export function isToolMessageChunk(x: BaseMessageChunk): x is ToolMessageChunk {
  return x._getType() === "tool";
}
