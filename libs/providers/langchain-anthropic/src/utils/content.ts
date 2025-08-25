import type Anthropic from "@anthropic-ai/sdk";

export function _isAnthropicThinkingBlock(
  block: unknown
): block is Anthropic.Messages.ThinkingBlockParam {
  return (
    typeof block === "object" &&
    block !== null &&
    "type" in block &&
    block.type === "thinking"
  );
}

export function _isAnthropicRedactedThinkingBlock(
  block: unknown
): block is Anthropic.Messages.RedactedThinkingBlockParam {
  return (
    typeof block === "object" &&
    block !== null &&
    "type" in block &&
    block.type === "redacted_thinking"
  );
}

export function _isAnthropicSearchResultBlock(
  block: unknown
): block is Anthropic.Beta.BetaSearchResultBlockParam {
  return (
    typeof block === "object" &&
    block !== null &&
    "type" in block &&
    block.type === "search_result"
  );
}

export function _isAnthropicImageBlockParam(
  block: unknown
): block is Anthropic.Messages.ImageBlockParam {
  if (typeof block !== "object" || block == null) {
    return false;
  }
  if (!("type" in block) || block.type !== "image") {
    return false;
  }

  if (
    !("source" in block) ||
    typeof block.source !== "object" ||
    block.source == null
  ) {
    return false;
  }

  if (!("type" in block.source)) {
    return false;
  }

  if (block.source.type === "base64") {
    if (!("media_type" in block.source)) {
      return false;
    }

    if (typeof block.source.media_type !== "string") {
      return false;
    }

    if (!("data" in block.source)) {
      return false;
    }

    if (typeof block.source.data !== "string") {
      return false;
    }

    return true;
  }

  if (block.source.type === "url") {
    if (!("url" in block.source)) {
      return false;
    }

    if (typeof block.source.url !== "string") {
      return false;
    }

    return true;
  }

  return false;
}
