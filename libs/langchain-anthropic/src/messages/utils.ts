import { v1 } from "@langchain/core/messages";

import { contentBlockConverter } from "./converter.js";
import { _formatImage } from "../utils/message_inputs.js";
import {
  isAnthropicImageBlockParam,
  type AnthropicThinkingBlockParam,
  type AnthropicRedactedThinkingBlockParam,
  type AnthropicSearchResultBlockParam,
  type AnthropicTextBlockParam,
  type AnthropicCacheControlEphemeral,
} from "../types.js";

const TOOL_TYPES = [
  "tool_use",
  "tool_result",
  "input_json_delta",
  "server_tool_use",
  "web_search_tool_result",
  "web_search_result",
];
const TEXT_TYPES = ["text", "text_delta"] as const;

export function ensureMessageContents(
  messages: v1.BaseMessage[]
): (v1.SystemMessage | v1.HumanMessage | v1.AIMessage)[] {
  // Merge runs of human/tool messages into single human messages with content blocks.
  const updatedMsgs: (v1.SystemMessage | v1.HumanMessage | v1.AIMessage)[] = [];
  for (const message of messages) {
    if (message.type !== "tool") {
      updatedMsgs.push(message);
      continue;
    }

    if (typeof message.content !== "string") {
      updatedMsgs.push({
        type: "user",
        responseMetadata: {},
        usageMetadata: {},
        content: [
          {
            type: "tool_result",
            result: formatContent(message.content),
            // TODO: add callId
            callId: "", // (message as ToolMessage).tool_call_id,
          } satisfies v1.ContentBlock.Tools.ToolResult,
        ],
      } satisfies v1.HumanMessage);
      continue;
    }

    if (typeof message.content === "string" || Array.isArray(message.content)) {
      const previousMessage = updatedMsgs[updatedMsgs.length - 1];
      const isToolResult =
        previousMessage.type === "user" &&
        Array.isArray(previousMessage.content) &&
        "type" in previousMessage.content[0] &&
        previousMessage.content[0].type === "tool_result";

      /**
       * If the previous message was a tool result, we merge this tool message into it.
       */
      if (isToolResult) {
        previousMessage.content.push({
          type: "tool_result",
          result: message.content as v1.ContentBlock.Tools.ToolResult,
          callId: "", // (message as ToolMessage).tool_call_id,
        });
        continue;
      }

      /**
       * If not, we create a new human message with the tool result.
       */
      updatedMsgs.push({
        type: "user",
        responseMetadata: {},
        usageMetadata: {},
        content: [
          {
            type: "tool_result",
            result: message.content,
            callId: "", // (message as ToolMessage).tool_call_id,
          },
        ],
      });
    }
  }
  return updatedMsgs;
}

function formatContent(content: v1.ContentBlock.Types[]) {
  return content.map((contentPart) => {
    /**
     * return if the content part is a known multimodal content block
     */
    if (v1.isMultimodalContentBlock(contentPart)) {
      return v1.convertToProviderContentBlock(
        contentPart,
        contentBlockConverter
      );
    }

    const unknownContentBlock = contentPart as unknown as Record<
      string,
      unknown
    >;
    if (
      typeof unknownContentBlock !== "object" ||
      unknownContentBlock === null
    ) {
      throw new Error("Unsupported message content format");
    }

    const cacheControl =
      "cache_control" in contentPart
        ? unknownContentBlock.cache_control
        : undefined;

    if (unknownContentBlock.type === "image_url") {
      let source;
      if (typeof unknownContentBlock.image_url === "string") {
        source = _formatImage(unknownContentBlock.image_url);
      } else if (
        typeof unknownContentBlock.image_url === "object" &&
        unknownContentBlock.image_url &&
        "url" in unknownContentBlock.image_url
      ) {
        source = _formatImage(unknownContentBlock.image_url.url as string);
      }
      return {
        type: "image" as const, // Explicitly setting the type as "image"
        source,
        ...(cacheControl ? { cache_control: cacheControl } : {}),
      };
    }

    if (isAnthropicImageBlockParam(contentPart)) {
      return contentPart;
    }

    if (unknownContentBlock.type === "document") {
      // PDF
      return {
        ...unknownContentBlock,
        ...(cacheControl ? { cache_control: cacheControl } : {}),
      };
    }

    if (unknownContentBlock.type === "thinking") {
      const block: AnthropicThinkingBlockParam = {
        type: "thinking" as const, // Explicitly setting the type as "thinking"
        thinking: unknownContentBlock.thinking as string,
        signature: unknownContentBlock.signature as string,
        ...(cacheControl ? { cache_control: cacheControl } : {}),
      };
      return block;
    }

    if (unknownContentBlock.type === "redacted_thinking") {
      const block: AnthropicRedactedThinkingBlockParam = {
        type: "redacted_thinking" as const, // Explicitly setting the type as "redacted_thinking"
        data: unknownContentBlock.data as string,
        ...(cacheControl ? { cache_control: cacheControl } : {}),
      };
      return block;
    }

    if (unknownContentBlock.type === "search_result") {
      return {
        type: "search_result" as const, // Explicitly setting the type as "search_result"
        title: unknownContentBlock.title as string,
        source: unknownContentBlock.source as string,
        ...("cache_control" in unknownContentBlock &&
        unknownContentBlock.cache_control
          ? {
              cache_control:
                unknownContentBlock.cache_control as AnthropicCacheControlEphemeral,
            }
          : {}),
        ...("citations" in unknownContentBlock && unknownContentBlock.citations
          ? { citations: unknownContentBlock.citations }
          : {}),
        content: unknownContentBlock.content as AnthropicTextBlockParam[],
      } satisfies AnthropicSearchResultBlockParam;
    }

    if (
      TEXT_TYPES.find((t) => t === unknownContentBlock.type) &&
      "text" in unknownContentBlock
    ) {
      // Assuming contentPart is of type MessageContentText here
      return {
        type: "text" as const, // Explicitly setting the type as "text"
        text: unknownContentBlock.text,
        ...(cacheControl ? { cache_control: cacheControl } : {}),
        ...("citations" in unknownContentBlock && unknownContentBlock.citations
          ? { citations: unknownContentBlock.citations }
          : {}),
      };
    }

    if (TOOL_TYPES.find((t) => t === unknownContentBlock.type)) {
      const contentPartCopy = { ...unknownContentBlock };
      if ("index" in contentPartCopy) {
        // Anthropic does not support passing the index field here, so we remove it.
        delete contentPartCopy.index;
      }

      if (contentPartCopy.type === "input_json_delta") {
        // `input_json_delta` type only represents yielding partial tool inputs
        // and is not a valid type for Anthropic messages.
        contentPartCopy.type = "tool_use";
      }

      if ("input" in contentPartCopy) {
        // Anthropic tool use inputs should be valid objects, when applicable.
        if (typeof contentPartCopy.input === "string") {
          try {
            contentPartCopy.input = JSON.parse(contentPartCopy.input);
          } catch {
            contentPartCopy.input = {};
          }
        }
      }

      // TODO: Fix when SDK types are fixed
      return {
        ...contentPartCopy,
        ...(cacheControl ? { cache_control: cacheControl } : {}),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
    } else {
      throw new Error("Unsupported message content format");
    }
  });
}
