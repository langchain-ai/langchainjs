/**
 * This util file contains functions for converting LangChain messages to Anthropic messages.
 */
import {
  type BaseMessage,
  type SystemMessage,
  HumanMessage,
  type AIMessage,
  type ToolMessage,
  isAIMessage,
  type StandardContentBlockConverter,
  type StandardTextBlock,
  type StandardImageBlock,
  type StandardFileBlock,
  MessageContentComplex,
  isDataContentBlock,
  convertToProviderContentBlock,
  parseBase64DataUrl,
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
  isAnthropicImageBlockParam,
  AnthropicSearchResultBlockParam,
  AnthropicToolResponse,
} from "../types.js";

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

const standardContentBlockConverter: StandardContentBlockConverter<{
  text: AnthropicTextBlockParam;
  image: AnthropicImageBlockParam;
  file: AnthropicDocumentBlockParam;
}> = {
  providerName: "anthropic",

  fromStandardTextBlock(block: StandardTextBlock): AnthropicTextBlockParam {
    return {
      type: "text",
      text: block.text,
      ...("citations" in (block.metadata ?? {})
        ? { citations: block.metadata!.citations }
        : {}),
      ...("cache_control" in (block.metadata ?? {})
        ? { cache_control: block.metadata!.cache_control }
        : {}),
    } as AnthropicTextBlockParam;
  },

  fromStandardImageBlock(block: StandardImageBlock): AnthropicImageBlockParam {
    if (block.source_type === "url") {
      const data = parseBase64DataUrl({
        dataUrl: block.url,
        asTypedArray: false,
      });
      if (data) {
        return {
          type: "image",
          source: {
            type: "base64",
            data: data.data,
            media_type: data.mime_type,
          },
          ...("cache_control" in (block.metadata ?? {})
            ? { cache_control: block.metadata!.cache_control }
            : {}),
        } as AnthropicImageBlockParam;
      } else {
        return {
          type: "image",
          source: {
            type: "url",
            url: block.url,
          },
          ...("cache_control" in (block.metadata ?? {})
            ? { cache_control: block.metadata!.cache_control }
            : {}),
        } as AnthropicImageBlockParam;
      }
    } else {
      if (block.source_type === "base64") {
        return {
          type: "image",
          source: {
            type: "base64",
            data: block.data,
            media_type: block.mime_type ?? "",
          },
          ...("cache_control" in (block.metadata ?? {})
            ? { cache_control: block.metadata!.cache_control }
            : {}),
        } as AnthropicImageBlockParam;
      } else {
        throw new Error(`Unsupported image source type: ${block.source_type}`);
      }
    }
  },

  fromStandardFileBlock(block: StandardFileBlock): AnthropicDocumentBlockParam {
    const mime_type = (block.mime_type ?? "").split(";")[0];

    if (block.source_type === "url") {
      if (mime_type === "application/pdf" || mime_type === "") {
        return {
          type: "document",
          source: {
            type: "url",
            url: block.url,
            media_type: block.mime_type ?? "",
          },
          ...("cache_control" in (block.metadata ?? {})
            ? { cache_control: block.metadata!.cache_control }
            : {}),
          ...("citations" in (block.metadata ?? {})
            ? { citations: block.metadata!.citations }
            : {}),
          ...("context" in (block.metadata ?? {})
            ? { context: block.metadata!.context }
            : {}),
          ...("title" in (block.metadata ?? {})
            ? { title: block.metadata!.title }
            : {}),
        } as AnthropicDocumentBlockParam;
      }
      throw new Error(
        `Unsupported file mime type for file url source: ${block.mime_type}`
      );
    } else if (block.source_type === "text") {
      if (mime_type === "text/plain" || mime_type === "") {
        return {
          type: "document",
          source: {
            type: "text",
            data: block.text,
            media_type: block.mime_type ?? "",
          },
          ...("cache_control" in (block.metadata ?? {})
            ? { cache_control: block.metadata!.cache_control }
            : {}),
          ...("citations" in (block.metadata ?? {})
            ? { citations: block.metadata!.citations }
            : {}),
          ...("context" in (block.metadata ?? {})
            ? { context: block.metadata!.context }
            : {}),
          ...("title" in (block.metadata ?? {})
            ? { title: block.metadata!.title }
            : {}),
        } as AnthropicDocumentBlockParam;
      } else {
        throw new Error(
          `Unsupported file mime type for file text source: ${block.mime_type}`
        );
      }
    } else if (block.source_type === "base64") {
      if (mime_type === "application/pdf" || mime_type === "") {
        return {
          type: "document",
          source: {
            type: "base64",
            data: block.data,
            media_type: "application/pdf",
          },
          ...("cache_control" in (block.metadata ?? {})
            ? { cache_control: block.metadata!.cache_control }
            : {}),
          ...("citations" in (block.metadata ?? {})
            ? { citations: block.metadata!.citations }
            : {}),
          ...("context" in (block.metadata ?? {})
            ? { context: block.metadata!.context }
            : {}),
          ...("title" in (block.metadata ?? {})
            ? { title: block.metadata!.title }
            : {}),
        } as AnthropicDocumentBlockParam;
      } else if (
        ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(
          mime_type
        )
      ) {
        return {
          type: "document",
          source: {
            type: "content",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  data: block.data,
                  media_type: mime_type as
                    | "image/jpeg"
                    | "image/png"
                    | "image/gif"
                    | "image/webp",
                },
              },
            ],
          },
          ...("cache_control" in (block.metadata ?? {})
            ? { cache_control: block.metadata!.cache_control }
            : {}),
          ...("citations" in (block.metadata ?? {})
            ? { citations: block.metadata!.citations }
            : {}),
          ...("context" in (block.metadata ?? {})
            ? { context: block.metadata!.context }
            : {}),
          ...("title" in (block.metadata ?? {})
            ? { title: block.metadata!.title }
            : {}),
        } as AnthropicDocumentBlockParam;
      } else {
        throw new Error(
          `Unsupported file mime type for file base64 source: ${block.mime_type}`
        );
      }
    } else {
      throw new Error(`Unsupported file source type: ${block.source_type}`);
    }
  },
};

function _formatContent(message: BaseMessage) {
  const toolTypes = [
    "tool_use",
    "tool_result",
    "input_json_delta",
    "server_tool_use",
    "web_search_tool_result",
    "web_search_result",
  ];
  const textTypes = ["text", "text_delta"];
  const { content } = message;

  if (typeof content === "string") {
    return content;
  } else {
    const contentBlocks = content.map((contentPart) => {
      if (isDataContentBlock(contentPart)) {
        return convertToProviderContentBlock(
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
        } else {
          source = _formatImage(contentPart.image_url.url);
        }
        return {
          type: "image" as const, // Explicitly setting the type as "image"
          source,
          ...(cacheControl ? { cache_control: cacheControl } : {}),
        };
      } else if (isAnthropicImageBlockParam(contentPart)) {
        return contentPart;
      } else if (contentPart.type === "document") {
        // PDF
        return {
          ...contentPart,
          ...(cacheControl ? { cache_control: cacheControl } : {}),
        };
      } else if (contentPart.type === "thinking") {
        const block: AnthropicThinkingBlockParam = {
          type: "thinking" as const, // Explicitly setting the type as "thinking"
          thinking: contentPart.thinking,
          signature: contentPart.signature,
          ...(cacheControl ? { cache_control: cacheControl } : {}),
        };
        return block;
      } else if (contentPart.type === "redacted_thinking") {
        const block: AnthropicRedactedThinkingBlockParam = {
          type: "redacted_thinking" as const, // Explicitly setting the type as "redacted_thinking"
          data: contentPart.data,
          ...(cacheControl ? { cache_control: cacheControl } : {}),
        };
        return block;
      } else if (contentPart.type === "search_result") {
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
        return block;
      } else if (
        textTypes.find((t) => t === contentPart.type) &&
        "text" in contentPart
      ) {
        // Assuming contentPart is of type MessageContentText here
        return {
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
        return {
          ...contentPartCopy,
          ...(cacheControl ? { cache_control: cacheControl } : {}),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
      } else if (
        "functionCall" in contentPart &&
        contentPart.functionCall &&
        typeof contentPart.functionCall === "object" &&
        isAIMessage(message)
      ) {
        const correspondingToolCall = message.tool_calls?.find(
          (toolCall) => toolCall.name === contentPart.functionCall.name
        );
        if (!correspondingToolCall) {
          throw new Error(
            `Could not find tool call for function call ${contentPart.functionCall.name}`
          );
        }
        // Google GenAI models include a `functionCall` object inside content. We should ignore it as Anthropic will not support it.
        return {
          id: correspondingToolCall.id,
          type: "tool_use",
          name: correspondingToolCall.name,
          input: contentPart.functionCall.args,
        };
      } else {
        throw new Error("Unsupported message content format");
      }
    });
    return contentBlocks;
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
          | AnthropicSearchResultBlockParam
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
    | AnthropicSearchResultBlockParam
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
