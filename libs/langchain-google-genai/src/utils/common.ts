import {
  EnhancedGenerateContentResponse,
  Content,
  Part,
  type FunctionDeclarationsTool as GoogleGenerativeAIFunctionDeclarationsTool,
  type FunctionDeclaration as GenerativeAIFunctionDeclaration,
  POSSIBLE_ROLES,
  FunctionCallPart,
} from "@google/generative-ai";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  ChatMessage,
  ToolMessage,
  ToolMessageChunk,
  MessageContent,
  MessageContentComplex,
  UsageMetadata,
  isAIMessage,
  isBaseMessage,
  isToolMessage,
} from "@langchain/core/messages";
import {
  ChatGeneration,
  ChatGenerationChunk,
  ChatResult,
} from "@langchain/core/outputs";
import { isLangChainTool } from "@langchain/core/utils/function_calling";
import { isOpenAITool } from "@langchain/core/language_models/base";
import { ToolCallChunk } from "@langchain/core/messages/tool";
import { v4 as uuidv4 } from "uuid";
import {
  jsonSchemaToGeminiParameters,
  schemaToGenerativeAIParameters,
} from "./zod_to_genai_parameters.js";
import { GoogleGenerativeAIToolType } from "../types.js";

export function getMessageAuthor(message: BaseMessage) {
  const type = message._getType();
  if (ChatMessage.isInstance(message)) {
    return message.role;
  }
  if (type === "tool") {
    return type;
  }
  return message.name ?? type;
}

/**
 * Maps a message type to a Google Generative AI chat author.
 * @param message The message to map.
 * @param model The model to use for mapping.
 * @returns The message type mapped to a Google Generative AI chat author.
 */
export function convertAuthorToRole(
  author: string
): (typeof POSSIBLE_ROLES)[number] {
  switch (author) {
    /**
     *  Note: Gemini currently is not supporting system messages
     *  we will convert them to human messages and merge with following
     * */
    case "supervisor":
    case "ai":
    case "model": // getMessageAuthor returns message.name. code ex.: return message.name ?? type;
      return "model";
    case "system":
      return "system";
    case "human":
      return "user";
    case "tool":
    case "function":
      return "function";
    default:
      throw new Error(`Unknown / unsupported author: ${author}`);
  }
}

function messageContentMedia(content: MessageContentComplex): Part {
  if ("mimeType" in content && "data" in content) {
    return {
      inlineData: {
        mimeType: content.mimeType,
        data: content.data,
      },
    };
  }
  if ("mimeType" in content && "fileUri" in content) {
    return {
      fileData: {
        mimeType: content.mimeType,
        fileUri: content.fileUri,
      },
    };
  }

  throw new Error("Invalid media content");
}

function inferToolNameFromPreviousMessages(
  message: ToolMessage | ToolMessageChunk,
  previousMessages: BaseMessage[]
): string | undefined {
  return previousMessages
    .map((msg) => {
      if (isAIMessage(msg)) {
        return msg.tool_calls ?? [];
      }
      return [];
    })
    .flat()
    .find((toolCall) => {
      return toolCall.id === message.tool_call_id;
    })?.name;
}

export function convertMessageContentToParts(
  message: BaseMessage,
  isMultimodalModel: boolean,
  previousMessages: BaseMessage[]
): Part[] {
  if (isToolMessage(message)) {
    const messageName =
      message.name ??
      inferToolNameFromPreviousMessages(message, previousMessages);
    if (messageName === undefined) {
      throw new Error(
        `Google requires a tool name for each tool call response, and we could not infer a called tool name for ToolMessage "${message.id}" from your passed messages. Please populate a "name" field on that ToolMessage explicitly.`
      );
    }
    return [
      {
        functionResponse: {
          name: messageName,
          response:
            typeof message.content === "string"
              ? { result: message.content }
              : message.content,
        },
      },
    ];
  }

  let functionCalls: FunctionCallPart[] = [];
  const messageParts: Part[] = [];

  if (typeof message.content === "string" && message.content) {
    messageParts.push({ text: message.content });
  }

  if (Array.isArray(message.content)) {
    message.content.forEach((c) => {
      if (c.type === "text") {
        messageParts.push({ text: c.text });
      } else if (c.type === "executableCode") {
        messageParts.push({ executableCode: c.executableCode });
      } else if (c.type === "codeExecutionResult") {
        messageParts.push({ codeExecutionResult: c.codeExecutionResult });
      } else if (c.type === "image_url") {
        if (!isMultimodalModel) {
          throw new Error(`This model does not support images`);
        }
        let source;
        if (typeof c.image_url === "string") {
          source = c.image_url;
        } else if (typeof c.image_url === "object" && "url" in c.image_url) {
          source = c.image_url.url;
        } else {
          throw new Error("Please provide image as base64 encoded data URL");
        }
        const [dm, data] = source.split(",");
        if (!dm.startsWith("data:")) {
          throw new Error("Please provide image as base64 encoded data URL");
        }

        const [mimeType, encoding] = dm.replace(/^data:/, "").split(";");
        if (encoding !== "base64") {
          throw new Error("Please provide image as base64 encoded data URL");
        }

        messageParts.push({
          inlineData: {
            data,
            mimeType,
          },
        });
      } else if (c.type === "media") {
        messageParts.push(messageContentMedia(c));
      } else if (c.type === "tool_use") {
        functionCalls.push({
          functionCall: {
            name: c.name,
            args: c.input,
          },
        });
      } else if (
        c.type?.includes("/") &&
        // Ensure it's a single slash.
        c.type.split("/").length === 2 &&
        "data" in c &&
        typeof c.data === "string"
      ) {
        messageParts.push({
          inlineData: {
            mimeType: c.type,
            data: c.data,
          },
        });
      } else if ("functionCall" in c) {
        // No action needed here — function calls will be added later from message.tool_calls
      } else {
        if ("type" in c) {
          throw new Error(`Unknown content type ${c.type}`);
        } else {
          throw new Error(`Unknown content ${JSON.stringify(c)}`);
        }
      }
    });
  }

  if (isAIMessage(message) && message.tool_calls?.length) {
    functionCalls = message.tool_calls.map((tc) => {
      return {
        functionCall: {
          name: tc.name,
          args: tc.args,
        },
      };
    });
  }

  return [...messageParts, ...functionCalls];
}

export function convertBaseMessagesToContent(
  messages: BaseMessage[],
  isMultimodalModel: boolean,
  convertSystemMessageToHumanContent: boolean = false
) {
  return messages.reduce<{
    content: Content[];
    mergeWithPreviousContent: boolean;
  }>(
    (acc, message, index) => {
      if (!isBaseMessage(message)) {
        throw new Error("Unsupported message input");
      }
      const author = getMessageAuthor(message);
      if (author === "system" && index !== 0) {
        throw new Error("System message should be the first one");
      }
      const role = convertAuthorToRole(author);

      const prevContent = acc.content[acc.content.length];
      if (
        !acc.mergeWithPreviousContent &&
        prevContent &&
        prevContent.role === role
      ) {
        throw new Error(
          "Google Generative AI requires alternate messages between authors"
        );
      }

      const parts = convertMessageContentToParts(
        message,
        isMultimodalModel,
        messages.slice(0, index)
      );

      if (acc.mergeWithPreviousContent) {
        const prevContent = acc.content[acc.content.length - 1];
        if (!prevContent) {
          throw new Error(
            "There was a problem parsing your system message. Please try a prompt without one."
          );
        }
        prevContent.parts.push(...parts);

        return {
          mergeWithPreviousContent: false,
          content: acc.content,
        };
      }
      let actualRole = role;
      if (
        actualRole === "function" ||
        (actualRole === "system" && !convertSystemMessageToHumanContent)
      ) {
        // GenerativeAI API will throw an error if the role is not "user" or "model."
        actualRole = "user";
      }
      const content: Content = {
        role: actualRole,
        parts,
      };
      return {
        mergeWithPreviousContent:
          author === "system" && !convertSystemMessageToHumanContent,
        content: [...acc.content, content],
      };
    },
    { content: [], mergeWithPreviousContent: false }
  ).content;
}

export function mapGenerateContentResultToChatResult(
  response: EnhancedGenerateContentResponse,
  extra?: {
    usageMetadata: UsageMetadata | undefined;
  }
): ChatResult {
  // if rejected or error, return empty generations with reason in filters
  if (
    !response.candidates ||
    response.candidates.length === 0 ||
    !response.candidates[0]
  ) {
    return {
      generations: [],
      llmOutput: {
        filters: response.promptFeedback,
      },
    };
  }

  const functionCalls = response.functionCalls();
  const [candidate] = response.candidates;
  const { content: candidateContent, ...generationInfo } = candidate;
  let content: MessageContent;
  if (candidateContent?.parts.length === 1 && candidateContent.parts[0].text) {
    content = candidateContent.parts[0].text;
  } else {
    content = candidateContent.parts.map((p) => {
      if ("text" in p) {
        return {
          type: "text",
          text: p.text,
        };
      } else if ("executableCode" in p) {
        return {
          type: "executableCode",
          executableCode: p.executableCode,
        };
      } else if ("codeExecutionResult" in p) {
        return {
          type: "codeExecutionResult",
          codeExecutionResult: p.codeExecutionResult,
        };
      }
      return p;
    });
  }

  let text = "";
  if (typeof content === "string") {
    text = content;
  } else if ("text" in content[0]) {
    text = content[0].text;
  }

  const generation: ChatGeneration = {
    text,
    message: new AIMessage({
      content,
      tool_calls: functionCalls?.map((fc) => {
        return {
          ...fc,
          type: "tool_call",
          id: "id" in fc && typeof fc.id === "string" ? fc.id : uuidv4(),
        };
      }),
      additional_kwargs: {
        ...generationInfo,
      },
      usage_metadata: extra?.usageMetadata,
    }),
    generationInfo,
  };

  return {
    generations: [generation],
    llmOutput: {
      tokenUsage: {
        promptTokens: extra?.usageMetadata?.input_tokens,
        completionTokens: extra?.usageMetadata?.output_tokens,
        totalTokens: extra?.usageMetadata?.total_tokens,
      },
    },
  };
}

export function convertResponseContentToChatGenerationChunk(
  response: EnhancedGenerateContentResponse,
  extra: {
    usageMetadata?: UsageMetadata | undefined;
    index: number;
  }
): ChatGenerationChunk | null {
  if (!response.candidates || response.candidates.length === 0) {
    return null;
  }
  const functionCalls = response.functionCalls();
  const [candidate] = response.candidates;
  const { content: candidateContent, ...generationInfo } = candidate;
  let content: MessageContent | undefined;
  // Checks if some parts do not have text. If false, it means that the content is a string.
  if (
    candidateContent?.parts &&
    candidateContent.parts.every((p) => "text" in p)
  ) {
    content = candidateContent.parts.map((p) => p.text).join("");
  } else if (candidateContent.parts) {
    content = candidateContent.parts.map((p) => {
      if ("text" in p) {
        return {
          type: "text",
          text: p.text,
        };
      } else if ("executableCode" in p) {
        return {
          type: "executableCode",
          executableCode: p.executableCode,
        };
      } else if ("codeExecutionResult" in p) {
        return {
          type: "codeExecutionResult",
          codeExecutionResult: p.codeExecutionResult,
        };
      }
      return p;
    });
  }

  let text = "";
  if (content && typeof content === "string") {
    text = content;
  } else if (content && typeof content === "object" && "text" in content[0]) {
    text = content[0].text;
  }

  const toolCallChunks: ToolCallChunk[] = [];
  if (functionCalls) {
    toolCallChunks.push(
      ...functionCalls.map((fc) => ({
        ...fc,
        args: JSON.stringify(fc.args),
        index: extra.index,
        type: "tool_call_chunk" as const,
        id: "id" in fc && typeof fc.id === "string" ? fc.id : uuidv4(),
      }))
    );
  }

  return new ChatGenerationChunk({
    text,
    message: new AIMessageChunk({
      content: content || "",
      name: !candidateContent ? undefined : candidateContent.role,
      tool_call_chunks: toolCallChunks,
      // Each chunk can have unique "generationInfo", and merging strategy is unclear,
      // so leave blank for now.
      additional_kwargs: {},
      usage_metadata: extra.usageMetadata,
    }),
    generationInfo,
  });
}

export function convertToGenerativeAITools(
  tools: GoogleGenerativeAIToolType[]
): GoogleGenerativeAIFunctionDeclarationsTool[] {
  if (
    tools.every(
      (tool) =>
        "functionDeclarations" in tool &&
        Array.isArray(tool.functionDeclarations)
    )
  ) {
    return tools as GoogleGenerativeAIFunctionDeclarationsTool[];
  }
  return [
    {
      functionDeclarations: tools.map(
        (tool): GenerativeAIFunctionDeclaration => {
          if (isLangChainTool(tool)) {
            const jsonSchema = schemaToGenerativeAIParameters(tool.schema);
            if (
              jsonSchema.type === "object" &&
              "properties" in jsonSchema &&
              Object.keys(jsonSchema.properties).length === 0
            ) {
              return {
                name: tool.name,
                description: tool.description,
              };
            }
            return {
              name: tool.name,
              description: tool.description,
              parameters: jsonSchema,
            };
          }
          if (isOpenAITool(tool)) {
            return {
              name: tool.function.name,
              description:
                tool.function.description ?? `A function available to call.`,
              parameters: jsonSchemaToGeminiParameters(
                tool.function.parameters
              ),
            };
          }
          return tool as unknown as GenerativeAIFunctionDeclaration;
        }
      ),
    },
  ];
}
