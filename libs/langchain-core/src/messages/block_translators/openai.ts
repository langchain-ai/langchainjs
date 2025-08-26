import type { ContentBlock } from "../content/index.js";
import { type AIMessageChunk, type AIMessage } from "../ai.js";
import { BaseContentBlock } from "../content/base.js";
import { StandardContentBlockTranslator } from "./index.js";
import { convertToV1FromOpenAIDataBlock, isOpenAIDataBlock } from "./data.js";
import {
  _isArray,
  _isContentBlock,
  _isObject,
  _isString,
  iife,
} from "./utils.js";

export function convertToV1FromChatCompletions(
  message: AIMessage
): Array<ContentBlock.Standard> {
  const blocks: Array<ContentBlock.Standard> = [];
  if (typeof message.content === "string") {
    blocks.push({
      type: "text",
      text: message.content,
    });
  } else {
    blocks.push(...convertToV1FromChatCompletionsInput(message.content));
  }
  for (const toolCall of message.tool_calls ?? []) {
    blocks.push({
      type: "tool_call",
      id: toolCall.id,
      name: toolCall.name,
      args: toolCall.args,
    });
  }
  return blocks;
}

export function convertToV1FromChatCompletionsChunk(
  message: AIMessage
): Array<ContentBlock.Standard> {
  const blocks: Array<ContentBlock.Standard> = [];
  if (typeof message.content === "string") {
    blocks.push({
      type: "text",
      text: message.content,
    });
  } else {
    blocks.push(...convertToV1FromChatCompletionsInput(message.content));
  }

  // TODO: parse chunk position information
  for (const toolCall of message.tool_calls ?? []) {
    blocks.push({
      type: "tool_call",
      id: toolCall.id,
      name: toolCall.name,
      args: toolCall.args,
    });
  }
  return blocks;
}

export function convertToV1FromChatCompletionsInput(
  blocks: Array<ContentBlock>
): Array<ContentBlock.Standard> {
  const convertedBlocks: Array<ContentBlock.Standard> = [];
  for (const block of blocks) {
    if (isOpenAIDataBlock(block)) {
      convertedBlocks.push(convertToV1FromOpenAIDataBlock(block));
    } else {
      convertedBlocks.push(block as ContentBlock.Standard);
    }
  }
  return convertedBlocks;
}

function convertResponsesAnnotation(
  annotation: BaseContentBlock
): ContentBlock | ContentBlock.Citation {
  if (annotation.type === "url_citation") {
    const { url, title, start_index, end_index } = annotation;
    return {
      type: "citation",
      url,
      title,
      startIndex: start_index,
      endIndex: end_index,
    };
  }
  if (annotation.type === "file_citation") {
    const { file_id, filename, index } = annotation;
    return {
      type: "citation",
      title: filename,
      startIndex: index,
      endIndex: index,
      fileId: file_id,
    };
  }
  return annotation;
}

export function convertToV1FromResponses(
  message: AIMessage
): Array<ContentBlock.Standard> {
  function* iterateContent(): Iterable<ContentBlock.Standard> {
    if (
      _isObject(message.additional_kwargs?.reasoning) &&
      _isArray(message.additional_kwargs.reasoning.summary)
    ) {
      const summary =
        message.additional_kwargs.reasoning.summary.reduce<string>(
          (acc, item) => {
            if (_isObject(item) && _isString(item.text)) {
              return `${acc}${item.text}`;
            }
            return acc;
          },
          ""
        );
      yield {
        type: "reasoning",
        reasoning: summary,
      };
    }
    const content =
      typeof message.content === "string"
        ? [{ type: "text", text: message.content }]
        : message.content;
    for (const block of content) {
      if (_isContentBlock(block, "text")) {
        const annotations = Array.isArray(block.annotations)
          ? block.annotations.map(convertResponsesAnnotation)
          : [];
        yield {
          type: "text",
          text: String(block.text),
          annotations,
        };
      }
    }
    for (const toolCall of message.tool_calls ?? []) {
      yield {
        type: "tool_call",
        id: toolCall.id,
        name: toolCall.name,
        args: toolCall.args,
      };
    }
    if (
      _isObject(message.additional_kwargs) &&
      _isArray(message.additional_kwargs.tool_outputs)
    ) {
      for (const toolOutput of message.additional_kwargs.tool_outputs) {
        if (_isContentBlock(toolOutput, "web_search_call")) {
          continue;
        } else if (_isContentBlock(toolOutput, "file_search_call")) {
          continue;
        } else if (_isContentBlock(toolOutput, "computer_call")) {
          continue;
        } else if (_isContentBlock(toolOutput, "code_interpreter_call")) {
          if (_isString(toolOutput.code)) {
            yield {
              type: "code_interpreter_call",
              code: toolOutput.code,
            };
          }
          if (_isArray(toolOutput.outputs)) {
            const returnCode = iife(() => {
              if (toolOutput.status === "in_progress") return undefined;
              if (toolOutput.status === "completed") return 0;
              if (toolOutput.status === "incomplete") return 127;
              if (toolOutput.status === "interpreting") return undefined;
              if (toolOutput.status === "failed") return 1;
              return undefined;
            });
            for (const output of toolOutput.outputs) {
              if (_isContentBlock(output, "logs")) {
                yield {
                  type: "code_interpreter_result",
                  output: [
                    {
                      type: "code_interpreter_output",
                      returnCode,
                      stderr: [0, undefined].includes(returnCode)
                        ? undefined
                        : String(output.logs),
                      stdout: [0, undefined].includes(returnCode)
                        ? String(output.logs)
                        : undefined,
                    },
                  ],
                };
              }
            }
          }
        } else if (_isContentBlock(toolOutput, "mcp_call")) {
          continue;
        } else if (_isContentBlock(toolOutput, "mco_list_tools")) {
          continue;
        } else if (_isContentBlock(toolOutput, "mcp_approval_request")) {
          continue;
        } else if (_isContentBlock(toolOutput, "image_generation_call")) {
          continue;
        }
      }
    }
  }
  return Array.from(iterateContent());
}

export function convertToV1FromResponsesChunk(
  message: AIMessageChunk
): Array<ContentBlock.Standard> {
  function* iterateContent(): Iterable<ContentBlock.Standard> {
    yield* convertToV1FromResponses(message);
    for (const toolCallChunk of message.tool_call_chunks ?? []) {
      yield {
        type: "tool_call_chunk",
        id: toolCallChunk.id,
        name: toolCallChunk.name,
        args: toolCallChunk.args,
      };
    }
  }
  return Array.from(iterateContent());
}

export const openaiTranslator: StandardContentBlockTranslator = {
  translateContent: (message) => {
    if (typeof message.content === "string") {
      return convertToV1FromChatCompletions(message);
    }
    return convertToV1FromResponses(message);
  },
  translateContentChunk: (message) => {
    if (typeof message.content === "string") {
      return convertToV1FromChatCompletionsChunk(message);
    }
    return convertToV1FromResponsesChunk(message);
  },
};
