import type Anthropic from "@anthropic-ai/sdk";
import {
  parseBase64DataUrl,
  type StandardContentBlockConverter,
} from "@langchain/core/messages";

export const standardContentBlockConverter: StandardContentBlockConverter<{
  text: Anthropic.Messages.TextBlockParam;
  image: Anthropic.Messages.ImageBlockParam;
  file: Anthropic.Messages.DocumentBlockParam;
}> = {
  providerName: "anthropic",

  fromStandardTextBlock(block): Anthropic.Messages.TextBlockParam {
    return {
      type: "text",
      text: block.text,
      ...("citations" in (block.metadata ?? {})
        ? { citations: block.metadata!.citations }
        : {}),
      ...("cache_control" in (block.metadata ?? {})
        ? { cache_control: block.metadata!.cache_control }
        : {}),
    } as Anthropic.Messages.TextBlockParam;
  },

  fromStandardImageBlock(block): Anthropic.Messages.ImageBlockParam {
    if (block.source_type === "url") {
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
        } as Anthropic.Messages.ImageBlockParam;
      } else {
        return {
          type: "image",
          source: {
            type: "url",
            url: block.url,
            media_type: block.mime_type ?? "",
          },
          ...("cache_control" in (block.metadata ?? {})
            ? { cache_control: block.metadata!.cache_control }
            : {}),
        } as Anthropic.Messages.ImageBlockParam;
      }
    } else {
      if (block.source_type === "base64") {
        return {
          type: "image",
          source: {
            type: "base64",
            data: block.data,
            media_type: block.mime_type ?? "",
          },
          ...("cache_control" in (block.metadata ?? {})
            ? { cache_control: block.metadata!.cache_control }
            : {}),
        } as Anthropic.Messages.ImageBlockParam;
      } else {
        throw new Error(`Unsupported image source type: ${block.source_type}`);
      }
    }
  },

  fromStandardFileBlock(block): Anthropic.Messages.DocumentBlockParam {
    const mime_type = (block.mime_type ?? "").split(";")[0];

    if (block.source_type === "url") {
      if (mime_type === "application/pdf" || mime_type === "") {
        return {
          type: "document",
          source: {
            type: "url",
            url: block.url,
            media_type: block.mime_type ?? "",
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
        } as Anthropic.Messages.DocumentBlockParam;
      }
      throw new Error(
        `Unsupported file mime type for file url source: ${block.mime_type}`
      );
    } else if (block.source_type === "text") {
      if (mime_type === "text/plain" || mime_type === "") {
        return {
          type: "document",
          source: {
            type: "text",
            data: block.text,
            media_type: block.mime_type ?? "",
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
        } as Anthropic.Messages.DocumentBlockParam;
      } else {
        throw new Error(
          `Unsupported file mime type for file text source: ${block.mime_type}`
        );
      }
    } else if (block.source_type === "base64") {
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
        } as Anthropic.Messages.DocumentBlockParam;
      } else if (
        ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(
          mime_type
        )
      ) {
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
        } as Anthropic.Messages.DocumentBlockParam;
      } else {
        throw new Error(
          `Unsupported file mime type for file base64 source: ${block.mime_type}`
        );
      }
    } else {
      throw new Error(`Unsupported file source type: ${block.source_type}`);
    }
  },
};
