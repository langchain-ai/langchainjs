import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { NewTokenIndices } from "@langchain/core/callbacks/base";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  BaseChatModel,
  BaseChatModelCallOptions,
  LangSmithParams,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  ChatMessage,
  ChatMessageChunk,
  HumanMessageChunk,
  SystemMessageChunk,
  ToolMessage,
  OpenAIToolCall,
  isAIMessage,
} from "@langchain/core/messages";
import {
  ChatGeneration,
  ChatGenerationChunk,
  ChatResult,
} from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  type OpenAICoreRequestOptions,
  type OpenAIClient,
} from "@langchain/openai";
import { isZodSchema } from "@langchain/core/utils/types";
import Groq from "groq-sdk";
import { ChatCompletionChunk } from "groq-sdk/lib/chat_completions_ext";
import {
  ChatCompletion,
  ChatCompletionCreateParams,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
} from "groq-sdk/resources/chat/completions";
import {
  Runnable,
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import {
  BaseLanguageModelInput,
  FunctionDefinition,
  StructuredOutputMethodOptions,
} from "@langchain/core/language_models/base";
import {
  BaseLLMOutputParser,
  JsonOutputParser,
  StructuredOutputParser,
} from "@langchain/core/output_parsers";
import {
  JsonOutputKeyToolsParser,
  parseToolCall,
  makeInvalidToolCall,
  convertLangChainToolCallToOpenAI,
} from "@langchain/core/output_parsers/openai_tools";
import { StructuredToolInterface } from "@langchain/core/tools";
import { convertToOpenAITool } from "@langchain/core/utils/function_calling";

export interface ChatGroqCallOptions extends BaseChatModelCallOptions {
  headers?: Record<string, string>;
  tools?: OpenAIClient.ChatCompletionTool[];
  tool_choice?: OpenAIClient.ChatCompletionToolChoiceOption;
  response_format?: { type: "json_object" };
}

export interface ChatGroqInput extends BaseChatModelParams {
  /**
   * The Groq API key to use for requests.
   * @default process.env.GROQ_API_KEY
   */
  apiKey?: string;
  /**
   * The name of the model to use.
   * Alias for `model`
   * @default "mixtral-8x7b-32768"
   */
  modelName?: string;
  /**
   * The name of the model to use.
   * @default "mixtral-8x7b-32768"
   */
  model?: string;
  /**
   * Up to 4 sequences where the API will stop generating further tokens. The
   * returned text will not contain the stop sequence.
   * Alias for `stopSequences`
   */
  stop?: string | null | Array<string>;
  /**
   * Up to 4 sequences where the API will stop generating further tokens. The
   * returned text will not contain the stop sequence.
   */
  stopSequences?: Array<string>;
  /**
   * Whether or not to stream responses.
   */
  streaming?: boolean;
  /**
   * The temperature to use for sampling.
   * @default 0.7
   */
  temperature?: number;
  /**
   * The maximum number of tokens that the model can process in a single response.
   * This limits ensures computational efficiency and resource management.
   */
  maxTokens?: number;
}

type GroqRoleEnum = "system" | "assistant" | "user" | "function";

interface TokenUsage {
  completionTokens?: number;
  promptTokens?: number;
  totalTokens?: number;
}

export function messageToGroqRole(message: BaseMessage): GroqRoleEnum {
  const type = message._getType();
  switch (type) {
    case "system":
      return "system";
    case "ai":
      return "assistant";
    case "human":
      return "user";
    case "function":
      return "function";
    case "tool":
      // Not yet supported as a type
      return "tool" as GroqRoleEnum;
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

function convertMessagesToGroqParams(
  messages: BaseMessage[]
): Array<ChatCompletion.Choice.Message> {
  return messages.map((message): ChatCompletion.Choice.Message => {
    if (typeof message.content !== "string") {
      throw new Error("Non string message content not supported");
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const completionParam: Record<string, any> = {
      role: messageToGroqRole(message),
      content: message.content,
      name: message.name,
      function_call: message.additional_kwargs.function_call,
      tool_calls: message.additional_kwargs.tool_calls,
      tool_call_id: (message as ToolMessage).tool_call_id,
    };
    if (isAIMessage(message) && !!message.tool_calls?.length) {
      completionParam.tool_calls = message.tool_calls.map(
        convertLangChainToolCallToOpenAI
      );
    } else {
      if (message.additional_kwargs.tool_calls != null) {
        completionParam.tool_calls = message.additional_kwargs.tool_calls;
      }
      if ((message as ToolMessage).tool_call_id != null) {
        completionParam.tool_call_id = (message as ToolMessage).tool_call_id;
      }
    }
    return completionParam as ChatCompletion.Choice.Message;
  });
}

function groqResponseToChatMessage(
  message: ChatCompletion.Choice.Message
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
      return new AIMessage({
        content: message.content || "",
        additional_kwargs: { tool_calls: rawToolCalls },
        tool_calls: toolCalls,
        invalid_tool_calls: invalidToolCalls,
      });
    }
    default:
      return new ChatMessage(message.content || "", message.role ?? "unknown");
  }
}

function _convertDeltaToMessageChunk(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delta: Record<string, any>
) {
  const { role } = delta;
  const content = delta.content ?? "";
  let additional_kwargs;
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
  if (role === "user") {
    return new HumanMessageChunk({ content });
  } else if (role === "assistant") {
    return new AIMessageChunk({ content, additional_kwargs });
  } else if (role === "system") {
    return new SystemMessageChunk({ content });
  } else {
    return new ChatMessageChunk({ content, role });
  }
}

/**
 * Wrapper around Groq API for large language models fine-tuned for chat
 *
 * Groq API is compatible to the OpenAI API with some limitations. View the
 * full API ref at:
 * @link {https://docs.api.groq.com/md/openai.oas.html}
 *
 * To use, you should have the `GROQ_API_KEY` environment variable set.
 * @example
 * ```typescript
 * const model = new ChatGroq({
 *   temperature: 0.9,
 *   apiKey: process.env.GROQ_API_KEY,
 * });
 *
 * const response = await model.invoke([new HumanMessage("Hello there!")]);
 * console.log(response);
 * ```
 */
export class ChatGroq extends BaseChatModel<
  ChatGroqCallOptions,
  AIMessageChunk
> {
  client: Groq;

  modelName = "mixtral-8x7b-32768";

  model = "mixtral-8x7b-32768";

  temperature = 0.7;

  stop?: string[];

  stopSequences?: string[];

  maxTokens?: number;

  streaming = false;

  static lc_name() {
    return "ChatGroq";
  }

  _llmType() {
    return "groq";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "GROQ_API_KEY",
    };
  }

  lc_serializable = true;

  constructor(fields?: ChatGroqInput) {
    super(fields ?? {});

    const apiKey = fields?.apiKey || getEnvironmentVariable("GROQ_API_KEY");
    if (!apiKey) {
      throw new Error(
        `Groq API key not found. Please set the GROQ_API_KEY environment variable or provide the key into "apiKey"`
      );
    }

    this.client = new Groq({
      apiKey,
      dangerouslyAllowBrowser: true,
    });
    this.temperature = fields?.temperature ?? this.temperature;
    this.modelName = fields?.model ?? fields?.modelName ?? this.model;
    this.model = this.modelName;
    this.streaming = fields?.streaming ?? this.streaming;
    this.stop =
      fields?.stopSequences ??
      (typeof fields?.stop === "string" ? [fields.stop] : fields?.stop) ??
      [];
    this.stopSequences = this.stop;
    this.maxTokens = fields?.maxTokens;
  }

  getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    const params = this.invocationParams(options);
    return {
      ls_provider: "groq",
      ls_model_name: this.model,
      ls_model_type: "chat",
      ls_temperature: params.temperature,
      ls_max_tokens: params.max_tokens,
      ls_stop: options.stop,
    };
  }

  async completionWithRetry(
    request: ChatCompletionCreateParamsStreaming,
    options?: OpenAICoreRequestOptions
  ): Promise<AsyncIterable<ChatCompletionChunk>>;

  async completionWithRetry(
    request: ChatCompletionCreateParamsNonStreaming,
    options?: OpenAICoreRequestOptions
  ): Promise<ChatCompletion>;

  async completionWithRetry(
    request: ChatCompletionCreateParams,
    options?: OpenAICoreRequestOptions
  ): Promise<AsyncIterable<ChatCompletionChunk> | ChatCompletion> {
    return this.caller.call(async () =>
      this.client.chat.completions.create(request, options)
    );
  }

  invocationParams(
    options: this["ParsedCallOptions"]
  ): ChatCompletionCreateParams {
    const params = super.invocationParams(options);
    if (options.tool_choice !== undefined) {
      params.tool_choice = options.tool_choice;
    }
    if (options.tools !== undefined) {
      params.tools = options.tools;
    }
    if (options.response_format !== undefined) {
      params.response_format = options.response_format;
    }
    return {
      ...params,
      stop: options.stop ?? this.stopSequences,
      model: this.model,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
    };
  }

  override bindTools(
    tools: (Record<string, unknown> | StructuredToolInterface)[],
    kwargs?: Partial<ChatGroqCallOptions>
  ): Runnable<BaseLanguageModelInput, AIMessageChunk, ChatGroqCallOptions> {
    return this.bind({
      tools: tools.map(convertToOpenAITool),
      ...kwargs,
    });
  }

  override async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const params = this.invocationParams(options);
    const messagesMapped = convertMessagesToGroqParams(messages);
    if (options.tools !== undefined && options.tools.length > 0) {
      const result = await this._generateNonStreaming(
        messages,
        options,
        runManager
      );
      const generationMessage = result.generations[0].message as AIMessage;
      if (
        generationMessage === undefined ||
        typeof generationMessage.content !== "string"
      ) {
        throw new Error("Could not parse Groq output.");
      }
      const toolCallChunks = generationMessage.tool_calls?.map(
        (toolCall, i) => ({
          name: toolCall.name,
          args: JSON.stringify(toolCall.args),
          id: toolCall.id,
          index: i,
        })
      );
      yield new ChatGenerationChunk({
        message: new AIMessageChunk({
          content: generationMessage.content,
          additional_kwargs: generationMessage.additional_kwargs,
          tool_call_chunks: toolCallChunks,
        }),
        text: generationMessage.content,
      });
    } else {
      const response = await this.completionWithRetry(
        {
          ...params,
          messages: messagesMapped,
          stream: true,
        },
        {
          signal: options?.signal,
          headers: options?.headers,
        }
      );
      let role = "";
      for await (const data of response) {
        const choice = data?.choices[0];
        if (!choice) {
          continue;
        }
        // The `role` field is populated in the first delta of the response
        // but is not present in subsequent deltas. Extract it when available.
        if (choice.delta?.role) {
          role = choice.delta.role;
        }
        const chunk = new ChatGenerationChunk({
          message: _convertDeltaToMessageChunk(
            {
              ...choice.delta,
              role,
            } ?? {}
          ),
          text: choice.delta.content ?? "",
          generationInfo: {
            finishReason: choice.finish_reason,
          },
        });
        yield chunk;
        void runManager?.handleLLMNewToken(chunk.text ?? "");
      }
      if (options.signal?.aborted) {
        throw new Error("AbortError");
      }
    }
  }

  override async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    if (this.streaming) {
      const tokenUsage: TokenUsage = {};
      const stream = this._streamResponseChunks(messages, options, runManager);
      const finalChunks: Record<number, ChatGenerationChunk> = {};
      for await (const chunk of stream) {
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

      return { generations, llmOutput: { estimatedTokenUsage: tokenUsage } };
    } else {
      return this._generateNonStreaming(messages, options, runManager);
    }
  }

  async _generateNonStreaming(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const tokenUsage: TokenUsage = {};
    const params = this.invocationParams(options);
    const messagesMapped = convertMessagesToGroqParams(messages);

    const data = await this.completionWithRetry(
      {
        ...params,
        stream: false,
        messages: messagesMapped,
      },
      {
        signal: options?.signal,
        headers: options?.headers,
      }
    );

    if ("usage" in data && data.usage) {
      const {
        completion_tokens: completionTokens,
        prompt_tokens: promptTokens,
        total_tokens: totalTokens,
      } = data.usage as ChatCompletion.Usage;

      if (completionTokens) {
        tokenUsage.completionTokens =
          (tokenUsage.completionTokens ?? 0) + completionTokens;
      }

      if (promptTokens) {
        tokenUsage.promptTokens = (tokenUsage.promptTokens ?? 0) + promptTokens;
      }

      if (totalTokens) {
        tokenUsage.totalTokens = (tokenUsage.totalTokens ?? 0) + totalTokens;
      }
    }

    const generations: ChatGeneration[] = [];

    if ("choices" in data && data.choices) {
      for (const part of (data as ChatCompletion).choices) {
        const text = part.message?.content ?? "";
        const generation: ChatGeneration = {
          text,
          message: groqResponseToChatMessage(
            part.message ?? { role: "assistant" }
          ),
        };
        generation.generationInfo = {
          ...(part.finish_reason ? { finish_reason: part.finish_reason } : {}),
          ...(part.logprobs ? { logprobs: part.logprobs } : {}),
        };
        generations.push(generation);
      }
    }

    return {
      generations,
      llmOutput: { tokenUsage },
    };
  }

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema:
      | z.ZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<false>
  ): Runnable<BaseLanguageModelInput, RunOutput>;

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema:
      | z.ZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<true>
  ): Runnable<BaseLanguageModelInput, { raw: BaseMessage; parsed: RunOutput }>;

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema:
      | z.ZodType<RunOutput>
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
    const schema: z.ZodType<RunOutput> | Record<string, any> = outputSchema;
    const name = config?.name;
    const method = config?.method;
    const includeRaw = config?.includeRaw;

    let functionName = name ?? "extract";
    let outputParser: BaseLLMOutputParser<RunOutput>;
    let llm: Runnable<BaseLanguageModelInput>;

    if (method === "jsonMode") {
      llm = this.bind({
        response_format: { type: "json_object" },
      });
      if (isZodSchema(schema)) {
        outputParser = StructuredOutputParser.fromZodSchema(schema);
      } else {
        outputParser = new JsonOutputParser<RunOutput>();
      }
    } else {
      if (isZodSchema(schema)) {
        const asJsonSchema = zodToJsonSchema(schema);
        llm = this.bind({
          tools: [
            {
              type: "function" as const,
              function: {
                name: functionName,
                description: asJsonSchema.description,
                parameters: asJsonSchema,
              },
            },
          ],
          tool_choice: {
            type: "function" as const,
            function: {
              name: functionName,
            },
          },
        });
        outputParser = new JsonOutputKeyToolsParser({
          returnSingle: true,
          keyName: functionName,
          zodSchema: schema,
        });
      } else {
        let openAIFunctionDefinition: FunctionDefinition;
        if (
          typeof schema.name === "string" &&
          typeof schema.parameters === "object" &&
          schema.parameters != null
        ) {
          openAIFunctionDefinition = schema as FunctionDefinition;
          functionName = schema.name;
        } else {
          functionName = schema.title ?? functionName;
          openAIFunctionDefinition = {
            name: functionName,
            description: schema.description ?? "",
            parameters: schema,
          };
        }
        llm = this.bind({
          tools: [
            {
              type: "function" as const,
              function: openAIFunctionDefinition,
            },
          ],
          tool_choice: {
            type: "function" as const,
            function: {
              name: functionName,
            },
          },
        });
        outputParser = new JsonOutputKeyToolsParser<RunOutput>({
          returnSingle: true,
          keyName: functionName,
        });
      }
    }

    if (!includeRaw) {
      return llm.pipe(outputParser).withConfig({
        runName: "ChatGroqStructuredOutput",
      });
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
      runName: "ChatGroqStructuredOutput",
    });
  }
}
