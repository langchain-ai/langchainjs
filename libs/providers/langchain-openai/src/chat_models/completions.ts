import { OpenAI as OpenAIClient } from "openai";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  AIMessage,
  AIMessageChunk,
  type BaseMessage,
  ChatMessage,
  ChatMessageChunk,
  FunctionMessageChunk,
  HumanMessageChunk,
  SystemMessageChunk,
  ToolMessageChunk,
  OpenAIToolCall,
  isAIMessage,
  type UsageMetadata,
  type BaseMessageFields,
} from "@langchain/core/messages";
import {
  ChatGenerationChunk,
  type ChatGeneration,
  type ChatResult,
} from "@langchain/core/outputs";
import { NewTokenIndices } from "@langchain/core/callbacks/base";
import {
  makeInvalidToolCall,
  parseToolCall,
} from "@langchain/core/output_parsers/openai_tools";
import type { ToolCallChunk } from "@langchain/core/messages/tool";
import { wrapOpenAIClientError } from "../utils/client.js";
import {
  OpenAIToolChoice,
  formatToOpenAIToolChoice,
  _convertToOpenAITool,
} from "../utils/tools.js";
import {
  handleMultiModalOutput,
  _convertOpenAIResponsesUsageToLangChainUsage,
} from "../utils/output.js";
import { _convertMessagesToOpenAIParams } from "../utils/message_inputs.js";
import { _convertToResponsesMessageFromV1 } from "../utils/standard.js";
import { isReasoningModel } from "../utils/misc.js";
import { BaseChatOpenAICallOptions } from "./base.js";
import { BaseChatOpenAI } from "./base.js";

export interface ChatOpenAICompletionsCallOptions
  extends BaseChatOpenAICallOptions {}

type ChatCompletionsInvocationParams = Omit<
  OpenAIClient.Chat.Completions.ChatCompletionCreateParams,
  "messages"
>;

/**
 * OpenAI Completions API implementation.
 * @internal
 */
export class ChatOpenAICompletions<
  CallOptions extends ChatOpenAICompletionsCallOptions = ChatOpenAICompletionsCallOptions
> extends BaseChatOpenAI<CallOptions> {
  /** @internal */
  override invocationParams(
    options?: this["ParsedCallOptions"],
    extra?: { streaming?: boolean }
  ): ChatCompletionsInvocationParams {
    let strict: boolean | undefined;
    if (options?.strict !== undefined) {
      strict = options.strict;
    } else if (this.supportsStrictToolCalling !== undefined) {
      strict = this.supportsStrictToolCalling;
    }

    let streamOptionsConfig = {};
    if (options?.stream_options !== undefined) {
      streamOptionsConfig = { stream_options: options.stream_options };
    } else if (this.streamUsage && (this.streaming || extra?.streaming)) {
      streamOptionsConfig = { stream_options: { include_usage: true } };
    }

    const params: Partial<ChatCompletionsInvocationParams> = {
      model: this.model,
      temperature: this.temperature,
      top_p: this.topP,
      frequency_penalty: this.frequencyPenalty,
      presence_penalty: this.presencePenalty,
      logprobs: this.logprobs,
      top_logprobs: this.topLogprobs,
      n: this.n,
      logit_bias: this.logitBias,
      stop: options?.stop ?? this.stopSequences,
      user: this.user,
      // if include_usage is set or streamUsage then stream must be set to true.
      stream: this.streaming,
      functions: options?.functions,
      function_call: options?.function_call,
      tools: options?.tools?.length
        ? options.tools.map((tool) =>
            this._convertChatOpenAIToolToCompletionsTool(tool, { strict })
          )
        : undefined,
      tool_choice: formatToOpenAIToolChoice(
        options?.tool_choice as OpenAIToolChoice
      ),
      response_format: this._getResponseFormat(options?.response_format),
      seed: options?.seed,
      ...streamOptionsConfig,
      parallel_tool_calls: options?.parallel_tool_calls,
      ...(this.audio || options?.audio
        ? { audio: this.audio || options?.audio }
        : {}),
      ...(this.modalities || options?.modalities
        ? { modalities: this.modalities || options?.modalities }
        : {}),
      ...this.modelKwargs,
      prompt_cache_key: options?.promptCacheKey ?? this.promptCacheKey,
      verbosity: options?.verbosity ?? this.verbosity,
    };
    if (options?.prediction !== undefined) {
      params.prediction = options.prediction;
    }
    if (this.service_tier !== undefined) {
      params.service_tier = this.service_tier;
    }
    if (options?.service_tier !== undefined) {
      params.service_tier = options.service_tier;
    }
    const reasoning = this._getReasoningParams(options);
    if (reasoning !== undefined && reasoning.effort !== undefined) {
      params.reasoning_effort = reasoning.effort;
    }
    if (isReasoningModel(params.model)) {
      params.max_completion_tokens =
        this.maxTokens === -1 ? undefined : this.maxTokens;
    } else {
      params.max_tokens = this.maxTokens === -1 ? undefined : this.maxTokens;
    }

    return params as ChatCompletionsInvocationParams;
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const usageMetadata = {} as UsageMetadata;
    const params = this.invocationParams(options);
    const messagesMapped: OpenAIClient.Chat.Completions.ChatCompletionMessageParam[] =
      _convertMessagesToOpenAIParams(messages, this.model);

    if (params.stream) {
      const stream = this._streamResponseChunks(messages, options, runManager);
      const finalChunks: Record<number, ChatGenerationChunk> = {};
      for await (const chunk of stream) {
        chunk.message.response_metadata = {
          ...chunk.generationInfo,
          ...chunk.message.response_metadata,
        };
        const index =
          (chunk.generationInfo as NewTokenIndices)?.completion ?? 0;
        if (finalChunks[index] === undefined) {
          finalChunks[index] = chunk;
        } else {
          finalChunks[index] = finalChunks[index].concat(chunk);
        }
      }
      const generations = Object.entries(finalChunks)
        .sort(([aKey], [bKey]) => parseInt(aKey, 10) - parseInt(bKey, 10))
        .map(([_, value]) => value);

      const { functions, function_call } = this.invocationParams(options);

      // OpenAI does not support token usage report under stream mode,
      // fallback to estimation.

      const promptTokenUsage = await this._getEstimatedTokenCountFromPrompt(
        messages,
        functions,
        function_call
      );
      const completionTokenUsage = await this._getNumTokensFromGenerations(
        generations
      );

      usageMetadata.input_tokens = promptTokenUsage;
      usageMetadata.output_tokens = completionTokenUsage;
      usageMetadata.total_tokens = promptTokenUsage + completionTokenUsage;
      return {
        generations,
        llmOutput: {
          estimatedTokenUsage: {
            promptTokens: usageMetadata.input_tokens,
            completionTokens: usageMetadata.output_tokens,
            totalTokens: usageMetadata.total_tokens,
          },
        },
      };
    } else {
      const data = await this.completionWithRetry(
        {
          ...params,
          stream: false,
          messages: messagesMapped,
        },
        {
          signal: options?.signal,
          ...options?.options,
        }
      );

      const {
        completion_tokens: completionTokens,
        prompt_tokens: promptTokens,
        total_tokens: totalTokens,
        prompt_tokens_details: promptTokensDetails,
        completion_tokens_details: completionTokensDetails,
      } = data?.usage ?? {};

      if (completionTokens) {
        usageMetadata.output_tokens =
          (usageMetadata.output_tokens ?? 0) + completionTokens;
      }

      if (promptTokens) {
        usageMetadata.input_tokens =
          (usageMetadata.input_tokens ?? 0) + promptTokens;
      }

      if (totalTokens) {
        usageMetadata.total_tokens =
          (usageMetadata.total_tokens ?? 0) + totalTokens;
      }

      if (
        promptTokensDetails?.audio_tokens !== null ||
        promptTokensDetails?.cached_tokens !== null
      ) {
        usageMetadata.input_token_details = {
          ...(promptTokensDetails?.audio_tokens !== null && {
            audio: promptTokensDetails?.audio_tokens,
          }),
          ...(promptTokensDetails?.cached_tokens !== null && {
            cache_read: promptTokensDetails?.cached_tokens,
          }),
        };
      }

      if (
        completionTokensDetails?.audio_tokens !== null ||
        completionTokensDetails?.reasoning_tokens !== null
      ) {
        usageMetadata.output_token_details = {
          ...(completionTokensDetails?.audio_tokens !== null && {
            audio: completionTokensDetails?.audio_tokens,
          }),
          ...(completionTokensDetails?.reasoning_tokens !== null && {
            reasoning: completionTokensDetails?.reasoning_tokens,
          }),
        };
      }

      const generations: ChatGeneration[] = [];
      for (const part of data?.choices ?? []) {
        const text = part.message?.content ?? "";
        const generation: ChatGeneration = {
          text,
          message: this._convertCompletionsMessageToBaseMessage(
            part.message ?? { role: "assistant" },
            data
          ),
        };
        generation.generationInfo = {
          ...(part.finish_reason ? { finish_reason: part.finish_reason } : {}),
          ...(part.logprobs ? { logprobs: part.logprobs } : {}),
        };
        if (isAIMessage(generation.message)) {
          generation.message.usage_metadata = usageMetadata;
        }
        // Fields are not serialized unless passed to the constructor
        // Doing this ensures all fields on the message are serialized
        generation.message = new AIMessage(
          Object.fromEntries(
            Object.entries(generation.message).filter(
              ([key]) => !key.startsWith("lc_")
            )
          ) as BaseMessageFields
        );
        generations.push(generation);
      }
      return {
        generations,
        llmOutput: {
          tokenUsage: {
            promptTokens: usageMetadata.input_tokens,
            completionTokens: usageMetadata.output_tokens,
            totalTokens: usageMetadata.total_tokens,
          },
        },
      };
    }
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const messagesMapped: OpenAIClient.Chat.Completions.ChatCompletionMessageParam[] =
      _convertMessagesToOpenAIParams(messages, this.model);

    const params = {
      ...this.invocationParams(options, {
        streaming: true,
      }),
      messages: messagesMapped,
      stream: true as const,
    };
    let defaultRole: OpenAIClient.Chat.ChatCompletionRole | undefined;

    const streamIterable = await this.completionWithRetry(params, options);
    let usage: OpenAIClient.Completions.CompletionUsage | undefined;
    for await (const data of streamIterable) {
      const choice = data?.choices?.[0];
      if (data.usage) {
        usage = data.usage;
      }
      if (!choice) {
        continue;
      }

      const { delta } = choice;
      if (!delta) {
        continue;
      }
      const chunk = this._convertCompletionsDeltaToBaseMessageChunk(
        delta,
        data,
        defaultRole
      );
      defaultRole = delta.role ?? defaultRole;
      const newTokenIndices = {
        prompt: options.promptIndex ?? 0,
        completion: choice.index ?? 0,
      };
      if (typeof chunk.content !== "string") {
        console.log(
          "[WARNING]: Received non-string content from OpenAI. This is currently not supported."
        );
        continue;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const generationInfo: Record<string, any> = { ...newTokenIndices };
      if (choice.finish_reason != null) {
        generationInfo.finish_reason = choice.finish_reason;
        // Only include system fingerprint in the last chunk for now
        // to avoid concatenation issues
        generationInfo.system_fingerprint = data.system_fingerprint;
        generationInfo.model_name = data.model;
        generationInfo.service_tier = data.service_tier;
      }
      if (this.logprobs) {
        generationInfo.logprobs = choice.logprobs;
      }
      const generationChunk = new ChatGenerationChunk({
        message: chunk,
        text: chunk.content,
        generationInfo,
      });
      yield generationChunk;
      await runManager?.handleLLMNewToken(
        generationChunk.text ?? "",
        newTokenIndices,
        undefined,
        undefined,
        undefined,
        { chunk: generationChunk }
      );
    }
    if (usage) {
      const inputTokenDetails = {
        ...(usage.prompt_tokens_details?.audio_tokens !== null && {
          audio: usage.prompt_tokens_details?.audio_tokens,
        }),
        ...(usage.prompt_tokens_details?.cached_tokens !== null && {
          cache_read: usage.prompt_tokens_details?.cached_tokens,
        }),
      };
      const outputTokenDetails = {
        ...(usage.completion_tokens_details?.audio_tokens !== null && {
          audio: usage.completion_tokens_details?.audio_tokens,
        }),
        ...(usage.completion_tokens_details?.reasoning_tokens !== null && {
          reasoning: usage.completion_tokens_details?.reasoning_tokens,
        }),
      };
      const generationChunk = new ChatGenerationChunk({
        message: new AIMessageChunk({
          content: "",
          response_metadata: {
            usage: { ...usage },
          },
          usage_metadata: {
            input_tokens: usage.prompt_tokens,
            output_tokens: usage.completion_tokens,
            total_tokens: usage.total_tokens,
            ...(Object.keys(inputTokenDetails).length > 0 && {
              input_token_details: inputTokenDetails,
            }),
            ...(Object.keys(outputTokenDetails).length > 0 && {
              output_token_details: outputTokenDetails,
            }),
          },
        }),
        text: "",
      });
      yield generationChunk;
    }
    if (options.signal?.aborted) {
      throw new Error("AbortError");
    }
  }

  async completionWithRetry(
    request: OpenAIClient.Chat.ChatCompletionCreateParamsStreaming,
    requestOptions?: OpenAIClient.RequestOptions
  ): Promise<AsyncIterable<OpenAIClient.Chat.Completions.ChatCompletionChunk>>;

  async completionWithRetry(
    request: OpenAIClient.Chat.ChatCompletionCreateParamsNonStreaming,
    requestOptions?: OpenAIClient.RequestOptions
  ): Promise<OpenAIClient.Chat.Completions.ChatCompletion>;

  async completionWithRetry(
    request: OpenAIClient.Chat.ChatCompletionCreateParams,
    requestOptions?: OpenAIClient.RequestOptions
  ): Promise<
    | AsyncIterable<OpenAIClient.Chat.Completions.ChatCompletionChunk>
    | OpenAIClient.Chat.Completions.ChatCompletion
  > {
    const clientOptions = await this._getClientOptions(requestOptions);
    const isParseableFormat =
      request.response_format && request.response_format.type === "json_schema";
    return this.caller.call(async () => {
      try {
        if (isParseableFormat && !request.stream) {
          return await this.client.chat.completions.parse(
            request,
            clientOptions
          );
        } else {
          return await this.client.chat.completions.create(
            request,
            clientOptions
          );
        }
      } catch (e) {
        const error = wrapOpenAIClientError(e);
        throw error;
      }
    });
  }

  /** @internal */
  protected _convertCompletionsMessageToBaseMessage(
    message: OpenAIClient.Chat.Completions.ChatCompletionMessage,
    rawResponse: OpenAIClient.Chat.Completions.ChatCompletion
  ): BaseMessage {
    const rawToolCalls: OpenAIToolCall[] | undefined = message.tool_calls as
      | OpenAIToolCall[]
      | undefined;
    switch (message.role) {
      case "assistant": {
        const toolCalls = [];
        const invalidToolCalls = [];
        for (const rawToolCall of rawToolCalls ?? []) {
          try {
            toolCalls.push(parseToolCall(rawToolCall, { returnId: true }));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } catch (e: any) {
            invalidToolCalls.push(makeInvalidToolCall(rawToolCall, e.message));
          }
        }
        const additional_kwargs: Record<string, unknown> = {
          function_call: message.function_call,
          tool_calls: rawToolCalls,
        };
        if (this.__includeRawResponse !== undefined) {
          additional_kwargs.__raw_response = rawResponse;
        }
        const response_metadata: Record<string, unknown> | undefined = {
          model_provider: "openai",
          model_name: rawResponse.model,
          ...(rawResponse.system_fingerprint
            ? {
                usage: { ...rawResponse.usage },
                system_fingerprint: rawResponse.system_fingerprint,
              }
            : {}),
        };

        if (message.audio) {
          additional_kwargs.audio = message.audio;
        }

        const content = handleMultiModalOutput(
          message.content || "",
          rawResponse.choices?.[0]?.message
        );
        return new AIMessage({
          content,
          tool_calls: toolCalls,
          invalid_tool_calls: invalidToolCalls,
          additional_kwargs,
          response_metadata,
          id: rawResponse.id,
        });
      }
      default:
        return new ChatMessage(
          message.content || "",
          message.role ?? "unknown"
        );
    }
  }

  /** @internal */
  protected _convertCompletionsDeltaToBaseMessageChunk(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delta: Record<string, any>,
    rawResponse: OpenAIClient.Chat.Completions.ChatCompletionChunk,
    defaultRole?: OpenAIClient.Chat.ChatCompletionRole
  ) {
    const role = delta.role ?? defaultRole;
    const content = delta.content ?? "";
    let additional_kwargs: Record<string, unknown>;
    if (delta.function_call) {
      additional_kwargs = {
        function_call: delta.function_call,
      };
    } else if (delta.tool_calls) {
      additional_kwargs = {
        tool_calls: delta.tool_calls,
      };
    } else {
      additional_kwargs = {};
    }
    if (this.__includeRawResponse) {
      additional_kwargs.__raw_response = rawResponse;
    }

    if (delta.audio) {
      additional_kwargs.audio = {
        ...delta.audio,
        index: rawResponse.choices[0].index,
      };
    }

    const response_metadata = {
      model_provider: "openai",
      usage: { ...rawResponse.usage },
    };
    if (role === "user") {
      return new HumanMessageChunk({ content, response_metadata });
    } else if (role === "assistant") {
      const toolCallChunks: ToolCallChunk[] = [];
      if (Array.isArray(delta.tool_calls)) {
        for (const rawToolCall of delta.tool_calls) {
          toolCallChunks.push({
            name: rawToolCall.function?.name,
            args: rawToolCall.function?.arguments,
            id: rawToolCall.id,
            index: rawToolCall.index,
            type: "tool_call_chunk",
          });
        }
      }
      return new AIMessageChunk({
        content,
        tool_call_chunks: toolCallChunks,
        additional_kwargs,
        id: rawResponse.id,
        response_metadata,
      });
    } else if (role === "system") {
      return new SystemMessageChunk({ content, response_metadata });
    } else if (role === "developer") {
      return new SystemMessageChunk({
        content,
        response_metadata,
        additional_kwargs: {
          __openai_role__: "developer",
        },
      });
    } else if (role === "function") {
      return new FunctionMessageChunk({
        content,
        additional_kwargs,
        name: delta.name,
        response_metadata,
      });
    } else if (role === "tool") {
      return new ToolMessageChunk({
        content,
        additional_kwargs,
        tool_call_id: delta.tool_call_id,
        response_metadata,
      });
    } else {
      return new ChatMessageChunk({ content, role, response_metadata });
    }
  }
}
