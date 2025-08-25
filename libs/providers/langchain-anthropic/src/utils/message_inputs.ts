/**
 * This util file contains functions for converting LangChain messages to Anthropic messages.
 */
import type Anthropic from "@anthropic-ai/sdk";
import {
  type BaseMessage,
  type SystemMessage,
  HumanMessage,
  type AIMessage,
  type ToolMessage,
  isAIMessage,
  MessageContentComplex,
  isDataContentBlock,
  convertToProviderContentBlock,
  parseBase64DataUrl,
  ContentBlock,
} from "@langchain/core/messages";
import { ToolCall } from "@langchain/core/messages/tool";
import {
  AnthropicImageBlockParam,
  AnthropicMessageCreateParams,
  AnthropicTextBlockParam,
  AnthropicToolResultBlockParam,
  AnthropicToolUseBlockParam,
  AnthropicDocumentBlockParam,
  AnthropicThinkingBlockParam,
  AnthropicRedactedThinkingBlockParam,
  AnthropicServerToolUseBlockParam,
  AnthropicWebSearchToolResultBlockParam,
  AnthropicSearchResultBlockParam,
  AnthropicToolResponse,
} from "../types.js";
import {
  _isAnthropicImageBlockParam,
  _isAnthropicRedactedThinkingBlock,
  _isAnthropicSearchResultBlock,
  _isAnthropicThinkingBlock,
} from "./content.js";
import { standardContentBlockConverter } from "./compat.js";
import { iife, safeParseJson } from "./index.js";

function _isStandardAnnotation(
  annotation: unknown
): annotation is ContentBlock.Citation {
  return (
    typeof annotation === "object" &&
    annotation !== null &&
    "type" in annotation &&
    annotation.type === "citation"
  );
}

function _formatStandardAnnotation(
  annotation: ContentBlock | ContentBlock.Citation
): Anthropic.Beta.BetaTextCitation | undefined {
  if (_isStandardAnnotation(annotation)) {
    if (annotation.source === "char") {
      return {
        type: "char_location",
        start_char_index: annotation.startIndex ?? 0,
        end_char_index: annotation.endIndex ?? 0,
        document_title: annotation.title ?? null,
        document_index: 0,
        cited_text: annotation.citedText ?? "",
      };
    } else if (annotation.source === "page") {
      return {
        type: "page_location",
        start_page_number: annotation.startIndex ?? 0,
        end_page_number: annotation.endIndex ?? 0,
        document_title: annotation.title ?? null,
        document_index: 0,
        cited_text: annotation.citedText ?? "",
      };
    } else if (annotation.source === "block") {
      return {
        type: "content_block_location",
        start_block_index: annotation.startIndex ?? 0,
        end_block_index: annotation.endIndex ?? 0,
        document_title: annotation.title ?? null,
        document_index: 0,
        cited_text: annotation.citedText ?? "",
      };
    } else if (annotation.source === "url") {
      return {
        type: "web_search_result_location",
        url: annotation.url ?? "",
        title: annotation.title ?? null,
        encrypted_index: String(annotation.startIndex ?? 0),
        cited_text: annotation.citedText ?? "",
      };
    } else if (annotation.source === "search") {
      return {
        type: "search_result_location",
        title: annotation.title ?? null,
        start_block_index: annotation.startIndex ?? 0,
        end_block_index: annotation.endIndex ?? 0,
        search_result_index: 0,
        source: annotation.source ?? "",
        cited_text: annotation.citedText ?? "",
      };
    }
  }
  return undefined;
}

function _formatStandardContent(
  blocks: ContentBlock.Standard[],
  toolCalls: ToolCall[],
  modelProvider?: string
): ContentBlock[] {
  const result: ContentBlock[] = [];
  for (const block of blocks) {
    if (block.type === "text") {
      const annotations = block.annotations?.map(_formatStandardAnnotation);
      if (annotations) {
        result.push({
          type: "text",
          text: block.text,
          annotations,
        });
      } else {
        result.push({
          type: "text",
          text: block.text,
        });
      }
    } else if (block.type === "tool_call") {
      result.push({
        type: "tool_use",
        id: block.id,
        name: block.name,
        input: block.args,
      });
    } else if (block.type === "tool_call_chunk") {
      const input = iife(() => {
        if (typeof block.args !== "string") {
          return block.args;
        }
        try {
          return JSON.parse(block.args);
        } catch {
          return {};
        }
      });
      result.push({
        type: "tool_use",
        id: block.id,
        name: block.name,
        input,
      });
    } else if (block.type === "reasoning" && modelProvider === "anthropic") {
      result.push({
        type: "thinking",
        thinking: block.text,
      });
    } else if (
      block.type === "web_search_call" &&
      modelProvider === "anthropic"
    ) {
      result.push({
        id: block.id,
        type: "server_tool_use",
        name: "web_search",
        input: block.input ?? { query: block.query },
      });
    } else if (
      block.type === "web_search_result" &&
      modelProvider === "anthropic"
    ) {
      result.push({
        id: block.id,
        type: "web_search_tool_result",
        content: block.content,
      });
    } else if (
      block.type === "code_interpreter_call" &&
      modelProvider === "anthropic"
    ) {
      result.push({
        type: "server_tool_use",
        name: "code_execution",
        id: block.id,
        input: { code: block.code },
      });
    } else if (
      block.type === "code_interpreter_result" &&
      modelProvider === "anthropic" &&
      Array.isArray(block.fileIds)
    ) {
      result.push({
        type: "code_execution_tool_result",
        content: {
          type: "code_execution_result",
          stderr: block.stderr,
          stdout: block.stdout,
          return_code: block.returnCode,
          fileIds: block.fileIds.map((fileId: string) => ({
            type: "code_execution_output",
            file_id: fileId,
          })),
        },
      });
    }
  }
  return result;
}

function _formatImage(imageUrl: string) {
  const parsed = parseBase64DataUrl({ dataUrl: imageUrl });
  if (parsed) {
    return {
      type: "base64",
      media_type: parsed.mime_type,
      data: parsed.data,
    };
  }
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    throw new Error(
      [
        `Malformed image URL: ${JSON.stringify(
          imageUrl
        )}. Content blocks of type 'image_url' must be a valid http, https, or base64-encoded data URL.`,
        "Example: data:image/png;base64,/9j/4AAQSk...",
        "Example: https://example.com/image.jpg",
      ].join("\n\n")
    );
  }

  if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
    return {
      type: "url",
      url: imageUrl,
    };
  }

  throw new Error(
    [
      `Invalid image URL protocol: ${JSON.stringify(
        parsedUrl.protocol
      )}. Anthropic only supports images as http, https, or base64-encoded data URLs on 'image_url' content blocks.`,
      "Example: data:image/png;base64,/9j/4AAQSk...",
      "Example: https://example.com/image.jpg",
    ].join("\n\n")
  );
}

function _ensureMessageContents(
  messages: BaseMessage[]
): (SystemMessage | HumanMessage | AIMessage)[] {
  // Merge runs of human/tool messages into single human messages with content blocks.
  const updatedMsgs = [];
  for (const message of messages) {
    if (message._getType() === "tool") {
      if (typeof message.content === "string") {
        const previousMessage = updatedMsgs[updatedMsgs.length - 1];
        if (
          previousMessage?._getType() === "human" &&
          Array.isArray(previousMessage.content) &&
          "type" in previousMessage.content[0] &&
          previousMessage.content[0].type === "tool_result"
        ) {
          // If the previous message was a tool result, we merge this tool message into it.
          (previousMessage.content as MessageContentComplex[]).push({
            type: "tool_result",
            content: message.content,
            tool_use_id: (message as ToolMessage).tool_call_id,
          });
        } else {
          // If not, we create a new human message with the tool result.
          updatedMsgs.push(
            new HumanMessage({
              content: [
                {
                  type: "tool_result",
                  content: message.content,
                  tool_use_id: (message as ToolMessage).tool_call_id,
                },
              ],
            })
          );
        }
      } else {
        updatedMsgs.push(
          new HumanMessage({
            content: [
              {
                type: "tool_result",
                // rare case: message.content could be undefined
                ...(message.content != null
                  ? { content: _formatContent(message) }
                  : {}),
                tool_use_id: (message as ToolMessage).tool_call_id,
              },
            ],
          })
        );
      }
    } else {
      updatedMsgs.push(message);
    }
  }
  return updatedMsgs;
}

export function _convertLangChainToolCallToAnthropic(
  toolCall: ToolCall
): AnthropicToolResponse {
  if (toolCall.id === undefined) {
    throw new Error(`Anthropic requires all tool calls to have an "id".`);
  }
  return {
    type: "tool_use",
    id: toolCall.id,
    name: toolCall.name,
    input: toolCall.args,
  };
}

function* _formatContentBlocks(content: ContentBlock[]) {
  const toolTypes = [
    "tool_use",
    "tool_result",
    "input_json_delta",
    "server_tool_use",
    "web_search_tool_result",
    "web_search_result",
  ];
  const textTypes = ["text", "text_delta"];

  for (const contentPart of content) {
    if (isDataContentBlock(contentPart)) {
      yield convertToProviderContentBlock(
        contentPart,
        standardContentBlockConverter
      );
    }

    const cacheControl =
      "cache_control" in contentPart ? contentPart.cache_control : undefined;

    if (contentPart.type === "image_url") {
      let source;
      if (typeof contentPart.image_url === "string") {
        source = _formatImage(contentPart.image_url);
      } else if (
        typeof contentPart.image_url === "object" &&
        contentPart.image_url !== null &&
        "url" in contentPart.image_url &&
        typeof contentPart.image_url.url === "string"
      ) {
        source = _formatImage(contentPart.image_url.url);
      }
      yield {
        type: "image" as const, // Explicitly setting the type as "image"
        source,
        ...(cacheControl ? { cache_control: cacheControl } : {}),
      };
    } else if (_isAnthropicImageBlockParam(contentPart)) {
      return contentPart;
    } else if (contentPart.type === "document") {
      // PDF
      yield {
        ...contentPart,
        ...(cacheControl ? { cache_control: cacheControl } : {}),
      };
    } else if (_isAnthropicThinkingBlock(contentPart)) {
      const block: AnthropicThinkingBlockParam = {
        type: "thinking" as const, // Explicitly setting the type as "thinking"
        thinking: contentPart.thinking,
        signature: contentPart.signature,
        ...(cacheControl ? { cache_control: cacheControl } : {}),
      };
      yield block;
    } else if (_isAnthropicRedactedThinkingBlock(contentPart)) {
      const block: AnthropicRedactedThinkingBlockParam = {
        type: "redacted_thinking" as const, // Explicitly setting the type as "redacted_thinking"
        data: contentPart.data,
        ...(cacheControl ? { cache_control: cacheControl } : {}),
      };
      yield block;
    } else if (_isAnthropicSearchResultBlock(contentPart)) {
      const block: AnthropicSearchResultBlockParam = {
        type: "search_result" as const, // Explicitly setting the type as "search_result"
        title: contentPart.title,
        source: contentPart.source,
        ...("cache_control" in contentPart && contentPart.cache_control
          ? { cache_control: contentPart.cache_control }
          : {}),
        ...("citations" in contentPart && contentPart.citations
          ? { citations: contentPart.citations }
          : {}),
        content: contentPart.content,
      };
      yield block;
    } else if (
      textTypes.find((t) => t === contentPart.type) &&
      "text" in contentPart
    ) {
      // Assuming contentPart is of type MessageContentText here
      yield {
        type: "text" as const, // Explicitly setting the type as "text"
        text: contentPart.text,
        ...(cacheControl ? { cache_control: cacheControl } : {}),
        ...("citations" in contentPart && contentPart.citations
          ? { citations: contentPart.citations }
          : {}),
      };
    } else if (toolTypes.find((t) => t === contentPart.type)) {
      const contentPartCopy = { ...contentPart };
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
      yield {
        ...contentPartCopy,
        ...(cacheControl ? { cache_control: cacheControl } : {}),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
    }
  }
}

function _formatContent(message: BaseMessage) {
  const { content } = message;

  if (typeof content === "string") {
    return content;
  } else {
    return Array.from(_formatContentBlocks(content));
  }
}

/**
 * Formats messages as a prompt for the model.
 * Used in LangSmith, export is important here.
 * @param messages The base messages to format as a prompt.
 * @returns The formatted prompt.
 */
export function _convertMessagesToAnthropicPayload(
  messages: BaseMessage[]
): AnthropicMessageCreateParams {
  const mergedMessages = _ensureMessageContents(messages);
  let system;
  if (mergedMessages.length > 0 && mergedMessages[0]._getType() === "system") {
    system = messages[0].content;
  }
  const conversationMessages =
    system !== undefined ? mergedMessages.slice(1) : mergedMessages;
  const formattedMessages = conversationMessages.map((message) => {
    let role;
    if (message._getType() === "human") {
      role = "user" as const;
    } else if (message._getType() === "ai") {
      role = "assistant" as const;
    } else if (message._getType() === "tool") {
      role = "user" as const;
    } else if (message._getType() === "system") {
      throw new Error(
        "System messages are only permitted as the first passed message."
      );
    } else {
      throw new Error(`Message type "${message._getType()}" is not supported.`);
    }
    if (isAIMessage(message) && !!message.tool_calls?.length) {
      if (typeof message.content === "string") {
        if (message.content === "") {
          return {
            role,
            content: message.tool_calls.map(
              _convertLangChainToolCallToAnthropic
            ),
          };
        } else {
          return {
            role,
            content: [
              { type: "text", text: message.content },
              ...message.tool_calls.map(_convertLangChainToolCallToAnthropic),
            ],
          };
        }
      } else {
        const { content } = message;
        const hasMismatchedToolCalls = !message.tool_calls.every((toolCall) =>
          content.find(
            (contentPart) =>
              (contentPart.type === "tool_use" ||
                contentPart.type === "input_json_delta" ||
                contentPart.type === "server_tool_use") &&
              contentPart.id === toolCall.id
          )
        );
        if (hasMismatchedToolCalls) {
          console.warn(
            `The "tool_calls" field on a message is only respected if content is a string.`
          );
        }
        return {
          role,
          content: _formatContent(message),
        };
      }
    } else {
      return {
        role,
        content: _formatContent(message),
      };
    }
  });
  return {
    messages: mergeMessages(formattedMessages),
    system,
  } as AnthropicMessageCreateParams;
}

function mergeMessages(messages: AnthropicMessageCreateParams["messages"]) {
  if (!messages || messages.length <= 1) {
    return messages;
  }

  const result: AnthropicMessageCreateParams["messages"] = [];
  let currentMessage = messages[0];

  const normalizeContent = (
    content:
      | string
      | Array<
          | AnthropicTextBlockParam
          | AnthropicImageBlockParam
          | AnthropicToolUseBlockParam
          | AnthropicToolResultBlockParam
          | AnthropicDocumentBlockParam
          | AnthropicThinkingBlockParam
          | AnthropicRedactedThinkingBlockParam
          | AnthropicServerToolUseBlockParam
          | AnthropicWebSearchToolResultBlockParam
        >
  ): Array<
    | AnthropicTextBlockParam
    | AnthropicImageBlockParam
    | AnthropicToolUseBlockParam
    | AnthropicToolResultBlockParam
    | AnthropicDocumentBlockParam
    | AnthropicThinkingBlockParam
    | AnthropicRedactedThinkingBlockParam
    | AnthropicServerToolUseBlockParam
    | AnthropicWebSearchToolResultBlockParam
  > => {
    if (typeof content === "string") {
      return [
        {
          type: "text",
          text: content,
        },
      ];
    }
    return content;
  };

  const isToolResultMessage = (msg: (typeof messages)[0]) => {
    if (msg.role !== "user") return false;

    if (typeof msg.content === "string") {
      return false;
    }

    return (
      Array.isArray(msg.content) &&
      msg.content.every((item) => item.type === "tool_result")
    );
  };

  for (let i = 1; i < messages.length; i += 1) {
    const nextMessage = messages[i];

    if (
      isToolResultMessage(currentMessage) &&
      isToolResultMessage(nextMessage)
    ) {
      // Merge the messages by combining their content arrays
      currentMessage = {
        ...currentMessage,
        content: [
          ...normalizeContent(currentMessage.content),
          ...normalizeContent(nextMessage.content),
        ],
      };
    } else {
      result.push(currentMessage);
      currentMessage = nextMessage;
    }
  }

  result.push(currentMessage);
  return result;
}
