/**
 * Converts Cloudflare Workers AI stream chunks into LangChain ChatModelStreamEvents.
 *
 * @module
 */

import type {
  ChatModelStreamEvent,
  FinishReason,
} from "@langchain/core/language_models/event";
import type { ContentBlock } from "@langchain/core/messages/content";

export interface CloudflareStreamChunk {
  response?: string;
}

export async function* convertCloudflareStream(
  source: AsyncIterable<CloudflareStreamChunk>
): AsyncGenerator<ChatModelStreamEvent> {
  let messageStarted = false;
  let accumulatedText = "";
  const textIndex = 0;

  for await (const chunk of source) {
    if (!messageStarted) {
      messageStarted = true;
      yield { event: "message-start" as const };
      yield {
        event: "content-block-start" as const,
        index: textIndex,
        content: { type: "text", text: "" } as ContentBlock,
      };
    }

    const text = chunk.response ?? "";
    if (text) {
      accumulatedText += text;
      yield {
        event: "content-block-delta" as const,
        index: textIndex,
        delta: { type: "text-delta" as const, text },
      };
    }
  }

  yield {
    event: "content-block-finish" as const,
    index: textIndex,
    content: { type: "text", text: accumulatedText } as ContentBlock,
  };

  yield {
    event: "message-finish" as const,
    reason: "stop" as FinishReason,
    responseMetadata: { model_provider: "cloudflare" },
  };
}
