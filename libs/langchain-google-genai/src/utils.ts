import {
  EnhancedGenerateContentResponse,
  Content,
  Part,
} from "@google/generative-ai";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  ChatMessage,
  MessageContent,
  isBaseMessage,
} from "@langchain/core/messages";
import {
  ChatGeneration,
  ChatGenerationChunk,
  ChatResult,
} from "@langchain/core/outputs";

export function getMessageAuthor(message: BaseMessage) {
  const type = message._getType();
  if (ChatMessage.isInstance(message)) {
    return message.role;
  }
  return message.name ?? type;
}

/**
 * Maps a message type to a Google Generative AI chat author.
 * @param message The message to map.
 * @param model The model to use for mapping.
 * @returns The message type mapped to a Google Generative AI chat author.
 */
export function convertAuthorToRole(author: string) {
  switch (author) {
    /**
     *  Note: Gemini currently is not supporting system messages
     *  we will convert them to human messages and merge with following
     * */
    case "ai":
      return "model";
    case "system":
    case "human":
      return "user";
    default:
      throw new Error(`Unknown / unsupported author: ${author}`);
  }
}

export function convertMessageContentToParts(
  content: MessageContent,
  isMultimodalModel: boolean
): Part[] {
  if (typeof content === "string") {
    return [{ text: content }];
  }

  return content.map((c) => {
    if (c.type === "text") {
      return {
        text: c.text,
      };
    }

    if (c.type === "image_url") {
      if (!isMultimodalModel) {
        throw new Error(`This model does not support images`);
      }
      if (typeof c.image_url !== "string") {
        throw new Error("Please provide image as base64 encoded data URL");
      }
      const [dm, data] = c.image_url.split(",");
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
    }
    throw new Error(`Unknown content type ${(c as { type: string }).type}`);
  });
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
        message.content,
        isMultimodalModel
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
      const content: Content = {
        role,
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
  response: EnhancedGenerateContentResponse
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

  const [candidate] = response.candidates;
  const { content, ...generationInfo } = candidate;
  const text = content.parts[0]?.text ?? "";

  const generation: ChatGeneration = {
    text,
    message: new AIMessage({
      content: text,
      name: content === null ? undefined : content.role,
      additional_kwargs: generationInfo,
    }),
    generationInfo,
  };

  return {
    generations: [generation],
  };
}

export function convertResponseContentToChatGenerationChunk(
  response: EnhancedGenerateContentResponse
): ChatGenerationChunk | null {
  if (!response.candidates || response.candidates.length === 0) {
    return null;
  }
  const [candidate] = response.candidates;
  const { content, ...generationInfo } = candidate;
  const text = content.parts[0]?.text ?? "";

  return new ChatGenerationChunk({
    text,
    message: new AIMessageChunk({
      content: text,
      name: content === null ? undefined : content.role,
      // Each chunk can have unique "generationInfo", and merging strategy is unclear,
      // so leave blank for now.
      additional_kwargs: {},
    }),
    generationInfo,
  });
}
