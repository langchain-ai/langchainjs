import type Anthropic from "@anthropic-ai/sdk";
import type {
  BaseMessage,
  ContentBlock,
  ResponseMetadata,
} from "@langchain/core/messages";
import { iife } from "./index.js";

function _isStandardAnnotation(
  annotation: unknown
): annotation is ContentBlock.Citation {
  return (
    typeof annotation === "object" &&
    annotation !== null &&
    "type" in annotation &&
    annotation.type === "citation"
  );
}

function _formatStandardCitations(
  annotations: ContentBlock.Citation[]
): Anthropic.Beta.BetaTextCitation[] {
  function* iterateAnnotations() {
    for (const annotation of annotations) {
      if (_isStandardAnnotation(annotation)) {
        if (annotation.source === "char") {
          yield {
            type: "char_location" as const,
            file_id: annotation.url ?? "",
            start_char_index: annotation.startIndex ?? 0,
            end_char_index: annotation.endIndex ?? 0,
            document_title: annotation.title ?? null,
            document_index: 0,
            cited_text: annotation.citedText ?? "",
          };
        } else if (annotation.source === "page") {
          yield {
            type: "page_location" as const,
            file_id: annotation.url ?? "",
            start_page_number: annotation.startIndex ?? 0,
            end_page_number: annotation.endIndex ?? 0,
            document_title: annotation.title ?? null,
            document_index: 0,
            cited_text: annotation.citedText ?? "",
          };
        } else if (annotation.source === "block") {
          yield {
            type: "content_block_location" as const,
            file_id: annotation.url ?? "",
            start_block_index: annotation.startIndex ?? 0,
            end_block_index: annotation.endIndex ?? 0,
            document_title: annotation.title ?? null,
            document_index: 0,
            cited_text: annotation.citedText ?? "",
          };
        } else if (annotation.source === "url") {
          yield {
            type: "web_search_result_location" as const,
            url: annotation.url ?? "",
            title: annotation.title ?? null,
            encrypted_index: String(annotation.startIndex ?? 0),
            cited_text: annotation.citedText ?? "",
          };
        } else if (annotation.source === "search") {
          yield {
            type: "search_result_location" as const,
            title: annotation.title ?? null,
            start_block_index: annotation.startIndex ?? 0,
            end_block_index: annotation.endIndex ?? 0,
            search_result_index: 0,
            source: annotation.source ?? "",
            cited_text: annotation.citedText ?? "",
          };
        }
      }
    }
  }
  return Array.from(iterateAnnotations());
}

function _formatBase64Data(data: string | Uint8Array): string {
  return typeof data === "string" ? data : Buffer.from(data).toString("base64");
}

function _normalizeMimeType(mimeType?: string | null): string {
  return (mimeType ?? "").split(";")[0].toLowerCase();
}

function _extractMetadataValue<T>(
  metadata: unknown,
  key: string
): T | undefined {
  if (
    metadata !== undefined &&
    metadata !== null &&
    typeof metadata === "object" &&
    key in metadata
  ) {
    return (metadata as Record<string, unknown>)[key] as T;
  }
  return undefined;
}

function _applyDocumentMetadata(
  block: Anthropic.Beta.BetaRequestDocumentBlock,
  metadata: unknown
): Anthropic.Beta.BetaRequestDocumentBlock {
  const cacheControl =
    _extractMetadataValue<Anthropic.Beta.BetaCacheControlEphemeral | null>(
      metadata,
      "cache_control"
    );
  if (cacheControl !== undefined) {
    block.cache_control = cacheControl;
  }
  const citations =
    _extractMetadataValue<Anthropic.Beta.BetaCitationsConfigParam | null>(
      metadata,
      "citations"
    );
  if (citations !== undefined) {
    block.citations = citations;
  }
  const context = _extractMetadataValue<string | null>(metadata, "context");
  if (context !== undefined) {
    block.context = context;
  }
  const title = _extractMetadataValue<string | null>(metadata, "title");
  if (title !== undefined) {
    block.title = title;
  }
  return block;
}

function _applyImageMetadata(
  block: Anthropic.Beta.BetaImageBlockParam,
  metadata: unknown
): Anthropic.Beta.BetaImageBlockParam {
  const cacheControl =
    _extractMetadataValue<Anthropic.Beta.BetaCacheControlEphemeral | null>(
      metadata,
      "cache_control"
    );
  if (cacheControl !== undefined) {
    block.cache_control = cacheControl;
  }
  return block;
}

function _hasAllowedImageMimeType(
  mimeType: string
): mimeType is "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  const ALLOWED_IMAGE_MIME_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
  ]);
  return ALLOWED_IMAGE_MIME_TYPES.has(mimeType);
}

export function _formatStandardContent(
  message: BaseMessage
): Anthropic.Beta.BetaContentBlockParam[] {
  const result: Anthropic.Beta.BetaContentBlockParam[] = [];
  const responseMetadata = message.response_metadata as ResponseMetadata;
  const isAnthropicMessage =
    "model_provider" in responseMetadata &&
    responseMetadata?.model_provider === "anthropic";
  for (const block of message.contentBlocks) {
    if (block.type === "text") {
      if (block.annotations) {
        result.push({
          type: "text",
          text: block.text,
          citations: _formatStandardCitations(
            block.annotations as ContentBlock.Citation[]
          ),
        });
      } else {
        result.push({
          type: "text",
          text: block.text,
        });
      }
    } else if (block.type === "tool_call") {
      result.push({
        type: "tool_use",
        id: block.id ?? "",
        name: block.name,
        input: block.args,
      });
    } else if (block.type === "tool_call_chunk") {
      const input = iife(() => {
        if (typeof block.args !== "string") {
          return block.args;
        }
        try {
          return JSON.parse(block.args);
        } catch {
          return {};
        }
      });
      result.push({
        type: "tool_use",
        id: block.id ?? "",
        name: block.name ?? "",
        input,
      });
    } else if (block.type === "reasoning" && isAnthropicMessage) {
      result.push({
        type: "thinking",
        thinking: block.reasoning,
        signature: String(block.signature),
      });
    } else if (block.type === "server_tool_call" && isAnthropicMessage) {
      if (block.name === "web_search") {
        result.push({
          type: "server_tool_use",
          name: block.name,
          id: block.id ?? "",
          input: block.args,
        });
      } else if (block.name === "code_execution") {
        result.push({
          type: "server_tool_use",
          name: block.name,
          id: block.id ?? "",
          input: block.args,
        });
      }
    } else if (block.type === "server_tool_call_result" && isAnthropicMessage) {
      if (block.name === "web_search" && Array.isArray(block.output.urls)) {
        const content = block.output.urls.map((url) => ({
          type: "web_search_result" as const,
          title: "",
          encrypted_content: "",
          url,
        }));
        result.push({
          type: "web_search_tool_result",
          tool_use_id: block.toolCallId ?? "",
          content,
        });
      } else if (block.name === "code_execution") {
        result.push({
          type: "code_execution_tool_result",
          tool_use_id: block.toolCallId ?? "",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content: block.output as any,
        });
      } else if (block.name === "mcp_tool_result") {
        result.push({
          type: "mcp_tool_result",
          tool_use_id: block.toolCallId ?? "",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content: block.output as any,
        });
      }
    } else if (block.type === "audio") {
      throw new Error("Anthropic does not support audio content blocks.");
    } else if (block.type === "file") {
      const metadata = block.metadata;
      if (block.fileId) {
        result.push(
          _applyDocumentMetadata(
            {
              type: "document",
              source: {
                type: "file",
                file_id: block.fileId,
              },
            },
            metadata
          )
        );
        continue;
      }
      if (block.url) {
        const mimeType = _normalizeMimeType(block.mimeType);
        if (mimeType === "application/pdf" || mimeType === "") {
          result.push(
            _applyDocumentMetadata(
              {
                type: "document",
                source: {
                  type: "url",
                  url: block.url,
                },
              },
              metadata
            )
          );
          continue;
        }
      }
      if (block.data) {
        const mimeType = _normalizeMimeType(block.mimeType);
        if (mimeType === "" || mimeType === "application/pdf") {
          result.push(
            _applyDocumentMetadata(
              {
                type: "document",
                source: {
                  type: "base64",
                  data: _formatBase64Data(block.data),
                  media_type: "application/pdf",
                },
              },
              metadata
            )
          );
        } else if (mimeType === "text/plain") {
          result.push(
            _applyDocumentMetadata(
              {
                type: "document",
                source: {
                  type: "text",
                  data: _formatBase64Data(block.data),
                  media_type: "text/plain",
                },
              },
              metadata
            )
          );
        } else {
          if (_hasAllowedImageMimeType(mimeType)) {
            result.push(
              _applyDocumentMetadata(
                {
                  type: "document",
                  source: {
                    type: "content",
                    content: [
                      {
                        type: "image",
                        source: {
                          type: "base64",
                          data: _formatBase64Data(block.data),
                          media_type: mimeType,
                        },
                      },
                    ],
                  },
                },
                metadata
              )
            );
          } else {
            throw new Error(
              `Unsupported file mime type for Anthropic base64 source: ${mimeType}`
            );
          }
        }
        continue;
      }
      throw new Error(
        "File content block must include a fileId, url, or data property."
      );
    } else if (block.type === "image") {
      const metadata = block.metadata;
      if (block.fileId) {
        result.push(
          _applyImageMetadata(
            {
              type: "image",
              source: {
                type: "file",
                file_id: block.fileId,
              },
            },
            metadata
          )
        );
        continue;
      }
      if (block.url) {
        result.push(
          _applyImageMetadata(
            {
              type: "image",
              source: {
                type: "url",
                url: block.url,
              },
            },
            metadata
          )
        );
        continue;
      }
      if (block.data) {
        const mimeType = _normalizeMimeType(block.mimeType) || "image/png";
        if (_hasAllowedImageMimeType(mimeType)) {
          result.push(
            _applyImageMetadata(
              {
                type: "image",
                source: {
                  type: "base64",
                  data: _formatBase64Data(block.data),
                  media_type: mimeType,
                },
              },
              metadata
            )
          );
        }
        continue;
      }
      throw new Error(
        "Image content block must include a fileId, url, or data property."
      );
    } else if (block.type === "video") {
      // no-op
    } else if (block.type === "text-plain") {
      if (block.data) {
        result.push(
          _applyDocumentMetadata(
            {
              type: "document",
              source: {
                type: "text",
                data: _formatBase64Data(block.data),
                media_type: "text/plain",
              },
            },
            block.metadata
          )
        );
      }
    } else if (block.type === "non_standard" && isAnthropicMessage) {
      result.push(block.value as Anthropic.Beta.BetaContentBlockParam);
    }
  }
  return result;
}
