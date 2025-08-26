import type Anthropic from "@anthropic-ai/sdk";
import type { ContentBlock } from "@langchain/core/messages";
import type { ToolCall } from "@langchain/core/messages/tool";
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
            type: "char_location",
            start_char_index: annotation.startIndex ?? 0,
            end_char_index: annotation.endIndex ?? 0,
            document_title: annotation.title ?? null,
            document_index: 0,
            cited_text: annotation.citedText ?? "",
          };
        } else if (annotation.source === "page") {
          yield {
            type: "page_location",
            start_page_number: annotation.startIndex ?? 0,
            end_page_number: annotation.endIndex ?? 0,
            document_title: annotation.title ?? null,
            document_index: 0,
            cited_text: annotation.citedText ?? "",
          };
        } else if (annotation.source === "block") {
          yield {
            type: "content_block_location",
            start_block_index: annotation.startIndex ?? 0,
            end_block_index: annotation.endIndex ?? 0,
            document_title: annotation.title ?? null,
            document_index: 0,
            cited_text: annotation.citedText ?? "",
          };
        } else if (annotation.source === "url") {
          yield {
            type: "web_search_result_location",
            url: annotation.url ?? "",
            title: annotation.title ?? null,
            encrypted_index: String(annotation.startIndex ?? 0),
            cited_text: annotation.citedText ?? "",
          };
        } else if (annotation.source === "search") {
          yield {
            type: "search_result_location",
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
  blocks: ContentBlock.Standard[],
  toolCalls: ToolCall[],
  modelProvider?: string
): Anthropic.Beta.BetaContentBlockParam[] {
  const result: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const block of blocks) {
    if (block.type === "text") {
      if (citations) {
        result.push({
          type: "text",
          text: block.text,
          citations: _formatStandardCitations(block.annotations),
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
      block.type === "web_search_call" &&
      modelProvider === "anthropic"
    ) {
      result.push({
        id: block.id ?? "",
        type: "server_tool_use",
        name: "web_search",
        input: block.input ?? { query: block.query },
      });
    } else if (
      block.type === "web_search_result" &&
      modelProvider === "anthropic"
    ) {
      result.push({
        id: block.id,
        type: "web_search_tool_result",
        content: block.content,
      });
    } else if (
      block.type === "code_interpreter_call" &&
      modelProvider === "anthropic"
    ) {
      result.push({
        type: "server_tool_use",
        name: "code_execution",
        id: block.id,
        input: { code: block.code },
      });
    } else if (
      block.type === "code_interpreter_result" &&
      modelProvider === "anthropic" &&
      Array.isArray(block.fileIds)
    ) {
      result.push({
        type: "code_execution_tool_result",
        content: {
          type: "code_execution_result",
          stderr: block.stderr as string,
          stdout: block.stdout as string,
          return_code: block.returnCode as number,
          fileIds: block.fileIds.map((fileId: string) => ({
            type: "code_execution_output",
            file_id: fileId,
          })),
        },
      });
    }
  }
  return result;
}
