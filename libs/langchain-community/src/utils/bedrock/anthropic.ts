import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  HumanMessage,
  MessageContent,
  SystemMessage,
  ToolMessage,
  UsageMetadata,
  isAIMessage,
} from "@langchain/core/messages";
import { ToolCall, ToolCallChunk } from "@langchain/core/messages/tool";
import { concat } from "@langchain/core/utils/stream";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractToolCalls(content: Record<string, any>[]) {
  const toolCalls: ToolCall[] = [];
  for (const block of content) {
    if (block.type === "tool_use") {
      toolCalls.push({
        name: block.name,
        args: block.input,
        id: block.id,
        type: "tool_call",
      });
    }
  }
  return toolCalls;
}

function _formatImage(imageUrl: string) {
  const regex = /^data:(image\/.+);base64,(.+)$/;
  const match = imageUrl.match(regex);
  if (match === null) {
    throw new Error(
      [
        "Anthropic only supports base64-encoded images currently.",
        "Example: data:image/png;base64,/9j/4AAQSk...",
      ].join("\n\n")
    );
  }
  return {
    type: "base64",
    media_type: match[1] ?? "",
    data: match[2] ?? "",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
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
          previousMessage.content.push({
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
                content: _formatContent(message.content),
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any> {
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

function _formatContent(content: MessageContent) {
  if (typeof content === "string") {
    return content;
  } else {
    const contentBlocks = content.map((contentPart) => {
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
        };
      } else if (contentPart.type === "text") {
        // Assuming contentPart is of type MessageContentText here
        return {
          type: "text" as const, // Explicitly setting the type as "text"
          text: contentPart.text,
        };
      } else if (
        contentPart.type === "tool_use" ||
        contentPart.type === "tool_result"
      ) {
        // TODO: Fix when SDK types are fixed
        return {
          ...contentPart,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
      } else {
        throw new Error("Unsupported message content format");
      }
    });
    return contentBlocks;
  }
}

export function formatMessagesForAnthropic(messages: BaseMessage[]): {
  system?: string;
  messages: Record<string, unknown>[];
} {
  const mergedMessages = _ensureMessageContents(messages);
  let system: string | undefined;
  if (mergedMessages.length > 0 && mergedMessages[0]._getType() === "system") {
    if (typeof messages[0].content !== "string") {
      throw new Error("System message content must be a string.");
    }
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
              contentPart.type === "tool_use" && contentPart.id === toolCall.id
          )
        );
        if (hasMismatchedToolCalls) {
          console.warn(
            `The "tool_calls" field on a message is only respected if content is a string.`
          );
        }
        return {
          role,
          content: _formatContent(message.content),
        };
      }
    } else {
      return {
        role,
        content: _formatContent(message.content),
      };
    }
  });
  return {
    messages: formattedMessages,
    system,
  };
}

export function isAnthropicTool(
  tool: unknown
): tool is Record<string, unknown> {
  if (typeof tool !== "object" || !tool) return false;
  return "input_schema" in tool;
}

export function _makeMessageChunkFromAnthropicEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
  fields: {
    coerceContentToString?: boolean;
  }
): AIMessageChunk | null {
  if (data.type === "message_start") {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { content, usage, ...additionalKwargs } = data.message;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filteredAdditionalKwargs: Record<string, any> = {};
    for (const [key, value] of Object.entries(additionalKwargs)) {
      if (value !== undefined && value !== null) {
        filteredAdditionalKwargs[key] = value;
      }
    }
    return new AIMessageChunk({
      content: fields.coerceContentToString ? "" : [],
      additional_kwargs: filteredAdditionalKwargs,
    });
  } else if (data.type === "message_delta") {
    let usageMetadata: UsageMetadata | undefined;
    return new AIMessageChunk({
      content: fields.coerceContentToString ? "" : [],
      additional_kwargs: { ...data.delta },
      usage_metadata: usageMetadata,
    });
  } else if (
    data.type === "content_block_start" &&
    data.content_block.type === "tool_use"
  ) {
    return new AIMessageChunk({
      content: fields.coerceContentToString
        ? ""
        : [
            {
              index: data.index,
              ...data.content_block,
              input: "",
            },
          ],
      additional_kwargs: {},
    });
  } else if (
    data.type === "content_block_delta" &&
    data.delta.type === "text_delta"
  ) {
    const content = data.delta?.text;
    if (content !== undefined) {
      return new AIMessageChunk({
        content: fields.coerceContentToString
          ? content
          : [
              {
                index: data.index,
                ...data.delta,
              },
            ],
        additional_kwargs: {},
      });
    }
  } else if (
    data.type === "content_block_delta" &&
    data.delta.type === "input_json_delta"
  ) {
    return new AIMessageChunk({
      content: fields.coerceContentToString
        ? ""
        : [
            {
              index: data.index,
              input: data.delta.partial_json,
              type: data.delta.type,
            },
          ],
      additional_kwargs: {},
    });
  } else if (
    data.type === "message_stop" &&
    data["amazon-bedrock-invocationMetrics"] !== undefined
  ) {
    return new AIMessageChunk({
      content: "",
      response_metadata: {
        "amazon-bedrock-invocationMetrics":
          data["amazon-bedrock-invocationMetrics"],
      },
      usage_metadata: {
        input_tokens: data["amazon-bedrock-invocationMetrics"].inputTokenCount,
        output_tokens:
          data["amazon-bedrock-invocationMetrics"].outputTokenCount,
        total_tokens:
          data["amazon-bedrock-invocationMetrics"].inputTokenCount +
          data["amazon-bedrock-invocationMetrics"].outputTokenCount,
      },
    });
  }

  return null;
}

export function extractToolCallChunk(
  chunk: AIMessageChunk
): ToolCallChunk | undefined {
  let newToolCallChunk: ToolCallChunk | undefined;

  // Initial chunk for tool calls from anthropic contains identifying information like ID and name.
  // This chunk does not contain any input JSON.
  const toolUseChunks = Array.isArray(chunk.content)
    ? chunk.content.find((c) => c.type === "tool_use")
    : undefined;
  if (
    toolUseChunks &&
    "index" in toolUseChunks &&
    "name" in toolUseChunks &&
    "id" in toolUseChunks
  ) {
    newToolCallChunk = {
      args: "",
      id: toolUseChunks.id,
      name: toolUseChunks.name,
      index: toolUseChunks.index,
      type: "tool_call_chunk",
    };
  }

  // Chunks after the initial chunk only contain the index and partial JSON.
  const inputJsonDeltaChunks = Array.isArray(chunk.content)
    ? chunk.content.find((c) => c.type === "input_json_delta")
    : undefined;
  if (
    inputJsonDeltaChunks &&
    "index" in inputJsonDeltaChunks &&
    "input" in inputJsonDeltaChunks
  ) {
    if (typeof inputJsonDeltaChunks.input === "string") {
      newToolCallChunk = {
        args: inputJsonDeltaChunks.input,
        index: inputJsonDeltaChunks.index,
        type: "tool_call_chunk",
      };
    } else {
      newToolCallChunk = {
        args: JSON.stringify(inputJsonDeltaChunks.input, null, 2),
        index: inputJsonDeltaChunks.index,
        type: "tool_call_chunk",
      };
    }
  }

  return newToolCallChunk;
}

export function extractToken(chunk: AIMessageChunk): string | undefined {
  return typeof chunk.content === "string" && chunk.content !== ""
    ? chunk.content
    : undefined;
}

export function extractToolUseContent(
  chunk: AIMessageChunk,
  concatenatedChunks: AIMessageChunk | undefined
) {
  let newConcatenatedChunks = concatenatedChunks;
  // Remove `tool_use` content types until the last chunk.
  let toolUseContent:
    | {
        id: string;
        type: "tool_use";
        name: string;
        input: Record<string, unknown>;
      }
    | undefined;
  if (!newConcatenatedChunks) {
    newConcatenatedChunks = chunk;
  } else {
    newConcatenatedChunks = concat(newConcatenatedChunks, chunk);
  }
  if (
    Array.isArray(newConcatenatedChunks.content) &&
    newConcatenatedChunks.content.find((c) => c.type === "tool_use")
  ) {
    try {
      const toolUseMsg = newConcatenatedChunks.content.find(
        (c) => c.type === "tool_use"
      );
      if (
        !toolUseMsg ||
        !("input" in toolUseMsg || "name" in toolUseMsg || "id" in toolUseMsg)
      )
        return;
      const parsedArgs = JSON.parse(toolUseMsg.input);
      if (parsedArgs) {
        toolUseContent = {
          type: "tool_use",
          id: toolUseMsg.id,
          name: toolUseMsg.name,
          input: parsedArgs,
        };
      }
    } catch (_) {
      // no-op
    }
  }

  return {
    toolUseContent,
    concatenatedChunks: newConcatenatedChunks,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function _toolsInParams(params: Record<string, any>): boolean {
  return !!(params.tools && params.tools.length > 0);
}
