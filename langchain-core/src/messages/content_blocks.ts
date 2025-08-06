export interface BaseDataContentBlock {
  mime_type?: string;
  metadata?: Record<string, unknown>;
}

export interface URLContentBlock extends BaseDataContentBlock {
  type: "image" | "audio" | "file";
  source_type: "url";
  url: string;
}

export interface Base64ContentBlock extends BaseDataContentBlock {
  type: "image" | "audio" | "file";
  source_type: "base64";
  data: string;
}

export interface PlainTextContentBlock extends BaseDataContentBlock {
  type: "file" | "text";
  source_type: "text";
  text: string;
}

export interface IDContentBlock extends BaseDataContentBlock {
  type: "image" | "audio" | "file";
  source_type: "id";
  id: string;
}

export type DataContentBlock =
  | URLContentBlock
  | Base64ContentBlock
  | PlainTextContentBlock
  | IDContentBlock;

export type StandardImageBlock = (
  | URLContentBlock
  | Base64ContentBlock
  | IDContentBlock
) & {
  type: "image";
};

export type StandardAudioBlock = (
  | URLContentBlock
  | Base64ContentBlock
  | IDContentBlock
) & {
  type: "audio";
};

export type StandardFileBlock = (
  | URLContentBlock
  | Base64ContentBlock
  | IDContentBlock
  | PlainTextContentBlock
) & {
  type: "file";
};

export type StandardTextBlock = PlainTextContentBlock & {
  type: "text";
};

export type DataContentBlockType = DataContentBlock["type"];

export function isDataContentBlock(
  content_block: object
): content_block is DataContentBlock {
  return (
    typeof content_block === "object" &&
    content_block !== null &&
    "type" in content_block &&
    typeof content_block.type === "string" &&
    "source_type" in content_block &&
    (content_block.source_type === "url" ||
      content_block.source_type === "base64" ||
      content_block.source_type === "text" ||
      content_block.source_type === "id")
  );
}

export function isURLContentBlock(
  content_block: object
): content_block is URLContentBlock {
  return (
    isDataContentBlock(content_block) &&
    content_block.source_type === "url" &&
    "url" in content_block &&
    typeof content_block.url === "string"
  );
}

export function isBase64ContentBlock(
  content_block: object
): content_block is Base64ContentBlock {
  return (
    isDataContentBlock(content_block) &&
    content_block.source_type === "base64" &&
    "data" in content_block &&
    typeof content_block.data === "string"
  );
}

export function isPlainTextContentBlock(
  content_block: object
): content_block is PlainTextContentBlock {
  return (
    isDataContentBlock(content_block) &&
    content_block.source_type === "text" &&
    "text" in content_block &&
    typeof content_block.text === "string"
  );
}

export function isIDContentBlock(
  content_block: object
): content_block is IDContentBlock {
  return (
    isDataContentBlock(content_block) &&
    content_block.source_type === "id" &&
    "id" in content_block &&
    typeof content_block.id === "string"
  );
}

export function convertToOpenAIImageBlock(
  content_block: URLContentBlock | Base64ContentBlock
) {
  if (isDataContentBlock(content_block)) {
    if (content_block.source_type === "url") {
      return {
        type: "image_url",
        image_url: {
          url: content_block.url,
        },
      };
    }
    if (content_block.source_type === "base64") {
      if (!content_block.mime_type) {
        throw new Error("mime_type key is required for base64 data.");
      }
      const mime_type = content_block.mime_type;
      return {
        type: "image_url",
        image_url: {
          url: `data:${mime_type};base64,${content_block.data}`,
        },
      };
    }
  }
  throw new Error(
    "Unsupported source type. Only 'url' and 'base64' are supported."
  );
}

/**
 * Utility function for ChatModelProviders. Parses a mime type into a type, subtype, and parameters.
 *
 * @param mime_type - The mime type to parse.
 * @returns An object containing the type, subtype, and parameters.
 */
export function parseMimeType(mime_type: string): {
  type: string;
  subtype: string;
  parameters: Record<string, string>;
} {
  const parts = mime_type.split(";")[0].split("/");
  if (parts.length !== 2) {
    throw new Error(
      `Invalid mime type: "${mime_type}" - does not match type/subtype format.`
    );
  }

  const type = parts[0].trim();
  const subtype = parts[1].trim();

  if (type === "" || subtype === "") {
    throw new Error(
      `Invalid mime type: "${mime_type}" - type or subtype is empty.`
    );
  }

  const parameters: Record<string, string> = {};

  for (const parameterKvp of mime_type.split(";").slice(1)) {
    const parameterParts = parameterKvp.split("=");
    if (parameterParts.length !== 2) {
      throw new Error(`Invalid parameter syntax in mime type: "${mime_type}".`);
    }
    const key = parameterParts[0].trim();
    const value = parameterParts[1].trim();
    if (key === "") {
      throw new Error(`Invalid parameter syntax in mime type: "${mime_type}".`);
    }

    parameters[key] = value;
  }

  return {
    type,
    subtype,
    parameters,
  };
}

/**
 * Utility function for ChatModelProviders. Parses a base64 data URL into a typed array or string.
 *
 * @param dataUrl - The base64 data URL to parse.
 * @param asTypedArray - Whether to return the data as a typed array.
 * @returns An object containing the parsed data and mime type, or undefined if the data URL is invalid.
 */
export function parseBase64DataUrl({
  dataUrl,
  asTypedArray,
}: {
  dataUrl: string;
  asTypedArray: true;
}): { data: Uint8Array; mime_type: string } | undefined;

/**
 * Utility function for ChatModelProviders. Parses a base64 data URL into a typed array or string.
 *
 * @param dataUrl - The base64 data URL to parse.
 * @param asTypedArray - Whether to return the data as a typed array.
 * @returns The parsed data and mime type, or undefined if the data URL is invalid.
 */
export function parseBase64DataUrl({
  dataUrl,
  asTypedArray,
}: {
  dataUrl: string;
  asTypedArray?: false;
}): { data: string; mime_type: string } | undefined;

/**
 * Utility function for ChatModelProviders. Parses a base64 data URL into a typed array or string.
 *
 * @param dataUrl - The base64 data URL to parse.
 * @param asTypedArray - Whether to return the data as a typed array.
 * @returns The parsed data and mime type, or undefined if the data URL is invalid.
 */
export function parseBase64DataUrl({
  dataUrl: data_url,
  asTypedArray = false,
}: {
  dataUrl: string;
  asTypedArray?: boolean;
}): { data: string | Uint8Array; mime_type: string } | undefined {
  const formatMatch = data_url.match(
    /^data:(\w+\/\w+);base64,([A-Za-z0-9+/]+=*)$/
  );
  let mime_type: string | undefined;

  if (formatMatch) {
    mime_type = formatMatch[1].toLowerCase();
    const data = asTypedArray
      ? Uint8Array.from(atob(formatMatch[2]), (c) => c.charCodeAt(0))
      : formatMatch[2];
    return {
      mime_type,
      data,
    };
  }

  return undefined;
}

/**
 * A bag of provider-specific content block types.
 *
 * Allows implementations of {@link StandardContentBlockConverter} and related to be defined only in
 * terms of the types they support. Also allows for forward compatibility as the set of known
 * standard types grows, as the set of types can be extended without breaking existing
 * implementations of the aforementioned interfaces.
 */
export type ProviderFormatTypes<
  TextFormat = unknown,
  ImageFormat = unknown,
  AudioFormat = unknown,
  FileFormat = unknown
> = {
  text: TextFormat;
  image: ImageFormat;
  audio: AudioFormat;
  file: FileFormat;
};

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
  fromStandardImageBlock?(block: StandardImageBlock): Formats["image"];

  /**
   * Convert from a standard audio block to a provider's proprietary audio block format.
   * @param block - The standard audio block to convert.
   * @returns The provider audio block.
   */
  fromStandardAudioBlock?(block: StandardAudioBlock): Formats["audio"];

  /**
   * Convert from a standard file block to a provider's proprietary file block format.
   * @param block - The standard file block to convert.
   * @returns The provider file block.
   */
  fromStandardFileBlock?(block: StandardFileBlock): Formats["file"];

  /**
   * Convert from a standard text block to a provider's proprietary text block format.
   * @param block - The standard text block to convert.
   * @returns The provider text block.
   */
  fromStandardTextBlock?(block: StandardTextBlock): Formats["text"];
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
  block: DataContentBlock,
  converter: StandardContentBlockConverter<Formats>
): Formats[keyof Formats] {
  if (block.type === "text") {
    if (!converter.fromStandardTextBlock) {
      throw new Error(
        `Converter for ${converter.providerName} does not implement \`fromStandardTextBlock\` method.`
      );
    }
    return converter.fromStandardTextBlock(block as StandardTextBlock);
  }
  if (block.type === "image") {
    if (!converter.fromStandardImageBlock) {
      throw new Error(
        `Converter for ${converter.providerName} does not implement \`fromStandardImageBlock\` method.`
      );
    }
    return converter.fromStandardImageBlock(block as StandardImageBlock);
  }
  if (block.type === "audio") {
    if (!converter.fromStandardAudioBlock) {
      throw new Error(
        `Converter for ${converter.providerName} does not implement \`fromStandardAudioBlock\` method.`
      );
    }
    return converter.fromStandardAudioBlock(block as StandardAudioBlock);
  }
  if (block.type === "file") {
    if (!converter.fromStandardFileBlock) {
      throw new Error(
        `Converter for ${converter.providerName} does not implement \`fromStandardFileBlock\` method.`
      );
    }
    return converter.fromStandardFileBlock(block as StandardFileBlock);
  }
  throw new Error(
    `Unable to convert content block type '${block.type}' to provider-specific format: not recognized.`
  );
}
