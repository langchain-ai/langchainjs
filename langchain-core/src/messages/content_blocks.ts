export interface BaseDataContentBlock {
  mime_type?: string;
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
  type: "file";
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

export function isDataContentBlock(
  content_block: object
): content_block is DataContentBlock {
  return (
    typeof content_block === "object" &&
    content_block !== null &&
    "source_type" in content_block &&
    (content_block.source_type === "url" ||
      content_block.source_type === "base64" ||
      content_block.source_type === "text" ||
      content_block.source_type === "id")
  );
}

export function convertToOpenAIImageBlock(
  content_block: object
): Record<string, unknown> {
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
