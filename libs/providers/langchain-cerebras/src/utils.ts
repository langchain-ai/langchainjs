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
import { v4 as uuidv4 } from "uuid";
import Cerebras from "@cerebras/cerebras_cloud_sdk";
import { ToolChoice } from "@langchain/core/language_models/chat_models";

export type CerebrasMessageParam =
  | Cerebras.ChatCompletionCreateParams.AssistantMessageRequest
  | Cerebras.ChatCompletionCreateParams.SystemMessageRequest
  | Cerebras.ChatCompletionCreateParams.ToolMessageRequest
  | Cerebras.ChatCompletionCreateParams.UserMessageRequest;
export type CerebrasToolCall =
  Cerebras.ChatCompletion.ChatCompletionResponse.Choice.Message.ToolCall;

export function convertCerebrasMessagesToLangChain(
  messages: Cerebras.ChatCompletion.ChatCompletionResponse.Choice.Message,
  extra?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    responseMetadata?: Record<string, any>;
    usageMetadata?: UsageMetadata;
  }
): AIMessageChunk {
  return new AIMessageChunk({
    content: messages.content ?? "",
    tool_call_chunks: messages.tool_calls?.map((tc) => ({
      name: tc.function.name,
      args: JSON.stringify(tc.function.arguments),
      type: "tool_call_chunk",
      index: 0,
      id: uuidv4(),
    })),
    response_metadata: extra?.responseMetadata,
    usage_metadata: extra?.usageMetadata,
  });
}

function extractBase64FromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:.*?;base64,(.*)$/);
  return match ? match[1] : "";
}

function convertAIMessageToCerebras(
  messages: AIMessage
): CerebrasMessageParam[] {
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
  const textMessages: CerebrasMessageParam[] = (
    textFields as MessageContentText[]
  ).map((c) => ({
    role: "assistant",
    content: c.text,
  }));
  let toolCallMsgs: CerebrasMessageParam | undefined;

  if (
    messages.content.find((c) => c.type === "tool_use") &&
    messages.tool_calls?.length
  ) {
    // `tool_use` content types are accepted if the message has tool calls
    const toolCalls: CerebrasToolCall[] | undefined = messages.tool_calls?.map(
      (tc) => ({
        id: tc.id!,
        type: "function",
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.args),
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

function convertHumanGenericMessagesToCerebras(
  message: HumanMessage
): CerebrasMessageParam[] {
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

function convertSystemMessageToCerebras(
  message: SystemMessage
): CerebrasMessageParam[] {
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

function convertToolMessageToCerebras(
  message: ToolMessage
): CerebrasMessageParam[] {
  if (typeof message.content !== "string") {
    throw new Error("Non string tool message content is not supported");
  }
  return [
    {
      role: "tool",
      content: message.content,
      tool_call_id: message.tool_call_id,
    },
  ];
}

export function convertToCerebrasMessageParams(
  messages: BaseMessage[]
): CerebrasMessageParam[] {
  return messages.flatMap((msg) => {
    if (["human", "generic"].includes(msg._getType())) {
      return convertHumanGenericMessagesToCerebras(msg);
    } else if (msg._getType() === "ai") {
      return convertAIMessageToCerebras(msg);
    } else if (msg._getType() === "system") {
      return convertSystemMessageToCerebras(msg);
    } else if (msg._getType() === "tool") {
      return convertToolMessageToCerebras(msg as ToolMessage);
    } else {
      throw new Error(`Unsupported message type: ${msg._getType()}`);
    }
  });
}

export function formatToCerebrasToolChoice(
  toolChoice?: ToolChoice
): Cerebras.ChatCompletionCreateParams["tool_choice"] {
  if (!toolChoice) {
    return undefined;
  } else if (toolChoice === "any" || toolChoice === "required") {
    return "required";
  } else if (toolChoice === "auto") {
    return "auto";
  } else if (toolChoice === "none") {
    return "none";
  } else if (typeof toolChoice === "string") {
    return {
      type: "function",
      function: {
        name: toolChoice,
      },
    };
  } else {
    return toolChoice as Cerebras.ChatCompletionCreateParams.Tool;
  }
}
