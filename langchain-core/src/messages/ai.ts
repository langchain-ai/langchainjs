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
  usage_metadata?: UsageMetadata;
};

/**
 * Breakdown of input token counts.
 *
 * Does not *need* to sum to full input token count. Does *not* need to have all keys.
 */
export type InputTokenDetails = {
  /**
   * Audio input tokens.
   */
  audio?: number;

  /**
   * Input tokens that were cached and there was a cache hit.
   *
   * Since there was a cache hit, the tokens were read from the cache.
   * More precisely, the model state given these tokens was read from the cache.
   */
  cache_read?: number;

  /**
   * Input tokens that were cached and there was a cache miss.
   *
   * Since there was a cache miss, the cache was created from these tokens.
   */
  cache_creation?: number;
};

/**
 * Breakdown of output token counts.
 *
 * Does *not* need to sum to full output token count. Does *not* need to have all keys.
 */
export type OutputTokenDetails = {
  /**
   * Audio output tokens
   */
  audio?: number;

  /**
   * Reasoning output tokens.
   *
   * Tokens generated by the model in a chain of thought process (i.e. by
   * OpenAI's o1 models) that are not returned as part of model output.
   */
  reasoning?: number;
};

/**
 * Usage metadata for a message, such as token counts.
 */
export type UsageMetadata = {
  /**
   * Count of input (or prompt) tokens. Sum of all input token types.
   */
  input_tokens: number;
  /**
   * Count of output (or completion) tokens. Sum of all output token types.
   */
  output_tokens: number;
  /**
   * Total token count. Sum of input_tokens + output_tokens.
   */
  total_tokens: number;

  /**
   * Breakdown of input token counts. 
   * 
   * Does *not* need to sum to full input token count. Does *not* need to have all keys.
   */ 
  input_token_details?: InputTokenDetails;

  /**
   * Breakdown of output token counts.
   * 
   * Does *not* need to sum to full output token count. Does *not* need to have all keys.   
   */
  output_token_details?: OutputTokenDetails;
};

/**
 * Represents an AI message in a conversation.
 */
export class AIMessage extends BaseMessage {
  // These are typed as optional to avoid breaking changes and allow for casting
  // from BaseMessage.
  tool_calls?: ToolCall[] = [];

  invalid_tool_calls?: InvalidToolCall[] = [];

  /**
   * If provided, token usage information associated with the message.
   */
  usage_metadata?: UsageMetadata;

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
        !(rawToolCalls == null) &&
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
        if (!(rawToolCalls == null) && toolCalls === undefined) {
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
    this.usage_metadata = initParams.usage_metadata;
  }

  static lc_name() {
    return "AIMessage";
  }

  _getType(): MessageType {
    return "ai";
  }

  override get _printableFields(): Record<string, unknown> {
    return {
      ...super._printableFields,
      tool_calls: this.tool_calls,
      invalid_tool_calls: this.invalid_tool_calls,
      usage_metadata: this.usage_metadata,
    };
  }
}

export function isAIMessage(x: BaseMessage): x is AIMessage {
  return x._getType() === "ai";
}

export function isAIMessageChunk(x: BaseMessageChunk): x is AIMessageChunk {
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

  /**
   * If provided, token usage information associated with the message.
   */
  usage_metadata?: UsageMetadata;

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
        tool_calls: fields.tool_calls ?? [],
        invalid_tool_calls: [],
        tool_call_chunks: [],
      };
    } else {
      const toolCalls: ToolCall[] = [];
      const invalidToolCalls: InvalidToolCall[] = [];
      for (const toolCallChunk of fields.tool_call_chunks) {
        let parsedArgs = {};
        try {
          parsedArgs = parsePartialJson(toolCallChunk.args || "{}");
          if (
            parsedArgs === null ||
            typeof parsedArgs !== "object" ||
            Array.isArray(parsedArgs)
          ) {
            throw new Error("Malformed tool call chunk args.");
          }
          toolCalls.push({
            name: toolCallChunk.name ?? "",
            args: parsedArgs,
            id: toolCallChunk.id,
            type: "tool_call",
          });
        } catch (e) {
          invalidToolCalls.push({
            name: toolCallChunk.name,
            args: toolCallChunk.args,
            id: toolCallChunk.id,
            error: "Malformed args.",
            type: "invalid_tool_call",
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
      initParams.tool_call_chunks ?? this.tool_call_chunks;
    this.tool_calls = initParams.tool_calls ?? this.tool_calls;
    this.invalid_tool_calls =
      initParams.invalid_tool_calls ?? this.invalid_tool_calls;
    this.usage_metadata = initParams.usage_metadata;
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

  override get _printableFields(): Record<string, unknown> {
    return {
      ...super._printableFields,
      tool_calls: this.tool_calls,
      tool_call_chunks: this.tool_call_chunks,
      invalid_tool_calls: this.invalid_tool_calls,
      usage_metadata: this.usage_metadata,
    };
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
      id: this.id ?? chunk.id,
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
    if (
      this.usage_metadata !== undefined ||
      chunk.usage_metadata !== undefined
    ) {
      const left: UsageMetadata = this.usage_metadata ?? {
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
      };
      const right: UsageMetadata = chunk.usage_metadata ?? {
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
      };
      const usage_metadata: UsageMetadata = {
        input_tokens: left.input_tokens + right.input_tokens,
        output_tokens: left.output_tokens + right.output_tokens,
        total_tokens: left.total_tokens + right.total_tokens,
      };
      combinedFields.usage_metadata = usage_metadata;
    }
    return new AIMessageChunk(combinedFields);
  }
}
