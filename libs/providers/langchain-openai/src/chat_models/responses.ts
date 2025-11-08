import { OpenAI as OpenAIClient } from "openai";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  AIMessage,
  AIMessageChunk,
  type BaseMessage,
  isAIMessage,
  type UsageMetadata,
  type BaseMessageFields,
  type MessageContent,
  type InvalidToolCall,
  MessageContentImageUrl,
  isDataContentBlock,
  convertToProviderContentBlock,
} from "@langchain/core/messages";
import { ChatGenerationChunk, type ChatResult } from "@langchain/core/outputs";
import { isOpenAITool as isOpenAIFunctionTool } from "@langchain/core/language_models/base";
import {
  makeInvalidToolCall,
  parseToolCall,
} from "@langchain/core/output_parsers/openai_tools";
import type {
  ToolCall,
  ToolCallChunk,
  ToolMessage,
} from "@langchain/core/messages/tool";
import { ResponseInputMessageContentList } from "openai/resources/responses/responses.js";
import { ChatOpenAIReasoningSummary, OpenAIVerbosityParam } from "../types.js";
import { wrapOpenAIClientError } from "../utils/client.js";
import {
  formatToOpenAIToolChoice,
  _convertToOpenAITool,
  ChatOpenAIToolType,
  convertCompletionsCustomTool,
  isBuiltInTool,
  isBuiltInToolChoice,
  isCustomTool,
  isCustomToolCall,
  isOpenAICustomTool,
  parseCustomToolCall,
  ResponsesTool,
} from "../utils/tools.js";
import { _convertOpenAIResponsesUsageToLangChainUsage } from "../utils/output.js";
import {
  _convertMessagesToOpenAIParams,
  completionsApiContentBlockConverter,
} from "../utils/message_inputs.js";
import {
  _convertToResponsesMessageFromV1,
  ResponsesInputItem,
} from "../utils/standard.js";
import { iife, isReasoningModel, messageToOpenAIRole } from "../utils/misc.js";
import { BaseChatOpenAI, BaseChatOpenAICallOptions } from "./base.js";

const _FUNCTION_CALL_IDS_MAP_KEY = "__openai_function_call_ids__";

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

type ChatResponsesInvocationParams = Omit<
  OpenAIClient.Responses.ResponseCreateParams,
  "input"
>;

type ExcludeController<T> = T extends { controller: unknown } ? never : T;

type ResponsesCreate = OpenAIClient.Responses["create"];
type ResponsesParse = OpenAIClient.Responses["parse"];

type ResponsesCreateInvoke = ExcludeController<
  Awaited<ReturnType<ResponsesCreate>>
>;
type ResponsesParseInvoke = ExcludeController<
  Awaited<ReturnType<ResponsesParse>>
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
    } else if (this.supportsStrictToolCalling !== undefined) {
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
      const input = this._convertMessagesToResponsesParams(messages);
      const data = await this.completionWithRetry(
        {
          input,
          ...invocationParams,
          stream: false,
        },
        { signal: options?.signal, ...options?.options }
      );

      return {
        generations: [
          {
            text: data.output_text,
            message: this._convertResponsesMessageToBaseMessage(data),
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
        input: this._convertMessagesToResponsesParams(messages),
        stream: true,
      },
      options
    );

    for await (const data of streamIterable) {
      const chunk = this._convertResponsesDeltaToBaseMessageChunk(data);
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
  protected _convertResponsesMessageToBaseMessage(
    response: ResponsesCreateInvoke | ResponsesParseInvoke
  ): BaseMessage {
    if (response.error) {
      // TODO: add support for `addLangChainErrorFields`
      const error = new Error(response.error.message);
      error.name = response.error.code;
      throw error;
    }

    let messageId: string | undefined;
    const content: MessageContent = [];
    const tool_calls: ToolCall[] = [];
    const invalid_tool_calls: InvalidToolCall[] = [];
    const response_metadata: Record<string, unknown> = {
      model_provider: "openai",
      model: response.model,
      created_at: response.created_at,
      id: response.id,
      incomplete_details: response.incomplete_details,
      metadata: response.metadata,
      object: response.object,
      status: response.status,
      user: response.user,
      service_tier: response.service_tier,
      // for compatibility with chat completion calls.
      model_name: response.model,
    };

    const additional_kwargs: {
      [key: string]: unknown;
      refusal?: string;
      reasoning?: OpenAIClient.Responses.ResponseReasoningItem;
      tool_outputs?: unknown[];
      parsed?: unknown;
      [_FUNCTION_CALL_IDS_MAP_KEY]?: Record<string, string>;
    } = {};

    for (const item of response.output) {
      if (item.type === "message") {
        messageId = item.id;
        content.push(
          ...item.content.flatMap((part) => {
            if (part.type === "output_text") {
              if ("parsed" in part && part.parsed != null) {
                additional_kwargs.parsed = part.parsed;
              }
              return {
                type: "text",
                text: part.text,
                annotations: part.annotations,
              };
            }

            if (part.type === "refusal") {
              additional_kwargs.refusal = part.refusal;
              return [];
            }

            return part;
          })
        );
      } else if (item.type === "function_call") {
        const fnAdapter = {
          function: { name: item.name, arguments: item.arguments },
          id: item.call_id,
        };

        try {
          tool_calls.push(parseToolCall(fnAdapter, { returnId: true }));
        } catch (e: unknown) {
          let errMessage: string | undefined;
          if (
            typeof e === "object" &&
            e != null &&
            "message" in e &&
            typeof e.message === "string"
          ) {
            errMessage = e.message;
          }
          invalid_tool_calls.push(makeInvalidToolCall(fnAdapter, errMessage));
        }

        additional_kwargs[_FUNCTION_CALL_IDS_MAP_KEY] ??= {};
        if (item.id) {
          additional_kwargs[_FUNCTION_CALL_IDS_MAP_KEY][item.call_id] = item.id;
        }
      } else if (item.type === "reasoning") {
        additional_kwargs.reasoning = item;
      } else if (item.type === "custom_tool_call") {
        const parsed = parseCustomToolCall(item);
        if (parsed) {
          tool_calls.push(parsed);
        } else {
          invalid_tool_calls.push(
            makeInvalidToolCall(item, "Malformed custom tool call")
          );
        }
      } else {
        additional_kwargs.tool_outputs ??= [];
        additional_kwargs.tool_outputs.push(item);
      }
    }

    return new AIMessage({
      id: messageId,
      content,
      tool_calls,
      invalid_tool_calls,
      usage_metadata: _convertOpenAIResponsesUsageToLangChainUsage(
        response.usage
      ),
      additional_kwargs,
      response_metadata,
    });
  }

  /** @internal */
  protected _convertResponsesDeltaToBaseMessageChunk(
    chunk: OpenAIClient.Responses.ResponseStreamEvent
  ) {
    const content: Record<string, unknown>[] = [];
    let generationInfo: Record<string, unknown> = {};
    let usage_metadata: UsageMetadata | undefined;
    const tool_call_chunks: ToolCallChunk[] = [];
    const response_metadata: Record<string, unknown> = {
      model_provider: "openai",
    };
    const additional_kwargs: {
      [key: string]: unknown;
      reasoning?: Partial<ChatOpenAIReasoningSummary>;
      tool_outputs?: unknown[];
    } = {};
    let id: string | undefined;
    if (chunk.type === "response.output_text.delta") {
      content.push({
        type: "text",
        text: chunk.delta,
        index: chunk.content_index,
      });
    } else if (chunk.type === "response.output_text.annotation.added") {
      content.push({
        type: "text",
        text: "",
        annotations: [chunk.annotation],
        index: chunk.content_index,
      });
    } else if (
      chunk.type === "response.output_item.added" &&
      chunk.item.type === "message"
    ) {
      id = chunk.item.id;
    } else if (
      chunk.type === "response.output_item.added" &&
      chunk.item.type === "function_call"
    ) {
      tool_call_chunks.push({
        type: "tool_call_chunk",
        name: chunk.item.name,
        args: chunk.item.arguments,
        id: chunk.item.call_id,
        index: chunk.output_index,
      });

      additional_kwargs[_FUNCTION_CALL_IDS_MAP_KEY] = {
        [chunk.item.call_id]: chunk.item.id,
      };
    } else if (
      chunk.type === "response.output_item.done" &&
      [
        "web_search_call",
        "file_search_call",
        "computer_call",
        "code_interpreter_call",
        "mcp_call",
        "mcp_list_tools",
        "mcp_approval_request",
        "image_generation_call",
        "custom_tool_call",
      ].includes(chunk.item.type)
    ) {
      additional_kwargs.tool_outputs = [chunk.item];
    } else if (chunk.type === "response.created") {
      response_metadata.id = chunk.response.id;
      response_metadata.model_name = chunk.response.model;
      response_metadata.model = chunk.response.model;
    } else if (chunk.type === "response.completed") {
      const msg = this._convertResponsesMessageToBaseMessage(chunk.response);

      usage_metadata = _convertOpenAIResponsesUsageToLangChainUsage(
        chunk.response.usage
      );

      if (chunk.response.text?.format?.type === "json_schema") {
        additional_kwargs.parsed ??= JSON.parse(msg.text);
      }
      for (const [key, value] of Object.entries(chunk.response)) {
        if (key !== "id") response_metadata[key] = value;
      }
    } else if (
      chunk.type === "response.function_call_arguments.delta" ||
      chunk.type === "response.custom_tool_call_input.delta"
    ) {
      tool_call_chunks.push({
        type: "tool_call_chunk",
        args: chunk.delta,
        index: chunk.output_index,
      });
    } else if (
      chunk.type === "response.web_search_call.completed" ||
      chunk.type === "response.file_search_call.completed"
    ) {
      generationInfo = {
        tool_outputs: {
          id: chunk.item_id,
          type: chunk.type.replace("response.", "").replace(".completed", ""),
          status: "completed",
        },
      };
    } else if (chunk.type === "response.refusal.done") {
      additional_kwargs.refusal = chunk.refusal;
    } else if (
      chunk.type === "response.output_item.added" &&
      "item" in chunk &&
      chunk.item.type === "reasoning"
    ) {
      const summary: ChatOpenAIReasoningSummary["summary"] | undefined = chunk
        .item.summary
        ? chunk.item.summary.map((s, index) => ({
            ...s,
            index,
          }))
        : undefined;

      additional_kwargs.reasoning = {
        // We only capture ID in the first chunk or else the concatenated result of all chunks will
        // have an ID field that is repeated once per chunk. There is special handling for the `type`
        // field that prevents this, however.
        id: chunk.item.id,
        type: chunk.item.type,
        ...(summary ? { summary } : {}),
      };
    } else if (chunk.type === "response.reasoning_summary_part.added") {
      additional_kwargs.reasoning = {
        type: "reasoning",
        summary: [{ ...chunk.part, index: chunk.summary_index }],
      };
    } else if (chunk.type === "response.reasoning_summary_text.delta") {
      additional_kwargs.reasoning = {
        type: "reasoning",
        summary: [
          {
            text: chunk.delta,
            type: "summary_text",
            index: chunk.summary_index,
          },
        ],
      };
    } else if (chunk.type === "response.image_generation_call.partial_image") {
      // noop/fixme: retaining partial images in a message chunk means that _all_
      // partial images get kept in history, so we don't do anything here.
      return null;
    } else {
      return null;
    }

    return new ChatGenerationChunk({
      // Legacy reasons, `onLLMNewToken` should pulls this out
      text: content.map((part) => part.text).join(""),
      message: new AIMessageChunk({
        id,
        content: content as MessageContent,
        tool_call_chunks,
        usage_metadata,
        additional_kwargs,
        response_metadata,
      }),
      generationInfo,
    });
  }

  /** @internal */
  protected _convertMessagesToResponsesParams(messages: BaseMessage[]) {
    return messages.flatMap(
      (lcMsg): ResponsesInputItem | ResponsesInputItem[] => {
        const responseMetadata = lcMsg.response_metadata as
          | Record<string, unknown>
          | undefined;
        if (responseMetadata?.output_version === "v1") {
          return _convertToResponsesMessageFromV1(lcMsg);
        }

        const additional_kwargs = lcMsg.additional_kwargs as
          | BaseMessageFields["additional_kwargs"] & {
              [_FUNCTION_CALL_IDS_MAP_KEY]?: Record<string, string>;
              reasoning?: OpenAIClient.Responses.ResponseReasoningItem;
              type?: string;
              refusal?: string;
            };

        let role = messageToOpenAIRole(lcMsg);
        if (role === "system" && isReasoningModel(this.model))
          role = "developer";

        if (role === "function") {
          throw new Error(
            "Function messages are not supported in Responses API"
          );
        }

        if (role === "tool") {
          const toolMessage = lcMsg as ToolMessage;

          // Handle computer call output
          if (additional_kwargs?.type === "computer_call_output") {
            const output = (() => {
              if (typeof toolMessage.content === "string") {
                return {
                  type: "computer_screenshot" as const,
                  image_url: toolMessage.content,
                };
              }

              if (Array.isArray(toolMessage.content)) {
                const oaiScreenshot = toolMessage.content.find(
                  (i) => i.type === "computer_screenshot"
                ) as { type: "computer_screenshot"; image_url: string };

                if (oaiScreenshot) return oaiScreenshot;

                const lcImage = toolMessage.content.find(
                  (i) => i.type === "image_url"
                ) as MessageContentImageUrl;

                if (lcImage) {
                  return {
                    type: "computer_screenshot" as const,
                    image_url:
                      typeof lcImage.image_url === "string"
                        ? lcImage.image_url
                        : lcImage.image_url.url,
                  };
                }
              }

              throw new Error("Invalid computer call output");
            })();

            return {
              type: "computer_call_output",
              output,
              call_id: toolMessage.tool_call_id,
            };
          }

          // Handle custom tool output
          if (toolMessage.additional_kwargs?.customTool) {
            return {
              type: "custom_tool_call_output",
              call_id: toolMessage.tool_call_id,
              output: toolMessage.content as string,
            };
          }

          return {
            type: "function_call_output",
            call_id: toolMessage.tool_call_id,
            id: toolMessage.id?.startsWith("fc_") ? toolMessage.id : undefined,
            output:
              typeof toolMessage.content !== "string"
                ? JSON.stringify(toolMessage.content)
                : toolMessage.content,
          };
        }

        if (role === "assistant") {
          // if we have the original response items, just reuse them
          if (
            !this.zdrEnabled &&
            responseMetadata?.output != null &&
            Array.isArray(responseMetadata?.output) &&
            responseMetadata?.output.length > 0 &&
            responseMetadata?.output.every((item) => "type" in item)
          ) {
            return responseMetadata?.output;
          }

          // otherwise, try to reconstruct the response from what we have

          const input: ResponsesInputItem[] = [];

          // reasoning items
          if (additional_kwargs?.reasoning && !this.zdrEnabled) {
            const reasoningItem = this._convertReasoningSummary(
              additional_kwargs.reasoning
            );
            input.push(reasoningItem);
          }

          // ai content
          let { content } = lcMsg;
          if (additional_kwargs?.refusal) {
            if (typeof content === "string") {
              content = [
                { type: "output_text", text: content, annotations: [] },
              ];
            }
            content = [
              ...content,
              { type: "refusal", refusal: additional_kwargs.refusal },
            ];
          }

          if (typeof content === "string" || content.length > 0) {
            input.push({
              type: "message",
              role: "assistant",
              ...(lcMsg.id && !this.zdrEnabled && lcMsg.id.startsWith("msg_")
                ? { id: lcMsg.id }
                : {}),
              content: iife(() => {
                if (typeof content === "string") {
                  return content;
                }
                return content.flatMap((item) => {
                  if (item.type === "text") {
                    return {
                      type: "output_text",
                      text: item.text,
                      annotations: item.annotations ?? [],
                    };
                  }

                  if (item.type === "output_text" || item.type === "refusal") {
                    return item;
                  }

                  return [];
                });
              }) as ResponseInputMessageContentList,
            });
          }

          const functionCallIds =
            additional_kwargs?.[_FUNCTION_CALL_IDS_MAP_KEY];

          if (isAIMessage(lcMsg) && !!lcMsg.tool_calls?.length) {
            input.push(
              ...lcMsg.tool_calls.map((toolCall): ResponsesInputItem => {
                if (isCustomToolCall(toolCall)) {
                  return {
                    type: "custom_tool_call",
                    id: toolCall.call_id,
                    call_id: toolCall.id ?? "",
                    input: toolCall.args.input,
                    name: toolCall.name,
                  };
                }
                return {
                  type: "function_call",
                  name: toolCall.name,
                  arguments: JSON.stringify(toolCall.args),
                  call_id: toolCall.id!,
                  ...(!this.zdrEnabled
                    ? { id: functionCallIds?.[toolCall.id!] }
                    : {}),
                };
              })
            );
          } else if (additional_kwargs?.tool_calls) {
            input.push(
              ...additional_kwargs.tool_calls.map(
                (toolCall): ResponsesInputItem => ({
                  type: "function_call",
                  name: toolCall.function.name,
                  call_id: toolCall.id,
                  arguments: toolCall.function.arguments,
                  ...(!this.zdrEnabled
                    ? { id: functionCallIds?.[toolCall.id] }
                    : {}),
                })
              )
            );
          }

          const toolOutputs = (
            responseMetadata?.output as Array<ResponsesInputItem>
          )?.length
            ? responseMetadata?.output
            : additional_kwargs.tool_outputs;

          const fallthroughCallTypes: ResponsesInputItem["type"][] = [
            "computer_call",
            "mcp_call",
            "code_interpreter_call",
            "image_generation_call",
          ];

          if (toolOutputs != null) {
            const castToolOutputs = toolOutputs as Array<ResponsesInputItem>;
            const fallthroughCalls = castToolOutputs?.filter((item) =>
              fallthroughCallTypes.includes(item.type)
            );
            if (fallthroughCalls.length > 0) input.push(...fallthroughCalls);
          }

          return input;
        }

        if (role === "user" || role === "system" || role === "developer") {
          if (typeof lcMsg.content === "string") {
            return { type: "message", role, content: lcMsg.content };
          }

          const messages: ResponsesInputItem[] = [];
          const content = lcMsg.content.flatMap((item) => {
            if (item.type === "mcp_approval_response") {
              messages.push({
                type: "mcp_approval_response",
                approval_request_id: item.approval_request_id as string,
                approve: item.approve as boolean,
              });
            }
            if (isDataContentBlock(item)) {
              return convertToProviderContentBlock(
                item,
                completionsApiContentBlockConverter
              );
            }
            if (item.type === "text") {
              return {
                type: "input_text",
                text: item.text,
              };
            }
            if (item.type === "image_url") {
              const imageUrl = iife(() => {
                if (typeof item.image_url === "string") {
                  return item.image_url;
                } else if (
                  typeof item.image_url === "object" &&
                  item.image_url !== null &&
                  "url" in item.image_url
                ) {
                  return item.image_url.url;
                }
                return undefined;
              });
              const detail = iife(() => {
                if (typeof item.image_url === "string") {
                  return "auto";
                } else if (
                  typeof item.image_url === "object" &&
                  item.image_url !== null &&
                  "detail" in item.image_url
                ) {
                  return item.image_url.detail;
                }
                return undefined;
              });
              return {
                type: "input_image",
                image_url: imageUrl,
                detail,
              };
            }
            if (
              item.type === "input_text" ||
              item.type === "input_image" ||
              item.type === "input_file"
            ) {
              return item;
            }
            return [];
          });

          if (content.length > 0) {
            messages.push({
              type: "message",
              role,
              content: content as ResponseInputMessageContentList,
            });
          }
          return messages;
        }

        console.warn(
          `Unsupported role found when converting to OpenAI Responses API: ${role}`
        );
        return [];
      }
    );
  }

  /** @internal */
  protected _convertReasoningSummary(
    reasoning: ChatOpenAIReasoningSummary
  ): OpenAIClient.Responses.ResponseReasoningItem {
    // combine summary parts that have the the same index and then remove the indexes
    const summary = (
      reasoning.summary.length > 1
        ? reasoning.summary.reduce(
            (acc, curr) => {
              const last = acc[acc.length - 1];

              if (last!.index === curr.index) {
                last!.text += curr.text;
              } else {
                acc.push(curr);
              }
              return acc;
            },
            [{ ...reasoning.summary[0] }]
          )
        : reasoning.summary
    ).map((s) =>
      Object.fromEntries(Object.entries(s).filter(([k]) => k !== "index"))
    ) as OpenAIClient.Responses.ResponseReasoningItem.Summary[];

    return {
      ...reasoning,
      summary,
    } as OpenAIClient.Responses.ResponseReasoningItem;
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
