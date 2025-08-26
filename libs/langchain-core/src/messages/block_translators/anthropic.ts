import { iife } from "../v1/utils.js";
import type { StandardContentBlockTranslator } from "./index.js";
import type { ContentBlock } from "../content/index.js";
import type { AIMessage } from "../ai.js";
import {
  _isArray,
  _isContentBlock,
  _isObject,
  _isString,
  safeParseJson,
} from "./utils.js";

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
): ContentBlock | ContentBlock.Citation {
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
      title: document_title,
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
      title: document_title,
      startIndex: start_page_number,
      endIndex: end_page_number,
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
      title: document_title,
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
      startIndex: encrypted_index,
      endIndex: encrypted_index,
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
      title,
      startIndex: start_block_index,
      endIndex: end_block_index,
      citedText: cited_text,
    };
  }
  return citation;
}

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
      // TODO: non standard?
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
      // TODO: non standard?
    }
  }
  return undefined;
}

export function convertToV1FromAnthropicInput(
  content: Array<ContentBlock>
): Array<ContentBlock.Standard> {
  function* iterateContent(): Iterable<ContentBlock.Standard> {
    for (const block of content) {
      const stdBlock = convertToV1FromAnthropicContentBlock(block);
      if (stdBlock) {
        yield stdBlock;
      } else {
        // TODO: non standard?
      }
    }
  }
  return Array.from(iterateContent());
}

type AnthropicCodeExecutionToolResult = {
  type: "code_execution_tool_result";
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
        const { text, annotations, ...rest } = block;
        if (_isArray(annotations) && annotations.length) {
          const _annotations = annotations as AnthropicCitation[];
          yield {
            ...rest,
            type: "text",
            text,
            annotations: _annotations.map(convertAnthropicAnnotation),
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
      else if (_isContentBlock(block, "thinking") && _isString(block.text)) {
        const { text, ...rest } = block;
        yield {
          ...rest,
          type: "reasoning",
          reasoning: text,
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
        // TODO: implement
      }
      // ServerToolUseBlock
      else if (
        _isContentBlock(block, "server_tool_use") &&
        _isString(block.name) &&
        _isString(block.id)
      ) {
        const { name, id, ...rest } = block;
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
            ...rest,
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
            ...rest,
            type: "code_interpreter_call",
            code,
          };
        }
      }
      // WebSearchToolResultBlock
      else if (
        _isContentBlock(block, "web_search_tool_result") &&
        _isString(block.url)
      ) {
        const { url, ...rest } = block;
        yield {
          ...rest,
          type: "web_search_result",
          urls: [url],
        };
      }
      // CodeExecutionToolResultBlock
      else if (_isContentBlock(block, "code_execution_tool_result")) {
        // We just make a type assertion here instead of deep checking every property
        // since `code_execution_tool_result` is an anthropic only block
        const { content, ...rest } = block as AnthropicCodeExecutionToolResult;
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
            const fileIds = content.content
              .filter((content) => content.type === "code_execution_output")
              .map((content) => content.file_id);
            return [
              {
                type: "code_interpreter_output" as const,
                returnCode: content.return_code,
                stderr: content.stderr,
                stdout: content.stdout,
                fileIds,
              },
            ];
          }
          return [];
        });
        yield {
          ...rest,
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
