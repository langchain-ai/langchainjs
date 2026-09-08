import type { ContentBlock } from "../content/index.js";
import type { AIMessageChunk, AIMessage } from "../ai.js";
import type { StandardContentBlockTranslator } from "./index.js";
import { convertToV1FromOpenAIDataBlock, isOpenAIDataBlock } from "./data.js";
import {
  _isArray,
  _isContentBlock,
  _isObject,
  _isString,
  iife,
} from "./utils.js";

/**
 * Converts a ChatOpenAICompletions message to an array of v1 standard content blocks.
 *
 * This function processes an AI message from ChatOpenAICompletions API format
 * and converts it to the standardized v1 content block format. It handles both
 * string content and structured content blocks, as well as tool calls.
 *
 * @param message - The AI message containing ChatOpenAICompletions formatted content
 * @returns Array of content blocks in v1 standard format
 *
 * @example
 * ```typescript
 * const message = new AIMessage("Hello world");
 * const standardBlocks = convertToV1FromChatCompletions(message);
 * // Returns: [{ type: "text", text: "Hello world" }]
 * ```
 *
 * @example
 * ```typescript
 * const message = new AIMessage([
 *   { type: "text", text: "Hello" },
 *   { type: "image_url", image_url: { url: "https://example.com/image.png" } }
 * ]);
 * message.tool_calls = [
 *   { id: "call_123", name: "calculator", args: { a: 1, b: 2 } }
 * ];
 *
 * const standardBlocks = convertToV1FromChatCompletions(message);
 * // Returns:
 * // [
 * //   { type: "text", text: "Hello" },
 * //   { type: "image", url: "https://example.com/image.png" },
 * //   { type: "tool_call", id: "call_123", name: "calculator", args: { a: 1, b: 2 } }
 * // ]
 * ```
 */
export function convertToV1FromChatCompletions(
  message: AIMessage
): Array<ContentBlock.Standard> {
  const blocks: Array<ContentBlock.Standard> = [];
  if (typeof message.content === "string") {
    // Only add text block if content is non-empty
    if (message.content.length > 0) {
      blocks.push({
        type: "text",
        text: message.content,
      });
    }
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

/**
 * Converts a ChatOpenAICompletions message chunk to an array of v1 standard content blocks.
 *
 * This function processes an AI message chunk from OpenAI's chat completions API and converts
 * it to the standardized v1 content block format. It handles both string and array content,
 * as well as tool calls that may be present in the chunk.
 *
 * @param message - The AI message chunk containing OpenAI-formatted content blocks
 * @returns Array of content blocks in v1 standard format
 *
 * @example
 * ```typescript
 * const chunk = new AIMessage("Hello");
 * const standardBlocks = convertToV1FromChatCompletionsChunk(chunk);
 * // Returns: [{ type: "text", text: "Hello" }]
 * ```
 *
 * @example
 * ```typescript
 * const chunk = new AIMessage([
 *   { type: "text", text: "Processing..." }
 * ]);
 * chunk.tool_calls = [
 *   { id: "call_456", name: "search", args: { query: "test" } }
 * ];
 *
 * const standardBlocks = convertToV1FromChatCompletionsChunk(chunk);
 * // Returns:
 * // [
 * //   { type: "text", text: "Processing..." },
 * //   { type: "tool_call", id: "call_456", name: "search", args: { query: "test" } }
 * // ]
 * ```
 */
export function convertToV1FromChatCompletionsChunk(
  message: AIMessage
): Array<ContentBlock.Standard> {
  const blocks: Array<ContentBlock.Standard> = [];
  if (typeof message.content === "string") {
    // Only add text block if content is non-empty
    if (message.content.length > 0) {
      blocks.push({
        type: "text",
        text: message.content,
      });
    }
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

/**
 * Converts an array of ChatOpenAICompletions content blocks to v1 standard content blocks.
 *
 * This function processes content blocks from OpenAI's Chat Completions API format
 * and converts them to the standardized v1 content block format. It handles both
 * OpenAI-specific data blocks (which require conversion) and standard blocks
 * (which are passed through with type assertion).
 *
 * @param blocks - Array of content blocks in ChatOpenAICompletions format
 * @returns Array of content blocks in v1 standard format
 *
 * @example
 * ```typescript
 * const openaiBlocks = [
 *   { type: "text", text: "Hello world" },
 *   { type: "image_url", image_url: { url: "https://example.com/image.png" } }
 * ];
 *
 * const standardBlocks = convertToV1FromChatCompletionsInput(openaiBlocks);
 * // Returns:
 * // [
 * //   { type: "text", text: "Hello world" },
 * //   { type: "image", url: "https://example.com/image.png" }
 * // ]
 * ```
 */
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
  annotation: ContentBlock
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

// Builds a reasoning content block, including id/encrypted_content when present.
function mapReasoningItemToV1(
  item: Record<string, unknown>
): ContentBlock.Standard | undefined {
  if (!_isArray(item.summary)) return undefined;
  const summary = item.summary.reduce<string>((acc, part) => {
    if (_isObject(part) && _isString(part.text)) {
      return `${acc}${part.text}`;
    }
    return acc;
  }, "");
  return {
    type: "reasoning",
    reasoning: summary,
    ...(_isString(item.id) ? { id: item.id } : {}),
    ...(_isString(item.encrypted_content)
      ? { encrypted_content: item.encrypted_content }
      : {}),
  } as ContentBlock.Standard;
}

// Converts a single built-in tool call/result entry into v1 content blocks.
function* mapToolOutputToV1Blocks(
  toolOutput: unknown
): Iterable<ContentBlock.Standard> {
  if (_isContentBlock(toolOutput, "web_search_call")) {
    /**
     * Build args from available action data.
     * The ResponseFunctionWebSearch base type only has id, status, type.
     * The action field (with query, sources, etc.) may be present at
     * runtime when the `include` parameter includes "web_search_call.action.sources".
     */
    const webSearchArgs: Record<string, unknown> = {};
    if (_isObject(toolOutput.action) && _isString(toolOutput.action.query)) {
      webSearchArgs.query = toolOutput.action.query;
    }
    yield {
      id: toolOutput.id,
      type: "server_tool_call",
      name: "web_search",
      args: webSearchArgs,
    };
    // Emit a server_tool_call_result when the search has completed or failed
    if (toolOutput.status === "completed" || toolOutput.status === "failed") {
      const output: Record<string, unknown> = {};
      if (_isObject(toolOutput.action)) {
        output.action = toolOutput.action;
      }
      yield {
        type: "server_tool_call_result",
        toolCallId: _isString(toolOutput.id) ? toolOutput.id : "",
        status: toolOutput.status === "completed" ? "success" : "error",
        output,
      };
    }
    return;
  }
  if (_isContentBlock(toolOutput, "file_search_call")) {
    yield {
      id: toolOutput.id,
      type: "server_tool_call",
      name: "file_search",
      args: {
        queries: _isArray(toolOutput.queries) ? toolOutput.queries : [],
      },
    };
    // Emit a server_tool_call_result when results are available
    if (toolOutput.status === "completed" || toolOutput.status === "failed") {
      yield {
        type: "server_tool_call_result",
        toolCallId: _isString(toolOutput.id) ? toolOutput.id : "",
        status: toolOutput.status === "completed" ? "success" : "error",
        output: _isArray(toolOutput.results)
          ? { results: toolOutput.results }
          : {},
      };
    }
    return;
  }
  if (_isContentBlock(toolOutput, "computer_call")) {
    yield { type: "non_standard", value: toolOutput };
    return;
  }
  if (_isContentBlock(toolOutput, "code_interpreter_call")) {
    if (_isString(toolOutput.code)) {
      yield {
        id: toolOutput.id,
        type: "server_tool_call",
        name: "code_interpreter",
        args: { code: toolOutput.code },
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
            type: "server_tool_call_result",
            toolCallId: toolOutput.id ?? "",
            status: "success",
            output: {
              type: "code_interpreter_output",
              returnCode: returnCode ?? 0,
              stderr: [0, undefined].includes(returnCode)
                ? undefined
                : String(output.logs),
              stdout: [0, undefined].includes(returnCode)
                ? String(output.logs)
                : undefined,
            },
          };
        }
      }
    }
    return;
  }
  if (_isContentBlock(toolOutput, "mcp_call")) {
    yield {
      id: toolOutput.id,
      type: "server_tool_call",
      name: "mcp_call",
      args: toolOutput.input,
    };
    return;
  }
  if (_isContentBlock(toolOutput, "mcp_list_tools")) {
    yield {
      id: toolOutput.id,
      type: "server_tool_call",
      name: "mcp_list_tools",
      args: toolOutput.input,
    };
    return;
  }
  if (_isContentBlock(toolOutput, "mcp_approval_request")) {
    yield { type: "non_standard", value: toolOutput };
    return;
  }
  if (_isContentBlock(toolOutput, "tool_search_call")) {
    const toolSearchArgs: Record<string, unknown> = {};
    if (_isObject(toolOutput.arguments)) {
      Object.assign(toolSearchArgs, toolOutput.arguments);
    }
    const toolSearchCallExtras: Record<string, unknown> = {};
    if (_isString(toolOutput.execution)) {
      toolSearchCallExtras.execution = toolOutput.execution;
    }
    if (_isString(toolOutput.status)) {
      toolSearchCallExtras.status = toolOutput.status;
    }
    if (_isString(toolOutput.call_id)) {
      toolSearchCallExtras.call_id = toolOutput.call_id;
    }
    yield {
      id: _isString(toolOutput.id) ? toolOutput.id : "",
      type: "server_tool_call",
      name: "tool_search",
      args: toolSearchArgs,
      ...(Object.keys(toolSearchCallExtras).length > 0
        ? { extras: toolSearchCallExtras }
        : {}),
    };
    return;
  }
  if (_isContentBlock(toolOutput, "tool_search_output")) {
    const toolSearchOutputExtras: Record<string, unknown> = {
      name: "tool_search",
    };
    if (_isString(toolOutput.execution)) {
      toolSearchOutputExtras.execution = toolOutput.execution;
    }
    yield {
      type: "server_tool_call_result",
      toolCallId: _isString(toolOutput.id) ? toolOutput.id : "",
      status:
        toolOutput.status === "completed"
          ? "success"
          : toolOutput.status === "failed"
            ? "error"
            : "success",
      output: {
        tools: _isArray(toolOutput.tools) ? toolOutput.tools : [],
      },
      extras: toolSearchOutputExtras,
    };
    return;
  }
  if (_isContentBlock(toolOutput, "image_generation_call")) {
    // Convert image_generation_call to proper image content block if result is available
    if (_isString(toolOutput.result)) {
      yield {
        type: "image",
        mimeType: "image/png",
        data: toolOutput.result,
        id: _isString(toolOutput.id) ? toolOutput.id : undefined,
        metadata: {
          status: _isString(toolOutput.status) ? toolOutput.status : undefined,
        },
      };
    }
    // Also yield as non_standard for backwards compatibility
    yield { type: "non_standard", value: toolOutput };
    return;
  }
  if (_isObject(toolOutput)) {
    yield { type: "non_standard", value: toolOutput };
  }
}

/**
 * Converts a ChatOpenAIResponses message to an array of v1 standard content blocks.
 *
 * This function processes an AI message containing OpenAI Responses-specific content blocks
 * and converts them to the standardized v1 content block format. It handles reasoning summaries,
 * text content with annotations, tool calls, and various tool outputs including code interpreter,
 * web search, file search, computer calls, and MCP-related blocks.
 *
 * A response can hold more than one reasoning item (e.g. multiple tool calls
 * in one turn, common on GPT-5.6-class models). When `response_metadata.output`
 * is available, each item's own `id`/`encrypted_content` is preserved and
 * blocks are sorted back into original order, so replay under Zero Data
 * Retention interleaves reasoning and tool calls correctly. Without it (e.g.
 * a hand-built message), falls back to a single reasoning block from
 * `additional_kwargs.reasoning`, as before.
 *
 * @param message - The AI message containing OpenAI Responses-formatted content blocks
 * @returns Array of content blocks in v1 standard format
 *
 * @example
 * ```typescript
 * const message = new AIMessage({
 *   content: [{ type: "text", text: "Hello world", annotations: [] }],
 *   tool_calls: [{ id: "123", name: "calculator", args: { a: 1, b: 2 } }],
 *   additional_kwargs: {
 *     reasoning: { summary: [{ text: "Let me calculate this..." }] },
 *     tool_outputs: [
 *       {
 *         type: "code_interpreter_call",
 *         code: "print('hello')",
 *         outputs: [{ type: "logs", logs: "hello" }]
 *       }
 *     ]
 *   }
 * });
 *
 * const standardBlocks = convertToV1FromResponses(message);
 * // Returns:
 * // [
 * //   { type: "reasoning", reasoning: "Let me calculate this..." },
 * //   { type: "text", text: "Hello world", annotations: [] },
 * //   { type: "tool_call", id: "123", name: "calculator", args: { a: 1, b: 2 } },
 * //   { type: "server_tool_call", name: "code_interpreter", args: { code: "print('hello')" } },
 * //   { type: "server_tool_call_result", toolCallId: "", status: "success", output: { type: "code_interpreter_output", returnCode: 0, stdout: "hello" } }
 * // ]
 * ```
 */
export function convertToV1FromResponses(
  message: AIMessage
): Array<ContentBlock.Standard> {
  const rawOutput = message.response_metadata?.output;
  const hasRawOutput = _isArray(rawOutput) && rawOutput.length > 0;

  // Maps a per-item key (namespaced by type, since ids aren't globally unique) to its original response.output position.
  const positionByKey = new Map<string, number>();
  let messageItemCount = 0;
  let onlyMessageItemIndex: number | undefined;
  if (hasRawOutput) {
    (rawOutput as unknown[]).forEach((rawItem, index) => {
      if (!_isObject(rawItem) || !_isString(rawItem.type)) return;
      if (rawItem.type === "reasoning" && _isString(rawItem.id)) {
        positionByKey.set(`reasoning:${rawItem.id}`, index);
      } else if (
        // These three types all become tool_call blocks keyed by call_id.
        (rawItem.type === "function_call" ||
          rawItem.type === "custom_tool_call" ||
          rawItem.type === "computer_call") &&
        _isString(rawItem.call_id)
      ) {
        positionByKey.set(`tool_call:${rawItem.call_id}`, index);
      } else if (rawItem.type === "message") {
        messageItemCount += 1;
        onlyMessageItemIndex = index;
      } else if (_isString(rawItem.id)) {
        positionByKey.set(`other:${rawItem.type}:${rawItem.id}`, index);
      }
    });
  }
  // Text isn't keyed to a specific "message" item, so only position it when exactly one exists (an unambiguous match).
  const textBlockKey =
    messageItemCount === 1 && onlyMessageItemIndex != null
      ? `message:${onlyMessageItemIndex}`
      : undefined;
  if (textBlockKey != null) {
    positionByKey.set(textBlockKey, onlyMessageItemIndex as number);
  }

  function* iterateContent(): Iterable<
    [block: ContentBlock.Standard, key: string | undefined]
  > {
    if (hasRawOutput) {
      for (const rawItem of rawOutput as unknown[]) {
        if (_isObject(rawItem) && rawItem.type === "reasoning") {
          const block = mapReasoningItemToV1(rawItem);
          if (block) {
            yield [
              block,
              _isString(rawItem.id) ? `reasoning:${rawItem.id}` : undefined,
            ];
          }
        }
      }
    } else if (
      _isObject(message.additional_kwargs?.reasoning) &&
      _isArray(message.additional_kwargs.reasoning.summary)
    ) {
      const block = mapReasoningItemToV1(message.additional_kwargs.reasoning);
      if (block) yield [block, undefined];
    }

    const content =
      typeof message.content === "string"
        ? [{ type: "text", text: message.content }]
        : message.content;
    for (const block of content) {
      if (_isContentBlock(block, "text")) {
        const {
          text,
          annotations,
          phase,
          extras: existingExtras,
          ...rest
        } = block;
        const extras: Record<string, unknown> = _isObject(existingExtras)
          ? { ...(existingExtras as Record<string, unknown>) }
          : {};
        if (_isString(phase)) {
          extras.phase = phase;
        }
        const extrasSpread = Object.keys(extras).length > 0 ? { extras } : {};
        yield [
          {
            ...rest,
            ...extrasSpread,
            type: "text",
            text: String(text),
            ...(Array.isArray(annotations)
              ? { annotations: annotations.map(convertResponsesAnnotation) }
              : {}),
          },
          textBlockKey,
        ];
      }
    }
    for (const toolCall of message.tool_calls ?? []) {
      yield [
        {
          type: "tool_call",
          id: toolCall.id,
          name: toolCall.name,
          args: toolCall.args,
        },
        toolCall.id ? `tool_call:${toolCall.id}` : undefined,
      ];
    }
    if (
      _isObject(message.additional_kwargs) &&
      _isArray(message.additional_kwargs.tool_outputs)
    ) {
      for (const toolOutput of message.additional_kwargs.tool_outputs) {
        // All blocks from one tool output share this key -- fine since the API returns a call and its result as one item.
        const key =
          _isObject(toolOutput) &&
          _isString(toolOutput.type) &&
          _isString(toolOutput.id)
            ? `other:${toolOutput.type}:${toolOutput.id}`
            : undefined;
        for (const block of mapToolOutputToV1Blocks(toolOutput)) {
          yield [block, key];
        }
      }
    }
  }

  const withKeys = Array.from(iterateContent());
  if (!hasRawOutput) {
    return withKeys.map(([block]) => block);
  }
  // Stable sort by original position; unkeyed blocks sort last, in push order.
  return withKeys
    .map(([block, key], pushIndex) => ({
      block,
      pushIndex,
      position: key != null ? positionByKey.get(key) : undefined,
    }))
    .sort((a, b) => {
      const aPos = a.position ?? Number.POSITIVE_INFINITY;
      const bPos = b.position ?? Number.POSITIVE_INFINITY;
      if (aPos !== bPos) return aPos - bPos;
      return a.pushIndex - b.pushIndex;
    })
    .map((entry) => entry.block);
}

/**
 * Converts a ChatOpenAIResponses message chunk to an array of v1 standard content blocks.
 *
 * This function processes an AI message chunk containing OpenAI-specific content blocks
 * and converts them to the standardized v1 content block format. It handles both the
 * regular message content and tool call chunks that are specific to streaming responses.
 *
 * @param message - The AI message chunk containing OpenAI-formatted content blocks
 * @returns Array of content blocks in v1 standard format
 *
 * @example
 * ```typescript
 * const messageChunk = new AIMessageChunk({
 *   content: [{ type: "text", text: "Hello" }],
 *   tool_call_chunks: [
 *     { id: "call_123", name: "calculator", args: '{"a": 1' }
 *   ]
 * });
 *
 * const standardBlocks = convertToV1FromResponsesChunk(messageChunk);
 * // Returns:
 * // [
 * //   { type: "text", text: "Hello" },
 * //   { type: "tool_call_chunk", id: "call_123", name: "calculator", args: '{"a": 1' }
 * // ]
 * ```
 */
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

export const ChatOpenAITranslator: StandardContentBlockTranslator = {
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
