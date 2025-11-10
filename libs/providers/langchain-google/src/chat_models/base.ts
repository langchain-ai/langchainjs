import {
  BaseChatModel,
  type BaseChatModelCallOptions,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  UsageMetadata,
} from "@langchain/core/messages";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { concat } from "@langchain/core/utils/stream";
import { ChatGenerationChunk, ChatResult } from "@langchain/core/outputs";
import { EventSourceParserStream } from "eventsource-parser/stream";
import type { BindToolsInput } from "@langchain/core/language_models/chat_models";
import type {
  BaseLanguageModelInput,
  StructuredOutputMethodOptions,
} from "@langchain/core/language_models/base";
import {
  Runnable,
  RunnableLambda,
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import {
  toJsonSchema,
  type JsonSchema7Type,
} from "@langchain/core/utils/json_schema";
import {
  InteropZodType,
  isInteropZodSchema,
} from "@langchain/core/utils/types";
import {
  JsonOutputParser,
  StructuredOutputParser,
} from "@langchain/core/output_parsers";
import { JsonOutputKeyToolsParser } from "@langchain/core/output_parsers/openai_tools";

import { ApiClient } from "../clients/index.js";
import {
  ChatGoogleFields,
  GenerateContentRequest,
  GenerateContentResponse,
} from "./types.js";
import { SafeJsonEventParserStream } from "../utils/stream.js";
import {
  convertGeminiCandidateToAIMessage,
  convertMessagesToGeminiContents,
  convertMessagesToGeminiSystemInstruction,
} from "../converters/messages.js";
import {
  MalformedOutputError,
  NoCandidatesError,
  PromptBlockedError,
  RequestError,
} from "../utils/errors.js";
import {
  convertToolsToGeminiTools,
  convertToolChoiceToGeminiConfig,
  schemaToGeminiParameters,
} from "../converters/tools.js";
import type {
  GeminiFunctionDeclaration,
  GeminiFunctionSchema,
  GeminiTool,
} from "./types.js";

export interface BaseChatGoogleParams
  extends BaseChatModelParams,
    ChatGoogleFields {
  model: string;
  apiClient?: ApiClient;
}

export interface BaseChatGoogleCallOptions
  extends BaseChatModelCallOptions,
    ChatGoogleFields {}

export abstract class BaseChatGoogle<
  CallOptions extends BaseChatGoogleCallOptions = BaseChatGoogleCallOptions
> extends BaseChatModel<CallOptions, AIMessageChunk> {
  model: string;

  streaming = false;

  protected apiClient: ApiClient;

  constructor(protected params: BaseChatGoogleParams) {
    super(params);
    if (!params.apiClient) {
      throw new Error("BaseChatGoogle requires an apiClient");
    }
    this.model = params.model;
    this.apiClient = params.apiClient;
  }

  abstract _llmType(): string;

  abstract getBaseUrl(): URL;

  override invocationParams(options: this["ParsedCallOptions"]) {
    const fields = combineGoogleChatModelFields(this.params, options);

    // Convert tools to Gemini format
    const tools = fields.tools
      ? convertToolsToGeminiTools(fields.tools)
      : undefined;

    // Convert tool choice to Gemini function calling config
    const toolConfig = convertToolChoiceToGeminiConfig(
      options.tool_choice,
      !!(tools && tools.length > 0)
    );

    let responseJsonSchema:
      | JsonSchema7Type
      | Record<string, unknown>
      | undefined;
    let responseMimeType: string | undefined;

    if (fields.responseSchema) {
      // Convert Zod schema to JSON Schema if needed
      if (isInteropZodSchema(fields.responseSchema)) {
        responseJsonSchema = toJsonSchema(fields.responseSchema);
      } else {
        responseJsonSchema = fields.responseSchema as Record<string, unknown>;
      }
      // Automatically set responseMimeType to "application/json" when schema is provided
      responseMimeType = "application/json";
    }

    return {
      ...(tools && tools.length > 0 ? { tools } : {}),
      ...(toolConfig ? { toolConfig } : {}),
      safetySettings: fields.safetySettings,
      generationConfig: {
        temperature: fields.temperature,
        topP: fields.topP,
        topK: fields.topK,
        maxOutputTokens: fields.maxOutputTokens,
        presencePenalty: fields.presencePenalty,
        frequencyPenalty: fields.frequencyPenalty,
        stopSequences: fields.stopSequences,
        ...(responseMimeType ? { responseMimeType } : {}),
        ...(responseJsonSchema ? { responseJsonSchema } : {}),
        ...(fields.responseModalities && fields.responseModalities.length > 0
          ? { responseModalities: fields.responseModalities }
          : {}),
        candidateCount: 1,
        seed: fields.seed,
        responseLogprobs: fields.responseLogprobs,
        logprobs: fields.logprobs,
        ...(fields.enableEnhancedCivicAnswers !== undefined
          ? { enableEnhancedCivicAnswers: fields.enableEnhancedCivicAnswers }
          : {}),
        thinkingConfig: fields.thinkingConfig,
        ...(fields.speechConfig ? { speechConfig: fields.speechConfig } : {}),
        ...(fields.imageConfig ? { imageConfig: fields.imageConfig } : {}),
        ...(fields.mediaResolution
          ? { mediaResolution: fields.mediaResolution }
          : {}),
      },
    };
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"]
  ): Promise<ChatResult> {
    if (this.streaming) {
      const stream = await this._streamResponseChunks(messages, options);
      let finalChunk: ChatGenerationChunk | null = null;
      for await (const chunk of stream) {
        finalChunk = !finalChunk ? chunk : concat(finalChunk, chunk);
      }
      return {
        generations: finalChunk ? [finalChunk] : [],
      };
    }

    const body: GenerateContentRequest = {
      ...this.invocationParams(options),
      systemInstruction: convertMessagesToGeminiSystemInstruction(messages),
      contents: convertMessagesToGeminiContents(messages),
    };

    const response = await this.apiClient.fetch(
      new Request(
        new URL(`./${this.model}:generateContent`, this.getBaseUrl()),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      )
    );

    if (!response.ok) throw await RequestError.fromResponse(response);
    const data: GenerateContentResponse = await response.json();

    // Check for prompt feedback errors
    if (data.promptFeedback?.blockReason) {
      throw PromptBlockedError.fromPromptFeedback(data.promptFeedback);
    }

    // Check if we have candidates
    if (!data.candidates || data.candidates.length === 0) {
      throw new NoCandidatesError();
    }

    // Use the first candidate
    const candidate = data.candidates[0];
    const message = convertGeminiCandidateToAIMessage(candidate);

    // Extract text content from the message
    const text =
      typeof message.content === "string"
        ? message.content
        : Array.isArray(message.content)
        ? message.content
            .filter(
              (c) =>
                typeof c === "string" ||
                (c as { type?: string }).type === "text"
            )
            .map((c) =>
              typeof c === "string" ? c : (c as { text?: string }).text || ""
            )
            .join("")
        : "";

    // FIXME: this should just be hoisted to its own function
    const inputTokenCount = data.usageMetadata?.promptTokenCount ?? 0;
    const candidatesTokenCount = data.usageMetadata?.candidatesTokenCount ?? 0;
    const thoughtsTokenCount = data.usageMetadata?.thoughtsTokenCount ?? 0;
    const outputTokenCount = candidatesTokenCount + thoughtsTokenCount;
    const totalTokens =
      data.usageMetadata?.totalTokenCount ?? inputTokenCount + outputTokenCount;

    const usageMetadata: UsageMetadata = {
      input_tokens: inputTokenCount,
      output_tokens: outputTokenCount,
      total_tokens: totalTokens,
      input_token_details: {
        // FIXME: include modality details
        cache_read: data.usageMetadata?.cachedContentTokenCount ?? 0,
      },
      output_token_details: {
        // FIXME: include modality details
        reasoning: thoughtsTokenCount,
      },
    };

    return {
      generations: [
        {
          text,
          message,
          generationInfo: {
            finishReason: candidate.finishReason,
            finishMessage: candidate.finishMessage,
            safetyRatings: candidate.safetyRatings,
            citationMetadata: candidate.citationMetadata,
            tokenCount: candidate.tokenCount,
          },
        },
      ],
      llmOutput: {
        tokenUsage: usageMetadata,
        model: data.modelVersion,
        responseId: data.responseId,
        usageMetadata,
      },
    };
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const body: GenerateContentRequest = {
      ...this.invocationParams(options),
      systemInstruction: convertMessagesToGeminiSystemInstruction(messages),
      contents: convertMessagesToGeminiContents(messages),
    };

    const response = await this.apiClient.fetch(
      new Request(
        new URL(
          `./${this.model}:generateContentStream?alt=sse`,
          this.getBaseUrl()
        ),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: options.signal,
        }
      )
    );

    if (!response.ok) throw await RequestError.fromResponse(response);

    if (response.body) {
      const stream = response.body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new EventSourceParserStream())
        .pipeThrough(new SafeJsonEventParserStream<GenerateContentResponse>())
        .pipeThrough(
          new TransformStream<GenerateContentResponse, ChatGenerationChunk>({
            transform(chunk, controller) {
              if (chunk === null) {
                controller.enqueue(
                  new ChatGenerationChunk({
                    text: "",
                    message: new AIMessageChunk({ content: "" }),
                    generationInfo: { finishReason: "stop" },
                  })
                );
                return;
              }

              // Extract text delta from the chunk
              const candidate = chunk.candidates?.[0];
              if (!candidate) {
                return;
              }

              const parts = candidate.content?.parts || [];
              const textDeltas: string[] = [];

              for (const part of parts) {
                if (part.text) {
                  textDeltas.push(part.text);
                }
              }

              const textDelta = textDeltas.join("");

              // Only emit if we have content
              if (textDelta || candidate.finishReason) {
                const messageChunk = new AIMessageChunk({
                  content: textDelta,
                  ...(candidate.finishReason && {
                    additional_kwargs: {
                      finishReason: candidate.finishReason,
                      finishMessage: candidate.finishMessage,
                    },
                  }),
                });

                controller.enqueue(
                  new ChatGenerationChunk({
                    text: textDelta,
                    message: messageChunk,
                    generationInfo: {
                      ...(candidate.finishReason && {
                        finishReason: candidate.finishReason,
                        finishMessage: candidate.finishMessage,
                      }),
                      ...(candidate.safetyRatings && {
                        safetyRatings: candidate.safetyRatings,
                      }),
                    },
                  })
                );
              }
            },
          })
        );

      const reader = stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          yield value;
          if (value.text) {
            await runManager?.handleLLMNewToken(
              value.text,
              undefined,
              undefined,
              undefined,
              undefined,
              { chunk: value }
            );
          }
        }
      } finally {
        reader.releaseLock();
      }
    }
  }

  /**
   * Bind tool-like objects to this chat model.
   *
   * @param tools A list of tool definitions to bind to this chat model.
   * Can be a structured tool, an OpenAI formatted tool, or a Gemini function declaration.
   * @param kwargs Any additional parameters to bind.
   */
  bindTools(
    tools: BindToolsInput[],
    kwargs?: Partial<CallOptions>
  ): Runnable<BaseMessage[], AIMessageChunk, CallOptions> {
    return this.withConfig({
      ...kwargs,
      tools,
    } as Partial<CallOptions>);
  }

  /**
   * Get structured output from the model based on a schema.
   *
   * This method supports two modes:
   * - `jsonMode`: Uses `responseSchema` to get JSON responses directly (preferred for structured outputs)
   * - `functionCalling`: Uses function calling with tools (default, for compatibility)
   *
   * @param outputSchema - The schema to use for structured output (Zod schema or JSON Schema)
   * @param config - Configuration options including method and whether to include raw response
   * @returns A Runnable that returns the parsed structured output
   */
  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<boolean>
  ):
    | Runnable<BaseLanguageModelInput, RunOutput>
    | Runnable<
        BaseLanguageModelInput,
        { raw: BaseMessage; parsed: RunOutput }
      > {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schema: InteropZodType<RunOutput> | Record<string, any> =
      outputSchema;
    const name = config?.name;
    const method = config?.method ?? "jsonMode";
    const includeRaw = config?.includeRaw;

    // Determine llm and outputParser based on method
    let llm: Runnable<BaseMessage[], AIMessageChunk, CallOptions>;
    let outputParser: Runnable<BaseMessage, RunOutput>;

    if (method === "jsonMode") {
      // Use JSON mode with responseSchema
      llm = this.withConfig({
        responseSchema: schema,
      } as Partial<CallOptions>);

      outputParser = RunnableLambda.from<BaseMessage, RunOutput>(
        async (input: BaseMessage): Promise<RunOutput> => {
          if (
            !AIMessage.isInstance(input) &&
            !AIMessageChunk.isInstance(input)
          ) {
            throw new MalformedOutputError({
              message: "Input is not an AIMessage or AIMessageChunk.",
            });
          }

          if (!input.text) {
            throw new MalformedOutputError({
              message:
                "No content found in response. Cannot parse structured output.",
            });
          }

          // Parse JSON and validate with schema
          if (isInteropZodSchema(schema)) {
            const zodParser = StructuredOutputParser.fromZodSchema(
              schema as InteropZodType<RunOutput>
            );
            return (await zodParser.parse(input.text)) as RunOutput;
          } else {
            const jsonParser = new JsonOutputParser<RunOutput>();
            return await jsonParser.parse(input.text);
          }
        }
      );
    } else {
      // Use function calling mode
      let functionName = name ?? "extract";
      let tools: GeminiTool[];

      if (isInteropZodSchema(schema)) {
        const jsonSchema = schemaToGeminiParameters(schema);
        const description =
          typeof jsonSchema.description === "string"
            ? jsonSchema.description
            : "A function available to call.";
        tools = [
          {
            functionDeclarations: [
              {
                name: functionName,
                description,
                parameters: jsonSchema as GeminiFunctionSchema,
              },
            ],
          },
        ];
        outputParser = new JsonOutputKeyToolsParser({
          returnSingle: true,
          keyName: functionName,
          zodSchema: schema,
        });
      } else {
        let geminiFunctionDefinition: GeminiFunctionDeclaration;
        if (
          typeof schema.name === "string" &&
          typeof schema.parameters === "object" &&
          schema.parameters != null
        ) {
          geminiFunctionDefinition = schema as GeminiFunctionDeclaration;
          functionName = schema.name;
        } else {
          // We are providing the schema for *just* the parameters
          const parameters = schemaToGeminiParameters(schema);
          geminiFunctionDefinition = {
            name: functionName,
            description: (schema as { description?: string }).description ?? "",
            parameters,
          };
        }
        tools = [
          {
            functionDeclarations: [geminiFunctionDefinition],
          },
        ];
        outputParser = new JsonOutputKeyToolsParser<RunOutput>({
          returnSingle: true,
          keyName: functionName,
        });
      }

      llm = this.bindTools(tools).withConfig({
        tool_choice: functionName,
      } as Partial<CallOptions>);
    }

    // Shared logic for handling includeRaw
    if (!includeRaw) {
      return llm.pipe(outputParser).withConfig({
        runName: "ChatGoogleStructuredOutput",
      }) as Runnable<BaseLanguageModelInput, RunOutput>;
    }

    const parserAssign = RunnablePassthrough.assign({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parsed: (input: any, config) => outputParser.invoke(input.raw, config),
    });
    const parserNone = RunnablePassthrough.assign({
      parsed: () => null,
    });
    const parsedWithFallback = parserAssign.withFallbacks({
      fallbacks: [parserNone],
    });
    return RunnableSequence.from<
      BaseLanguageModelInput,
      { raw: BaseMessage; parsed: RunOutput }
    >([
      {
        raw: llm,
      },
      parsedWithFallback,
    ]).withConfig({
      runName: "ChatGoogleStructuredOutputRunnable",
    });
  }
}

export function combineGoogleChatModelFields(
  a: ChatGoogleFields,
  b: ChatGoogleFields,
  ...rest: ChatGoogleFields[]
): ChatGoogleFields {
  const combined: ChatGoogleFields = {
    temperature: b.temperature ?? a.temperature,
    topP: b.topP ?? a.topP,
    topK: b.topK ?? a.topK,
    maxOutputTokens: b.maxOutputTokens ?? a.maxOutputTokens,
    presencePenalty: b.presencePenalty ?? a.presencePenalty,
    frequencyPenalty: b.frequencyPenalty ?? a.frequencyPenalty,
    stopSequences: b.stopSequences ?? a.stopSequences,
    seed: b.seed ?? a.seed,
    responseLogprobs: b.responseLogprobs ?? a.responseLogprobs,
    logprobs: b.logprobs ?? a.logprobs,
    safetySettings: b.safetySettings ?? a.safetySettings,
    thinkingConfig: b.thinkingConfig ?? a.thinkingConfig,
    responseSchema: b.responseSchema ?? a.responseSchema,
    tools: b.tools ?? a.tools,
    responseModalities: b.responseModalities ?? a.responseModalities,
    enableEnhancedCivicAnswers:
      b.enableEnhancedCivicAnswers ?? a.enableEnhancedCivicAnswers,
    speechConfig: b.speechConfig ?? a.speechConfig,
    imageConfig: b.imageConfig ?? a.imageConfig,
    mediaResolution: b.mediaResolution ?? a.mediaResolution,
  };
  if (rest.length > 0) {
    return combineGoogleChatModelFields(combined, rest[0], ...rest.slice(1));
  }
  return combined;
}

export function getGoogleChatModelParams<TParams extends BaseChatGoogleParams>(
  modelOrParams: string | TParams,
  paramsArg?: Omit<TParams, "model">
): TParams {
  const model =
    typeof modelOrParams === "string" ? modelOrParams : modelOrParams.model;
  const params = typeof modelOrParams === "string" ? paramsArg : modelOrParams;
  return { model, ...params } as TParams;
}
