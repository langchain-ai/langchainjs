import {
  BaseMessage,
  ChatMessage,
  convertToProviderContentBlock,
  isAIMessage,
  isDataContentBlock,
  parseBase64DataUrl,
  parseMimeType,
  StandardContentBlockConverter,
  ToolMessage,
} from "@langchain/core/messages";
import { convertLangChainToolCallToOpenAI } from "@langchain/core/output_parsers/openai_tools";
import type { OpenAI as OpenAIClient } from "openai";
import type {
  ChatCompletionContentPartText,
  ChatCompletionContentPartImage,
  ChatCompletionContentPartInputAudio,
  ChatCompletionContentPart,
} from "openai/resources/chat/completions";

export type ResponsesInputItem = OpenAIClient.Responses.ResponseInputItem;

export function isReasoningModel(model?: string) {
  return model && /^o\d/.test(model);
}

export function extractGenericMessageCustomRole(message: ChatMessage) {
  if (
    message.role !== "system" &&
    message.role !== "developer" &&
    message.role !== "assistant" &&
    message.role !== "user" &&
    message.role !== "function" &&
    message.role !== "tool"
  ) {
    console.warn(`Unknown message role: ${message.role}`);
  }

  return message.role as OpenAIClient.ChatCompletionRole;
}

export function messageToOpenAIRole(
  message: BaseMessage
): OpenAIClient.ChatCompletionRole {
  const type = message._getType();
  switch (type) {
    case "system":
      return "system";
    case "ai":
      return "assistant";
    case "human":
      return "user";
    case "function":
      return "function";
    case "tool":
      return "tool";
    case "generic": {
      if (!ChatMessage.isInstance(message))
        throw new Error("Invalid generic chat message");
      return extractGenericMessageCustomRole(message);
    }
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

export const completionsApiContentBlockConverter: StandardContentBlockConverter<{
  text: ChatCompletionContentPartText;
  image: ChatCompletionContentPartImage;
  audio: ChatCompletionContentPartInputAudio;
  file: ChatCompletionContentPart.File;
}> = {
  providerName: "ChatOpenAI",

  fromStandardTextBlock(block): ChatCompletionContentPartText {
    return { type: "text", text: block.text };
  },

  fromStandardImageBlock(block): ChatCompletionContentPartImage {
    if (block.source_type === "url") {
      return {
        type: "image_url",
        image_url: {
          url: block.url,
          ...(block.metadata?.detail
            ? { detail: block.metadata.detail as "auto" | "low" | "high" }
            : {}),
        },
      };
    }

    if (block.source_type === "base64") {
      const url = `data:${block.mime_type ?? ""};base64,${block.data}`;
      return {
        type: "image_url",
        image_url: {
          url,
          ...(block.metadata?.detail
            ? { detail: block.metadata.detail as "auto" | "low" | "high" }
            : {}),
        },
      };
    }

    throw new Error(
      `Image content blocks with source_type ${block.source_type} are not supported for ChatOpenAI`
    );
  },

  fromStandardAudioBlock(block): ChatCompletionContentPartInputAudio {
    if (block.source_type === "url") {
      const data = parseBase64DataUrl({ dataUrl: block.url });
      if (!data) {
        throw new Error(
          `URL audio blocks with source_type ${block.source_type} must be formatted as a data URL for ChatOpenAI`
        );
      }

      const rawMimeType = data.mime_type || block.mime_type || "";
      let mimeType: { type: string; subtype: string };

      try {
        mimeType = parseMimeType(rawMimeType);
      } catch {
        throw new Error(
          `Audio blocks with source_type ${block.source_type} must have mime type of audio/wav or audio/mp3`
        );
      }

      if (
        mimeType.type !== "audio" ||
        (mimeType.subtype !== "wav" && mimeType.subtype !== "mp3")
      ) {
        throw new Error(
          `Audio blocks with source_type ${block.source_type} must have mime type of audio/wav or audio/mp3`
        );
      }

      return {
        type: "input_audio",
        input_audio: {
          format: mimeType.subtype,
          data: data.data,
        },
      };
    }

    if (block.source_type === "base64") {
      let mimeType: { type: string; subtype: string };

      try {
        mimeType = parseMimeType(block.mime_type ?? "");
      } catch {
        throw new Error(
          `Audio blocks with source_type ${block.source_type} must have mime type of audio/wav or audio/mp3`
        );
      }

      if (
        mimeType.type !== "audio" ||
        (mimeType.subtype !== "wav" && mimeType.subtype !== "mp3")
      ) {
        throw new Error(
          `Audio blocks with source_type ${block.source_type} must have mime type of audio/wav or audio/mp3`
        );
      }

      return {
        type: "input_audio",
        input_audio: {
          format: mimeType.subtype,
          data: block.data,
        },
      };
    }

    throw new Error(
      `Audio content blocks with source_type ${block.source_type} are not supported for ChatOpenAI`
    );
  },

  fromStandardFileBlock(block): ChatCompletionContentPart.File {
    if (block.source_type === "url") {
      const data = parseBase64DataUrl({ dataUrl: block.url });
      if (!data) {
        throw new Error(
          `URL file blocks with source_type ${block.source_type} must be formatted as a data URL for ChatOpenAI`
        );
      }

      return {
        type: "file",
        file: {
          file_data: block.url, // formatted as base64 data URL
          ...(block.metadata?.filename || block.metadata?.name
            ? {
                filename: (block.metadata?.filename ||
                  block.metadata?.name) as string,
              }
            : {}),
        },
      };
    }

    if (block.source_type === "base64") {
      return {
        type: "file",
        file: {
          file_data: `data:${block.mime_type ?? ""};base64,${block.data}`,
          ...(block.metadata?.filename ||
          block.metadata?.name ||
          block.metadata?.title
            ? {
                filename: (block.metadata?.filename ||
                  block.metadata?.name ||
                  block.metadata?.title) as string,
              }
            : {}),
        },
      };
    }

    if (block.source_type === "id") {
      return {
        type: "file",
        file: {
          file_id: block.id,
        },
      };
    }

    throw new Error(
      `File content blocks with source_type ${block.source_type} are not supported for ChatOpenAI`
    );
  },
};

export function _convertMessagesToOpenAIParams(
  messages: BaseMessage[],
  model?: string
): OpenAIClient.Chat.Completions.ChatCompletionMessageParam[] {
  // TODO: Function messages do not support array content, fix cast
  return messages.flatMap((message) => {
    let role = messageToOpenAIRole(message);
    if (role === "system" && isReasoningModel(model)) {
      role = "developer";
    }

    const content =
      typeof message.content === "string"
        ? message.content
        : message.content.map((m) => {
            if (isDataContentBlock(m)) {
              return convertToProviderContentBlock(
                m,
                completionsApiContentBlockConverter
              );
            }
            return m;
          });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const completionParam: Record<string, any> = {
      role,
      content,
    };
    if (message.name != null) {
      completionParam.name = message.name;
    }
    if (message.additional_kwargs.function_call != null) {
      completionParam.function_call = message.additional_kwargs.function_call;
      completionParam.content = "";
    }
    if (isAIMessage(message) && !!message.tool_calls?.length) {
      completionParam.tool_calls = message.tool_calls.map(
        convertLangChainToolCallToOpenAI
      );
      completionParam.content = "";
    } else {
      if (message.additional_kwargs.tool_calls != null) {
        completionParam.tool_calls = message.additional_kwargs.tool_calls;
      }
      if ((message as ToolMessage).tool_call_id != null) {
        completionParam.tool_call_id = (message as ToolMessage).tool_call_id;
      }
    }

    if (
      message.additional_kwargs.audio &&
      typeof message.additional_kwargs.audio === "object" &&
      "id" in message.additional_kwargs.audio
    ) {
      const audioMessage = {
        role: "assistant",
        audio: {
          id: message.additional_kwargs.audio.id,
        },
      };
      return [
        completionParam,
        audioMessage,
      ] as OpenAIClient.Chat.Completions.ChatCompletionMessageParam[];
    }

    return completionParam as OpenAIClient.Chat.Completions.ChatCompletionMessageParam;
  });
}
