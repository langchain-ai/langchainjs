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
  type Data, UsageMetadata, InputTokenDetails, OutputTokenDetails, ModalitiesTokenDetails,
} from "@langchain/core/messages";
import { Converter } from "@langchain/core/utils/format";
import {
  GenerateContentRequest,
  GeminiContent,
  GeminiPart,
  GeminiCandidate,
  GeminiRole, GenerateContentResponse, GeminiUsageMetadata, GeminiModalityTokenCount,
} from "../chat_models/types.js";
import { iife } from "../utils/misc.js";
import { ToolCallNotFoundError } from "../utils/errors.js";

/**
 * Standard content block converter for Google Gemini API.
 * Converts deprecated Data content blocks to Gemini Part format.
 *
 * @deprecated This converter is for backward compatibility with older message formats.
 * Use ContentBlock.Multimodal.Standard instead.
 */
export const geminiContentBlockConverter: StandardContentBlockConverter<{
  text: GeminiPart;
  image: GeminiPart;
  audio: GeminiPart;
  file: GeminiPart;
}> = {
  providerName: "ChatGoogle",

  fromStandardTextBlock(block: Data.StandardTextBlock): GeminiPart {
    return { text: block.text };
  },

  fromStandardImageBlock(block: Data.StandardImageBlock): GeminiPart {
    if (isDataContentBlock(block)) {
      if (block.source_type === "base64") {
        if (!block.mime_type) {
          throw new Error("mime_type is required for base64 image blocks");
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

    throw new Error(
      `Image content blocks with source_type ${
        (block as Data.DataContentBlock).source_type
      } are not supported for ChatGoogle`
    );
  },

  fromStandardAudioBlock(block: Data.StandardAudioBlock): GeminiPart {
    if (isDataContentBlock(block)) {
      if (block.source_type === "base64") {
        if (!block.mime_type) {
          throw new Error("mime_type is required for base64 audio blocks");
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

    throw new Error(
      `Audio content blocks with source_type ${
        (block as Data.DataContentBlock).source_type
      } are not supported for ChatGoogle`
    );
  },

  fromStandardFileBlock(block: Data.StandardFileBlock): GeminiPart {
    if (isDataContentBlock(block)) {
      if (block.source_type === "base64") {
        if (!block.mime_type) {
          throw new Error("mime_type is required for base64 file blocks");
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

    throw new Error(
      `File content blocks with source_type ${
        (block as Data.DataContentBlock).source_type
      } are not supported for ChatGoogle`
    );
  },
};

/**
 * Converts a single LangChain message with standard content blocks (v1 format) to Gemini Content.
 * This handles messages that have `response_metadata.output_version === "v1"`.
 *
 * This is intended to be called from `convertMessagesToGeminiContent`
 */
function convertStandardContentMessageToGeminiContent(
  message: BaseMessage
): GeminiContent | null {
  // Skip system messages - they're handled separately
  if (SystemMessage.isInstance(message)) {
    return null;
  }

  let role: GeminiRole;
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

  const parts: GeminiPart[] = [];

  // Process standard content blocks
  for (const block of message.contentBlocks) {
    if (block.type === "text") {
      parts.push({ text: block.text });
    }
  }

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
  messages: BaseMessage[],
): GeminiContent | null {
  // Skip system messages - they're handled separately
  if (SystemMessage.isInstance(message)) {
    return null;
  }

  const role: GeminiRole = iife(() => {
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

  let parts: GeminiPart[] = [];

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
        if (isDataContentBlock(item)) {
          parts.push(
            convertToProviderContentBlock(item, geminiContentBlockConverter)
          );
        } else if (item?.type === "functionCall") {
          // Skip this - it will be added later
        } else {
          parts.push(item as GeminiPart);
        }
      }
    }
  }

  // Handle tool calls by adding function call parts to the end of the parts array
  if (AIMessage.isInstance(message) && message.tool_calls?.length) {
    parts.push(
      ...message.tool_calls.map((toolCall) => ({
        functionCall: {
          name: toolCall.name,
          args: toolCall.args,
        },
      }))
    );
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
  GenerateContentRequest["contents"]
> = (messages) => {
  const contents: GeminiContent[] = [];

  for (const message of messages) {
    // const content: GeminiContent | null = convertContentMessageToGeminiContent(message, messages);
    const content: GeminiContent | null = iife(() => {
      const outputVersion = "output_version" in message.response_metadata
        ? message.response_metadata?.output_version as string
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
  GenerateContentRequest["systemInstruction"]
> = (messages) => {
  const systemParts: GeminiPart[] = [];

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
 * const candidate: GeminiCandidate = {
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
  GeminiCandidate,
  AIMessage
> = (candidate) => {
  const parts = candidate.content?.parts || [];

  // Extract tool calls from function call parts
  const toolCalls: ContentBlock.Tools.ToolCall<
    string,
    Record<string, unknown>
  >[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.functionCall) {
      toolCalls.push({
        type: "tool_call",
        id: `call_${toolCalls.length}`,
        name: part.functionCall.name,
        args: part.functionCall.args,
      });
    }
  }

  // Convert parts to content format that the translator understands
  // Format: array of objects with type field matching the part type
  let content: string | ContentBlock[];

  if (parts.length === 0) {
    content = "";
  } else if (parts.length === 1 && parts[0].text) {
    // Single text part - store as string for simplicity
    content = parts[0].text;
  } else {
    // Multiple parts - convert to array format with type fields
    content = parts.map((p) => {
      if ("text" in p && p.text) {
        return {
          type: "text",
          text: p.text,
        };
      } else if ("inlineData" in p && p.inlineData) {
        return {
          type: "inlineData",
          inlineData: p.inlineData,
        };
      } else if ("fileData" in p && p.fileData) {
        return {
          type: "fileData",
          fileData: p.fileData,
        };
      } else if ("functionCall" in p && p.functionCall) {
        return {
          type: "functionCall",
          functionCall: p.functionCall,
        };
      } else if ("functionResponse" in p && p.functionResponse) {
        return {
          type: "functionResponse",
          functionResponse: p.functionResponse,
        };
      } else if ("executableCode" in p && p.executableCode) {
        return {
          type: "executableCode",
          executableCode: p.executableCode,
        };
      } else if ("codeExecutionResult" in p && p.codeExecutionResult) {
        return {
          type: "codeExecutionResult",
          codeExecutionResult: p.codeExecutionResult,
        };
      }
      return p as ContentBlock;
    });
  }

  const additional_kwargs: Record<string, unknown> = {
    finishReason: candidate.finishReason,
    finishMessage: candidate.finishMessage,
    safetyRatings: candidate.safetyRatings,
    citationMetadata: candidate.citationMetadata,
    tokenCount: candidate.tokenCount,
  };

  const response_metadata: Record<string, unknown> = {
    model_provider: "google",
    finish_reason: candidate.finishReason,
    ...(candidate.safetyRatings && { safety_ratings: candidate.safetyRatings }),
    ...(candidate.citationMetadata && {
      citation_metadata: candidate.citationMetadata,
    }),
  };

  return new AIMessage({
    content,
    tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
    additional_kwargs,
    response_metadata,
  });
};

export const convertGeminiGenerateContentResponseToUsageMetadata: Converter<
  GenerateContentResponse,
  UsageMetadata
> = (data: GenerateContentResponse): UsageMetadata => {

  function addModalityCounts(
    modalityTokenCounts: GeminiModalityTokenCount[] | undefined,
    details: InputTokenDetails | OutputTokenDetails
  ): void {
    modalityTokenCounts?.forEach((modalityTokenCount) => {
      const { modality, tokenCount } = modalityTokenCount;
      const modalityLc: keyof ModalitiesTokenDetails =
        modality.toLowerCase() as keyof ModalitiesTokenDetails;
      const currentCount = details[modalityLc] ?? 0;
      details[modalityLc] = currentCount + tokenCount;
    });
  }

  const usageMetadata: GeminiUsageMetadata | undefined = data.usageMetadata;

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
}