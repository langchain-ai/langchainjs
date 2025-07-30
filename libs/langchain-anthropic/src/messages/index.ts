import type Anthropic from "@anthropic-ai/sdk";
import { type AIMessageChunk, v1 } from "@langchain/core/messages";
import { ChatGeneration } from "@langchain/core/outputs";
import { ToolCall } from "@langchain/core/messages/tool";

import { ensureMessageContents } from "./utils.js";
import type { AnthropicToolResponse, ChatAnthropicToolType } from "../types.js";

/**
 * Messages:
 *
 *                _convertMessagesToAnthropicPayload
 * LC Messages    --------------------------------> Anthropic Payload
 *                <--------------------------------
 *                 anthropicResponseToChatMessages
 *                _makeMessageChunkFromAnthropicEvent
 *
 * Tools:
 * formatStructuredToolToAnthropic
 *
 * Arguments:
 * invocationParams
 */
class MessageTranslator {
  /**
   * @see _convertMessagesToAnthropicPayload
   */
  static toAnthropic(
    messages: v1.BaseMessage[]
  ): Anthropic.MessageCreateParamsNonStreaming {
    const mergedMessages = ensureMessageContents(messages);
    let system;
    if (mergedMessages.length > 0 && mergedMessages[0].type === "system") {
      system = messages[0].content;
    }
    const conversationMessages =
      system !== undefined ? mergedMessages.slice(1) : mergedMessages;
    const formattedMessages = conversationMessages.map((message) => {
      let role;
      if (message.type === "user") {
        role = "user" as const;
      } else if (message.type === "ai") {
        role = "assistant" as const;
        /**
         * this is being caught in `ensureMessageContents` and is essentially dead code
         */
        // } else if (message.type === "tool") {
        //   role = "user" as const;
      } else if (message.type === "system") {
        throw new Error(
          "System messages are only permitted as the first passed message."
        );
      } else {
        throw new Error(
          `Message type "${JSON.stringify(message)}" is not supported.`
        );
      }
      if (v1.isAIMessage(message) && !!message.content.length) {
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
      messages: mergeMessages(formattedMessages),
      system,
    } as AnthropicMessageCreateParams;
  }

  static fromAnthropic(
    messages: AnthropicToolResponse[]
    // additionalKwargs: Record<string, unknown>
  ): ChatGeneration[] {
    return [];
  }

  static chunkFromAnthropicEvent(
    data: Anthropic.Messages.RawMessageStreamEvent
    // fields: {
    //   streamUsage: boolean;
    //   coerceContentToString: boolean;
    // }
  ): {
    chunk: AIMessageChunk;
  } | null {
    return null;
  }

  /**
   * Formats LangChain StructuredTools to AnthropicTools.
   *
   * @param {ChatAnthropicCallOptions["tools"]} tools The tools to format
   * @returns {AnthropicTool[] | undefined} The formatted tools, or undefined if none are passed.
   */
  static toAnthropicToolUse(
    tools: ChatAnthropicToolType[]
  ): Anthropic.Messages.ToolUseBlockParam[] | undefined {
    return undefined;
  }

  static toAnthropicToolCall(toolCall: ToolCall): AnthropicToolResponse {
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
}
