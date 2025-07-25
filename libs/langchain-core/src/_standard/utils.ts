import { ProviderFormatTypes } from "../messages/content_blocks.js";
import { ContentBlock } from "./content/index.js";

/**
 * Utility interface for converting between standard and provider-specific data content blocks, to be
 * used when implementing chat model providers.
 *
 * Meant to be used with {@link convertToProviderContentBlock} and
 * {@link convertToStandardContentBlock} rather than being consumed directly.
 */
export interface StandardContentBlockConverter<
  Formats extends Partial<ProviderFormatTypes>
> {
  /**
   * The name of the provider type that corresponds to the provider-specific content block types
   * that this converter supports.
   */
  providerName: string;

  /**
   * Convert from a standard image block to a provider's proprietary image block format.
   * @param block - The standard image block to convert.
   * @returns The provider image block.
   */
  fromStandardImageBlock?(
    block: ContentBlock.Multimodal.Image
  ): Formats["image"];

  /**
   * Convert from a standard audio block to a provider's proprietary audio block format.
   * @param block - The standard audio block to convert.
   * @returns The provider audio block.
   */
  fromStandardAudioBlock?(
    block: ContentBlock.Multimodal.Audio
  ): Formats["audio"];

  /**
   * Convert from a standard video block to a provider's proprietary video block format.
   * @param block - The standard video block to convert.
   * @returns The provider video block.
   */
  fromStandardVideoBlock?(
    block: ContentBlock.Multimodal.Video
  ): Formats["video"];

  /**
   * Convert from a standard file block to a provider's proprietary file block format.
   * @param block - The standard file block to convert.
   * @returns The provider file block.
   */
  fromStandardFileBlock?(block: ContentBlock.Multimodal.File): Formats["file"];

  /**
   * Convert from a standard text block to a provider's proprietary text block format.
   * @param block - The standard text block to convert.
   * @returns The provider text block.
   */
  fromStandardTextBlock?(
    block: ContentBlock.Multimodal.PlainText
  ): Formats["text"];
}

/**
 * Convert from a standard data content block to a provider's proprietary data content block format.
 *
 * Don't override this method. Instead, override the more specific conversion methods and use this
 * method unmodified.
 *
 * @param block - The standard data content block to convert.
 * @returns The provider data content block.
 * @throws An error if the standard data content block type is not supported.
 */
export function convertToProviderContentBlock<
  Formats extends Partial<ProviderFormatTypes>
>(
  block: ContentBlock.Multimodal.ContentBlock,
  converter: StandardContentBlockConverter<Formats>
): Formats[keyof Formats] {
  if (block.type === "text-plain") {
    if (!converter.fromStandardTextBlock) {
      throw new Error(
        `Converter for ${converter.providerName} does not implement \`fromStandardTextBlock\` method.`
      );
    }
    return converter.fromStandardTextBlock(
      block as ContentBlock.Multimodal.PlainText
    );
  }
  if (block.type === "image") {
    if (!converter.fromStandardImageBlock) {
      throw new Error(
        `Converter for ${converter.providerName} does not implement \`fromStandardImageBlock\` method.`
      );
    }
    return converter.fromStandardImageBlock(
      block as ContentBlock.Multimodal.Image
    );
  }
  if (block.type === "audio") {
    if (!converter.fromStandardAudioBlock) {
      throw new Error(
        `Converter for ${converter.providerName} does not implement \`fromStandardAudioBlock\` method.`
      );
    }
    return converter.fromStandardAudioBlock(
      block as ContentBlock.Multimodal.Audio
    );
  }
  if (block.type === "video") {
    if (!converter.fromStandardVideoBlock) {
      throw new Error(
        `Converter for ${converter.providerName} does not implement \`fromStandardVideoBlock\` method.`
      );
    }
    return converter.fromStandardVideoBlock(
      block as ContentBlock.Multimodal.Video
    );
  }
  if (block.type === "file") {
    if (!converter.fromStandardFileBlock) {
      throw new Error(
        `Converter for ${converter.providerName} does not implement \`fromStandardFileBlock\` method.`
      );
    }
    return converter.fromStandardFileBlock(
      block as ContentBlock.Multimodal.File
    );
  }
  throw new Error(
    `Unable to convert content block type '${
      (block as { type?: string }).type || "unknown"
    }' to provider-specific format: not recognized.`
  );
}
