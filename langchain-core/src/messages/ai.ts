import { parsePartialJson } from "../output_parsers/json.js";
import {
  BaseMessage,
  BaseMessageChunk,
  mergeContent,
  _mergeDicts,
  type MessageType,
  BaseMessageFields,
} from "./base.js";
import {
  InvalidToolCall,
  ToolCall,
  ToolCallChunk,
  defaultToolCallParser,
} from "./tool.js";

export type AIMessageFields = BaseMessageFields & {
  tool_calls?: (ToolCall | InvalidToolCall)[];
};

/**
 * Represents an AI message in a conversation.
 */
export class AIMessage extends BaseMessage {
  tool_calls?: (ToolCall | InvalidToolCall)[];

  get lc_aliases(): Record<string, string> {
    // exclude snake case conversion to pascal case
    return {
      ...super.lc_aliases,
      tool_calls: "tool_calls",
    };
  }

  constructor(fields: string | AIMessageFields) {
    if (typeof fields === "string") {
      super(fields);
      return;
    }
    try {
      const rawToolCalls = fields.additional_kwargs?.tool_calls;
      const toolCalls = fields.tool_calls;
      if (rawToolCalls !== undefined && toolCalls === undefined) {
        // eslint-disable-next-line no-param-reassign
        fields.tool_calls = defaultToolCallParser(rawToolCalls ?? []);
      }
    } catch (e) {
      // Do nothing if parsing fails
    }
    super(fields);
    this.tool_calls = fields.tool_calls;
  }

  static lc_name() {
    return "AIMessage";
  }

  _getType(): MessageType {
    return "ai";
  }
}

export type AIMessageChunkFields = AIMessageFields & {
  tool_call_chunks?: ToolCallChunk[];
};

/**
 * Represents a chunk of an AI message, which can be concatenated with
 * other AI message chunks.
 */
export class AIMessageChunk extends BaseMessageChunk {
  // Must redeclare "tool_calls" field due to lack of support for multiple inhertiance.
  tool_calls?: (ToolCall | InvalidToolCall)[];

  tool_call_chunks?: ToolCallChunk[];

  constructor(fields: AIMessageChunkFields) {
    if (fields.tool_calls !== undefined) {
      throw new Error(
        `"tool_calls" cannot be set directly on AIMessageChunk, it is derived from "tool_call_chunks".`
      );
    }
    if (
      fields.tool_call_chunks === undefined ||
      fields.tool_call_chunks.length === 0
    ) {
      super({ tool_calls: fields.tool_call_chunks, ...fields });
    } else {
      // eslint-disable-next-line no-param-reassign
      fields.tool_calls = fields.tool_call_chunks.map((toolCallChunk) => {
        let parsedArgs = {};
        try {
          parsedArgs = parsePartialJson(toolCallChunk.args ?? "{}") ?? {};
        } catch (e) {
          // Do nothing if parsing fails
        }
        return new ToolCall({
          name: toolCallChunk.name ?? "",
          args: parsedArgs,
          index: toolCallChunk.index,
          id: toolCallChunk.id,
        });
      });
    }
    super(fields);
    this.tool_call_chunks = fields.tool_call_chunks;
    this.tool_calls = fields.tool_calls;
  }

  get lc_aliases(): Record<string, string> {
    // exclude snake case conversion to pascal case
    return {
      ...super.lc_aliases,
      tool_call_chunks: "tool_call_chunks",
    };
  }

  static lc_name() {
    return "AIMessageChunk";
  }

  _getType(): MessageType {
    return "ai";
  }

  concat(chunk: AIMessageChunk) {
    const combinedFields: AIMessageChunkFields = {
      content: mergeContent(this.content, chunk.content),
      additional_kwargs: _mergeDicts(
        this.additional_kwargs,
        chunk.additional_kwargs
      ),
      response_metadata: _mergeDicts(
        this.response_metadata,
        chunk.response_metadata
      ),
    };
    if (
      this.tool_call_chunks !== undefined ||
      chunk.tool_call_chunks !== undefined
    ) {
    }
    return new AIMessageChunk(combinedFields);
  }
}
