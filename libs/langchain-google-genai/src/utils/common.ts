import {
  EnhancedGenerateContentResponse,
  Content,
  Part,
  type FunctionDeclarationsTool as GoogleGenerativeAIFunctionDeclarationsTool,
  type FunctionDeclaration as GenerativeAIFunctionDeclaration,
  POSSIBLE_ROLES,
} from "@google/generative-ai";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  ChatMessage,
  MessageContentComplex,
  UsageMetadata,
  isBaseMessage,
} from "@langchain/core/messages";
import {
  ChatGeneration,
  ChatGenerationChunk,
  ChatResult,
} from "@langchain/core/outputs";
import { StructuredToolInterface } from "@langchain/core/tools";
import { isStructuredTool } from "@langchain/core/utils/function_calling";
import { ToolCallChunk } from "@langchain/core/messages/tool";
import { zodToGenerativeAIParameters } from "./zod_to_genai_parameters.js";

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
    case "ai":
    case "model": // getMessageAuthor returns message.name. code ex.: return message.name ?? type;
      return "model";
    case "system":
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

  throw new Error("Invalid media content");
}

export function convertMessageContentToParts(
  message: BaseMessage,
  isMultimodalModel: boolean,
  role: (typeof POSSIBLE_ROLES)[number]
): Part[] {
  if (typeof message.content === "string") {
    return [{ text: message.content }];
  }

  let functionCallParts: Part[] = [];
  if (role === "function") {
    if (message.name && typeof message.content === "string") {
      functionCallParts.push({
        functionResponse: {
          name: message.name,
          response: message.content,
        },
      });
    } else {
      throw new Error(
        "ChatGoogleGenerativeAI requires tool messages to contain the tool name, and a string content."
      );
    }
  }
  if ("tool_calls" in message) {
    const castMessage = message as AIMessage;
    if (castMessage.tool_calls && castMessage.tool_calls.length > 0) {
      functionCallParts = castMessage.tool_calls.map((tc) => ({
        functionCall: {
          name: tc.name,
          args: tc.args,
        },
      }));
    }
  }

  const messageContentParts = message.content.map((c) => {
    if (c.type === "text") {
      return {
        text: c.text,
      };
    }

    if (c.type === "image_url") {
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

      return {
        inlineData: {
          data,
          mimeType,
        },
      };
    } else if (c.type === "media") {
      return messageContentMedia(c);
    } else if (c.type === "tool_use") {
      return {
        functionCall: {
          name: c.name,
          args: c.input,
        },
      };
    }
    throw new Error(`Unknown content type ${(c as { type: string }).type}`);
  });
  return [...messageContentParts, ...functionCallParts];
}

export function convertBaseMessagesToContent(
  messages: BaseMessage[],
  isMultimodalModel: boolean
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
        role
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
      if (actualRole === "function") {
        // GenerativeAI API will throw an error if the role is not "user" or "model."
        actualRole = "user";
      }
      const content: Content = {
        role: actualRole,
        parts,
      };
      return {
        mergeWithPreviousContent: author === "system",
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
  const { content, ...generationInfo } = candidate;
  const text = content?.parts[0]?.text ?? "";

  const generation: ChatGeneration = {
    text,
    message: new AIMessage({
      content: text,
      tool_calls: functionCalls,
      additional_kwargs: {
        ...generationInfo,
      },
      usage_metadata: extra?.usageMetadata,
    }),
    generationInfo,
  };

  return {
    generations: [generation],
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
  const { content, ...generationInfo } = candidate;
  const text = content?.parts[0]?.text ?? "";

  const toolCallChunks: ToolCallChunk[] = [];
  if (functionCalls) {
    toolCallChunks.push(
      ...functionCalls.map((fc) => ({
        ...fc,
        args: JSON.stringify(fc.args),
        index: extra.index,
      }))
    );
  }
  return new ChatGenerationChunk({
    text,
    message: new AIMessageChunk({
      content: text,
      name: !content ? undefined : content.role,
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
  structuredTools: (StructuredToolInterface | Record<string, unknown>)[]
): GoogleGenerativeAIFunctionDeclarationsTool[] {
  if (
    structuredTools.every(
      (tool) =>
        "functionDeclarations" in tool &&
        Array.isArray(tool.functionDeclarations)
    )
  ) {
    return structuredTools as GoogleGenerativeAIFunctionDeclarationsTool[];
  }
  return [
    {
      functionDeclarations: structuredTools.map(
        (structuredTool): GenerativeAIFunctionDeclaration => {
          if (isStructuredTool(structuredTool)) {
            const jsonSchema = zodToGenerativeAIParameters(
              structuredTool.schema
            );
            return {
              name: structuredTool.name,
              description: structuredTool.description,
              parameters: jsonSchema,
            };
          }
          return structuredTool as unknown as GenerativeAIFunctionDeclaration;
        }
      ),
    },
  ];
}
