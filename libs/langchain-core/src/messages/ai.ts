import {
  BaseMessage,
  BaseMessageChunk,
  mergeContent,
  _mergeDicts,
  _mergeLists,
  BaseMessageFields,
} from "./base.js";
import { getTranslator } from "./block_translators/index.js";
import { ContentBlock } from "./content/index.js";
import {
  $InferMessageContent,
  $InferMessageProperty,
  MessageStructure,
} from "./message.js";
import { mergeResponseMetadata, mergeUsageMetadata } from "./metadata.js";
import {
  InvalidToolCall,
  ToolCall,
  ToolCallChunk,
  defaultToolCallParser,
} from "./tool.js";
import { collapseToolCallChunks, Constructor } from "./utils.js";

export interface AIMessageFields<
  TStructure extends MessageStructure = MessageStructure
> extends BaseMessageFields<TStructure, "ai"> {
  tool_calls?: ToolCall[];
  invalid_tool_calls?: InvalidToolCall[];
  usage_metadata?: $InferMessageProperty<TStructure, "ai", "usage_metadata">;
}

export class AIMessage<TStructure extends MessageStructure = MessageStructure>
  extends BaseMessage<TStructure, "ai">
  implements AIMessageFields<TStructure>
{
  readonly type = "ai" as const;

  tool_calls?: ToolCall[] = [];

  invalid_tool_calls?: InvalidToolCall[] = [];

  usage_metadata?: AIMessageFields<TStructure>["usage_metadata"];

  get lc_aliases(): Record<string, string> {
    // exclude snake case conversion to pascal case
    return {
      ...super.lc_aliases,
      tool_calls: "tool_calls",
      invalid_tool_calls: "invalid_tool_calls",
    };
  }

  constructor(
    fields: $InferMessageContent<TStructure, "ai"> | AIMessageFields<TStructure>
  ) {
    let initParams: AIMessageFields<TStructure>;
    if (typeof fields === "string" || Array.isArray(fields)) {
      initParams = {
        content: fields,
        tool_calls: [],
        invalid_tool_calls: [],
        additional_kwargs: {},
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
            "message tool calls. e.g., `pnpm install @langchain/anthropic`,",
            "pnpm install @langchain/openai`, etc.",
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
      } catch {
        // Do nothing if parsing fails
        initParams.tool_calls = [];
        initParams.invalid_tool_calls = [];
      }

      // Convert content to content blocks if output version is v1
      if (
        initParams.response_metadata !== undefined &&
        "output_version" in initParams.response_metadata &&
        initParams.response_metadata.output_version === "v1"
      ) {
        initParams.contentBlocks =
          initParams.content as Array<ContentBlock.Standard>;
        initParams.content = undefined;
      }

      if (initParams.contentBlocks !== undefined) {
        // Add constructor tool calls as content blocks
        initParams.contentBlocks.push(
          ...initParams.tool_calls.map((toolCall) => ({
            type: "tool_call" as const,
            id: toolCall.id,
            name: toolCall.name,
            args: toolCall.args,
          }))
        );
        // Add content block tool calls that aren't in the constructor tool calls
        const missingToolCalls = initParams.contentBlocks
          .filter<ContentBlock.Tools.ToolCall>(
            (block): block is ContentBlock.Tools.ToolCall =>
              block.type === "tool_call"
          )
          .filter(
            (block) =>
              !initParams.tool_calls?.some(
                (toolCall) =>
                  toolCall.id === block.id && toolCall.name === block.name
              )
          );
        if (missingToolCalls.length > 0) {
          initParams.tool_calls = missingToolCalls.map((block) => ({
            type: "tool_call" as const,
            id: block.id!,
            name: block.name,
            args: block.args as Record<string, unknown>,
          }));
        }
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

  get contentBlocks(): Array<ContentBlock.Standard> {
    if (
      this.response_metadata &&
      "output_version" in this.response_metadata &&
      this.response_metadata.output_version === "v1"
    ) {
      return this.content as Array<ContentBlock.Standard>;
    }

    if (
      this.response_metadata &&
      "model_provider" in this.response_metadata &&
      typeof this.response_metadata.model_provider === "string"
    ) {
      const translator = getTranslator(this.response_metadata.model_provider);
      if (translator) {
        return translator.translateContent(this);
      }
    }

    const blocks = super.contentBlocks;

    if (this.tool_calls) {
      const missingToolCalls = this.tool_calls.filter(
        (block) =>
          !blocks.some((b) => b.id === block.id && b.name === block.name)
      );
      blocks.push(
        ...missingToolCalls.map((block) => ({
          ...block,
          type: "tool_call" as const,
          id: block.id,
          name: block.name,
          args: block.args,
        }))
      );
    }

    return blocks;
  }

  override get _printableFields(): Record<string, unknown> {
    return {
      ...super._printableFields,
      tool_calls: this.tool_calls,
      invalid_tool_calls: this.invalid_tool_calls,
      usage_metadata: this.usage_metadata,
    };
  }

  static isInstance(obj: unknown): obj is AIMessage {
    return super.isInstance(obj) && obj.type === "ai";
  }
}

/**
 * @deprecated Use {@link AIMessage.isInstance} instead
 */
export function isAIMessage<TStructure extends MessageStructure>(
  x: BaseMessage
): x is AIMessage<TStructure> {
  return x._getType() === "ai";
}

/**
 * @deprecated Use {@link AIMessageChunk.isInstance} instead
 */
export function isAIMessageChunk<TStructure extends MessageStructure>(
  x: BaseMessageChunk
): x is AIMessageChunk<TStructure> {
  return x._getType() === "ai";
}

export type AIMessageChunkFields<
  TStructure extends MessageStructure = MessageStructure
> = AIMessageFields<TStructure> & {
  tool_call_chunks?: ToolCallChunk[];
};

/**
 * Represents a chunk of an AI message, which can be concatenated with
 * other AI message chunks.
 */
export class AIMessageChunk<
    TStructure extends MessageStructure = MessageStructure
  >
  extends BaseMessageChunk<TStructure, "ai">
  implements AIMessage<TStructure>, AIMessageChunkFields<TStructure>
{
  readonly type = "ai" as const;

  tool_calls?: ToolCall[] = [];

  invalid_tool_calls?: InvalidToolCall[] = [];

  tool_call_chunks?: ToolCallChunk[] = [];

  usage_metadata?: AIMessageChunkFields<TStructure>["usage_metadata"];

  constructor(
    fields:
      | $InferMessageContent<TStructure, "ai">
      | AIMessageChunkFields<TStructure>
  ) {
    let initParams: AIMessageChunkFields<TStructure>;
    if (typeof fields === "string" || Array.isArray(fields)) {
      initParams = {
        content: fields,
        tool_calls: [],
        invalid_tool_calls: [],
        tool_call_chunks: [],
      };
    } else if (
      fields.tool_call_chunks === undefined ||
      fields.tool_call_chunks.length === 0
    ) {
      initParams = {
        ...fields,
        tool_calls: fields.tool_calls ?? [],
        invalid_tool_calls: [],
        tool_call_chunks: [],
        usage_metadata:
          fields.usage_metadata !== undefined
            ? fields.usage_metadata
            : undefined,
      };
    } else {
      initParams = {
        ...fields,
        ...collapseToolCallChunks(fields.tool_call_chunks ?? []),
        usage_metadata:
          fields.usage_metadata !== undefined
            ? fields.usage_metadata
            : undefined,
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

  get contentBlocks(): Array<ContentBlock.Standard> {
    if (
      this.response_metadata &&
      "output_version" in this.response_metadata &&
      this.response_metadata.output_version === "v1"
    ) {
      return this.content as Array<ContentBlock.Standard>;
    }

    if (
      this.response_metadata &&
      "model_provider" in this.response_metadata &&
      typeof this.response_metadata.model_provider === "string"
    ) {
      const translator = getTranslator(this.response_metadata.model_provider);
      if (translator) {
        return translator.translateContent(this);
      }
    }

    const blocks = super.contentBlocks;

    if (this.tool_calls) {
      if (typeof this.content !== "string") {
        const contentToolCalls = this.content
          .filter((block) => block.type === "tool_call")
          .map((block) => block.id);
        for (const toolCall of this.tool_calls) {
          if (toolCall.id && !contentToolCalls.includes(toolCall.id)) {
            blocks.push({
              ...toolCall,
              type: "tool_call",
              id: toolCall.id,
              name: toolCall.name,
              args: toolCall.args,
            });
          }
        }
      }
    }

    return blocks;
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

  concat(chunk: AIMessageChunk<TStructure>) {
    const combinedFields: AIMessageChunkFields = {
      content: mergeContent(this.content, chunk.content),
      additional_kwargs: _mergeDicts(
        this.additional_kwargs,
        chunk.additional_kwargs
      ),
      response_metadata: mergeResponseMetadata(
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
        this.tool_call_chunks as ContentBlock.Tools.ToolCallChunk[],
        chunk.tool_call_chunks as ContentBlock.Tools.ToolCallChunk[]
      );
      if (rawToolCalls !== undefined && rawToolCalls.length > 0) {
        combinedFields.tool_call_chunks = rawToolCalls;
      }
    }
    if (
      this.usage_metadata !== undefined ||
      chunk.usage_metadata !== undefined
    ) {
      combinedFields.usage_metadata = mergeUsageMetadata(
        this.usage_metadata,
        chunk.usage_metadata
      );
    }
    const Cls = this.constructor as Constructor<this>;
    return new Cls(combinedFields);
  }

  static isInstance(obj: unknown): obj is AIMessageChunk {
    return super.isInstance(obj) && obj.type === "ai";
  }
}
