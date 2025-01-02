import Cerebras from "@cerebras/cerebras_cloud_sdk";

import {
  AIMessage,
  AIMessageChunk,
  UsageMetadata,
  type BaseMessage,
} from "@langchain/core/messages";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  BaseChatModel,
  BaseChatModelCallOptions,
  type BaseChatModelParams,
  BindToolsInput,
  LangSmithParams,
  ToolChoice,
} from "@langchain/core/language_models/chat_models";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { ChatGenerationChunk, ChatResult } from "@langchain/core/outputs";
import {
  Runnable,
  RunnableLambda,
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import {
  BaseLanguageModelInput,
  StructuredOutputMethodOptions,
  ToolDefinition,
} from "@langchain/core/language_models/base";
import { convertToOpenAITool } from "@langchain/core/utils/function_calling";
import { concat } from "@langchain/core/utils/stream";
import { isZodSchema } from "@langchain/core/utils/types";
import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";

import {
  convertToCerebrasMessageParams,
  formatToCerebrasToolChoice,
} from "./utils.js";

/**
 * Input to chat model class.
 */
export interface ChatCerebrasInput extends BaseChatModelParams {
  model: string;
  apiKey?: string;
  maxTokens?: number;
  maxCompletionTokens?: number;
  temperature?: number;
  topP?: number;
  seed?: number;
  timeout?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetch?: (...args: any) => any;
}

export interface ChatCerebrasCallOptions
  extends BaseChatModelCallOptions,
    Pick<Cerebras.RequestOptions, "httpAgent" | "headers"> {
  tools?: BindToolsInput[];
  tool_choice?: ToolChoice;
  user?: string;
  response_format?: Cerebras.ChatCompletionCreateParams["response_format"];
}

/**
 * Integration with a chat model.
 */
export class ChatCerebras
  extends BaseChatModel<ChatCerebrasCallOptions>
  implements ChatCerebrasInput
{
  static lc_name() {
    return "ChatCerebras";
  }

  lc_serializable = true;

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "CEREBRAS_API_KEY",
    };
  }

  get lc_aliases(): { [key: string]: string } | undefined {
    return {
      apiKey: "CEREBRAS_API_KEY",
    };
  }

  getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    const params = this.invocationParams(options);
    return {
      ls_provider: "cerebras",
      ls_model_name: this.model,
      ls_model_type: "chat",
      ls_temperature: params.temperature ?? undefined,
      ls_max_tokens: params.max_completion_tokens ?? undefined,
      ls_stop: options.stop,
    };
  }

  client: Cerebras;

  model: string;

  maxCompletionTokens?: number;

  temperature?: number;

  topP?: number;

  seed?: number;

  constructor(fields: ChatCerebrasInput) {
    super(fields ?? {});
    this.model = fields.model;
    this.maxCompletionTokens = fields.maxCompletionTokens;
    this.temperature = fields.temperature;
    this.topP = fields.topP;
    this.seed = fields.seed;
    this.client = new Cerebras({
      apiKey: fields.apiKey ?? getEnvironmentVariable("CEREBRAS_API_KEY"),
      timeout: fields.timeout,
      // Rely on built-in async caller
      maxRetries: 0,
      fetch: fields.fetch,
    });
  }

  // Replace
  _llmType() {
    return "cerebras";
  }

  override bindTools(
    tools: BindToolsInput[],
    kwargs?: Partial<this["ParsedCallOptions"]>
  ): Runnable<BaseLanguageModelInput, AIMessageChunk, ChatCerebrasCallOptions> {
    return this.bind({
      tools: tools.map((tool) => convertToOpenAITool(tool)),
      ...kwargs,
    });
  }

  /**
   * A method that returns the parameters for an Ollama API call. It
   * includes model and options parameters.
   * @param options Optional parsed call options.
   * @returns An object containing the parameters for an Ollama API call.
   */
  override invocationParams(
    options?: this["ParsedCallOptions"]
  ): Omit<Cerebras.ChatCompletionCreateParams, "stream" | "messages"> {
    return {
      model: this.model,
      max_completion_tokens: this.maxCompletionTokens,
      temperature: this.temperature,
      top_p: this.topP,
      seed: this.seed,
      stop: options?.stop,
      response_format: options?.response_format,
      user: options?.user,
      tools: options?.tools?.length
        ? options.tools.map(
            (tool) =>
              convertToOpenAITool(
                tool
              ) as Cerebras.ChatCompletionCreateParams.Tool
          )
        : undefined,
      tool_choice: formatToCerebrasToolChoice(options?.tool_choice),
    };
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    let finalChunk: AIMessageChunk | undefined;
    for await (const chunk of this._streamResponseChunks(
      messages,
      options,
      runManager
    )) {
      if (!finalChunk) {
        finalChunk = chunk.message;
      } else {
        finalChunk = concat(finalChunk, chunk.message);
      }
    }

    // Convert from AIMessageChunk to AIMessage since `generate` expects AIMessage.
    const nonChunkMessage = new AIMessage({
      id: finalChunk?.id,
      content: finalChunk?.content ?? "",
      tool_calls: finalChunk?.tool_calls,
      response_metadata: finalChunk?.response_metadata,
      usage_metadata: finalChunk?.usage_metadata,
    });
    return {
      generations: [
        {
          text:
            typeof nonChunkMessage.content === "string"
              ? nonChunkMessage.content
              : "",
          message: nonChunkMessage,
        },
      ],
    };
  }

  /**
   * Implement to support streaming.
   * Should yield chunks iteratively.
   */
  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    // All models have a built in `this.caller` property for retries
    const stream = await this.caller.call(async () => {
      const res = await this.client.chat.completions.create(
        {
          ...this.invocationParams(options),
          messages: convertToCerebrasMessageParams(messages),
          stream: true,
        },
        {
          headers: options.headers,
          httpAgent: options.httpAgent,
        }
      );
      return res;
    });
    for await (const chunk of stream) {
      const { choices, system_fingerprint, model, id, ...rest } = chunk;
      // TODO: Remove casts when underlying types are fixed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const choice = (choices as any)[0];
      const content = choice?.delta?.content ?? "";
      const usage: UsageMetadata = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        input_tokens: (rest.usage as any)?.prompt_tokens,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        output_tokens: (rest.usage as any)?.completion_tokens,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        total_tokens: (rest.usage as any)?.total_tokens,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const generationInfo: Record<string, any> = {};
      if (choice.finish_reason != null) {
        generationInfo.finish_reason = choice.finish_reason;
        // Only include system fingerprint and related in the last chunk for now
        // to avoid concatenation issues
        generationInfo.id = id;
        generationInfo.system_fingerprint = system_fingerprint;
        generationInfo.model = model;
      }
      yield new ChatGenerationChunk({
        text: content,
        message: new AIMessageChunk({
          content,
          tool_call_chunks: choice?.delta.tool_calls?.map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (toolCallChunk: any) => ({
              id: toolCallChunk.id,
              name: toolCallChunk.function?.name,
              args: toolCallChunk.function?.arguments,
              index: toolCallChunk.index,
              type: "tool_call_chunk",
            })
          ),
          usage_metadata: usage,
          response_metadata: rest,
        }),
        generationInfo,
      });
      await runManager?.handleLLMNewToken(content);
    }
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
        {
          raw: BaseMessage;
          parsed: RunOutput;
        }
      > {
    if (config?.strict) {
      throw new Error(
        `"strict" mode is not supported for this model by default.`
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schema: z.ZodType<RunOutput> | Record<string, any> = outputSchema;
    const name = config?.name;
    const description = schema.description ?? "A function available to call.";
    const method = config?.method;
    const includeRaw = config?.includeRaw;
    if (method === "jsonMode") {
      throw new Error(
        `Cerebras withStructuredOutput implementation only supports "functionCalling" as a method.`
      );
    }
    let functionName = name ?? "extract";
    let tools: ToolDefinition[];
    if (isZodSchema(schema)) {
      tools = [
        {
          type: "function",
          function: {
            name: functionName,
            description,
            parameters: zodToJsonSchema(schema),
          },
        },
      ];
    } else {
      if ("name" in schema) {
        functionName = schema.name;
      }
      tools = [
        {
          type: "function",
          function: {
            name: functionName,
            description,
            parameters: schema,
          },
        },
      ];
    }

    const llm = this.bindTools(tools, {
      tool_choice: tools[0].function.name,
    });
    const outputParser = RunnableLambda.from<AIMessageChunk, RunOutput>(
      (input: AIMessageChunk): RunOutput => {
        if (!input.tool_calls || input.tool_calls.length === 0) {
          throw new Error("No tool calls found in the response.");
        }
        const toolCall = input.tool_calls.find(
          (tc) => tc.name === functionName
        );
        if (!toolCall) {
          throw new Error(`No tool call found with name ${functionName}.`);
        }
        return toolCall.args as RunOutput;
      }
    );

    if (!includeRaw) {
      return llm.pipe(outputParser).withConfig({
        runName: "ChatCerebrasStructuredOutput",
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
      runName: "ChatCerebrasStructuredOutput",
    });
  }
}
