import {
  AIMessage,
  UsageMetadata,
  type BaseMessage,
} from "@langchain/core/messages";
import {
  BaseLanguageModelInput,
  StructuredOutputMethodOptions,
} from "@langchain/core/language_models/base";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  type BaseChatModelParams,
  BaseChatModel,
  LangSmithParams,
  BaseChatModelCallOptions,
  BindToolsInput,
} from "@langchain/core/language_models/chat_models";
import { Ollama } from "ollama/browser";
import { ChatGenerationChunk, ChatResult } from "@langchain/core/outputs";
import { AIMessageChunk } from "@langchain/core/messages";
import type {
  ChatRequest as OllamaChatRequest,
  ChatResponse as OllamaChatResponse,
  Message as OllamaMessage,
  Tool as OllamaTool,
} from "ollama";
import {
  Runnable,
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { convertToOpenAITool } from "@langchain/core/utils/function_calling";
import { concat } from "@langchain/core/utils/stream";
import {
  JsonOutputParser,
  StructuredOutputParser,
} from "@langchain/core/output_parsers";
import { isZodSchema } from "@langchain/core/utils/types";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  convertOllamaMessagesToLangChain,
  convertToOllamaMessages,
} from "./utils.js";
import { OllamaCamelCaseOptions } from "./types.js";

export interface ChatOllamaCallOptions extends BaseChatModelCallOptions {
  /**
   * An array of strings to stop on.
   */
  stop?: string[];
  tools?: BindToolsInput[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  format?: string | Record<string, any>;
}

export interface PullModelOptions {
  /**
   * Whether or not to stream the download.
   * @default true
   */
  stream?: boolean;
  insecure?: boolean;
  /**
   * Whether or not to log the status of the download
   * to the console.
   * @default false
   */
  logProgress?: boolean;
}

/**
 * Input to chat model class.
 */
export interface ChatOllamaInput
  extends BaseChatModelParams,
    OllamaCamelCaseOptions {
  /**
   * The model to invoke. If the model does not exist, it
   * will be pulled.
   * @default "llama3"
   */
  model?: string;
  /**
   * The host URL of the Ollama server.
   * @default "http://127.0.0.1:11434"
   */
  baseUrl?: string;
  /**
   * Optional HTTP Headers to include in the request.
   */
  headers?: Headers;
  /**
   * Whether or not to check the model exists on the local machine before
   * invoking it. If set to `true`, the model will be pulled if it does not
   * exist.
   * @default false
   */
  checkOrPullModel?: boolean;
  streaming?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  format?: string | Record<string, any>;
}

/**
 * Ollama chat model integration.
 *
 * Setup:
 * Install `@langchain/ollama` and the Ollama app.
 *
 * ```bash
 * npm install @langchain/ollama
 * ```
 *
 * ## [Constructor args](https://api.js.langchain.com/classes/_langchain_ollama.ChatOllama.html#constructor)
 *
 * ## [Runtime args](https://api.js.langchain.com/interfaces/_langchain_ollama.ChatOllamaCallOptions.html)
 *
 * Runtime args can be passed as the second argument to any of the base runnable methods `.invoke`. `.stream`, `.batch`, etc.
 * They can also be passed via `.bind`, or the second arg in `.bindTools`, like shown in the examples below:
 *
 * ```typescript
 * // When calling `.bind`, call options should be passed via the first argument
 * const llmWithArgsBound = llm.bind({
 *   stop: ["\n"],
 *   tools: [...],
 * });
 *
 * // When calling `.bindTools`, call options should be passed via the second argument
 * const llmWithTools = llm.bindTools(
 *   [...],
 *   {
 *     stop: ["\n"],
 *   }
 * );
 * ```
 *
 * ## Examples
 *
 * <details open>
 * <summary><strong>Instantiate</strong></summary>
 *
 * ```typescript
 * import { ChatOllama } from '@langchain/ollama';
 *
 * const llm = new ChatOllama({
 *   model: "llama-3.1:8b",
 *   temperature: 0,
 *   // other params...
 * });
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Invoking</strong></summary>
 *
 * ```typescript
 * const input = `Translate "I love programming" into French.`;
 *
 * // Models also accept a list of chat messages or a formatted prompt
 * const result = await llm.invoke(input);
 * console.log(result);
 * ```
 *
 * ```txt
 * AIMessage {
 *   "content": "The translation of \"I love programming\" into French is:\n\n\"J'adore programmer.\"",
 *   "additional_kwargs": {},
 *   "response_metadata": {
 *     "model": "llama3.1:8b",
 *     "created_at": "2024-08-12T22:12:23.09468Z",
 *     "done_reason": "stop",
 *     "done": true,
 *     "total_duration": 3715571291,
 *     "load_duration": 35244375,
 *     "prompt_eval_count": 19,
 *     "prompt_eval_duration": 3092116000,
 *     "eval_count": 20,
 *     "eval_duration": 585789000
 *   },
 *   "tool_calls": [],
 *   "invalid_tool_calls": [],
 *   "usage_metadata": {
 *     "input_tokens": 19,
 *     "output_tokens": 20,
 *     "total_tokens": 39
 *   }
 * }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Streaming Chunks</strong></summary>
 *
 * ```typescript
 * for await (const chunk of await llm.stream(input)) {
 *   console.log(chunk);
 * }
 * ```
 *
 * ```txt
 * AIMessageChunk {
 *   "content": "The",
 *   "additional_kwargs": {},
 *   "response_metadata": {},
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * AIMessageChunk {
 *   "content": " translation",
 *   "additional_kwargs": {},
 *   "response_metadata": {},
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * AIMessageChunk {
 *   "content": " of",
 *   "additional_kwargs": {},
 *   "response_metadata": {},
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * AIMessageChunk {
 *   "content": " \"",
 *   "additional_kwargs": {},
 *   "response_metadata": {},
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * AIMessageChunk {
 *   "content": "I",
 *   "additional_kwargs": {},
 *   "response_metadata": {},
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * ...
 * AIMessageChunk {
 *   "content": "",
 *   "additional_kwargs": {},
 *   "response_metadata": {},
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * AIMessageChunk {
 *   "content": "",
 *   "additional_kwargs": {},
 *   "response_metadata": {
 *     "model": "llama3.1:8b",
 *     "created_at": "2024-08-12T22:13:22.22423Z",
 *     "done_reason": "stop",
 *     "done": true,
 *     "total_duration": 8599883208,
 *     "load_duration": 35975875,
 *     "prompt_eval_count": 19,
 *     "prompt_eval_duration": 7918195000,
 *     "eval_count": 20,
 *     "eval_duration": 643569000
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": [],
 *   "usage_metadata": {
 *     "input_tokens": 19,
 *     "output_tokens": 20,
 *     "total_tokens": 39
 *   }
 * }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Bind tools</strong></summary>
 *
 * ```typescript
 * import { z } from 'zod';
 *
 * const GetWeather = {
 *   name: "GetWeather",
 *   description: "Get the current weather in a given location",
 *   schema: z.object({
 *     location: z.string().describe("The city and state, e.g. San Francisco, CA")
 *   }),
 * }
 *
 * const GetPopulation = {
 *   name: "GetPopulation",
 *   description: "Get the current population in a given location",
 *   schema: z.object({
 *     location: z.string().describe("The city and state, e.g. San Francisco, CA")
 *   }),
 * }
 *
 * const llmWithTools = llm.bindTools([GetWeather, GetPopulation]);
 * const aiMsg = await llmWithTools.invoke(
 *   "Which city is hotter today and which is bigger: LA or NY?"
 * );
 * console.log(aiMsg.tool_calls);
 * ```
 *
 * ```txt
 * [
 *   {
 *     name: 'GetWeather',
 *     args: { location: 'Los Angeles, CA' },
 *     id: '49410cad-2163-415e-bdcd-d26938a9c8c5',
 *     type: 'tool_call'
 *   },
 *   {
 *     name: 'GetPopulation',
 *     args: { location: 'New York, NY' },
 *     id: '39e230e4-63ec-4fae-9df0-21c3abe735ad',
 *     type: 'tool_call'
 *   }
 * ]
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Structured Output</strong></summary>
 *
 * ```typescript
 * import { z } from 'zod';
 *
 * const Joke = z.object({
 *   setup: z.string().describe("The setup of the joke"),
 *   punchline: z.string().describe("The punchline to the joke"),
 *   rating: z.number().optional().describe("How funny the joke is, from 1 to 10")
 * }).describe('Joke to tell user.');
 *
 * const structuredLlm = llm.withStructuredOutput(Joke, { name: "Joke" });
 * const jokeResult = await structuredLlm.invoke("Tell me a joke about cats");
 * console.log(jokeResult);
 * ```
 *
 * ```txt
 * {
 *   punchline: 'Why did the cat join a band? Because it wanted to be the purr-cussionist!',
 *   rating: 8,
 *   setup: 'A cat walks into a music store and asks the owner...'
 * }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Usage Metadata</strong></summary>
 *
 * ```typescript
 * const aiMsgForMetadata = await llm.invoke(input);
 * console.log(aiMsgForMetadata.usage_metadata);
 * ```
 *
 * ```txt
 * { input_tokens: 19, output_tokens: 20, total_tokens: 39 }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Response Metadata</strong></summary>
 *
 * ```typescript
 * const aiMsgForResponseMetadata = await llm.invoke(input);
 * console.log(aiMsgForResponseMetadata.response_metadata);
 * ```
 *
 * ```txt
 * {
 *   model: 'llama3.1:8b',
 *   created_at: '2024-08-12T22:17:42.274795Z',
 *   done_reason: 'stop',
 *   done: true,
 *   total_duration: 6767071209,
 *   load_duration: 31628209,
 *   prompt_eval_count: 19,
 *   prompt_eval_duration: 6124504000,
 *   eval_count: 20,
 *   eval_duration: 608785000
 * }
 * ```
 * </details>
 *
 * <br />
 */
export class ChatOllama
  extends BaseChatModel<ChatOllamaCallOptions, AIMessageChunk>
  implements ChatOllamaInput
{
  // Used for tracing, replace with the same name as your class
  static lc_name() {
    return "ChatOllama";
  }

  model = "llama3";

  numa?: boolean;

  numCtx?: number;

  numBatch?: number;

  numGpu?: number;

  mainGpu?: number;

  lowVram?: boolean;

  f16Kv?: boolean;

  logitsAll?: boolean;

  vocabOnly?: boolean;

  useMmap?: boolean;

  useMlock?: boolean;

  embeddingOnly?: boolean;

  numThread?: number;

  numKeep?: number;

  seed?: number;

  numPredict?: number;

  topK?: number;

  topP?: number;

  tfsZ?: number;

  typicalP?: number;

  repeatLastN?: number;

  temperature?: number;

  repeatPenalty?: number;

  presencePenalty?: number;

  frequencyPenalty?: number;

  mirostat?: number;

  mirostatTau?: number;

  mirostatEta?: number;

  penalizeNewline?: boolean;

  streaming?: boolean;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  format?: string | Record<string, any>;

  keepAlive?: string | number;

  client: Ollama;

  checkOrPullModel = false;

  baseUrl = "http://127.0.0.1:11434";

  constructor(fields?: ChatOllamaInput) {
    super(fields ?? {});

    this.client = new Ollama({
      host: fields?.baseUrl,
      headers: fields?.headers,
    });
    this.baseUrl = fields?.baseUrl ?? this.baseUrl;

    this.model = fields?.model ?? this.model;
    this.numa = fields?.numa;
    this.numCtx = fields?.numCtx;
    this.numBatch = fields?.numBatch;
    this.numGpu = fields?.numGpu;
    this.mainGpu = fields?.mainGpu;
    this.lowVram = fields?.lowVram;
    this.f16Kv = fields?.f16Kv;
    this.logitsAll = fields?.logitsAll;
    this.vocabOnly = fields?.vocabOnly;
    this.useMmap = fields?.useMmap;
    this.useMlock = fields?.useMlock;
    this.embeddingOnly = fields?.embeddingOnly;
    this.numThread = fields?.numThread;
    this.numKeep = fields?.numKeep;
    this.seed = fields?.seed;
    this.numPredict = fields?.numPredict;
    this.topK = fields?.topK;
    this.topP = fields?.topP;
    this.tfsZ = fields?.tfsZ;
    this.typicalP = fields?.typicalP;
    this.repeatLastN = fields?.repeatLastN;
    this.temperature = fields?.temperature;
    this.repeatPenalty = fields?.repeatPenalty;
    this.presencePenalty = fields?.presencePenalty;
    this.frequencyPenalty = fields?.frequencyPenalty;
    this.mirostat = fields?.mirostat;
    this.mirostatTau = fields?.mirostatTau;
    this.mirostatEta = fields?.mirostatEta;
    this.penalizeNewline = fields?.penalizeNewline;
    this.streaming = fields?.streaming;
    this.format = fields?.format;
    this.keepAlive = fields?.keepAlive;
    this.checkOrPullModel = fields?.checkOrPullModel ?? this.checkOrPullModel;
  }

  // Replace
  _llmType() {
    return "ollama";
  }

  /**
   * Download a model onto the local machine.
   *
   * @param {string} model The name of the model to download.
   * @param {PullModelOptions | undefined} options Options for pulling the model.
   * @returns {Promise<void>}
   */
  async pull(model: string, options?: PullModelOptions): Promise<void> {
    const { stream, insecure, logProgress } = {
      stream: true,
      ...options,
    };

    if (stream) {
      for await (const chunk of await this.client.pull({
        model,
        insecure,
        stream,
      })) {
        if (logProgress) {
          console.log(chunk);
        }
      }
    } else {
      const response = await this.client.pull({ model, insecure });
      if (logProgress) {
        console.log(response);
      }
    }
  }

  override bindTools(
    tools: BindToolsInput[],
    kwargs?: Partial<this["ParsedCallOptions"]>
  ): Runnable<BaseLanguageModelInput, AIMessageChunk, ChatOllamaCallOptions> {
    return this.bind({
      tools: tools.map((tool) => convertToOpenAITool(tool)),
      ...kwargs,
    });
  }

  getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    const params = this.invocationParams(options);
    return {
      ls_provider: "ollama",
      ls_model_name: this.model,
      ls_model_type: "chat",
      ls_temperature: params.options?.temperature ?? undefined,
      ls_max_tokens: params.options?.num_predict ?? undefined,
      ls_stop: options.stop,
    };
  }

  invocationParams(
    options?: this["ParsedCallOptions"]
  ): Omit<OllamaChatRequest, "messages"> {
    if (options?.tool_choice) {
      throw new Error("Tool choice is not supported for ChatOllama.");
    }

    return {
      model: this.model,
      format: options?.format ?? this.format,
      keep_alive: this.keepAlive,
      options: {
        numa: this.numa,
        num_ctx: this.numCtx,
        num_batch: this.numBatch,
        num_gpu: this.numGpu,
        main_gpu: this.mainGpu,
        low_vram: this.lowVram,
        f16_kv: this.f16Kv,
        logits_all: this.logitsAll,
        vocab_only: this.vocabOnly,
        use_mmap: this.useMmap,
        use_mlock: this.useMlock,
        embedding_only: this.embeddingOnly,
        num_thread: this.numThread,
        num_keep: this.numKeep,
        seed: this.seed,
        num_predict: this.numPredict,
        top_k: this.topK,
        top_p: this.topP,
        tfs_z: this.tfsZ,
        typical_p: this.typicalP,
        repeat_last_n: this.repeatLastN,
        temperature: this.temperature,
        repeat_penalty: this.repeatPenalty,
        presence_penalty: this.presencePenalty,
        frequency_penalty: this.frequencyPenalty,
        mirostat: this.mirostat,
        mirostat_tau: this.mirostatTau,
        mirostat_eta: this.mirostatEta,
        penalize_newline: this.penalizeNewline,
        stop: options?.stop,
      },
      tools: options?.tools?.length
        ? (options.tools.map((tool) =>
            convertToOpenAITool(tool)
          ) as OllamaTool[])
        : undefined,
    };
  }

  /**
   * Check if a model exists on the local machine.
   *
   * @param {string} model The name of the model to check.
   * @returns {Promise<boolean>} Whether or not the model exists.
   */
  private async checkModelExistsOnMachine(model: string): Promise<boolean> {
    const { models } = await this.client.list();
    return !!models.find(
      (m) => m.name === model || m.name === `${model}:latest`
    );
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    if (this.checkOrPullModel) {
      if (!(await this.checkModelExistsOnMachine(this.model))) {
        await this.pull(this.model, {
          logProgress: true,
        });
      }
    }

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
    if (this.checkOrPullModel) {
      if (!(await this.checkModelExistsOnMachine(this.model))) {
        await this.pull(this.model, {
          logProgress: true,
        });
      }
    }

    const params = this.invocationParams(options);
    // TODO: remove cast after SDK adds support for tool calls
    const ollamaMessages = convertToOllamaMessages(messages) as OllamaMessage[];

    const usageMetadata: UsageMetadata = {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
    };

    if (params.tools && params.tools.length > 0) {
      const toolResult = await this.client.chat({
        ...params,
        messages: ollamaMessages,
        stream: false, // Ollama currently does not support streaming with tools
      });

      const { message: responseMessage, ...rest } = toolResult;
      usageMetadata.input_tokens += rest.prompt_eval_count ?? 0;
      usageMetadata.output_tokens += rest.eval_count ?? 0;
      usageMetadata.total_tokens =
        usageMetadata.input_tokens + usageMetadata.output_tokens;

      yield new ChatGenerationChunk({
        text: responseMessage.content,
        message: convertOllamaMessagesToLangChain(responseMessage, {
          responseMetadata: rest,
          usageMetadata,
        }),
      });
      return runManager?.handleLLMNewToken(responseMessage.content);
    }

    const stream = await this.client.chat({
      ...params,
      messages: ollamaMessages,
      stream: true,
    });

    let lastMetadata: Omit<OllamaChatResponse, "message"> | undefined;

    for await (const chunk of stream) {
      if (options.signal?.aborted) {
        this.client.abort();
      }
      const { message: responseMessage, ...rest } = chunk;
      usageMetadata.input_tokens += rest.prompt_eval_count ?? 0;
      usageMetadata.output_tokens += rest.eval_count ?? 0;
      usageMetadata.total_tokens =
        usageMetadata.input_tokens + usageMetadata.output_tokens;
      lastMetadata = rest;

      yield new ChatGenerationChunk({
        text: responseMessage.content ?? "",
        message: convertOllamaMessagesToLangChain(responseMessage),
      });
      await runManager?.handleLLMNewToken(responseMessage.content ?? "");
    }

    // Yield the `response_metadata` as the final chunk.
    yield new ChatGenerationChunk({
      text: "",
      message: new AIMessageChunk({
        content: "",
        response_metadata: lastMetadata,
        usage_metadata: usageMetadata,
      }),
    });
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
      >;

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
    if (config?.method === undefined || config?.method === "jsonSchema") {
      const outputSchemaIsZod = isZodSchema(outputSchema);
      const jsonSchema = outputSchemaIsZod
        ? zodToJsonSchema(outputSchema)
        : outputSchema;
      const llm = this.bind({
        format: jsonSchema,
      });
      const outputParser = outputSchemaIsZod
        ? StructuredOutputParser.fromZodSchema(outputSchema)
        : new JsonOutputParser<RunOutput>();

      if (!config?.includeRaw) {
        return llm.pipe(outputParser) as Runnable<
          BaseLanguageModelInput,
          RunOutput
        >;
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
      ]);
    } else {
      // TODO: Fix this type in core
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return super.withStructuredOutput<RunOutput>(outputSchema, config as any);
    }
  }
}
