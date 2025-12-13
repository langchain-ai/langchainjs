import { OpenAI as OpenAIClient } from "openai";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import { ChatGenerationChunk, type ChatResult } from "@langchain/core/outputs";
import { isOpenAITool as isOpenAIFunctionTool } from "@langchain/core/language_models/base";
import { wrapOpenAIClientError } from "../utils/client.js";
import {
  ChatOpenAIToolType,
  convertCompletionsCustomTool,
  formatToOpenAIToolChoice,
  isBuiltInTool,
  isBuiltInToolChoice,
  isCustomTool,
  isOpenAICustomTool,
  ResponsesTool,
} from "../utils/tools.js";
import { BaseChatOpenAI, BaseChatOpenAICallOptions } from "./base.js";
import {
  convertMessagesToResponsesInput,
  convertResponsesDeltaToChatGenerationChunk,
  convertResponsesMessageToAIMessage,
} from "../converters/responses.js";
import { OpenAIVerbosityParam } from "../types.js";

export interface ChatOpenAIResponsesCallOptions
  extends BaseChatOpenAICallOptions {
  /**
   * Configuration options for a text response from the model. Can be plain text or
   * structured JSON data.
   */
  text?: OpenAIClient.Responses.ResponseCreateParams["text"];

  /**
   * The truncation strategy to use for the model response.
   */
  truncation?: OpenAIClient.Responses.ResponseCreateParams["truncation"];

  /**
   * Specify additional output data to include in the model response.
   */
  include?: OpenAIClient.Responses.ResponseCreateParams["include"];

  /**
   * The unique ID of the previous response to the model. Use this to create multi-turn
   * conversations.
   */
  previous_response_id?: OpenAIClient.Responses.ResponseCreateParams["previous_response_id"];

  /**
   * The verbosity of the model's response.
   */
  verbosity?: OpenAIVerbosityParam;
}

export type ChatResponsesInvocationParams = Omit<
  OpenAIClient.Responses.ResponseCreateParams,
  "input"
>;

/**
 * OpenAI Responses API implementation.
 *
 * Will be exported in a later version of @langchain/openai.
 *
 * @internal
 */
export class ChatOpenAIResponses<
  CallOptions extends ChatOpenAIResponsesCallOptions = ChatOpenAIResponsesCallOptions
> extends BaseChatOpenAI<CallOptions> {
  override invocationParams(
    options?: this["ParsedCallOptions"]
  ): ChatResponsesInvocationParams {
    let strict: boolean | undefined;
    if (options?.strict !== undefined) {
      strict = options.strict;
    }
    if (strict === undefined && this.supportsStrictToolCalling !== undefined) {
      strict = this.supportsStrictToolCalling;
    }

    const params: ChatResponsesInvocationParams = {
      model: this.model,
      temperature: this.temperature,
      top_p: this.topP,
      user: this.user,

      // if include_usage is set or streamUsage then stream must be set to true.
      stream: this.streaming,
      previous_response_id: options?.previous_response_id,
      truncation: options?.truncation,
      include: options?.include,
      tools: options?.tools?.length
        ? this._reduceChatOpenAITools(options.tools, {
            stream: this.streaming,
            strict,
          })
        : undefined,
      tool_choice: isBuiltInToolChoice(options?.tool_choice)
        ? options?.tool_choice
        : (() => {
            const formatted = formatToOpenAIToolChoice(options?.tool_choice);
            if (typeof formatted === "object" && "type" in formatted) {
              if (formatted.type === "function") {
                return { type: "function", name: formatted.function.name };
              } else if (formatted.type === "allowed_tools") {
                return {
                  type: "allowed_tools",
                  mode: formatted.allowed_tools.mode,
                  tools: formatted.allowed_tools.tools,
                };
              } else if (formatted.type === "custom") {
                return {
                  type: "custom",
                  name: formatted.custom.name,
                };
              }
            }
            return undefined;
          })(),
      text: (() => {
        if (options?.text) return options.text;
        const format = this._getResponseFormat(options?.response_format);
        if (format?.type === "json_schema") {
          if (format.json_schema.schema != null) {
            return {
              format: {
                type: "json_schema",
                schema: format.json_schema.schema,
                description: format.json_schema.description,
                name: format.json_schema.name,
                strict: format.json_schema.strict,
              },
              verbosity: options?.verbosity,
            };
          }
          return undefined;
        }
        return { format, verbosity: options?.verbosity };
      })(),
      parallel_tool_calls: options?.parallel_tool_calls,
      max_output_tokens: this.maxTokens === -1 ? undefined : this.maxTokens,
      prompt_cache_key: options?.promptCacheKey ?? this.promptCacheKey,
      prompt_cache_retention:
        options?.promptCacheRetention ?? this.promptCacheRetention,
      ...(this.zdrEnabled ? { store: false } : {}),
      ...this.modelKwargs,
    };

    const reasoning = this._getReasoningParams(options);

    if (reasoning !== undefined) {
      params.reasoning = reasoning;
    }

    return params;
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"]
  ): Promise<ChatResult> {
    const invocationParams = this.invocationParams(options);
    if (invocationParams.stream) {
      const stream = this._streamResponseChunks(messages, options);
      let finalChunk: ChatGenerationChunk | undefined;
      for await (const chunk of stream) {
        chunk.message.response_metadata = {
          ...chunk.generationInfo,
          ...chunk.message.response_metadata,
        };
        finalChunk = finalChunk?.concat(chunk) ?? chunk;
      }

      return {
        generations: finalChunk ? [finalChunk] : [],
        llmOutput: {
          estimatedTokenUsage: (finalChunk?.message as AIMessage | undefined)
            ?.usage_metadata,
        },
      };
    } else {
      const data = await this.completionWithRetry(
        {
          input: convertMessagesToResponsesInput({
            messages,
            zdrEnabled: this.zdrEnabled ?? false,
            model: this.model,
          }),
          ...invocationParams,
          stream: false,
        },
        { signal: options?.signal, ...options?.options }
      );

      return {
        generations: [
          {
            text: data.output_text,
            message: convertResponsesMessageToAIMessage(data),
          },
        ],
        llmOutput: {
          id: data.id,
          estimatedTokenUsage: data.usage
            ? {
                promptTokens: data.usage.input_tokens,
                completionTokens: data.usage.output_tokens,
                totalTokens: data.usage.total_tokens,
              }
            : undefined,
        },
      };
    }
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const streamIterable = await this.completionWithRetry(
      {
        ...this.invocationParams(options),
        input: convertMessagesToResponsesInput({
          messages,
          zdrEnabled: this.zdrEnabled ?? false,
          model: this.model,
        }),
        stream: true,
      },
      options
    );

    for await (const data of streamIterable) {
      const chunk = convertResponsesDeltaToChatGenerationChunk(data);
      if (chunk == null) continue;
      yield chunk;
      await runManager?.handleLLMNewToken(
        chunk.text || "",
        {
          prompt: options.promptIndex ?? 0,
          completion: 0,
        },
        undefined,
        undefined,
        undefined,
        { chunk }
      );
    }
  }

  /**
   * Calls the Responses API with retry logic in case of failures.
   * @param request The request to send to the OpenAI API.
   * @param options Optional configuration for the API call.
   * @returns The response from the OpenAI API.
   */
  async completionWithRetry(
    request: OpenAIClient.Responses.ResponseCreateParamsStreaming,
    requestOptions?: OpenAIClient.RequestOptions
  ): Promise<AsyncIterable<OpenAIClient.Responses.ResponseStreamEvent>>;

  async completionWithRetry(
    request: OpenAIClient.Responses.ResponseCreateParamsNonStreaming,
    requestOptions?: OpenAIClient.RequestOptions
  ): Promise<OpenAIClient.Responses.Response>;

  async completionWithRetry(
    request: OpenAIClient.Responses.ResponseCreateParams,
    requestOptions?: OpenAIClient.RequestOptions
  ): Promise<
    | AsyncIterable<OpenAIClient.Responses.ResponseStreamEvent>
    | OpenAIClient.Responses.Response
  > {
    return this.caller.call(async () => {
      const clientOptions = this._getClientOptions(requestOptions);
      try {
        // use parse if dealing with json_schema
        if (request.text?.format?.type === "json_schema" && !request.stream) {
          return await this.client.responses.parse(request, clientOptions);
        }
        return await this.client.responses.create(request, clientOptions);
      } catch (e) {
        const error = wrapOpenAIClientError(e);
        throw error;
      }
    });
  }

  /** @internal */
  protected _reduceChatOpenAITools(
    tools: ChatOpenAIToolType[],
    fields: { stream?: boolean; strict?: boolean }
  ): ResponsesTool[] {
    const reducedTools: ResponsesTool[] = [];
    for (const tool of tools) {
      if (isBuiltInTool(tool)) {
        if (tool.type === "image_generation" && fields?.stream) {
          // OpenAI sends a 400 error if partial_images is not set and we want to stream.
          // We also set it to 1 since we don't support partial images yet.
          tool.partial_images = 1;
        }
        reducedTools.push(tool);
      } else if (isCustomTool(tool)) {
        const customToolData = tool.metadata.customTool;
        reducedTools.push({
          type: "custom",
          name: customToolData.name,
          description: customToolData.description,
          format: customToolData.format,
        } as ResponsesTool);
      } else if (isOpenAIFunctionTool(tool)) {
        reducedTools.push({
          type: "function",
          name: tool.function.name,
          parameters: tool.function.parameters,
          description: tool.function.description,
          strict: fields?.strict ?? null,
        });
      } else if (isOpenAICustomTool(tool)) {
        reducedTools.push(convertCompletionsCustomTool(tool));
      }
    }
    return reducedTools;
  }
}
