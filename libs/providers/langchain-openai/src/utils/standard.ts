import type { OpenAI as OpenAIClient } from "openai";
import {
  isToolMessage,
  type AIMessage,
  type ContentBlock,
} from "@langchain/core/messages";
import { isReasoningModel, messageToOpenAIRole } from "./message_inputs.js";
import { iife } from "./misc.js";

type ChatCompletionContentData =
  | OpenAIClient.Chat.Completions.ChatCompletionContentPartImage
  | OpenAIClient.Chat.Completions.ChatCompletionContentPartInputAudio
  | OpenAIClient.Chat.Completions.ChatCompletionContentPart.File;

function _convertToChatCompletionsData(
  block: ContentBlock.Standard
): ChatCompletionContentData | undefined {
  if (block.type === "image") {
    if (block.url) {
      return {
        type: "image_url",
        image_url: {
          url: block.url,
        },
      };
    } else if (block.data) {
      return {
        type: "image_url",
        image_url: {
          url: `data:${block.mimeType};base64,${block.data}`,
        },
      };
    }
  }
  if (block.type === "audio") {
    if (block.data) {
      const format = iife(() => {
        const [, format] = block.mimeType.split("/");
        if (format === "wav" || format === "mp3") {
          return format;
        }
        return "wav";
      });
      return {
        type: "input_audio",
        input_audio: {
          data: block.data.toString(),
          format,
        },
      };
    }
  }
  if (block.type === "file") {
    if (block.data) {
      return {
        type: "file",
        file: {
          file_data: block.data.toString(),
        },
      };
    }
    if (block.fileId) {
      return {
        type: "file",
        file: {
          file_id: block.fileId,
        },
      };
    }
  }
  return undefined;
}

export function _convertToCompletionsMessageFromV1(
  message: AIMessage,
  model?: string
): OpenAIClient.Chat.Completions.ChatCompletionMessageParam {
  let role = messageToOpenAIRole(message);
  if (role === "system" && isReasoningModel(model)) {
    role = "developer";
  }
  if (role === "developer") {
    return {
      role: "developer",
      content: message.contentBlocks.filter((block) => block.type === "text"),
    };
  } else if (role === "system") {
    return {
      role: "system",
      content: message.contentBlocks.filter((block) => block.type === "text"),
    };
  } else if (role === "assistant") {
    return {
      role: "assistant",
      content: message.contentBlocks.filter((block) => block.type === "text"),
    };
  } else if (role === "tool" && isToolMessage(message)) {
    return {
      role: "tool",
      tool_call_id: message.tool_call_id,
      content: message.contentBlocks.filter((block) => block.type === "text"),
    };
  } else if (role === "function") {
    return {
      role: "function",
      name: message.name ?? "",
      content: message.contentBlocks
        .filter((block) => block.type === "text")
        .join(""),
    };
  }
  // Default to user message handling
  function* iterateUserContent(blocks: ContentBlock.Standard[]) {
    for (const block of blocks) {
      if (block.type === "text") {
        yield {
          type: "text" as const,
          text: block.text,
        };
      }
      const data = _convertToChatCompletionsData(block);
      if (data) {
        yield data;
      }
    }
  }
  return {
    role: "user",
    content: Array.from(iterateUserContent(message.contentBlocks)),
  };
}

export function _convertToResponsesMessageFromV1(message: AIMessage) {
  function* iterateContent(): Generator<OpenAIClient.Responses.ResponseInputItem> {
    for (const block of message.contentBlocks) {
      if (block.type === "text") {
        yield {
          type: "message" as const,
          role: "assistant",
          content: block.text,
        };
      } else if (block.type === "reasoning") {
        yield {
          id: block.id ?? "",
          type: "reasoning" as const,
          summary: [
            {
              type: "summary_text",
              text: block.reasoning,
            },
          ],
        };
      } else if (block.type === "tool_call") {
        yield {
          type: "function_call" as const,
          name: block.name,
          call_id: block.id ?? "",
          arguments: JSON.stringify(block.args),
        };
      }
    }
  }
  return Array.from(iterateContent());
}
