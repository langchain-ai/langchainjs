import { iife } from "../v1/utils.js";
import type { StandardContentBlockTranslator } from "./index.js";
import type { ContentBlock } from "../content/index.js";
import type { AIMessage } from "../ai.js";

type AnthropicTextBlock = {
  type: "text";
  text: string;
  citations: Array<AnthropicCitation> | null;
};

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

type AnthropicImageBlock = {
  type: "image";
  source:
    | {
        type: "base64";
        data: string;
        media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
      }
    | {
        type: "url";
        url: string;
      }
    | {
        type: "file";
        file_id: string;
      };
};

type AnthropicDocumentBlock = {
  type: "document";
  citations?: Array<AnthropicCitation>;
  title?: string | null;
  context?: string | null;
  source:
    | {
        type: "base64";
        media_type: "application/pdf";
        data: string;
      }
    | {
        type: "text";
        media_type: "text/plain";
        data: string;
      }
    | {
        type: "content";
        content: string | Array<AnthropicTextBlock | AnthropicImageBlock>;
      }
    | {
        type: "url";
        url: string;
      }
    | {
        type: "file";
        file_id: string;
      };
};

function convertAnthropicCitationToV1(
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

function convertToV1FromAnthropicMessage(
  message: AIMessage
): Array<ContentBlock.Standard> {
  function* iterateContent(): Iterable<ContentBlock.Standard> {
    if (typeof message.content === "string") {
      yield {
        type: "text",
        text: message.content,
      };
    } else {
      for (const block of message.content) {
        // TextBlock
        if (block.type === "text") {
          const { text, citations, ...rest } = block as AnthropicTextBlock;
          if (typeof text !== "string") continue;
          if (citations) {
            yield {
              ...rest,
              type: "text",
              text,
              annotations: citations.map(convertAnthropicCitationToV1),
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
        else if (block.type === "thinking") {
          const { text, ...rest } = block;
          if (typeof text !== "string") continue;
          yield {
            ...rest,
            type: "reasoning",
            reasoning: text,
          };
        }
        // RedactedThinkingBlock {
        else if (block.type === "redacted_thinking") {
          continue;
        }
        // ToolUseBlock
        else if (block.type === "tool_use") {
          if (typeof block.name !== "string") continue;
          if (typeof block.id !== "string") continue;
          yield {
            type: "tool_call",
            id: block.id,
            name: block.name ?? "",
            args: block.input,
          };
        }
        // ServerToolUseBlock
        else if (block.type === "server_tool_use") {
          if (typeof block.id !== "string") continue;
          if (typeof block.name !== "string") continue;
          if (block.name === "web_search") {
            yield {
              type: "web_search_call",
              query: typeof block.input === "string" ? block.input : undefined,
            };
          } else if (block.name === "code_execution") {
            yield {
              type: "code_interpreter_call",
              code: typeof block.input === "string" ? block.input : undefined,
            };
          }
        }
        // WebSearchToolResultBlock
        else if (block.type === "web_search_tool_result") {
          const { url, ...rest } = block;
          if (typeof url !== "string") continue;
          yield {
            ...rest,
            type: "web_search_result",
            urls: [url],
          };
        }
        // CodeExecutionToolResultBlock
        else if (block.type === "code_execution_tool_result") {
          const { content, ...rest } =
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
        // ImageBlockParam
        else if (block.type === "image") {
          const { source, ...rest } = block as AnthropicImageBlock;
          if (source.type === "base64") {
            yield {
              ...rest,
              type: "image",
              mimeType: source.media_type,
              data: source.data,
            };
          } else if (source.type === "url") {
            yield {
              ...rest,
              type: "image",
              url: source.url,
            };
          } else if (source.type === "file") {
            yield {
              ...rest,
              type: "image",
              fileId: source.file_id,
            };
          }
        }
        // RequestDocumentBlock
        else if (block.type === "document") {
          const { source, ...rest } = block as AnthropicDocumentBlock;
          if (source.type === "base64") {
            yield {
              ...rest,
              type: "file",
              mimeType: source.media_type,
              data: source.data,
            };
          } else if (source.type === "text") {
            yield {
              ...rest,
              type: "file",
              mimeType: source.media_type,
              data: source.data,
            };
          } else if (source.type === "content") {
            // TODO: what do with this?
            continue;
          } else if (source.type === "url") {
            yield {
              ...rest,
              type: "file",
              url: source.url,
            };
          } else if (source.type === "file") {
            yield {
              ...rest,
              type: "file",
              fileId: source.file_id,
            };
          }
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
