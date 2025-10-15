import { type ContentBlock } from "@langchain/core/messages";

export type MessageContentUnknown = Record<string, unknown> & {
  type: string;
};

export type MessageContent = string | ContentBlock[];

export function isMessageContentText(obj: unknown): obj is ContentBlock.Text {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "type" in obj &&
    obj.type === "text" &&
    "text" in obj &&
    typeof obj.text === "string"
  );
}

/**
 * Checks if an object is a valid MessageContentImageUrl which can be either a simple URL string
 * or an object with a `url` property. We assume that the `url` property is always a string
 */
function isMessageContentImageUrl(
  obj: unknown
): obj is ContentBlock.Data.URLContentBlock {
  if (
    typeof obj === "object" &&
    obj !== null &&
    "type" in obj &&
    obj.type === "image_url" &&
    "image_url" in obj
  ) {
    if (typeof obj.image_url === "string") {
      return true; // Simple URL string
    }
    if (
      typeof obj.image_url === "object" &&
      obj.image_url !== null &&
      "url" in obj.image_url &&
      typeof obj.image_url.url === "string"
    ) {
      return true; // Detailed object with a URL
    }
  }
  return false;
}

/**
 * Checks if an object is a valid ContentBlock object.
 */
export function isContentBlock(obj: unknown): obj is ContentBlock {
  if (
    typeof obj === "object" &&
    obj !== null &&
    "type" in obj &&
    typeof obj.type === "string"
  ) {
    return true;
  }
  // Check against the most specific types first
  if (isMessageContentText(obj) || isMessageContentImageUrl(obj)) {
    return true;
  }
  return false;
}
