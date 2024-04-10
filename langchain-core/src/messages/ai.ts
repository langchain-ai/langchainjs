import { parsePartialJson } from "../utils/json.js";
import {
  BaseMessage,
  BaseMessageChunk,
  mergeContent,
  _mergeDicts,
  type MessageType,
  BaseMessageFields,
  _mergeLists,
} from "./base.js";
import {
  InvalidToolCall,
  ToolCall,
  ToolCallChunk,
  defaultToolCallParser,
} from "./tool.js";

export type AIMessageFields = BaseMessageFields & {
  tool_calls?: ToolCall[];
  invalid_tool_calls?: InvalidToolCall[];
};

/**
 * Represents an AI message in a conversation.
 */
export class AIMessage extends BaseMessage {
  // These are typed as optional to avoid breaking changes and allow for casting
  // from BaseMessage.
  tool_calls?: ToolCall[] = [];

  invalid_tool_calls?: InvalidToolCall[] = [];

  get lc_aliases(): Record<string, string> {
    // exclude snake case conversion to pascal case
    return {
      ...super.lc_aliases,
      tool_calls: "tool_calls",
      invalid_tool_calls: "invalid_tool_calls",
    };
  }

  constructor(
    fields: string | AIMessageFields,
    /** @deprecated */
    kwargs?: Record<string, unknown>
  ) {
    let initParams: AIMessageFields;
    if (typeof fields === "string") {
      initParams = {
        content: fields,
        tool_calls: [],
        invalid_tool_calls: [],
        additional_kwargs: kwargs ?? {},
      };
    } else {
      initParams = fields;
      const rawToolCalls = initParams.additional_kwargs?.tool_calls;
      const toolCalls = initParams.tool_calls;
      if (
        rawToolCalls !== undefined &&
        rawToolCalls.length > 0 &&
        (toolCalls === undefined || toolCalls.length === 0)
      ) {
        console.warn(
          [
            "New LangChain packages are available that more efficiently handle",
            "tool calling.\n\nPlease upgrade your packages to versions that set",
            "message tool calls. e.g., `yarn add @langchain/anthropic`,",
            "yarn add @langchain/openai`, etc.",
          ].join(" ")
        );
      }
      try {
        if (rawToolCalls !== undefined && toolCalls === undefined) {
          const [toolCalls, invalidToolCalls] =
            defaultToolCallParser(rawToolCalls);
          initParams.tool_calls = toolCalls ?? [];
          initParams.invalid_tool_calls = invalidToolCalls ?? [];
        } else {
          initParams.tool_calls = initParams.tool_calls ?? [];
          initParams.invalid_tool_calls = initParams.invalid_tool_calls ?? [];
        }
      } catch (e) {
        // Do nothing if parsing fails
        initParams.tool_calls = [];
        initParams.invalid_tool_calls = [];
      }
    }
    // Sadly, TypeScript only allows super() calls at root if the class has
    // properties with initializers, so we have to check types twice.
    super(initParams);
    if (typeof initParams !== "string") {
      this.tool_calls = initParams.tool_calls ?? this.tool_calls;
      this.invalid_tool_calls =
        initParams.invalid_tool_calls ?? this.invalid_tool_calls;
    }
  }

  static lc_name() {
    return "AIMessage";
  }

  _getType(): MessageType {
    return "ai";
  }
}

export function isAIMessage(x: BaseMessage): x is AIMessage {
  return x._getType() === "ai";
}

export type AIMessageChunkFields = AIMessageFields & {
  tool_call_chunks?: ToolCallChunk[];
};

/**
 * Represents a chunk of an AI message, which can be concatenated with
 * other AI message chunks.
 */
export class AIMessageChunk extends BaseMessageChunk {
  // Must redeclare tool call fields since there is no multiple inheritance in JS.
  // These are typed as optional to avoid breaking changes and allow for casting
  // from BaseMessage.
  tool_calls?: ToolCall[] = [];

  invalid_tool_calls?: InvalidToolCall[] = [];

  tool_call_chunks?: ToolCallChunk[] = [];

  constructor(fields: string | AIMessageChunkFields) {
    let initParams: AIMessageChunkFields;
    if (typeof fields === "string") {
      initParams = {
        content: fields,
        tool_calls: [],
        invalid_tool_calls: [],
        tool_call_chunks: [],
      };
    } else if (fields.tool_call_chunks === undefined) {
      initParams = {
        ...fields,
        tool_calls: [],
        invalid_tool_calls: [],
        tool_call_chunks: [],
      };
    } else {
      const toolCalls: ToolCall[] = [];
      const invalidToolCalls: InvalidToolCall[] = [];
      for (const toolCallChunk of fields.tool_call_chunks) {
        let parsedArgs = {};
        try {
          parsedArgs = parsePartialJson(toolCallChunk.args ?? "{}") ?? {};
          if (typeof parsedArgs !== "object" || Array.isArray(parsedArgs)) {
            throw new Error("Malformed tool call chunk args.");
          }
          toolCalls.push({
            name: toolCallChunk.name ?? "",
            args: parsedArgs,
            id: toolCallChunk.id,
          });
        } catch (e) {
          invalidToolCalls.push({
            name: toolCallChunk.name,
            args: toolCallChunk.args,
            id: toolCallChunk.id,
            error: "Malformed args.",
          });
        }
      }
      initParams = {
        ...fields,
        tool_calls: toolCalls,
        invalid_tool_calls: invalidToolCalls,
      };
    }
    // Sadly, TypeScript only allows super() calls at root if the class has
    // properties with initializers, so we have to check types twice.
    super(initParams);
    this.tool_call_chunks =
      initParams?.tool_call_chunks ?? this.tool_call_chunks;
    this.tool_calls = initParams?.tool_calls ?? this.tool_calls;
    this.invalid_tool_calls =
      initParams?.invalid_tool_calls ?? this.invalid_tool_calls;
  }

  get lc_aliases(): Record<string, string> {
    // exclude snake case conversion to pascal case
    return {
      ...super.lc_aliases,
      tool_calls: "tool_calls",
      invalid_tool_calls: "invalid_tool_calls",
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
      tool_call_chunks: [],
    };
    if (
      this.tool_call_chunks !== undefined ||
      chunk.tool_call_chunks !== undefined
    ) {
      const rawToolCalls = _mergeLists(
        this.tool_call_chunks,
        chunk.tool_call_chunks
      );
      if (rawToolCalls !== undefined && rawToolCalls.length > 0) {
        combinedFields.tool_call_chunks = rawToolCalls;
      }
    }
    return new AIMessageChunk(combinedFields);
  }
}
