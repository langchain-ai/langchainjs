import {
  BaseMessage,
  AIMessage,
  isDataContentBlock,
  ContentBlock,
  parseBase64DataUrl,
  SystemMessage,
  HumanMessage,
  ToolMessage,
  ChatMessage,
  StandardContentBlockConverter,
  convertToProviderContentBlock,
  type Data,
  UsageMetadata,
  InputTokenDetails,
  OutputTokenDetails,
  ModalitiesTokenDetails,
  MessageContentImageUrl,
  MessageContentComplex,
  MessageContentText,
} from "@langchain/core/messages";
import { Converter } from "@langchain/core/utils/format";
import type { Gemini } from "../chat_models/types.js";
import { iife } from "../utils/misc.js";
import { InvalidInputError, ToolCallNotFoundError } from "../utils/errors.js";

/**
 * Standard content block converter for Google Gemini API.
 * Converts deprecated Data content blocks to Gemini Part format.
 *
 * @deprecated This converter is for backward compatibility with older message formats.
 * Use ContentBlock.Multimodal.Standard instead.
 */
export const geminiContentBlockConverter: StandardContentBlockConverter<{
  text: Gemini.Part;
  image: Gemini.Part;
  audio: Gemini.Part;
  file: Gemini.Part;
}> = {
  providerName: "ChatGoogle",

  fromStandardTextBlock(block: Data.StandardTextBlock): Gemini.Part {
    return { text: block.text };
  },

  fromStandardImageBlock(block: Data.StandardImageBlock): Gemini.Part {
    if (isDataContentBlock(block)) {
      if (block.source_type === "base64") {
        if (!block.mime_type) {
          throw new InvalidInputError(
            "mime_type is required for base64 image blocks"
          );
        }
        const dataStr =
          typeof block.data === "string"
            ? block.data
            : typeof block.data === "object" && block.data !== null
            ? // Convert Uint8Array to base64 string
              btoa(
                Array.from(block.data as Uint8Array)
                  .map((byte) => String.fromCharCode(byte))
                  .join("")
              )
            : String(block.data);
        return {
          inlineData: {
            mimeType: block.mime_type,
            data: dataStr,
          },
        };
      }

      if (block.source_type === "url") {
        // Check if it's a data URL
        const parsed = parseBase64DataUrl({ dataUrl: block.url });
        if (parsed) {
          const dataStr =
            typeof parsed.data === "string"
              ? parsed.data
              : // Convert Uint8Array to base64 string
                btoa(
                  Array.from(parsed.data as Uint8Array)
                    .map((byte) => String.fromCharCode(byte))
                    .join("")
                );
          return {
            inlineData: {
              mimeType: parsed.mime_type || block.mime_type || "image/jpeg",
              data: dataStr,
            },
          };
        }
        // Otherwise, treat as file URI
        return {
          fileData: {
            mimeType: block.mime_type || "image/jpeg",
            fileUri: block.url,
          },
        };
      }

      if (block.source_type === "id") {
        return {
          fileData: {
            mimeType: block.mime_type || "image/jpeg",
            fileUri: block.id,
          },
        };
      }
    }

    throw new InvalidInputError(
      `Image content blocks with source_type "${
        (block as Data.DataContentBlock).source_type
      }" are not supported for ChatGoogle. Supported source types are: "base64", "url", "id".`
    );
  },

  fromStandardAudioBlock(block: Data.StandardAudioBlock): Gemini.Part {
    if (isDataContentBlock(block)) {
      if (block.source_type === "base64") {
        if (!block.mime_type) {
          throw new InvalidInputError(
            "mime_type is required for base64 audio blocks"
          );
        }
        const dataStr =
          typeof block.data === "string"
            ? block.data
            : typeof block.data === "object" && block.data !== null
            ? // Convert Uint8Array to base64 string
              btoa(
                Array.from(block.data as Uint8Array)
                  .map((byte) => String.fromCharCode(byte))
                  .join("")
              )
            : String(block.data);
        return {
          inlineData: {
            mimeType: block.mime_type,
            data: dataStr,
          },
        };
      }

      if (block.source_type === "url") {
        // Check if it's a data URL
        const parsed = parseBase64DataUrl({ dataUrl: block.url });
        if (parsed) {
          const dataStr =
            typeof parsed.data === "string"
              ? parsed.data
              : // Convert Uint8Array to base64 string
                btoa(
                  Array.from(parsed.data as Uint8Array)
                    .map((byte) => String.fromCharCode(byte))
                    .join("")
                );
          return {
            inlineData: {
              mimeType: parsed.mime_type || block.mime_type || "audio/mpeg",
              data: dataStr,
            },
          };
        }
        // Otherwise, treat as file URI
        return {
          fileData: {
            mimeType: block.mime_type || "audio/mpeg",
            fileUri: block.url,
          },
        };
      }

      if (block.source_type === "id") {
        return {
          fileData: {
            mimeType: block.mime_type || "audio/mpeg",
            fileUri: block.id,
          },
        };
      }
    }

    throw new InvalidInputError(
      `Audio content blocks with source_type "${
        (block as Data.DataContentBlock).source_type
      }" are not supported for ChatGoogle. Supported source types are: "base64", "url", "id".`
    );
  },

  fromStandardFileBlock(block: Data.StandardFileBlock): Gemini.Part {
    if (isDataContentBlock(block)) {
      if (block.source_type === "base64") {
        if (!block.mime_type) {
          throw new InvalidInputError(
            "mime_type is required for base64 file blocks"
          );
        }
        const dataStr =
          typeof block.data === "string"
            ? block.data
            : typeof block.data === "object" && block.data !== null
            ? // Convert Uint8Array to base64 string
              btoa(
                Array.from(block.data as Uint8Array)
                  .map((byte) => String.fromCharCode(byte))
                  .join("")
              )
            : String(block.data);
        return {
          inlineData: {
            mimeType: block.mime_type,
            data: dataStr,
          },
        };
      }

      if (block.source_type === "url") {
        // Check if it's a data URL
        const parsed = parseBase64DataUrl({ dataUrl: block.url });
        if (parsed) {
          const dataStr =
            typeof parsed.data === "string"
              ? parsed.data
              : // Convert Uint8Array to base64 string
                btoa(
                  Array.from(parsed.data as Uint8Array)
                    .map((byte) => String.fromCharCode(byte))
                    .join("")
                );
          return {
            inlineData: {
              mimeType:
                parsed.mime_type ||
                block.mime_type ||
                "application/octet-stream",
              data: dataStr,
            },
          };
        }
        // Otherwise, treat as file URI
        return {
          fileData: {
            mimeType: block.mime_type || "application/octet-stream",
            fileUri: block.url,
          },
        };
      }

      if (block.source_type === "id") {
        return {
          fileData: {
            mimeType: block.mime_type || "application/octet-stream",
            fileUri: block.id,
          },
        };
      }
    }

    // Handle text source type (for plain text file blocks)
    if (
      "source_type" in block &&
      block.source_type === "text" &&
      "text" in block
    ) {
      return {
        text: block.text,
      };
    }

    throw new InvalidInputError(
      `File content blocks with source_type "${
        (block as Data.DataContentBlock).source_type
      }" are not supported for ChatGoogle. Supported source types are: "base64", "url", "id", "text".`
    );
  },
};

function convertStandardDataContentBlockToGeminiPart(
  block: ContentBlock.Multimodal.Data
): Gemini.Part | null {
  function uint8arrayToString(data: Uint8Array): string {
    return btoa(
      Array.from(data as Uint8Array)
        .map((byte) => String.fromCharCode(byte))
        .join("")
    );
  }

  function extractMimeType(str: string): {
    mimeType: string | null;
    data: string | null;
  } {
    if (str.startsWith("data:")) {
      return {
        mimeType: str.split(":")[1].split(";")[0],
        data: str.split(",")[1],
      };
    }
    return {
      mimeType: null,
      data: null,
    };
  }

  if ("mimeType" in block && "data" in block) {
    const mimeType = block.mimeType!;
    const data: string =
      typeof block.data === "string"
        ? block.data
        : uint8arrayToString(block.data!);
    return {
      inlineData: {
        mimeType,
        data,
      },
    };
  } else if ("mimeType" in block && "url" in block) {
    const mimeType = block.mimeType!;
    const fileUri = block.url!;
    return {
      fileData: {
        mimeType,
        fileUri,
      },
    };
  } else if ("url" in block && block.url?.startsWith("data:")) {
    const { mimeType, data } = extractMimeType(block.url!);
    if (mimeType && data) {
      return {
        inlineData: {
          mimeType,
          data,
        },
      };
    }
  }
  // FIXME - report this somehow?
  return null;
}

function convertStandardVideoContentBlockToGeminiPart(
  block: ContentBlock.Multimodal.Video
): Gemini.Part | null {
  const ret: Gemini.Part | null =
    convertStandardDataContentBlockToGeminiPart(block);
  if (ret && block.metadata && "videoMetadata" in block.metadata) {
    (ret as Gemini.Part.FileData).videoMetadata = block.metadata.videoMetadata!;
  }
  return ret;
}

/**
 * Converts a single LangChain standard content block (v1 format)
 * into a Gemini.Part.
 *
 * This is intended to be called from `convertStandardContentMessageToGeminiContent`
 */
function convertStandardContentBlockToGeminiPart(
  block: ContentBlock.Standard
): Gemini.Part | null {
  switch (block.type) {
    case "text":
      return { text: block.text };
    case "image":
    case "audio":
      return convertStandardDataContentBlockToGeminiPart(block);
    case "video":
      return convertStandardVideoContentBlockToGeminiPart(block);
    default:
      return null;
  }
}

/**
 * Converts a single LangChain message with standard content blocks (v1 format) to Gemini Content.
 * This handles messages that have `response_metadata.output_version === "v1"`.
 *
 * This is intended to be called from `convertMessagesToGeminiContent`
 */
function convertStandardContentMessageToGeminiContent(
  message: BaseMessage
): Gemini.Content | null {
  // Skip system messages - they're handled separately
  if (SystemMessage.isInstance(message)) {
    return null;
  }

  let role: Gemini.Role;
  if (HumanMessage.isInstance(message)) {
    role = "user";
  } else if (AIMessage.isInstance(message)) {
    role = "model";
  } else if (ToolMessage.isInstance(message)) {
    // Tool messages in Gemini are represented as function responses
    role = "function";
  } else if (ChatMessage.isInstance(message)) {
    // Map ChatMessage roles to Gemini roles
    const msgRole = message.role.toLowerCase();
    if (msgRole === "user" || msgRole === "human") {
      role = "user";
    } else if (
      msgRole === "assistant" ||
      msgRole === "ai" ||
      msgRole === "model"
    ) {
      role = "model";
    } else if (msgRole === "function" || msgRole === "tool") {
      role = "function";
    } else {
      // Default to user for unknown roles
      role = "user";
    }
  } else {
    // Unknown message type - default to user
    role = "user";
  }

  const parts: Gemini.Part[] = [];

  // Process standard content blocks
  message.contentBlocks.forEach((block: ContentBlock.Standard) => {
    const contentBlock =
      (message.additional_kwargs
        .originalTextContentBlock as ContentBlock.Standard) || block;
    const part: Gemini.Part | null =
      convertStandardContentBlockToGeminiPart(contentBlock);
    if (part) {
      parts.push(part);
    }
  });

  // Handle tool messages as function responses
  if (ToolMessage.isInstance(message) && message.tool_call_id) {
    const responseContent =
      typeof message.content === "string"
        ? message.content
        : JSON.stringify(message.content);
    // FIXME: ToolMessage almost never has a name, we need to refer to the message history
    parts.push({
      functionResponse: {
        name: message.name || "unknown",
        response: { result: responseContent },
      },
    });
  }

  // Only return content if we have parts
  if (parts.length === 0) {
    return null;
  }

  return { role, parts };
}

/**
 * Converts a single LangChain message with legacy content blocks (v0 format) to Gemini Content.
 * This handles messages that have `response_metadata.output_version === "v0"`.
 *
 * This is intended to be called from `convertMessagesToGeminiContent`
 */
function convertLegacyContentMessageToGeminiContent(
  message: BaseMessage,
  messages: BaseMessage[]
): Gemini.Content | null {
  // Skip system messages - they're handled separately
  if (SystemMessage.isInstance(message)) {
    return null;
  }

  /**
   * @deprecated - This is for use by `convertLegacyContentMessageToGeminiContent` only
   */
  function isMessageContentText(
    content: object
  ): content is MessageContentText {
    return typeof content === "object" && content !== null && "text" in content;
  }

  /**
   * @deprecated - This is for use by `convertLegacyContentMessageToGeminiContent` only
   */
  function isMessageContentImageUrl(
    content: object
  ): content is MessageContentImageUrl {
    return (
      typeof content === "object" && content !== null && "image_url" in content
    );
  }

  /**
   * @deprecated - This is for use by `convertLegacyContentMessageToGeminiContent` only
   */
  function isMessageContentMedia(
    content: object
  ): content is MessageContentComplex {
    return (
      typeof content === "object" &&
      content !== null &&
      "type" in content &&
      content.type === "media"
    );
  }

  /**
   * Infers the MIME type from a URL based on its file extension.
   * This is used as a fallback when the MIME type is not provided.
   *
   * @param url - The URL to infer the MIME type from
   * @returns The inferred MIME type or a generic type if it cannot be determined
   */
  function inferMimeTypeFromUrl(url: string): string {
    const mimeTypeMap: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      bmp: "image/bmp",
      svg: "image/svg+xml",
      ico: "image/x-icon",
      tiff: "image/tiff",
      tif: "image/tiff",
    };

    try {
      // Extract the pathname from the URL
      const pathname = new URL(url).pathname;
      // Get the file extension (handle query params and fragments)
      const extension = pathname
        .split(".")
        .pop()
        ?.toLowerCase()
        .split(/[?#]/)[0];
      return extension ? mimeTypeMap[extension] : "application/octet-stream";
    } catch {
      // If URL parsing fails, try a simple extension extraction
      const match = url.match(/\.([a-zA-Z0-9]+)(?:[?#]|$)/);
      if (match) {
        const extension = match[1].toLowerCase();
        return mimeTypeMap[extension];
      }
      return "application/octet-stream";
    }
  }

  function messageContentImageUrlData(
    content: MessageContentImageUrl
  ): Gemini.Part.InlineData | Gemini.Part.FileData {
    const url: string =
      typeof content.image_url === "string"
        ? content.image_url
        : content.image_url.url;
    if (!url) {
      throw new InvalidInputError(
        "Missing image URL in image_url content block."
      );
    }

    const dataUrl = parseBase64DataUrl({ dataUrl: url });
    if (dataUrl?.data && dataUrl?.mime_type) {
      return {
        inlineData: {
          data: dataUrl.data,
          mimeType: dataUrl.mime_type,
        },
      };
    } else {
      // Infer MIME type from URL extension
      const mimeType = inferMimeTypeFromUrl(url) || "image/png";
      return {
        fileData: {
          mimeType,
          fileUri: url,
        },
      };
    }
  }

  function messageContentImageUrl(
    content: MessageContentImageUrl
  ): Gemini.Part.InlineData | Gemini.Part.FileData {
    const ret = messageContentImageUrlData(content);
    supplementVideoMetadata(content, ret);
    return ret;
  }

  function messageContentMediaData(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: Record<string, any>
  ): Gemini.Part.InlineData | Gemini.Part.FileData {
    if ("mimeType" in content && "data" in content) {
      return {
        inlineData: {
          mimeType: content.mimeType,
          data: content.data,
        },
      };
    } else if ("mimeType" in content && "fileUri" in content) {
      return {
        fileData: {
          mimeType: content.mimeType,
          fileUri: content.fileUri,
        },
      };
    } else {
      // The old version would attempt to read the URL, but we're
      // not in an async function, so we can't do that.
    }

    throw new InvalidInputError(
      `Invalid media content: ${JSON.stringify(
        content,
        null,
        1
      )}. Expected either { mimeType, data } for inline data or { mimeType, fileUri } for file references.`
    );
  }

  function supplementVideoMetadata(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: MessageContentImageUrl | Record<string, any>,
    ret: Gemini.Part.InlineData | Gemini.Part.FileData
  ): Gemini.Part.InlineData | Gemini.Part.FileData {
    // Add videoMetadata if defined
    if ("videoMetadata" in content && typeof ret === "object") {
      ret.videoMetadata = content.videoMetadata;
    }
    return ret;
  }

  function messageContentMedia(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: Record<string, any>
  ): Gemini.Part.InlineData | Gemini.Part.FileData {
    const ret = messageContentMediaData(content);
    supplementVideoMetadata(content, ret);
    return ret;
  }

  const role: Gemini.Role = iife(() => {
    if (HumanMessage.isInstance(message)) {
      return "user";
    } else if (AIMessage.isInstance(message)) {
      return "model";
    } else if (ToolMessage.isInstance(message)) {
      // Tool messages in Gemini are represented as function responses
      return "function";
    } else if (ChatMessage.isInstance(message)) {
      // Map ChatMessage roles to Gemini roles
      const msgRole = message.role.toLowerCase();
      if (msgRole === "user" || msgRole === "human") {
        return "user";
      } else if (
        msgRole === "assistant" ||
        msgRole === "ai" ||
        msgRole === "model"
      ) {
        return "model";
      } else if (msgRole === "function" || msgRole === "tool") {
        return "function";
      } else {
        // Default to user for unknown roles
        return "user";
      }
    } else {
      // Unknown message type - skip or default to user
      return "user";
    }
  });

  let parts: Gemini.Part[] = [];

  // Handle legacy content formats
  if (typeof message.content === "string") {
    // Simple string content
    if (message.content.trim()) {
      parts.push({ text: message.content });
    }
  } else if (Array.isArray(message.content)) {
    // Array of content blocks (legacy format)
    for (const item of message.content) {
      if (typeof item === "string") {
        parts.push({ text: item });
      } else if (typeof item === "object" && item !== null) {
        if (isMessageContentText(item)) {
          parts.push({ text: item.text });
        } else if (isDataContentBlock(item)) {
          parts.push(
            convertToProviderContentBlock(item, geminiContentBlockConverter)
          );
        } else if (item?.type === "functionCall") {
          const { type, functionCall, ...etc } = item;
          parts.push({
            ...etc,
            functionCall,
          } as Gemini.Part.FunctionCall);
        } else if (isMessageContentImageUrl(item)) {
          parts.push(messageContentImageUrl(item));
        } else if (isMessageContentMedia(item)) {
          parts.push(messageContentMedia(item));
        } else {
          parts.push(item as Gemini.Part);
        }
      }
    }
  }

  // Handle tool messages as function responses
  if (ToolMessage.isInstance(message) && message.tool_call_id) {
    const responseContent =
      typeof message.content === "string"
        ? message.content
        : JSON.stringify(message.content);
    // Find the response name by checking previous messages for the tool call
    const toolCall = messages
      .filter(AIMessage.isInstance)
      .find((msg) =>
        msg.tool_calls?.find((tc) => tc.id === message.tool_call_id)
      );
    if (!toolCall) {
      throw new ToolCallNotFoundError(message.tool_call_id);
    }
    parts.push({
      functionResponse: {
        name: toolCall?.name || "unknown",
        response: { result: responseContent },
      },
    });
  }

  // Remove non-functionResponse parts if this is a tool response
  if (role === "function") {
    parts = parts.filter((part) => "functionResponse" in part);
  }

  // Only add content if we have parts
  if (parts.length > 0) {
    return { role, parts };
  }

  return null;
}

/**
 * Converts an array of LangChain messages to Gemini API content format.
 *
 * This converter transforms LangChain's message types into the content structure
 * expected by Google's Gemini API.
 *
 * @remarks
 * The converter processes messages in two distinct ways based on their format:
 *
 * **V1 Standard Content Format**:
 * Messages with `output_version: "v1"` in their response metadata use the
 * standardized content block format. These are processed through
 * `convertStandardContentMessageToGeminiContent`, which extracts text blocks
 * from the `contentBlocks` array and maps message roles appropriately.
 *
 * **Google Format**:
 * Messages without the v1 marker are processed using generic logic that handles:
 * - String content: Simple text strings are converted to text parts
 * - Array content: Arrays of strings or content blocks are processed individually
 * - Tool messages: Converted to function response parts with tool call metadata
 *
 * @example
 * ```typescript
 * // Simple conversation with text messages
 * const messages = [
 *   new HumanMessage("What is the weather?"),
 *   new AIMessage("I'll check that for you.")
 * ];
 * const contents = convertMessagesToGeminiContents(messages);
 * // Returns: [
 * //   { role: "user", parts: [{ text: "What is the weather?" }] },
 * //   { role: "model", parts: [{ text: "I'll check that for you." }] }
 * // ]
 * ```
 */
export const convertMessagesToGeminiContents: Converter<
  BaseMessage[],
  Gemini.GenerateContentRequest["contents"]
> = (messages) => {
  const contents: Gemini.Content[] = [];

  for (const message of messages) {
    // const content: Gemini.Content | null = convertContentMessageToGeminiContent(message, messages);
    const content: Gemini.Content | null = iife(() => {
      const outputVersion =
        "output_version" in message.response_metadata
          ? (message.response_metadata?.output_version as string)
          : "v0";
      switch (outputVersion) {
        case "v1":
          return convertStandardContentMessageToGeminiContent(message);
        case "v0":
        default:
          return convertLegacyContentMessageToGeminiContent(message, messages);
      }
    });
    if (content) {
      contents.push(content);
    }
  }

  return contents;
};

/**
 * Converts LangChain system messages to Gemini API system instruction format.
 *
 * This converter extracts system messages from a message array and transforms them
 * into the format expected by Google's Gemini API for system instructions. System
 * instructions provide context and guidelines that influence the model's behavior
 * throughout the conversation.
 *
 * @remarks
 * The converter handles two distinct message formats:
 *
 * 1. **V1 Standard Content Format**: Messages with `output_version: "v1"` in their
 *    response metadata use the standardized content block format. Only text blocks
 *    are extracted from the `contentBlocks` array.
 *
 * 2. **Legacy Google Format**: Messages without the v1 marker use the legacy format
 *    where content can be:
 *    - A simple string (trimmed and converted to a text part)
 *    - An array of strings or objects with `type: "text"` and a `text` property
 *
 * The converter filters out non-SystemMessage instances and only processes text
 * content, ignoring other content types like images or tool calls that may be
 * present in the message array.
 *
 * @example
 * ```typescript
 * // Simple string system message
 * const messages = [
 *   new SystemMessage("You are a helpful assistant.")
 * ];
 * const instruction = convertMessagesToGeminiSystemInstruction(messages);
 * // Returns: { parts: [{ text: "You are a helpful assistant." }] }
 * ```
 *
 * @param messages - Array of LangChain messages to extract system instructions from
 * @returns A Gemini system instruction object with text parts, or undefined if no
 *          system messages with text content are found
 */
export const convertMessagesToGeminiSystemInstruction: Converter<
  BaseMessage[],
  Gemini.GenerateContentRequest["systemInstruction"]
> = (messages) => {
  const systemParts: Gemini.Part[] = [];

  for (const message of messages) {
    if (SystemMessage.isInstance(message)) {
      if (message.text.trim()) {
        systemParts.push({ text: message.text });
      }
    }
  }

  if (systemParts.length === 0) {
    return undefined;
  }

  return { parts: systemParts };
};

/**
 * Converts an array of Gemini API parts into an array of LangChain tool calls.
 *
 * This function iterates through a given array of `Gemini.Part` objects,
 * identifies parts that represent a function call, and transforms them into
 * LangChain's standardized `ToolCall` format. Each resulting tool call is
 * assigned a unique, sequential ID.
 *
 * @param parts - An array of `Gemini.Part` objects, which may or may not
 *   contain function calls.
 * @returns An array of `ContentBlock.Tools.ToolCall` objects. If no function
 *   call parts are found, an empty array is returned.
 *
 * @remarks
 * The `id` for each tool call is generated sequentially in the format `call_0`,
 * `call_1`, and so on, based on its order of appearance in the input array.
 *
 * @example
 * ```typescript
 * const geminiParts: Gemini.Part[] = [
 *   { text: "Thinking about what to do..." },
 *   {
 *     functionCall: {
 *       name: "search_web",
 *       args: { query: "latest AI news" }
 *     }
 *   },
 *   {
 *     functionCall: {
 *       name: "calculator",
 *       args: { expression: "2 + 2" }
 *     }
 *   }
 * ];
 *
 * const toolCalls = convertGeminiPartsToToolCalls(geminiParts);
 * // toolCalls will be:
 * // [
 * //   { type: "tool_call", id: "call_0", name: "search_web", args: { query: "latest AI news" } },
 * //   { type: "tool_call", id: "call_1", name: "calculator", args: { expression: "2 + 2" } }
 * // ]
 * ```
 */
export const convertGeminiPartsToToolCalls: Converter<
  Gemini.Part[],
  ContentBlock.Tools.ToolCall<string, Record<string, unknown>>[]
> = (
  parts: Gemini.Part[]
): ContentBlock.Tools.ToolCall<string, Record<string, unknown>>[] => {
  const toolCalls: ContentBlock.Tools.ToolCall<
    string,
    Record<string, unknown>
  >[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if ("functionCall" in part && part.functionCall) {
      const functionCallPart = part as Gemini.Part.FunctionCall;
      toolCalls.push({
        type: "tool_call",
        id: `call_${toolCalls.length}`,
        name: functionCallPart.functionCall.name,
        args: functionCallPart.functionCall.args ?? {},
        thoughtSignature: functionCallPart.thoughtSignature,
      });
    }
  }

  return toolCalls;
};

export const convertGeminiPartToContentBlock: Converter<
  Gemini.Part,
  ContentBlock
> = (part: Gemini.Part): ContentBlock => {
  const block: ContentBlock = iife(() => {
    if ("text" in part && typeof part.text === "string") {
      return {
        type: "text",
        text: part.text,
      };
    } else if ("inlineData" in part && part.inlineData) {
      return {
        type: "inlineData",
        inlineData: part.inlineData,
      };
    } else if ("fileData" in part && part.fileData) {
      return {
        type: "fileData",
        fileData: part.fileData,
      };
    } else if ("functionCall" in part && part.functionCall) {
      return {
        type: "functionCall",
        functionCall: part.functionCall,
      };
    } else if ("functionResponse" in part && part.functionResponse) {
      return {
        type: "functionResponse",
        functionResponse: part.functionResponse,
      };
    } else if ("executableCode" in part && part.executableCode) {
      return {
        type: "executableCode",
        executableCode: part.executableCode,
      };
    } else if ("codeExecutionResult" in part && part.codeExecutionResult) {
      return {
        type: "codeExecutionResult",
        codeExecutionResult: part.codeExecutionResult,
      };
    }
    return part as unknown as ContentBlock;
  });
  const ret: ContentBlock = {
    thought: part.thought,
    thoughtSignature: part.thoughtSignature,
    partMetadata: part.partMetadata,
    ...block,
  };
  for (const attribute in ret) {
    if (ret[attribute] === undefined) {
      delete ret[attribute];
    }
  }

  return ret;
};

/**
 * Converts a Gemini API candidate response to a LangChain AIMessage.
 *
 * This converter transforms the response from Google's Gemini API into a standardized
 * AIMessage format that can be used throughout the LangChain ecosystem. It handles
 * various types of content including text, inline data, file data, function calls,
 * and code execution results.
 *
 * @remarks
 * The converter performs the following transformations:
 * - Extracts tool calls from function call parts and assigns sequential IDs
 * - Converts single text responses to string format for simplicity
 * - Converts multi-part responses to ContentBlock array format
 * - Preserves metadata including finish reason, safety ratings, and citations
 * - Handles various Gemini part types (text, inlineData, fileData, functionCall, etc.)
 *
 * @example
 * ```typescript
 * const candidate: Gemini.Candidate = {
 *   content: {
 *     parts: [
 *       { text: "Hello, how can I help you?" }
 *     ]
 *   },
 *   finishReason: "STOP",
 *   safetyRatings: [...]
 * };
 *
 * const aiMessage = convertGeminiCandidateToAIMessage(candidate);
 * // Returns: AIMessage with content "Hello, how can I help you?"
 * ```
 *
 * @param candidate - The Gemini API candidate response containing content parts and metadata
 * @returns An AIMessage instance with converted content, tool calls, and metadata
 */
export const convertGeminiCandidateToAIMessage: Converter<
  Gemini.Candidate,
  AIMessage
> = (candidate) => {
  function groundingSupportByPart(
    groundingSupports?: Gemini.GroundingSupport[]
  ): Gemini.GroundingSupport[][] {
    const ret: Gemini.GroundingSupport[][] = [];

    if (!groundingSupports || groundingSupports.length === 0) {
      return [[]];
    }

    groundingSupports?.forEach((groundingSupport) => {
      const segment = groundingSupport?.segment;
      const partIndex = segment?.partIndex ?? 0;
      if (ret[partIndex]) {
        ret[partIndex].push(groundingSupport);
      } else {
        ret[partIndex] = [groundingSupport];
      }
    });

    return ret;
  }

  const parts = candidate.content?.parts || [];

  // Extract tool calls from function call parts
  const toolCalls = convertGeminiPartsToToolCalls(parts);

  // Convert parts to content format that the translator understands
  // Format: array of objects with type field matching the part type
  let content: string | ContentBlock[];
  let originalTextContentBlock: ContentBlock | undefined = undefined;

  const groundingMetadata = candidate?.groundingMetadata;
  const citationMetadata = candidate?.citationMetadata;
  const groundingParts = groundingSupportByPart(
    groundingMetadata?.groundingSupports
  );

  // Determine if a part carries actual content vs. just metadata.
  // Metadata-only parts (e.g. empty text with only thoughtSignature) should not
  // prevent collapsing a single-text response into a string.
  const hasContentPayload = (p: Gemini.Part): boolean =>
    !!p.text ||
    !!p.thought ||
    !!p.inlineData ||
    !!p.fileData ||
    !!p.functionCall ||
    !!p.functionResponse ||
    !!p.executableCode ||
    !!p.codeExecutionResult;

  const contentParts = parts.filter(hasContentPayload);

  if (contentParts.length === 0) {
    // No content-bearing parts (may still have metadata-only parts)
    content = "";
    if (parts.length > 0) {
      originalTextContentBlock = convertGeminiPartToContentBlock(parts[0]);
    }
  } else if (
    contentParts.length === 1 &&
    "text" in contentParts[0] &&
    !("thought" in contentParts[0])
  ) {
    // Single text content part (possibly alongside metadata-only parts like
    // thoughtSignature) - store as string
    content = contentParts[0].text ?? "";
    // Merge metadata from any metadata-only parts into the content block
    const mergedPart: Gemini.Part = { ...contentParts[0] };
    for (const p of parts) {
      if (p !== contentParts[0] && p.thoughtSignature) {
        mergedPart.thoughtSignature = p.thoughtSignature;
      }
    }
    originalTextContentBlock = convertGeminiPartToContentBlock(mergedPart);
  } else {
    // Multiple content parts - convert to array format with type fields
    content = parts.map((p: Gemini.Part) => convertGeminiPartToContentBlock(p));
  }

  const additional_kwargs: Record<string, unknown> = {
    finishReason: candidate.finishReason,
    finishMessage: candidate.finishMessage,
    safetyRatings: candidate.safetyRatings,
    tokenCount: candidate.tokenCount,
    citationMetadata: candidate.citationMetadata,
    groundingMetadata: candidate.groundingMetadata,
    groundingAttributions: candidate.groundingAttributions,
    urlRetrievalMetadata: candidate.urlRetrievalMetadata,
    urlContextMetadata: candidate.urlContextMetadata,
    avgLogprobs: candidate.avgLogprobs,
    logprobsResult: candidate.logprobsResult,
    originalTextContentBlock,
  };

  const response_metadata: Record<string, unknown> = {
    model_provider: "google",
    finish_reason: candidate.finishReason,
    safety_ratings: candidate.safetyRatings,
    citation_metadata: candidate.citationMetadata,
    grounding_metadata: candidate.groundingMetadata,
    grounding_attributions: candidate.groundingAttributions,
    url_retrieval_metadata: candidate.urlRetrievalMetadata,
    url_context_metadata: candidate.urlContextMetadata,
    avg_logprobs: candidate.avgLogprobs,
    logprobs_result: candidate.logprobsResult,

    // Backwards compatibility
    citationMetadata,
    groundingMetadata,
    groundingSupport: groundingParts[0],
  };
  // Remove any undefined properties, so we don't include them
  for (const attribute in additional_kwargs) {
    if (additional_kwargs[attribute] === undefined) {
      delete additional_kwargs[attribute];
    }
  }
  for (const attribute in response_metadata) {
    if (response_metadata[attribute] === undefined) {
      delete response_metadata[attribute];
    }
  }

  return new AIMessage({
    content,
    tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
    additional_kwargs,
    response_metadata,
  });
};

export const convertAIMessageToText: Converter<AIMessage, string> = (
  message: AIMessage
): string => {
  if (typeof message.content === "string") {
    return message.content;
  } else if (Array.isArray(message.content)) {
    return message.content
      .filter(
        (c) => typeof c === "string" || (c as { type?: string }).type === "text"
      )
      .map((c) =>
        typeof c === "string" ? c : (c as { text?: string }).text || ""
      )
      .join("");
  } else {
    return "";
  }
};

export const convertGeminiGenerateContentResponseToUsageMetadata: Converter<
  Gemini.GenerateContentResponse,
  UsageMetadata
> = (data: Gemini.GenerateContentResponse): UsageMetadata => {
  function addModalityCounts(
    modalityTokenCounts: Gemini.ModalityTokenCount[] | undefined,
    details: InputTokenDetails | OutputTokenDetails
  ): void {
    modalityTokenCounts?.forEach((modalityTokenCount) => {
      const { modality, tokenCount } = modalityTokenCount;
      if (
        typeof modality === "undefined" ||
        typeof tokenCount === "undefined"
      ) {
        return;
      }
      const modalityLc: keyof ModalitiesTokenDetails =
        modality.toLowerCase() as keyof ModalitiesTokenDetails;
      const currentCount = details[modalityLc] ?? 0;
      details[modalityLc] = currentCount + tokenCount;
    });
  }

  const usageMetadata: Gemini.UsageMetadata | undefined = data.usageMetadata;

  const inputTokenCount = usageMetadata?.promptTokenCount ?? 0;
  const candidatesTokenCount = usageMetadata?.candidatesTokenCount ?? 0;
  const thoughtsTokenCount = usageMetadata?.thoughtsTokenCount ?? 0;
  const outputTokenCount = candidatesTokenCount + thoughtsTokenCount;
  const totalTokens =
    usageMetadata?.totalTokenCount ?? inputTokenCount + outputTokenCount;

  const input_token_details: InputTokenDetails = {};
  addModalityCounts(usageMetadata?.promptTokensDetails, input_token_details);
  input_token_details.cache_read = usageMetadata?.cachedContentTokenCount ?? 0;

  const output_token_details: OutputTokenDetails = {};
  addModalityCounts(
    usageMetadata?.candidatesTokensDetails,
    output_token_details
  );
  output_token_details.reasoning = usageMetadata?.thoughtsTokenCount ?? 0;

  return {
    input_tokens: inputTokenCount,
    output_tokens: outputTokenCount,
    total_tokens: totalTokens,
    input_token_details,
    output_token_details,
  };
};
