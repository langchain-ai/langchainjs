import type { OpenAI as OpenAIClient } from "openai";
import {
  AIMessage,
  BaseMessage,
  ToolMessage,
  type ContentBlock,
} from "@langchain/core/messages";
import { iife, isReasoningModel, messageToOpenAIRole } from "./misc.js";

export type ResponsesInputItem = OpenAIClient.Responses.ResponseInputItem;

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
  message: BaseMessage,
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
  } else if (role === "tool" && ToolMessage.isInstance(message)) {
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

export function _convertToResponsesMessageFromV1(message: BaseMessage) {
  const isResponsesMessage =
    AIMessage.isInstance(message) &&
    message.response_metadata?.model_provider === "openai";

  function* iterateItems(): Generator<OpenAIClient.Responses.ResponseInputItem> {
    const messageRole = iife(() => {
      try {
        const role = messageToOpenAIRole(message);
        if (
          role === "system" ||
          role === "developer" ||
          role === "assistant" ||
          role === "user"
        ) {
          return role;
        }
        return "assistant";
      } catch {
        return "assistant";
      }
    });

    let currentMessage: OpenAIClient.Responses.EasyInputMessage | undefined =
      undefined;

    const functionCallIdsWithBlocks = new Set<string>();
    const serverFunctionCallIdsWithBlocks = new Set<string>();

    const pendingFunctionChunks = new Map<
      string,
      { name?: string; args: string[] }
    >();
    const pendingServerFunctionChunks = new Map<
      string,
      { name?: string; args: string[] }
    >();

    function* flushMessage() {
      if (!currentMessage) return;
      const content = currentMessage.content;
      if (
        (typeof content === "string" && content.length > 0) ||
        (Array.isArray(content) && content.length > 0)
      ) {
        yield currentMessage;
      }
      currentMessage = undefined;
    }

    const pushMessageContent: (
      content: OpenAIClient.Responses.ResponseInputMessageContentList
    ) => void = (content) => {
      if (!currentMessage) {
        currentMessage = {
          type: "message",
          role: messageRole,
          content: [],
        };
      }
      if (typeof currentMessage.content === "string") {
        currentMessage.content =
          currentMessage.content.length > 0
            ? [{ type: "input_text", text: currentMessage.content }, ...content]
            : [...content];
      } else {
        currentMessage.content.push(...content);
      }
    };

    const toJsonString = (value: unknown) => {
      if (typeof value === "string") {
        return value;
      }
      try {
        return JSON.stringify(value ?? {});
      } catch {
        return "{}";
      }
    };

    const resolveImageItem = (
      block: ContentBlock.Multimodal.Image
    ): OpenAIClient.Responses.ResponseInputImage | undefined => {
      const detail = iife(() => {
        const raw = block.metadata?.detail;
        if (raw === "low" || raw === "high" || raw === "auto") {
          return raw;
        }
        return "auto";
      });
      if (block.fileId) {
        return {
          type: "input_image",
          detail,
          file_id: block.fileId,
        };
      }
      if (block.url) {
        return {
          type: "input_image",
          detail,
          image_url: block.url,
        };
      }
      if (block.data) {
        const base64Data =
          typeof block.data === "string"
            ? block.data
            : Buffer.from(block.data).toString("base64");
        const mimeType = block.mimeType ?? "image/png";
        return {
          type: "input_image",
          detail,
          image_url: `data:${mimeType};base64,${base64Data}`,
        };
      }
      return undefined;
    };

    const resolveFileItem = (
      block: ContentBlock.Multimodal.File | ContentBlock.Multimodal.Video
    ): OpenAIClient.Responses.ResponseInputFile | undefined => {
      const filename =
        block.metadata?.filename ??
        block.metadata?.name ??
        block.metadata?.title;
      if (block.fileId && typeof filename === "string") {
        return {
          type: "input_file",
          file_id: block.fileId,
          ...(filename ? { filename } : {}),
        };
      }
      if (block.url && typeof filename === "string") {
        return {
          type: "input_file",
          file_url: block.url,
          ...(filename ? { filename } : {}),
        };
      }
      if (block.data && typeof filename === "string") {
        const encoded =
          typeof block.data === "string"
            ? block.data
            : Buffer.from(block.data).toString("base64");
        const mimeType = block.mimeType ?? "application/octet-stream";
        return {
          type: "input_file",
          file_data: `data:${mimeType};base64,${encoded}`,
          ...(filename ? { filename } : {}),
        };
      }
      return undefined;
    };

    const convertReasoningBlock = (
      block: ContentBlock.Reasoning
    ): OpenAIClient.Responses.ResponseReasoningItem => {
      const summaryEntries = iife(() => {
        if (Array.isArray(block.summary)) {
          const candidate = block.summary;
          const mapped =
            candidate
              ?.map((item) => item?.text)
              .filter((text): text is string => typeof text === "string") ?? [];
          if (mapped.length > 0) {
            return mapped;
          }
        }
        return block.reasoning ? [block.reasoning] : [];
      });

      const summary =
        summaryEntries.length > 0
          ? summaryEntries.map((text) => ({
              type: "summary_text" as const,
              text,
            }))
          : [{ type: "summary_text" as const, text: "" }];

      const reasoningItem: OpenAIClient.Responses.ResponseReasoningItem = {
        type: "reasoning",
        id: block.id ?? "",
        summary,
      };

      if (block.reasoning) {
        reasoningItem.content = [
          {
            type: "reasoning_text" as const,
            text: block.reasoning,
          },
        ];
      }
      return reasoningItem;
    };

    const convertFunctionCall = (
      block: ContentBlock.Tools.ToolCall | ContentBlock.Tools.ServerToolCall
    ): OpenAIClient.Responses.ResponseFunctionToolCall => ({
      type: "function_call",
      name: block.name ?? "",
      call_id: block.id ?? "",
      arguments: toJsonString(block.args),
    });

    const convertFunctionCallOutput = (
      block: ContentBlock.Tools.ServerToolCallResult
    ): OpenAIClient.Responses.ResponseInputItem.FunctionCallOutput => {
      const output = toJsonString(block.output);
      const status =
        block.status === "success"
          ? "completed"
          : block.status === "error"
          ? "incomplete"
          : undefined;
      return {
        type: "function_call_output",
        call_id: block.toolCallId ?? "",
        output,
        ...(status ? { status } : {}),
      };
    };

    for (const block of message.contentBlocks) {
      if (block.type === "text") {
        pushMessageContent([{ type: "input_text", text: block.text }]);
      } else if (block.type === "invalid_tool_call") {
        // no-op
      } else if (block.type === "reasoning") {
        yield* flushMessage();
        yield convertReasoningBlock(
          block as ContentBlock.Standard & { type: "reasoning" }
        );
      } else if (block.type === "tool_call") {
        yield* flushMessage();
        const id = block.id ?? "";
        if (id) {
          functionCallIdsWithBlocks.add(id);
          pendingFunctionChunks.delete(id);
        }
        yield convertFunctionCall(
          block as ContentBlock.Standard & { type: "tool_call" }
        );
      } else if (block.type === "tool_call_chunk") {
        if (block.id) {
          const existing = pendingFunctionChunks.get(block.id) ?? {
            name: block.name,
            args: [],
          };
          if (block.name) existing.name = block.name;
          if (block.args) existing.args.push(block.args);
          pendingFunctionChunks.set(block.id, existing);
        }
      } else if (block.type === "server_tool_call") {
        yield* flushMessage();
        const id = block.id ?? "";
        if (id) {
          serverFunctionCallIdsWithBlocks.add(id);
          pendingServerFunctionChunks.delete(id);
        }
        yield convertFunctionCall(block);
      } else if (block.type === "server_tool_call_chunk") {
        if (block.id) {
          const existing = pendingServerFunctionChunks.get(block.id) ?? {
            name: block.name,
            args: [],
          };
          if (block.name) existing.name = block.name;
          if (block.args) existing.args.push(block.args);
          pendingServerFunctionChunks.set(block.id, existing);
        }
      } else if (block.type === "server_tool_call_result") {
        yield* flushMessage();
        yield convertFunctionCallOutput(block);
      } else if (block.type === "audio") {
        // no-op
      } else if (block.type === "file") {
        const fileItem = resolveFileItem(block);
        if (fileItem) {
          pushMessageContent([fileItem]);
        }
      } else if (block.type === "image") {
        const imageItem = resolveImageItem(block);
        if (imageItem) {
          pushMessageContent([imageItem]);
        }
      } else if (block.type === "video") {
        const videoItem = resolveFileItem(block);
        if (videoItem) {
          pushMessageContent([videoItem]);
        }
      } else if (block.type === "text-plain") {
        if (block.text) {
          pushMessageContent([
            {
              type: "input_text",
              text: block.text,
            },
          ]);
        }
      } else if (block.type === "non_standard" && isResponsesMessage) {
        yield* flushMessage();
        yield block.value as ResponsesInputItem;
      }
    }
    yield* flushMessage();

    for (const [id, chunk] of pendingFunctionChunks) {
      if (!id || functionCallIdsWithBlocks.has(id)) continue;
      const args = chunk.args.join("");
      if (!chunk.name && !args) continue;
      yield {
        type: "function_call",
        call_id: id,
        name: chunk.name ?? "",
        arguments: args,
      };
    }

    for (const [id, chunk] of pendingServerFunctionChunks) {
      if (!id || serverFunctionCallIdsWithBlocks.has(id)) continue;
      const args = chunk.args.join("");
      if (!chunk.name && !args) continue;
      yield {
        type: "function_call",
        call_id: id,
        name: chunk.name ?? "",
        arguments: args,
      };
    }
  }
  return Array.from(iterateItems());
}
