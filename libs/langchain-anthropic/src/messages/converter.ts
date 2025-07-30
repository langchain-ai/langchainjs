import { v1, parseBase64DataUrl } from "@langchain/core/messages";
import type {
  AnthropicTextBlockParam,
  AnthropicImageBlockParam,
  AnthropicDocumentBlockParam,
} from "../types";

const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export const contentBlockConverter: v1.StandardContentBlockConverter<{
  text: AnthropicTextBlockParam;
  image: AnthropicImageBlockParam;
  file: AnthropicDocumentBlockParam;
}> = {
  providerName: "anthropic",

  fromStandardTextBlock(
    block: v1.ContentBlock.Multimodal.PlainText
  ): AnthropicTextBlockParam {
    return {
      type: "text",
      text: block.text,
      ...("citations" in (block.metadata ?? {})
        ? { citations: block.metadata!.citations }
        : {}),
      ...("cache_control" in (block.metadata ?? {})
        ? { cache_control: block.metadata!.cache_control }
        : {}),
    } as AnthropicTextBlockParam;
  },

  fromStandardImageBlock(
    block: v1.ContentBlock.Multimodal.Image
  ): AnthropicImageBlockParam {
    if (typeof block.url === "string") {
      const data = parseBase64DataUrl({
        dataUrl: block.url,
        asTypedArray: false,
      });
      if (data) {
        return {
          type: "image",
          source: {
            type: "base64",
            data: data.data,
            media_type: data.mime_type,
          },
          ...("cache_control" in (block.metadata ?? {})
            ? { cache_control: block.metadata!.cache_control }
            : {}),
        } as AnthropicImageBlockParam;
      }
      return {
        type: "image",
        source: {
          type: "url",
          url: block.url,
          media_type: block.mimeType ?? "",
        },
        ...("cache_control" in (block.metadata ?? {})
          ? { cache_control: block.metadata!.cache_control }
          : {}),
      } as AnthropicImageBlockParam;
    }

    if (typeof block.data === "string") {
      return {
        type: "image",
        source: {
          type: "base64",
          data: block.data,
          media_type: block.mimeType ?? "",
        },
        ...("cache_control" in (block.metadata ?? {})
          ? { cache_control: block.metadata!.cache_control }
          : {}),
      } as AnthropicImageBlockParam;
    }

    if (typeof block.data === "object") {
      throw new Error(`Uint8Array as data is not yet supported`);
    }

    throw new Error(`Unsupported image source type: ${block.type}`);
  },

  fromStandardFileBlock(
    block: v1.ContentBlock.Multimodal.File
  ): AnthropicDocumentBlockParam {
    const mime_type = (block.mimeType ?? "").split(";")[0];

    if (typeof block.url === "string") {
      if (mime_type === "application/pdf" || mime_type === "") {
        return {
          type: "document",
          source: {
            type: "url",
            url: block.url,
            media_type: block.mimeType ?? "",
          },
          ...("cache_control" in (block.metadata ?? {})
            ? { cache_control: block.metadata!.cache_control }
            : {}),
          ...("citations" in (block.metadata ?? {})
            ? { citations: block.metadata!.citations }
            : {}),
          ...("context" in (block.metadata ?? {})
            ? { context: block.metadata!.context }
            : {}),
          ...("title" in (block.metadata ?? {})
            ? { title: block.metadata!.title }
            : {}),
        } as AnthropicDocumentBlockParam;
      }
      throw new Error(
        `Unsupported file mime type for file url source: ${
          block.mimeType || "unknown mime type"
        }`
      );
    }

    if (typeof block.data === "string") {
      if (mime_type === "text/plain" || mime_type === "") {
        return {
          type: "document",
          source: {
            type: "text",
            data: block.data,
            media_type: block.mimeType ?? "",
          },
          ...("cache_control" in (block.metadata ?? {})
            ? { cache_control: block.metadata!.cache_control }
            : {}),
          ...("citations" in (block.metadata ?? {})
            ? { citations: block.metadata!.citations }
            : {}),
          ...("context" in (block.metadata ?? {})
            ? { context: block.metadata!.context }
            : {}),
          ...("title" in (block.metadata ?? {})
            ? { title: block.metadata!.title }
            : {}),
        } as AnthropicDocumentBlockParam;
      } else {
        throw new Error(
          `Unsupported file mime type for file text source: ${
            block.mimeType || "unknown mime type"
          }`
        );
      }
    }

    if (v1.isMultimodalBase64ContentBlock(block)) {
      if (mime_type === "application/pdf" || mime_type === "") {
        return {
          type: "document",
          source: {
            type: "base64",
            data: block.data,
            media_type: "application/pdf",
          },
          ...("cache_control" in (block.metadata ?? {})
            ? { cache_control: block.metadata!.cache_control }
            : {}),
          ...("citations" in (block.metadata ?? {})
            ? { citations: block.metadata!.citations }
            : {}),
          ...("context" in (block.metadata ?? {})
            ? { context: block.metadata!.context }
            : {}),
          ...("title" in (block.metadata ?? {})
            ? { title: block.metadata!.title }
            : {}),
        } as AnthropicDocumentBlockParam;
      }

      if (IMAGE_MIME_TYPES.includes(mime_type)) {
        return {
          type: "document",
          source: {
            type: "content",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  data: block.data,
                  media_type: mime_type as
                    | "image/jpeg"
                    | "image/png"
                    | "image/gif"
                    | "image/webp",
                },
              },
            ],
          },
          ...("cache_control" in (block.metadata ?? {})
            ? { cache_control: block.metadata!.cache_control }
            : {}),
          ...("citations" in (block.metadata ?? {})
            ? { citations: block.metadata!.citations }
            : {}),
          ...("context" in (block.metadata ?? {})
            ? { context: block.metadata!.context }
            : {}),
          ...("title" in (block.metadata ?? {})
            ? { title: block.metadata!.title }
            : {}),
        } as AnthropicDocumentBlockParam;
      } else {
        throw new Error(
          `Unsupported file mime type for file base64 source: ${
            block.mimeType || "unknown mime type"
          }`
        );
      }
    } else {
      throw new Error(`Unsupported file source type: ${block.type}`);
    }
  },
};
