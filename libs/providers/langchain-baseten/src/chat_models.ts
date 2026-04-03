/**
 * ChatBaseten — Baseten LLM provider for LangChain.
 *
 * Extends ChatOpenAI to target Baseten's OpenAI-compatible inference API.
 * Includes streaming fixes for TensorRT-LLM serving quirks ported from
 * the Python `langchain-baseten` package.
 *
 * @packageDocumentation
 */

import { ChatOpenAI } from "@langchain/openai";
import type { LangSmithParams } from "@langchain/core/language_models/chat_models";
import type { BaseMessage } from "@langchain/core/messages";
import { AIMessageChunk } from "@langchain/core/messages";
import type { ToolCallChunk } from "@langchain/core/messages/tool";
import type { ChatGenerationChunk, ChatResult } from "@langchain/core/outputs";
import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  DEFAULT_BASE_URL,
  DEFAULT_API_KEY_ENV_VAR,
  normalizeModelUrl,
  type BasetenChatInput,
} from "./types.js";

function resolveApiKey(fields?: BasetenChatInput): string {
  if (fields?.basetenApiKey) return fields.basetenApiKey;
  if (typeof fields?.apiKey === "string") return fields.apiKey;
  if (typeof fields?.openAIApiKey === "string") return fields.openAIApiKey;

  const envKey = getEnvironmentVariable(DEFAULT_API_KEY_ENV_VAR);
  if (envKey) return envKey;

  throw new Error(
    `Baseten API key not found. Provide it via the "basetenApiKey" constructor ` +
      `option or set the ${DEFAULT_API_KEY_ENV_VAR} environment variable.\n\n` +
      `  Get your API key at https://app.baseten.co/settings/api-keys`
  );
}

/**
 * Fix TensorRT-LLM tool-call streaming quirks:
 * - Fold same-index deltas within a single SSE event into one entry
 * - Clear `id` on continuation deltas (no `name`) so `concat()` merges by index
 *
 * See: Python `langchain-baseten._normalize_tool_call_chunks`
 */
export function normalizeToolCallChunks(
  chunks: ToolCallChunk[]
): ToolCallChunk[] {
  if (chunks.length <= 1 && (!chunks[0] || chunks[0].name)) return chunks;

  const byIndex = new Map<number, ToolCallChunk>();

  for (const tc of chunks) {
    if (tc.index == null) continue;
    const existing = byIndex.get(tc.index);
    if (!existing) {
      byIndex.set(tc.index, { ...tc });
    } else {
      byIndex.set(tc.index, {
        ...existing,
        name: existing.name ?? tc.name,
        args: (existing.args ?? "") + (tc.args ?? ""),
        id: existing.id ?? tc.id,
      });
    }
  }

  const result: ToolCallChunk[] = [];
  for (const tc of byIndex.values()) {
    if (!tc.name && tc.id != null) {
      result.push({ ...tc, id: undefined });
    } else {
      result.push(tc);
    }
  }

  return result;
}

function chunkHasContent(message: AIMessageChunk): boolean {
  if (typeof message.content === "string" && message.content.length > 0)
    return true;
  if (Array.isArray(message.content) && message.content.length > 0) return true;
  if (message.tool_call_chunks && message.tool_call_chunks.length > 0)
    return true;
  return false;
}

function inferModelNameFromUrl(url: string): string {
  const match = /model-([a-zA-Z0-9]+)/.exec(url);
  return match ? `model-${match[1]}` : "baseten-model";
}

/**
 * Baseten chat model for LangChain.
 *
 * Wraps {@link ChatOpenAI} pointed at `https://inference.baseten.co/v1`.
 * Streaming, tool calling, structured output, and token tracking are
 * all inherited from ChatOpenAI.
 *
 * @example
 * ```typescript
 * import { ChatBaseten } from "@langchain/baseten";
 *
 * const model = new ChatBaseten({
 *   model: "deepseek-ai/DeepSeek-V3.1",
 * });
 *
 * const result = await model.invoke("What is the capital of France?");
 * ```
 *
 * @example
 * ```typescript
 * import { ChatBaseten } from "@langchain/baseten";
 * import { HumanMessage } from "@langchain/core/messages";
 *
 * const model = new ChatBaseten({
 *   model: "deepseek-ai/DeepSeek-V3.1",
 *   temperature: 0.7,
 * });
 *
 * const result = await model.invoke([
 *   new HumanMessage("Tell me a joke"),
 * ]);
 * ```
 */
export class ChatBaseten extends ChatOpenAI {
  static lc_name() {
    return "ChatBaseten";
  }

  constructor(fields?: BasetenChatInput) {
    const apiKey = resolveApiKey(fields);

    let baseURL: string;
    let model: string;

    if (fields?.modelUrl) {
      baseURL = normalizeModelUrl(fields.modelUrl);
      model = fields.model ?? inferModelNameFromUrl(fields.modelUrl);
    } else {
      baseURL = fields?.baseURL ?? DEFAULT_BASE_URL;
      model = fields?.model ?? "";
    }

    const {
      basetenApiKey: _basetenApiKey,
      baseURL: _baseURL,
      modelUrl: _modelUrl,
      configuration,
      ...rest
    } = fields ?? {};

    super({
      ...rest,
      model,
      apiKey,
      streamUsage: rest.streamUsage ?? true,
      configuration: {
        ...configuration,
        baseURL,
      },
    });
  }

  override getName(): string {
    return "ChatBaseten";
  }

  override getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    const params = super.getLsParams(options);
    return {
      ...params,
      ls_provider: "baseten",
    };
  }

  override async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const result = await super._generate(messages, options, runManager);
    for (const generation of result.generations) {
      generation.message.response_metadata = {
        ...generation.message.response_metadata,
        model_provider: "baseten",
      };
    }
    return result;
  }

  // Reasoning content (`additional_kwargs.reasoning_content`) is handled by
  // the parent ChatOpenAI via its completions converters — no override needed.

  override async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    for await (const chunk of super._streamResponseChunks(
      messages,
      options,
      runManager
    )) {
      const message = chunk.message;

      if (AIMessageChunk.isInstance(message)) {
        if (message.tool_call_chunks && message.tool_call_chunks.length > 0) {
          message.tool_call_chunks = normalizeToolCallChunks(
            message.tool_call_chunks
          );
        }

        // Baseten sends cumulative usage on every content chunk; strip it so
        // LangChain only counts the final usage-only chunk.
        if (message.usage_metadata && chunkHasContent(message)) {
          message.usage_metadata = undefined;
        }

        message.response_metadata = {
          ...message.response_metadata,
          model_provider: "baseten",
        };
      }

      yield chunk;
    }
  }
}
