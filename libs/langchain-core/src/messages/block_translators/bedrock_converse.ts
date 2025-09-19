import { AIMessage } from "../ai.js";
import { ContentBlock } from "../content/index.js";
import { KNOWN_BLOCK_TYPES } from "../content/tools.js";
import type { StandardContentBlockTranslator } from "./index.js";
import {
  _isArray,
  _isBytesArray,
  _isContentBlock,
  _isNumber,
  _isObject,
  _isString,
  iife,
} from "./utils.js";

function convertFileFormatToMimeType(format: string): string {
  switch (format) {
    // DocumentBlock
    case "csv":
      return "text/csv";
    case "doc":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "html":
      return "text/html";
    case "md":
      return "text/markdown";
    case "pdf":
      return "application/pdf";
    case "txt":
      return "text/plain";
    case "xls":
      return "application/vnd.ms-excel";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    // ImageBlock
    case "gif":
      return "image/gif";
    case "jpeg":
      return "image/jpeg";
    case "jpg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    // VideoBlock
    case "flv":
      return "video/flv";
    case "mkv":
      return "video/mkv";
    case "mov":
      return "video/mov";
    case "mp4":
      return "video/mp4";
    case "mpeg":
      return "video/mpeg";
    case "mpg":
      return "video/mpg";
    case "three_gp":
      return "video/three_gp";
    case "webm":
      return "video/webm";
    case "wmv":
      return "video/wmv";
    default:
      return "application/octet-stream";
  }
}

function convertConverseDocumentBlock(
  block: ContentBlock
): ContentBlock.Standard {
  if (_isObject(block.document) && _isObject(block.document.source)) {
    const format =
      _isObject(block.document) && _isString(block.document.format)
        ? block.document.format
        : "";
    const mimeType = convertFileFormatToMimeType(format);

    if (_isObject(block.document.source)) {
      if (
        _isObject(block.document.source.s3Location) &&
        _isString(block.document.source.s3Location.uri)
      ) {
        return {
          type: "file",
          mimeType,
          url: block.document.source.s3Location.uri,
        };
      }
      if (_isBytesArray(block.document.source.bytes)) {
        return {
          type: "file",
          mimeType,
          data: block.document.source.bytes,
        };
      }
      if (_isString(block.document.source.text)) {
        return {
          type: "file",
          mimeType,
          data: Buffer.from(block.document.source.text).toString("base64"),
        };
      }
      if (_isArray(block.document.source.content)) {
        const data = block.document.source.content.reduce(
          (acc: string, item) => {
            if (_isObject(item) && _isString(item.text)) {
              return acc + item.text;
            }
            return acc;
          },
          ""
        );
        return {
          type: "file",
          mimeType,
          data,
        };
      }
    }
  }
  return { type: "non_standard", value: block };
}

function convertConverseImageBlock(block: ContentBlock): ContentBlock.Standard {
  if (_isContentBlock(block, "image") && _isObject(block.image)) {
    const format =
      _isObject(block.image) && _isString(block.image.format)
        ? block.image.format
        : "";
    const mimeType = convertFileFormatToMimeType(format);

    if (_isObject(block.image.source)) {
      if (
        _isObject(block.image.source.s3Location) &&
        _isString(block.image.source.s3Location.uri)
      ) {
        return {
          type: "image",
          mimeType,
          url: block.image.source.s3Location.uri,
        };
      }
      if (_isBytesArray(block.image.source.bytes)) {
        return {
          type: "image",
          mimeType,
          data: block.image.source.bytes,
        };
      }
    }
  }
  return { type: "non_standard", value: block };
}

function convertConverseVideoBlock(block: ContentBlock): ContentBlock.Standard {
  if (_isContentBlock(block, "video") && _isObject(block.video)) {
    const format =
      _isObject(block.video) && _isString(block.video.format)
        ? block.video.format
        : "";
    const mimeType = convertFileFormatToMimeType(format);

    if (_isObject(block.video.source)) {
      if (
        _isObject(block.video.source.s3Location) &&
        _isString(block.video.source.s3Location.uri)
      ) {
        return {
          type: "video",
          mimeType,
          url: block.video.source.s3Location.uri,
        };
      }
      if (_isBytesArray(block.video.source.bytes)) {
        return {
          type: "video",
          mimeType,
          data: block.video.source.bytes,
        };
      }
    }
  }
  return { type: "non_standard", value: block };
}

export function convertToV1FromChatBedrockConverseInput(
  message: AIMessage
): Array<ContentBlock.Standard> {
  function* iterateContent(): Iterable<ContentBlock.Standard> {
    const content =
      typeof message.content === "string"
        ? [{ type: "text", text: message.content }]
        : message.content;
    const blocks = content.map((block) => {
      if (_isContentBlock(block, "non_standard") && "value" in block) {
        return block.value as ContentBlock;
      }
      return block;
    });
    for (const block of blocks) {
      if (_isContentBlock(block, "text") && _isString(block.text)) {
        yield { type: "text", text: block.text };
        continue;
      } else if (
        _isContentBlock(block, "document") &&
        _isObject(block.document)
      ) {
        yield convertConverseDocumentBlock(block);
        continue;
      } else if (_isContentBlock(block, "image") && _isObject(block.image)) {
        yield convertConverseImageBlock(block);
        continue;
      } else if (_isContentBlock(block, "video") && _isObject(block.video)) {
        yield convertConverseVideoBlock(block);
        continue;
      }
      if (KNOWN_BLOCK_TYPES.includes(block.type)) {
        yield block as ContentBlock.Standard;
      } else {
        yield { type: "non_standard", value: block };
      }
    }
  }
  return Array.from(iterateContent());
}

function convertToV1FromChatBedrockConverseMessage(
  message: AIMessage
): Array<ContentBlock.Standard> {
  // see `/libs/providers/langchain-aws/src/utils/message_outputs.ts:convertConverseMessageToLangChainMessage`
  function* iterateContent(): Iterable<ContentBlock.Standard> {
    const content =
      typeof message.content === "string"
        ? [{ type: "text", text: message.content }]
        : message.content;
    for (const block of content) {
      if (_isContentBlock(block, "cache_point")) {
        yield { type: "non_standard", value: block };
        continue;
      } else if (
        _isContentBlock(block, "citations_content") &&
        _isObject(block.citationsContent)
      ) {
        const text = _isArray(block.citationsContent.content)
          ? block.citationsContent.content.reduce((acc: string, item) => {
              if (_isObject(item) && _isString(item.text)) {
                return acc + item.text;
              }
              return acc;
            }, "")
          : "";
        const annotations = _isArray(block.citationsContent.citations)
          ? block.citationsContent.citations.reduce(
              (acc: Array<ContentBlock.Citation>, item) => {
                if (_isObject(item)) {
                  const citedText = _isArray(item.sourceContent)
                    ? item.sourceContent.reduce((acc: string, item) => {
                        if (_isObject(item) && _isString(item.text)) {
                          return acc + item.text;
                        }
                        return acc;
                      }, "")
                    : "";
                  const properties = iife(() => {
                    if (_isObject(item.location)) {
                      const location =
                        item.location.documentChar ||
                        item.location.documentPage ||
                        item.location.documentChunk;
                      if (_isObject(location)) {
                        return {
                          source: _isNumber(location.documentIndex)
                            ? location.documentIndex.toString()
                            : undefined,
                          startIndex: _isNumber(location.start)
                            ? location.start
                            : undefined,
                          endIndex: _isNumber(location.end)
                            ? location.end
                            : undefined,
                        };
                      }
                    }
                    return {};
                  });
                  acc.push({ type: "citation", citedText, ...properties });
                }
                return acc;
              },
              []
            )
          : [];
        yield { type: "text", text, annotations };
        continue;
      } else if (
        _isContentBlock(block, "document") &&
        _isObject(block.document)
      ) {
        yield convertConverseDocumentBlock(block);
        continue;
      } else if (_isContentBlock(block, "guard_content")) {
        yield {
          type: "non_standard",
          value: { guardContent: block.guardContent },
        };
        continue;
      } else if (_isContentBlock(block, "image") && _isObject(block.image)) {
        yield convertConverseImageBlock(block);
        continue;
      } else if (
        _isContentBlock(block, "reasoning_content") &&
        _isString(block.reasoningText)
      ) {
        yield {
          type: "reasoning",
          reasoning: block.reasoningText,
        };
        continue;
      } else if (_isContentBlock(block, "text") && _isString(block.text)) {
        yield { type: "text", text: block.text };
        continue;
      } else if (_isContentBlock(block, "tool_result")) {
        yield { type: "non_standard", value: block };
        continue;
      } else if (_isContentBlock(block, "tool_call")) {
        // no-op - filtered to tools
        continue;
      } else if (_isContentBlock(block, "video") && _isObject(block.video)) {
        yield convertConverseVideoBlock(block);
        continue;
      }
      yield { type: "non_standard", value: block };
    }
  }
  return Array.from(iterateContent());
}

export const ChatBedrockConverseTranslator: StandardContentBlockTranslator = {
  translateContent: convertToV1FromChatBedrockConverseMessage,
  translateContentChunk: convertToV1FromChatBedrockConverseMessage,
};
