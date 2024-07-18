import {
  AIMessageChunk,
  BaseMessage,
  MessageContentText,
  ToolMessage,
  UsageMetadata,
} from "@langchain/core/messages";
import type { Message as OllamaMessage } from "ollama";

export interface OllamaToolCall {
  function: {
    name: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    arguments: Record<string, any>;
  };
}

export interface OllamaMessageWithTools extends OllamaMessage {
  tool_calls?: OllamaToolCall[];
}

export function convertOllamaMessagesToLangChain(
  messages: OllamaMessageWithTools,
  extra: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    responseMetadata: Record<string, any>;
    usageMetadata: UsageMetadata;
  }
): AIMessageChunk {
  return new AIMessageChunk({
    content: messages.content ?? "",
    tool_call_chunks: messages.tool_calls?.map((tc) => ({
      name: tc.function.name,
      args: JSON.stringify(tc.function.arguments),
      type: "tool_call_chunk",
      index: 0,
    })),
    response_metadata: extra.responseMetadata,
    usage_metadata: extra.usageMetadata,
  });
}

function extractBase64FromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:.*?;base64,(.*)$/);
  return match ? match[1] : "";
}

export function convertToOllamaMessages(
  messages: BaseMessage[]
): OllamaMessage[] {
  return messages.flatMap((msg) => {
    if (["human", "generic"].includes(msg._getType())) {
      if (typeof msg.content === "string") {
        return {
          role: "user",
          content: msg.content,
        };
      }
      return msg.content.map((c) => {
        if (c.type === "text") {
          return {
            role: "user",
            content: c.text,
          };
        } else if (c.type === "image_url") {
          if (typeof c.image_url === "string") {
            return {
              role: "user",
              content: "",
              images: [extractBase64FromDataUrl(c.image_url)],
            };
          } else if (c.image_url.url && typeof c.image_url.url === "string") {
            return {
              role: "user",
              content: "",
              images: [extractBase64FromDataUrl(c.image_url.url)],
            };
          }
        }
        throw new Error(`Unsupported content type: ${c.type}`);
      });
    } else if (msg._getType() === "ai") {
      if (typeof msg.content === "string") {
        return {
          role: "assistant",
          content: msg.content,
        };
      } else if (
        msg.content.every(
          (c) => c.type === "text" && typeof c.text === "string"
        )
      ) {
        return (msg.content as MessageContentText[]).map((c) => ({
          role: "assistant",
          content: c.text,
        }));
      } else {
        throw new Error(
          `Unsupported content type(s): ${msg.content
            .map((c) => c.type)
            .join(", ")}`
        );
      }
    } else if (msg._getType() === "system") {
      if (typeof msg.content === "string") {
        return {
          role: "system",
          content: msg.content,
        };
      } else if (
        msg.content.every(
          (c) => c.type === "text" && typeof c.text === "string"
        )
      ) {
        return (msg.content as MessageContentText[]).map((c) => ({
          role: "system",
          content: c.text,
        }));
      } else {
        throw new Error(
          `Unsupported content type(s): ${msg.content
            .map((c) => c.type)
            .join(", ")}`
        );
      }
    } else if (msg._getType() === "tool") {
      if (typeof msg.content !== "string") {
        throw new Error("Non string tool message content is not supported");
      }
      const castMsg = msg as ToolMessage;
      return {
        tool_call_id: castMsg.tool_call_id,
        role: "tool",
        content: castMsg.content,
      };
    } else {
      throw new Error(`Unsupported message type: ${msg._getType()}`);
    }
  });
}
