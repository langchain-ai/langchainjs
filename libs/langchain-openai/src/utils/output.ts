import {
  StandardImageBlock,
  StandardTextBlock,
} from "@langchain/core/messages";

/**
 * Handle multi modal response content.
 *
 * @param content The content of the message.
 * @param messages The messages of the response.
 * @returns The new content of the message.
 */
export function handleMultiModalOutput(
  content: string,
  messages: unknown
): (StandardImageBlock | StandardTextBlock)[] | string {
  /**
   * Handle OpenRouter image responses
   * @see https://openrouter.ai/docs/features/multimodal/image-generation#api-usage
   */
  if (
    messages &&
    typeof messages === "object" &&
    "images" in messages &&
    Array.isArray(messages.images)
  ) {
    const images = messages.images
      .filter((image) => typeof image?.image_url?.url === "string")
      .map(
        (image) =>
          ({
            type: "image",
            url: image.image_url.url as string,
            source_type: "url",
          } as const)
      );
    return [{ type: "text", text: content, source_type: "text" }, ...images];
  }

  return content;
}
