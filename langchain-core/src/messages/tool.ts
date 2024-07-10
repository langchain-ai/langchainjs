import {
  BaseMessage,
  BaseMessageChunk,
  type BaseMessageFields,
  mergeContent,
  _mergeDicts,
  type MessageType,
} from "./base.js";

export interface ToolMessageFieldsWithToolCallId<RawOutput extends any = any>
  extends BaseMessageFields {
  /**
   * The raw output of the tool.
   *
   * **Not part of the payload sent to the model.** Should only be specified if it is
   * different from the message content, i.e. if only a subset of the full tool output
   * is being passed as message content.
   */
  raw_output?: RawOutput;
  tool_call_id: string;
}

/**
 * Represents a tool message in a conversation.
 */
export class ToolMessage<RawOutput extends any = any> extends BaseMessage {
  static lc_name() {
    return "ToolMessage";
  }

  get lc_aliases(): Record<string, string> {
    // exclude snake case conversion to pascal case
    return { tool_call_id: "tool_call_id" };
  }

  tool_call_id: string;

  /**
   * The raw output of the tool.
   *
   * **Not part of the payload sent to the model.** Should only be specified if it is
   * different from the message content, i.e. if only a subset of the full tool output
   * is being passed as message content.
   */
  raw_output?: RawOutput;

  constructor(fields: ToolMessageFieldsWithToolCallId<RawOutput>);

  constructor(
    fields: string | BaseMessageFields,
    tool_call_id: string,
    name?: string
  );

  constructor(
    fields: string | ToolMessageFieldsWithToolCallId<RawOutput>,
    tool_call_id?: string,
    name?: string
  ) {
    if (typeof fields === "string") {
      // eslint-disable-next-line no-param-reassign, @typescript-eslint/no-non-null-assertion
      fields = { content: fields, name, tool_call_id: tool_call_id! };
    }
    super(fields);
    this.tool_call_id = fields.tool_call_id;
    this.raw_output = fields.raw_output;
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
export class ToolMessageChunk<
  RawOutput extends any = any
> extends BaseMessageChunk {
  tool_call_id: string;

  /**
   * The raw output of the tool.
   *
   * **Not part of the payload sent to the model.** Should only be specified if it is
   * different from the message content, i.e. if only a subset of the full tool output
   * is being passed as message content.
   */
  raw_output?: RawOutput;

  constructor(fields: ToolMessageFieldsWithToolCallId<RawOutput>) {
    super(fields);
    this.tool_call_id = fields.tool_call_id;
    this.raw_output = fields.raw_output;
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
      id: this.id ?? chunk.id,
    });
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
};

export type InvalidToolCall = {
  name?: string;
  args?: string;
  id?: string;
  error?: string;
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
