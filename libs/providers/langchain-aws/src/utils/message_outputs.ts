import type {
  MessageContentComplex,
  BaseMessage,
  UsageMetadata,
} from "@langchain/core/messages";
import { AIMessage, AIMessageChunk } from "@langchain/core/messages";
import type { ToolCall } from "@langchain/core/messages/tool";
import type {
  Message as BedrockMessage,
  ConverseResponse,
  ContentBlockDeltaEvent,
  ConverseStreamMetadataEvent,
  ContentBlockStartEvent,
  ReasoningContentBlock,
  ReasoningContentBlockDelta,
  ReasoningTextBlock,
} from "@aws-sdk/client-bedrock-runtime";
import type { DocumentType as __DocumentType } from "@smithy/types";
import { ChatGenerationChunk } from "@langchain/core/outputs";
import {
  MessageContentReasoningBlock,
  MessageContentReasoningBlockReasoningTextPartial,
  MessageContentReasoningBlockRedacted,
} from "../types.js";

export function convertConverseMessageToLangChainMessage(
  message: BedrockMessage,
  responseMetadata: Omit<ConverseResponse, "output">
): BaseMessage {
  if (!message.content) {
    throw new Error("No message content found in response.");
  }
  if (message.role !== "assistant") {
    throw new Error(
      `Unsupported message role received in ChatBedrockConverse response: ${message.role}`
    );
  }
  let requestId: string | undefined;
  if (
    "$metadata" in responseMetadata &&
    responseMetadata.$metadata &&
    typeof responseMetadata.$metadata === "object" &&
    "requestId" in responseMetadata.$metadata
  ) {
    requestId = responseMetadata.$metadata.requestId as string;
  }
  let tokenUsage: UsageMetadata | undefined;
  if (responseMetadata.usage) {
    const input_tokens = responseMetadata.usage.inputTokens ?? 0;
    const output_tokens = responseMetadata.usage.outputTokens ?? 0;
    tokenUsage = {
      input_tokens,
      output_tokens,
      total_tokens:
        responseMetadata.usage.totalTokens ?? input_tokens + output_tokens,
    };
  }

  if (
    message.content?.length === 1 &&
    "text" in message.content[0] &&
    typeof message.content[0].text === "string"
  ) {
    return new AIMessage({
      content: message.content[0].text,
      response_metadata: responseMetadata,
      usage_metadata: tokenUsage,
      id: requestId,
    });
  } else {
    const toolCalls: ToolCall[] = [];
    const content: MessageContentComplex[] = [];
    message.content.forEach((c) => {
      if (
        "toolUse" in c &&
        c.toolUse &&
        c.toolUse.name &&
        c.toolUse.input &&
        typeof c.toolUse.input === "object"
      ) {
        toolCalls.push({
          id: c.toolUse.toolUseId,
          name: c.toolUse.name,
          args: c.toolUse.input,
          type: "tool_call",
        });
      } else if ("text" in c && typeof c.text === "string") {
        content.push({ type: "text", text: c.text });
      } else if ("reasoningContent" in c) {
        content.push(
          bedrockReasoningBlockToLangchainReasoningBlock(
            c.reasoningContent as ReasoningContentBlock
          )
        );
      } else {
        content.push(c);
      }
    });
    return new AIMessage({
      content: content.length ? content : "",
      tool_calls: toolCalls.length ? toolCalls : undefined,
      response_metadata: responseMetadata,
      usage_metadata: tokenUsage,
      id: requestId,
    });
  }
}

export function handleConverseStreamContentBlockDelta(
  contentBlockDelta: ContentBlockDeltaEvent
): ChatGenerationChunk {
  if (!contentBlockDelta.delta) {
    throw new Error("No delta found in content block.");
  }
  if (typeof contentBlockDelta.delta.text === "string") {
    return new ChatGenerationChunk({
      text: contentBlockDelta.delta.text,
      message: new AIMessageChunk({
        content: contentBlockDelta.delta.text,
      }),
    });
  } else if (contentBlockDelta.delta.toolUse) {
    const index = contentBlockDelta.contentBlockIndex;
    return new ChatGenerationChunk({
      text: "",
      message: new AIMessageChunk({
        content: "",
        tool_call_chunks: [
          {
            args: contentBlockDelta.delta.toolUse.input,
            index,
            type: "tool_call_chunk",
          },
        ],
      }),
    });
  } else if (contentBlockDelta.delta.reasoningContent) {
    return new ChatGenerationChunk({
      text: "",
      message: new AIMessageChunk({
        content: [
          bedrockReasoningDeltaToLangchainPartialReasoningBlock(
            contentBlockDelta.delta.reasoningContent
          ),
        ],
      }),
    });
  } else {
    throw new Error(
      `Unsupported content block type(s): ${JSON.stringify(
        contentBlockDelta.delta,
        null,
        2
      )}`
    );
  }
}

export function handleConverseStreamContentBlockStart(
  contentBlockStart: ContentBlockStartEvent
): ChatGenerationChunk {
  const index = contentBlockStart.contentBlockIndex;
  if (contentBlockStart.start?.toolUse) {
    return new ChatGenerationChunk({
      text: "",
      message: new AIMessageChunk({
        content: "",
        tool_call_chunks: [
          {
            name: contentBlockStart.start.toolUse.name,
            id: contentBlockStart.start.toolUse.toolUseId,
            index,
            type: "tool_call_chunk",
          },
        ],
      }),
    });
  }
  throw new Error("Unsupported content block start event.");
}

export function handleConverseStreamMetadata(
  metadata: ConverseStreamMetadataEvent,
  extra: {
    streamUsage: boolean;
  }
): ChatGenerationChunk {
  const inputTokens = metadata.usage?.inputTokens ?? 0;
  const outputTokens = metadata.usage?.outputTokens ?? 0;
  const usage_metadata: UsageMetadata = {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: metadata.usage?.totalTokens ?? inputTokens + outputTokens,
  };
  return new ChatGenerationChunk({
    text: "",
    message: new AIMessageChunk({
      content: "",
      usage_metadata: extra.streamUsage ? usage_metadata : undefined,
      response_metadata: {
        // Use the same key as returned from the Converse API
        metadata,
      },
    }),
  });
}

export function bedrockReasoningDeltaToLangchainPartialReasoningBlock(
  reasoningContent: ReasoningContentBlockDelta
):
  | MessageContentReasoningBlockReasoningTextPartial
  | MessageContentReasoningBlockRedacted {
  const { text, redactedContent, signature } = reasoningContent;
  if (typeof text === "string") {
    return {
      type: "reasoning_content",
      reasoningText: { text },
    };
  }
  if (signature) {
    return {
      type: "reasoning_content",
      reasoningText: { signature },
    };
  }
  if (redactedContent) {
    return {
      type: "reasoning_content",
      redactedContent: Buffer.from(redactedContent).toString("base64"),
    };
  }
  throw new Error("Invalid reasoning content");
}

export function bedrockReasoningBlockToLangchainReasoningBlock(
  reasoningContent: ReasoningContentBlock
): MessageContentReasoningBlock {
  const { reasoningText, redactedContent } = reasoningContent;
  if (reasoningText) {
    return {
      type: "reasoning_content",
      reasoningText: reasoningText as Required<ReasoningTextBlock>,
    };
  }

  if (redactedContent) {
    return {
      type: "reasoning_content",
      redactedContent: Buffer.from(redactedContent).toString("base64"),
    };
  }
  throw new Error("Invalid reasoning content");
}
