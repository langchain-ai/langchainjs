import { ContentChunk as MistralAIContentChunk } from "@mistralai/mistralai/models/components/contentchunk.js";
import { MessageContentComplex } from "@langchain/core/messages";

// Mistral enforces a specific pattern for tool call IDs
const TOOL_CALL_ID_PATTERN = /^[a-zA-Z0-9]{9}$/;

export function _isValidMistralToolCallId(toolCallId: string): boolean {
  return TOOL_CALL_ID_PATTERN.test(toolCallId);
}

function _base62Encode(num: number): string {
  let numCopy = num;
  const base62 =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (numCopy === 0) return base62[0];
  const arr: string[] = [];
  const base = base62.length;
  while (numCopy) {
    arr.push(base62[numCopy % base]);
    numCopy = Math.floor(numCopy / base);
  }
  return arr.reverse().join("");
}

function _simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash &= hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

export function _convertToolCallIdToMistralCompatible(
  toolCallId: string
): string {
  if (_isValidMistralToolCallId(toolCallId)) {
    return toolCallId;
  } else {
    const hash = _simpleHash(toolCallId);
    const base62Str = _base62Encode(hash);
    if (base62Str.length >= 9) {
      return base62Str.slice(0, 9);
    } else {
      return base62Str.padStart(9, "0");
    }
  }
}

export function _mistralContentChunkToMessageContentComplex(
  content: string | MistralAIContentChunk[] | null | undefined
): string | MessageContentComplex[] {
  if (!content) {
    return "";
  }
  if (typeof content === "string") {
    return content;
  }
  return content.map((contentChunk) => {
    // Only Mistral ImageURLChunks need conversion to MessageContentComplex
    if (contentChunk.type === "image_url") {
      if (
        typeof contentChunk.imageUrl !== "string" &&
        contentChunk.imageUrl?.detail
      ) {
        const { detail } = contentChunk.imageUrl;
        // Mistral detail can be any string, but MessageContentComplex only supports
        // detail to be "high", "auto", or "low"
        if (detail !== "high" && detail !== "auto" && detail !== "low") {
          return {
            type: contentChunk.type,
            image_url: {
              url: contentChunk.imageUrl.url,
            },
          };
        }
      }
      return {
        type: contentChunk.type,
        image_url: contentChunk.imageUrl,
      };
    }
    return contentChunk;
  });
}
