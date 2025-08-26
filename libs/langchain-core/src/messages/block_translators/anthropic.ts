import { iife } from "../v1/utils.js";
import type { StandardContentBlockTranslator } from "./index.js";
import type { ContentBlock } from "../content/index.js";
import { isAIMessageChunk, type AIMessage } from "../ai.js";
import {
  _isArray,
  _isContentBlock,
  _isObject,
  _isString,
  safeParseJson,
} from "./utils.js";
import { isBaseMessageChunk } from "../base.js";

type AnthropicCitation =
  | {
      type: "char_location";
      start_char_index: number;
      end_char_index: number;
      document_title: string | null;
      document_index: number;
      cited_text: string;
    }
  | {
      type: "page_location";
      start_page_number: number;
      end_page_number: string;
      document_title: string | null;
      document_index: number;
      cited_text: string;
    }
  | {
      type: "content_block_location";
      start_block_index: number;
      end_block_index: number;
      document_title: string | null;
      document_index: number;
      cited_text: string;
    }
  | {
      type: "web_search_result_location";
      url: string;
      title: string;
      encrypted_index: string;
      cited_text: string;
    }
  | {
      type: "search_result_location";
      title: string | null;
      start_block_index: number;
      end_block_index: number;
      search_result_index: number;
      source: string;
      cited_text: string;
    };

function convertAnthropicAnnotation(
  citation: AnthropicCitation
): ContentBlock.Citation | undefined {
  if (citation.type === "char_location") {
    const {
      document_title,
      start_char_index,
      end_char_index,
      cited_text,
      ...rest
    } = citation;
    return {
      ...rest,
      type: "citation",
      source: "char",
      title: document_title ?? undefined,
      startIndex: start_char_index,
      endIndex: end_char_index,
      citedText: cited_text,
    };
  }
  if (citation.type === "page_location") {
    const {
      document_title,
      start_page_number,
      end_page_number,
      cited_text,
      ...rest
    } = citation;
    return {
      ...rest,
      type: "citation",
      source: "page",
      title: document_title ?? undefined,
      startIndex: start_page_number,
      endIndex: Number(end_page_number),
      citedText: cited_text,
    };
  }
  if (citation.type === "content_block_location") {
    const {
      document_title,
      start_block_index,
      end_block_index,
      cited_text,
      ...rest
    } = citation;
    return {
      ...rest,
      type: "citation",
      source: "block",
      title: document_title ?? undefined,
      startIndex: start_block_index,
      endIndex: end_block_index,
      citedText: cited_text,
    };
  }
  if (citation.type === "web_search_result_location") {
    const { url, title, encrypted_index, cited_text, ...rest } = citation;
    return {
      ...rest,
      type: "citation",
      source: "url",
      url,
      title,
      startIndex: Number(encrypted_index),
      endIndex: Number(encrypted_index),
      citedText: cited_text,
    };
  }
  if (citation.type === "search_result_location") {
    const {
      source,
      title,
      start_block_index,
      end_block_index,
      cited_text,
      ...rest
    } = citation;
    return {
      ...rest,
      type: "citation",
      source: "search",
      url: source,
      title: title ?? undefined,
      startIndex: start_block_index,
      endIndex: end_block_index,
      citedText: cited_text,
    };
  }
  return undefined;
}

/**
 * Converts an Anthropic content block to a standard V1 content block.
 *
 * This function handles the conversion of Anthropic-specific content blocks
 * (document and image blocks) to the standardized V1 format. It supports
 * various source types including base64 data, URLs, file IDs, and text data.
 *
 * @param block - The Anthropic content block to convert
 * @returns A standard V1 content block if conversion is successful, undefined otherwise
 *
 * @example
 * ```typescript
 * const anthropicBlock = {
 *   type: "image",
 *   source: {
 *     type: "base64",
 *     media_type: "image/png",
 *     data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
 *   }
 * };
 *
 * const standardBlock = convertToV1FromAnthropicContentBlock(anthropicBlock);
 * // Returns: { type: "image", mimeType: "image/png", data: "..." }
 * ```
 */
export function convertToV1FromAnthropicContentBlock(
  block: ContentBlock
): ContentBlock.Standard | undefined {
  if (
    _isContentBlock(block, "document") &&
    _isObject(block.source) &&
    "type" in block.source
  ) {
    if (
      block.source.type === "base64" &&
      _isString(block.source.media_type) &&
      _isString(block.source.data)
    ) {
      return {
        type: "file",
        mimeType: block.source.media_type,
        data: block.source.data,
      };
    } else if (block.source.type === "url" && _isString(block.source.url)) {
      return {
        type: "file",
        url: block.source.url,
      };
    } else if (
      block.source.type === "file" &&
      _isString(block.source.file_id)
    ) {
      return {
        type: "file",
        fileId: block.source.file_id,
      };
    } else if (block.source.type === "text" && _isString(block.source.data)) {
      return {
        type: "file",
        mimeType: String(block.source.media_type ?? "text/plain"),
        data: block.source.data,
      };
    } else {
      return block as ContentBlock.Standard;
    }
  } else if (
    _isContentBlock(block, "image") &&
    _isObject(block.source) &&
    "type" in block.source
  ) {
    if (
      block.source.type === "base64" &&
      _isString(block.source.media_type) &&
      _isString(block.source.data)
    ) {
      return {
        type: "image",
        mimeType: block.source.media_type,
        data: block.source.data,
      };
    } else if (block.source.type === "url" && _isString(block.source.url)) {
      return {
        type: "image",
        url: block.source.url,
      };
    } else if (
      block.source.type === "file" &&
      _isString(block.source.file_id)
    ) {
      return {
        type: "image",
        fileId: block.source.file_id,
      };
    } else {
      return block as ContentBlock.Standard;
    }
  }
  return undefined;
}

/**
 * Converts an array of content blocks from Anthropic format to v1 standard format.
 *
 * This function processes each content block in the input array, attempting to convert
 * Anthropic-specific block formats (like image blocks with source objects, document blocks, etc.)
 * to the standardized v1 content block format. If a block cannot be converted, it is
 * passed through as-is with a type assertion to ContentBlock.Standard.
 *
 * @param content - Array of content blocks in Anthropic format to be converted
 * @returns Array of content blocks in v1 standard format
 */
export function convertToV1FromAnthropicInput(
  content: Array<ContentBlock>
): Array<ContentBlock.Standard> {
  function* iterateContent(): Iterable<ContentBlock.Standard> {
    for (const block of content) {
      const stdBlock = convertToV1FromAnthropicContentBlock(block);
      if (stdBlock) {
        yield stdBlock;
      } else {
        yield block as ContentBlock.Standard;
      }
    }
  }
  return Array.from(iterateContent());
}

type AnthropicCodeExecutionToolResult = {
  type: "code_execution_tool_result";
  tool_use_id: string;
  content:
    | {
        // BetaCodeExecutionToolResultError
        type: "code_execution_tool_result_error";
        error_code: string;
      }
    | {
        // BetaCodeExecutionResultBlock
        type: "code_execution_result";
        stderr: string;
        stdout: string;
        return_code: number;
        content: {
          // BetaCodeExecutionOutputBlock
          type: "code_execution_output";
          file_id: string;
        }[];
      };
};

/**
 * Converts an Anthropic AI message to an array of v1 standard content blocks.
 *
 * This function processes an AI message containing Anthropic-specific content blocks
 * and converts them to the standardized v1 content block format.
 *
 * @param message - The AI message containing Anthropic-formatted content blocks
 * @returns Array of content blocks in v1 standard format
 *
 * @example
 * ```typescript
 * const message = new AIMessage([
 *   { type: "text", text: "Hello world" },
 *   { type: "thinking", text: "Let me think about this..." },
 *   { type: "tool_use", id: "123", name: "calculator", input: { a: 1, b: 2 } }
 * ]);
 *
 * const standardBlocks = convertToV1FromAnthropicMessage(message);
 * // Returns:
 * // [
 * //   { type: "text", text: "Hello world" },
 * //   { type: "reasoning", reasoning: "Let me think about this..." },
 * //   { type: "tool_call", id: "123", name: "calculator", args: { a: 1, b: 2 } }
 * // ]
 * ```
 */
export function convertToV1FromAnthropicMessage(
  message: AIMessage
): Array<ContentBlock.Standard> {
  function* iterateContent(): Iterable<ContentBlock.Standard> {
    const content =
      typeof message.content === "string"
        ? [{ type: "text", text: message.content }]
        : message.content;
    for (const block of content) {
      // TextBlock
      if (_isContentBlock(block, "text") && _isString(block.text)) {
        const { text, citations, ...rest } = block;
        if (_isArray(citations) && citations.length) {
          const _citations = citations
            .map(convertAnthropicAnnotation)
            .filter(Boolean) as ContentBlock.Citation[];
          yield {
            ...rest,
            type: "text",
            text,
            annotations: _citations,
          };
        } else {
          yield {
            ...rest,
            type: "text",
            text,
          };
        }
      }
      // ThinkingBlock
      else if (
        _isContentBlock(block, "thinking") &&
        _isString(block.thinking)
      ) {
        const { thinking, signature, ...rest } = block;
        yield {
          ...rest,
          type: "reasoning",
          reasoning: thinking,
          signature,
        };
      }
      // RedactedThinkingBlock
      else if (_isContentBlock(block, "redacted_thinking")) {
        continue;
      }
      // ToolUseBlock
      else if (
        _isContentBlock(block, "tool_use") &&
        _isString(block.name) &&
        _isString(block.id)
      ) {
        yield {
          type: "tool_call",
          id: block.id,
          name: block.name,
          args: block.input,
        };
      }
      // message chunks can have input_json_delta contents
      else if (_isContentBlock(block, "input_json_delta")) {
        if (
          isBaseMessageChunk(message) &&
          isAIMessageChunk(message) &&
          message.tool_call_chunks?.length
        ) {
          const tool_call_chunk = message.tool_call_chunks[0];
          yield {
            type: "tool_call_chunk",
            id: tool_call_chunk.id,
            name: tool_call_chunk.name,
            args: tool_call_chunk.args,
            index: tool_call_chunk.index,
          };
        }
        // TODO: implement
      }
      // ServerToolUseBlock
      else if (
        _isContentBlock(block, "server_tool_use") &&
        _isString(block.name) &&
        _isString(block.id)
      ) {
        const { name, id } = block;
        if (name === "web_search") {
          const query = iife(() => {
            if (typeof block.input === "string") {
              return block.input;
            } else if (_isObject(block.input) && _isString(block.input.query)) {
              return block.input.query;
            } else if (_isString(block.partial_json)) {
              const json = safeParseJson<{ query?: string }>(
                block.partial_json
              );
              if (json?.query) {
                return json.query;
              }
            }
            return "";
          });
          yield {
            id,
            type: "web_search_call",
            query,
          };
        } else if (block.name === "code_execution") {
          const code = iife(() => {
            if (typeof block.input === "string") {
              return block.input;
            } else if (_isObject(block.input) && _isString(block.input.code)) {
              return block.input.code;
            } else if (_isString(block.partial_json)) {
              const json = safeParseJson<{ code?: string }>(block.partial_json);
              if (json?.code) {
                return json.code;
              }
            }
            return "";
          });
          yield {
            id,
            type: "code_interpreter_call",
            code,
          };
        }
      }
      // WebSearchToolResultBlock
      else if (
        _isContentBlock(block, "web_search_tool_result") &&
        _isString(block.tool_use_id) &&
        _isArray(block.content)
      ) {
        const { content, tool_use_id } = block;
        const urls = content.reduce<string[]>((acc, content) => {
          if (_isContentBlock(content, "web_search_result")) {
            return [...acc, content.url as string];
          }
          return acc;
        }, []);
        yield {
          id: tool_use_id,
          type: "web_search_result",
          urls,
        };
      }
      // CodeExecutionToolResultBlock
      else if (
        _isContentBlock(block, "code_execution_tool_result") &&
        _isString(block.tool_use_id)
      ) {
        // We just make a type assertion here instead of deep checking every property
        // since `code_execution_tool_result` is an anthropic only block
        const { content, tool_use_id } =
          block as AnthropicCodeExecutionToolResult;
        const output = iife(() => {
          if (content.type === "code_execution_tool_result_error") {
            return [
              {
                type: "code_interpreter_output" as const,
                returnCode: 1,
                stderr: content.error_code,
              },
            ];
          }
          if (content.type === "code_execution_result") {
            const fileIds = Array.isArray(content.content)
              ? content.content
                  .filter((content) => content.type === "code_execution_output")
                  .map((content) => content.file_id)
              : [];
            return [
              {
                type: "code_interpreter_output" as const,
                returnCode: content.return_code ?? 0,
                stderr: content.stderr,
                stdout: content.stdout,
                fileIds,
              },
            ];
          }
          return [];
        });
        yield {
          id: tool_use_id,
          type: "code_interpreter_result",
          output,
        };
      }
      // MCPToolUseBlock
      else if (block.type === "mcp_tool_use") {
        continue;
      }
      // MCPToolResultBlock
      else if (block.type === "mcp_tool_result") {
        continue;
      }
      // ContainerUploadBlock
      else if (block.type === "container_upload") {
        continue;
      }
      // SearchResultBlockParam
      else if (block.type === "search_result") {
        continue;
      }
      // ToolResultBlockParam
      else if (block.type === "tool_result") {
        // TODO: Implement
        continue;
      } else {
        // For all other blocks, we try to convert them to a standard block
        const stdBlock = convertToV1FromAnthropicContentBlock(block);
        if (stdBlock) {
          yield stdBlock;
        } else {
          // TODO: non standard?
        }
      }
    }
  }
  return Array.from(iterateContent());
}

export const anthropicTranslator: StandardContentBlockTranslator = {
  translateContent: convertToV1FromAnthropicMessage,
  translateContentChunk: convertToV1FromAnthropicMessage,
};
