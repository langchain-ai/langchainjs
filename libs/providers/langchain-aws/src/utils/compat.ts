import { AIMessage, ContentBlock } from "@langchain/core/messages";
import type * as Bedrock from "@aws-sdk/client-bedrock-runtime";

function convertReasoningText(
  text: unknown,
  signature: unknown
): Bedrock.ReasoningContentBlock | undefined {
  if (typeof text !== "string" || text.length === 0) {
    return undefined;
  }
  return {
    reasoningText: {
      text,
      ...(typeof signature === "string" ? { signature } : {}),
    },
  };
}

function convertLegacyReasoningContent(
  value: unknown
): Bedrock.ReasoningContentBlock | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  if (
    "type" in value &&
    value.type === "reasoning_content" &&
    "reasoningText" in value &&
    typeof value.reasoningText === "object" &&
    value.reasoningText !== null
  ) {
    const reasoningText = value.reasoningText;
    return convertReasoningText(
      "text" in reasoningText ? reasoningText.text : undefined,
      "signature" in reasoningText ? reasoningText.signature : undefined
    );
  }

  if (
    "type" in value &&
    value.type === "reasoning_content" &&
    "redactedContent" in value &&
    typeof value.redactedContent === "string" &&
    value.redactedContent.length > 0
  ) {
    return {
      redactedContent: Buffer.from(value.redactedContent, "base64"),
    };
  }

  if (
    "reasoningContent" in value &&
    typeof value.reasoningContent === "object" &&
    value.reasoningContent !== null
  ) {
    if (
      "reasoningText" in value.reasoningContent &&
      typeof value.reasoningContent.reasoningText === "object" &&
      value.reasoningContent.reasoningText !== null
    ) {
      const reasoningText = value.reasoningContent.reasoningText;
      return convertReasoningText(
        "text" in reasoningText ? reasoningText.text : undefined,
        "signature" in reasoningText ? reasoningText.signature : undefined
      );
    }

    if (
      "redactedContent" in value.reasoningContent &&
      value.reasoningContent.redactedContent instanceof Uint8Array &&
      value.reasoningContent.redactedContent.byteLength > 0
    ) {
      return {
        redactedContent: value.reasoningContent.redactedContent,
      };
    }
  }

  return undefined;
}

// see `/libs/langchain-core/src/messages/block_translators/bedrock_converse.ts:convertFileFormatToMimeType`
const formatToMimeType = {
  document(format: string): Bedrock.DocumentFormat {
    switch (format) {
      case "text/csv":
        return "csv";
      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return "docx";
      case "text/html":
        return "html";
      case "text/markdown":
        return "md";
      case "application/pdf":
        return "pdf";
      case "text/plain":
        return "txt";
      case "application/vnd.ms-excel":
        return "xls";
      case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        return "xlsx";
      default:
        return format as Bedrock.DocumentFormat;
    }
  },
  image(format: string): Bedrock.ImageFormat {
    switch (format) {
      case "image/gif":
        return "gif";
      case "image/jpeg":
        return "jpeg";
      case "image/png":
        return "png";
      case "image/webp":
        return "webp";
      default:
        return format as Bedrock.ImageFormat;
    }
  },
  video(format: string): Bedrock.VideoFormat {
    switch (format) {
      case "video/flv":
        return "flv";
      case "video/mkv":
        return "mkv";
      case "video/mov":
        return "mov";
      case "video/mp4":
        return "mp4";
      case "video/mpeg":
        return "mpeg";
      case "video/mpg":
        return "mpg";
      case "video/three_gp":
        return "three_gp";
      case "video/webm":
        return "webm";
      case "video/wmv":
        return "wmv";
      default:
        return format as Bedrock.VideoFormat;
    }
  },
};

function convertCitation(
  annotation: ContentBlock | ContentBlock.Citation
): Bedrock.Citation {
  return {
    sourceContent: [
      {
        text:
          typeof annotation.citedText === "string" ? annotation.citedText : "",
      },
    ],
    location: {
      documentChunk: {
        documentIndex:
          typeof annotation.source === "string"
            ? Number(annotation.source)
            : undefined,
        start:
          typeof annotation.startIndex === "number"
            ? annotation.startIndex
            : undefined,
        end:
          typeof annotation.endIndex === "number"
            ? annotation.endIndex
            : undefined,
      },
    },
  };
}

export function convertFromV1ToChatBedrockConverseMessage(
  message: AIMessage
): Array<Bedrock.ContentBlock> {
  const modelProvider = message.response_metadata?.model_provider;
  function* iterateContent(): Iterable<Bedrock.ContentBlock> {
    for (const block of message.contentBlocks) {
      if (block.type === "text") {
        if (block.annotations?.length) {
          yield {
            citationsContent: {
              content: [{ text: block.text }],
              citations: block.annotations.map(convertCitation),
            },
          };
        } else {
          yield {
            text: block.text,
          };
        }
      } else if (block.type === "audio") {
        // no-op
        continue;
      } else if (block.type === "code_interpreter_call") {
        // no-op
        continue;
      } else if (block.type === "code_interpreter_result") {
        // no-op
        continue;
      } else if (block.type === "file") {
        const format = formatToMimeType.document(block.mimeType ?? "");
        if (block.data) {
          const bytes =
            typeof block.data === "string"
              ? Uint8Array.from(Buffer.from(block.data, "base64"))
              : block.data;
          yield {
            document: {
              name: block.id,
              format,
              source: { bytes },
            },
          };
        } else if (block.fileId && block.fileId.startsWith("s3://")) {
          yield {
            document: {
              name: block.id,
              format,
              source: { s3Location: { uri: block.fileId } },
            },
          };
        }
      } else if (block.type === "image") {
        const format = formatToMimeType.image(block.mimeType ?? "");
        if (block.data) {
          const bytes =
            typeof block.data === "string"
              ? Uint8Array.from(Buffer.from(block.data, "base64"))
              : block.data;
          yield {
            image: {
              format,
              source: { bytes },
            },
          };
        } else if (block.fileId && block.fileId.startsWith("s3://")) {
          yield {
            image: {
              format,
              source: { s3Location: { uri: block.fileId } },
            },
          };
        }
      } else if (block.type === "invalid_tool_call") {
        // no-op
        continue;
      } else if (block.type === "reasoning") {
        const reasoningContent = convertReasoningText(
          block.reasoning,
          block.signature
        );
        if (reasoningContent) {
          yield { reasoningContent };
        }
      } else if (block.type === "server_tool_call") {
        // no-op
        continue;
      } else if (block.type === "server_tool_call_chunk") {
        // no-op
        continue;
      } else if (block.type === "server_tool_result") {
        // no-op
        continue;
      } else if (block.type === "text-plain") {
        // no-op
        continue;
      } else if (block.type === "tool_call") {
        yield {
          toolUse: {
            toolUseId: block.id,
            name: block.name,
            // oxlint-disable-next-line @typescript-eslint/no-explicit-any
            input: block.args as any,
          },
        };
      } else if (block.type === "tool_call_chunk") {
        // no-op
        continue;
      } else if (block.type === "video") {
        const format = formatToMimeType.video(block.mimeType ?? "");
        if (block.data) {
          const bytes =
            typeof block.data === "string"
              ? Uint8Array.from(Buffer.from(block.data, "base64"))
              : block.data;
          yield {
            video: {
              format,
              source: { bytes },
            },
          };
        } else if (block.fileId && block.fileId.startsWith("s3://")) {
          yield {
            video: {
              format,
              source: { s3Location: { uri: block.fileId } },
            },
          };
        }
      } else if (block.type === "web_search_call") {
        // no-op
        continue;
      } else if (block.type === "web_search_result") {
        // no-op
        continue;
      } else if (
        block.type === "non_standard" &&
        modelProvider === "bedrock-converse"
      ) {
        const reasoningContent = convertLegacyReasoningContent(block.value);
        if (reasoningContent) {
          yield { reasoningContent };
        }
      }
    }
  }
  return Array.from(iterateContent());
}
