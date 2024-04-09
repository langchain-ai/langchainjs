import {
  BaseMessage,
  BaseMessageChunk,
  type BaseMessageFields,
  mergeContent,
  _mergeDicts,
  type MessageType,
} from "./base.js";
import { Serializable } from "../load/serializable.js";

export interface ToolMessageFieldsWithToolCallId extends BaseMessageFields {
  tool_call_id: string;
}

/**
 * Represents a tool message in a conversation.
 */
export class ToolMessage extends BaseMessage {
  static lc_name() {
    return "ToolMessage";
  }

  get lc_aliases(): Record<string, string> {
    // exclude snake case conversion to pascal case
    return { tool_call_id: "tool_call_id" };
  }

  tool_call_id: string;

  constructor(fields: ToolMessageFieldsWithToolCallId);

  constructor(
    fields: string | BaseMessageFields,
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
  }

  _getType(): MessageType {
    return "tool";
  }

  static isInstance(message: BaseMessage): message is ToolMessage {
    return message._getType() === "tool";
  }
}

/**
 * Represents a chunk of a tool message, which can be concatenated
 * with other tool message chunks.
 */
export class ToolMessageChunk extends BaseMessageChunk {
  tool_call_id: string;

  constructor(fields: ToolMessageFieldsWithToolCallId) {
    super(fields);
    this.tool_call_id = fields.tool_call_id;
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
      tool_call_id: this.tool_call_id,
    });
  }
}

export type ToolCallFields = {
  name: string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: Record<string, any>;

  id?: string;

  index?: number;
};

/**
 * A call to a tool.
 * @property {string} name - The name of the tool to be called
 * @property {Object} args - The arguments to the tool call
 * @property {string} [id] - If provided, an identifier associated with the tool call
 * @property {number} [index] - If provided, the index of the tool call in a sequence of content
 */
export class ToolCall extends Serializable implements ToolCallFields {
  lc_serializable = true;

  lc_namespace = ["langchain_core", "messages"];

  name: string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: Record<string, any>;

  id?: string;

  index?: number;

  constructor(fields: ToolCallFields) {
    super(fields);
    this.name = fields.name;
    this.args = fields.args;
    this.id = fields.id;
    this.index = fields.index;
  }
}

export type ToolCallChunkFields = {
  name?: string;

  args?: string;

  id?: string;

  index?: number;
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
 *   new ToolCallChunk({
 *     name: "foo",
 *     args: '{"a":',
 *     index: 0
 *   })
 * ];
 *
 * const leftAIMessageChunk = new AIMessageChunk({
 *   content: "",
 *   tool_call_chunks: leftChunks
 * });
 *
 * const rightChunks = [
 *   new ToolCallChunk({
 *     name: undefined,
 *     args: '1}',
 *     index: 0
 *   })
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
 * //   new ToolCallChunk({
 * //     name: "foo",
 * //     args: '{"a":1}'
 * //     index: 0
 * //   })
 * // ]
 * ```
 *
 * @property {string} [name] - If provided, a substring of the name of the tool to be called
 * @property {string} [args] - If provided, a JSON substring of the arguments to the tool call
 * @property {string} [id] - If provided, a substring of an identifier for the tool call
 * @property {number} [index] - If provided, the index of the tool call in a sequence
 */
export class ToolCallChunk extends Serializable implements ToolCallChunkFields {
  lc_serializable = true;

  lc_namespace = ["langchain_core", "messages"];

  name?: string;

  args?: string;

  id?: string;

  index?: number;

  constructor(fields: ToolCallChunkFields) {
    super(fields);
    this.name = fields.name;
    this.args = fields.args;
    this.id = fields.id;
    this.index = fields.index;
  }
}

export type InvalidToolCallFields = {
  name?: string;
  args?: string;
  id?: string;
  index?: number;
  error?: string;
};

/**
 * Allowance for errors made by LLM.
 * Here we add an `error` key to surface errors made during generation
 * (e.g., invalid JSON arguments.)
 */
export class InvalidToolCall
  extends Serializable
  implements InvalidToolCallFields
{
  lc_serializable = true;

  lc_namespace = ["langchain_core", "messages"];

  name?: string;

  args?: string;

  id?: string;

  index?: number;

  error?: string;

  constructor(fields: InvalidToolCallFields) {
    super(fields);
    this.name = fields.name;
    this.args = fields.args;
    this.id = fields.id;
    this.index = fields.index;
    this.error = fields.error;
  }
}

export function defaultToolCallParser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawToolCalls: Record<string, any>[]
): ToolCall[] {
  return rawToolCalls.map((toolCall) => {
    const functionArgs = toolCall.function?.arguments
      ? JSON.parse(toolCall?.function.arguments)
      : {};
    const functionName = toolCall.function?.name ?? "";
    return new ToolCall({
      name: functionName,
      args: functionArgs,
      id: toolCall.id,
      index: toolCall.index,
    });
  });
}

export function defaultToolCallChunkParser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawToolCalls: Record<string, any>[]
): ToolCallChunk[] {
  return rawToolCalls.map((toolCall) => {
    const functionArgs: string = toolCall.function?.arguments;
    const functionName: string = toolCall.function?.name;
    return new ToolCallChunk({
      name: functionName,
      args: functionArgs,
      id: toolCall.id,
      index: toolCall.index,
    });
  });
}
