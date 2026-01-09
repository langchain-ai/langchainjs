import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  HumanMessage,
  MessageContentText,
  SystemMessage,
  ToolMessage,
  UsageMetadata,
} from "@langchain/core/messages";
import type {
  Message as OllamaMessage,
  ToolCall as OllamaToolCall,
} from "ollama";
import { v4 as uuidv4 } from "uuid";

export function convertOllamaMessagesToLangChain(
  messages: OllamaMessage,
  extra?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    responseMetadata?: Record<string, any>;
    usageMetadata?: UsageMetadata;
  }
): AIMessageChunk {
  return new AIMessageChunk({
    content: messages.content ?? "",
    additional_kwargs:
      messages.thinking && messages.thinking !== ""
        ? { reasoning_content: messages.thinking }
        : {},
    tool_call_chunks: messages.tool_calls?.map((tc) => ({
      name: tc.function.name,
      args: JSON.stringify(tc.function.arguments),
      type: "tool_call_chunk",
      index: 0,
      id: uuidv4(),
    })),
    response_metadata: {
      ...extra?.responseMetadata,
      model_provider: "ollama",
    },
    usage_metadata: extra?.usageMetadata,
  });
}

function extractBase64FromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:.*?;base64,(.*)$/);
  return match ? match[1] : "";
}

function convertAMessagesToOllama(messages: AIMessage): OllamaMessage[] {
  if (typeof messages.content === "string") {
    return [
      {
        role: "assistant",
        content: messages.content,
      },
    ];
  }

  const textFields = messages.content.filter(
    (c) => c.type === "text" && typeof c.text === "string"
  );
  const textMessages = (textFields as MessageContentText[]).map((c) => ({
    role: "assistant",
    content: c.text,
  }));
  let toolCallMsgs: OllamaMessage | undefined;

  if (
    messages.content.find((c) => c.type === "tool_use") &&
    messages.tool_calls?.length
  ) {
    // `tool_use` content types are accepted if the message has tool calls
    const toolCalls: OllamaToolCall[] | undefined = messages.tool_calls?.map(
      (tc) => ({
        id: tc.id,
        type: "function",
        function: {
          name: tc.name,
          arguments: tc.args,
        },
      })
    );

    if (toolCalls) {
      toolCallMsgs = {
        role: "assistant",
        tool_calls: toolCalls,
        content: "",
      };
    }
  } else if (
    messages.content.find((c) => c.type === "tool_use") &&
    !messages.tool_calls?.length
  ) {
    throw new Error(
      "'tool_use' content type is not supported without tool calls."
    );
  }

  return [...textMessages, ...(toolCallMsgs ? [toolCallMsgs] : [])];
}

function convertHumanGenericMessagesToOllama(
  message: HumanMessage
): OllamaMessage[] {
  if (typeof message.content === "string") {
    return [
      {
        role: "user",
        content: message.content,
      },
    ];
  }
  return message.content.map((c) => {
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
}

function convertSystemMessageToOllama(message: SystemMessage): OllamaMessage[] {
  if (typeof message.content === "string") {
    return [
      {
        role: "system",
        content: message.content,
      },
    ];
  } else if (
    message.content.every(
      (c) => c.type === "text" && typeof c.text === "string"
    )
  ) {
    return (message.content as MessageContentText[]).map((c) => ({
      role: "system",
      content: c.text,
    }));
  } else {
    throw new Error(
      `Unsupported content type(s): ${message.content
        .map((c) => c.type)
        .join(", ")}`
    );
  }
}

function convertToolMessageToOllama(message: ToolMessage): OllamaMessage[] {
  if (typeof message.content !== "string") {
    throw new Error("Non string tool message content is not supported");
  }
  return [
    {
      role: "tool",
      content: message.content,
    },
  ];
}

export function convertToOllamaMessages(
  messages: BaseMessage[]
): OllamaMessage[] {
  return messages.flatMap((msg) => {
    if (["human", "generic"].includes(msg._getType())) {
      return convertHumanGenericMessagesToOllama(msg);
    } else if (msg._getType() === "ai") {
      return convertAMessagesToOllama(msg);
    } else if (msg._getType() === "system") {
      return convertSystemMessageToOllama(msg);
    } else if (msg._getType() === "tool") {
      return convertToolMessageToOllama(msg as ToolMessage);
    } else {
      throw new Error(`Unsupported message type: ${msg._getType()}`);
    }
  });
}
