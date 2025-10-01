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
            start_char_index: annotation.startIndex ?? 0,
            end_char_index: annotation.endIndex ?? 0,
            document_title: annotation.title ?? null,
            document_index: 0,
            cited_text: annotation.citedText ?? "",
          };
        } else if (annotation.source === "page") {
          yield {
            type: "page_location" as const,
            start_page_number: annotation.startIndex ?? 0,
            end_page_number: annotation.endIndex ?? 0,
            document_title: annotation.title ?? null,
            document_index: 0,
            cited_text: annotation.citedText ?? "",
          };
        } else if (annotation.source === "block") {
          yield {
            type: "content_block_location" as const,
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

export function _formatStandardContent(
  message: BaseMessage
): Anthropic.Beta.BetaContentBlockParam[] {
  const result: Anthropic.Beta.BetaContentBlockParam[] = [];
  const responseMetadata = message.response_metadata as ResponseMetadata;
  const modelProvider = responseMetadata?.model_provider;
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
    } else if (block.type === "reasoning" && modelProvider === "anthropic") {
      result.push({
        type: "thinking",
        thinking: block.reasoning,
        signature: String(block.signature),
      });
    } else if (
      block.type === "server_tool_call" &&
      modelProvider == "anthropic"
    ) {
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
    } else if (
      block.type === "server_tool_call_result" &&
      modelProvider === "anthropic"
    ) {
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
    }
  }
  return result;
}
