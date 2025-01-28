/* eslint-disable import/no-extraneous-dependencies */
import {
  BaseLanguageModelInput,
  ToolDefinition,
} from "@langchain/core/language_models/base";
import {
  BaseChatModel,
  BaseChatModelParams,
  BindToolsInput,
  type BaseChatModelCallOptions,
} from "@langchain/core/language_models/chat_models";
import { BaseMessage, type AIMessageChunk } from "@langchain/core/messages";
import {
  type RunnableBatchOptions,
  RunnableBinding,
  type RunnableConfig,
  type RunnableToolLike,
  ensureConfig,
} from "@langchain/core/runnables";
import {
  AsyncGeneratorWithSetup,
  IterableReadableStream,
} from "@langchain/core/utils/stream";
import {
  type LogStreamCallbackHandlerInput,
  type RunLogPatch,
  type StreamEvent,
} from "@langchain/core/tracers/log_stream";
import { type StructuredToolInterface } from "@langchain/core/tools";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { ChatResult } from "@langchain/core/outputs";

// TODO: remove once `EventStreamCallbackHandlerInput` is exposed in core
interface EventStreamCallbackHandlerInput
  extends Omit<LogStreamCallbackHandlerInput, "_schemaFormat"> {}

const _SUPPORTED_PROVIDERS = [
  "openai",
  "anthropic",
  "azure_openai",
  "cohere",
  "google-vertexai",
  "google-vertexai-web",
  "google-genai",
  "google-genai",
  "ollama",
  "together",
  "fireworks",
  "mistralai",
  "groq",
  "bedrock",
  "cerebras",
  "deepseek",
] as const;

export type ChatModelProvider = (typeof _SUPPORTED_PROVIDERS)[number];

export interface ConfigurableChatModelCallOptions
  extends BaseChatModelCallOptions {
  tools?: (
    | StructuredToolInterface
    | Record<string, unknown>
    | ToolDefinition
    | RunnableToolLike
  )[];
}

async function _initChatModelHelper(
  model: string,
  modelProvider?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: Record<string, any> = {}
): Promise<BaseChatModel> {
  const modelProviderCopy = modelProvider || _inferModelProvider(model);
  if (!modelProviderCopy) {
    throw new Error(
      `Unable to infer model provider for { model: ${model} }, please specify modelProvider directly.`
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { modelProvider: _unused, ...passedParams } = params;

  try {
    switch (modelProviderCopy) {
      case "openai": {
        const { ChatOpenAI } = await import("@langchain/openai");
        return new ChatOpenAI({ model, ...passedParams });
      }
      case "anthropic": {
        const { ChatAnthropic } = await import("@langchain/anthropic");
        return new ChatAnthropic({ model, ...passedParams });
      }
      case "azure_openai": {
        const { AzureChatOpenAI } = await import("@langchain/openai");
        return new AzureChatOpenAI({ model, ...passedParams });
      }
      case "cohere": {
        const { ChatCohere } = await import("@langchain/cohere");
        return new ChatCohere({ model, ...passedParams });
      }
      case "google-vertexai": {
        const { ChatVertexAI } = await import("@langchain/google-vertexai");
        return new ChatVertexAI({ model, ...passedParams });
      }
      case "google-vertexai-web": {
        const { ChatVertexAI } = await import("@langchain/google-vertexai-web");
        return new ChatVertexAI({ model, ...passedParams });
      }
      case "google-genai": {
        const { ChatGoogleGenerativeAI } = await import(
          "@langchain/google-genai"
        );
        return new ChatGoogleGenerativeAI({ model, ...passedParams });
      }
      case "ollama": {
        const { ChatOllama } = await import("@langchain/ollama");
        return new ChatOllama({ model, ...passedParams });
      }
      case "mistralai": {
        const { ChatMistralAI } = await import("@langchain/mistralai");
        return new ChatMistralAI({ model, ...passedParams });
      }
      case "groq": {
        const { ChatGroq } = await import("@langchain/groq");
        return new ChatGroq({ model, ...passedParams });
      }
      case "cerebras": {
        const { ChatCerebras } = await import("@langchain/cerebras");
        return new ChatCerebras({ model, ...passedParams });
      }
      case "bedrock": {
        const { ChatBedrockConverse } = await import("@langchain/aws");
        return new ChatBedrockConverse({ model, ...passedParams });
      }
      case "deepseek": {
        const { ChatDeepSeek } = await import("@langchain/deepseek");
        return new ChatDeepSeek({ model, ...passedParams });
      }
      case "fireworks": {
        const { ChatFireworks } = await import(
          // We can not 'expect-error' because if you explicitly build `@langchain/community`
          // this import will be able to be resolved, thus there will be no error. However
          // this will never be the case in CI.
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore - Can not install as a proper dependency due to circular dependency
          "@langchain/community/chat_models/fireworks"
        );
        return new ChatFireworks({ model, ...passedParams });
      }
      case "together": {
        const { ChatTogetherAI } = await import(
          // We can not 'expect-error' because if you explicitly build `@langchain/community`
          // this import will be able to be resolved, thus there will be no error. However
          // this will never be the case in CI.
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore - Can not install as a proper dependency due to circular dependency
          "@langchain/community/chat_models/togetherai"
        );
        return new ChatTogetherAI({ model, ...passedParams });
      }
      default: {
        const supported = _SUPPORTED_PROVIDERS.join(", ");
        throw new Error(
          `Unsupported { modelProvider: ${modelProviderCopy} }.\n\nSupported model providers are: ${supported}`
        );
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    if ("code" in e && e.code.includes("ERR_MODULE_NOT_FOUND")) {
      const attemptedPackage = new Error(e).message
        .split("Error: Cannot find package '")[1]
        .split("'")[0];
      throw new Error(
        `Unable to import ${attemptedPackage}. Please install with ` +
          `\`npm install ${attemptedPackage}\` or \`yarn add ${attemptedPackage}\``
      );
    }
    throw e;
  }
}

/**
 * Attempts to infer the model provider based on the given model name.
 *
 * @param {string} modelName - The name of the model to infer the provider for.
 * @returns {string | undefined} The inferred model provider name, or undefined if unable to infer.
 *
 * @example
 * _inferModelProvider("gpt-4"); // returns "openai"
 * _inferModelProvider("claude-2"); // returns "anthropic"
 * _inferModelProvider("unknown-model"); // returns undefined
 */
export function _inferModelProvider(modelName: string): string | undefined {
  if (
    modelName.startsWith("gpt-3") ||
    modelName.startsWith("gpt-4") ||
    modelName.startsWith("o1")
  ) {
    return "openai";
  } else if (modelName.startsWith("claude")) {
    return "anthropic";
  } else if (modelName.startsWith("command")) {
    return "cohere";
  } else if (modelName.startsWith("accounts/fireworks")) {
    return "fireworks";
  } else if (modelName.startsWith("gemini")) {
    return "google-vertexai";
  } else if (modelName.startsWith("amazon.")) {
    return "bedrock";
  } else {
    return undefined;
  }
}

interface ConfigurableModelFields extends BaseChatModelParams {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultConfig?: Record<string, any>;
  /**
   * @default "any"
   */
  configurableFields?: string[] | "any";
  /**
   * @default ""
   */
  configPrefix?: string;
  /**
   * Methods which should be called after the model is initialized.
   * The key will be the method name, and the value will be the arguments.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queuedMethodOperations?: Record<string, any>;
}

class _ConfigurableModel<
  RunInput extends BaseLanguageModelInput = BaseLanguageModelInput,
  CallOptions extends ConfigurableChatModelCallOptions = ConfigurableChatModelCallOptions
> extends BaseChatModel<CallOptions, AIMessageChunk> {
  _llmType(): string {
    return "chat_model";
  }

  lc_namespace = ["langchain", "chat_models"];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _defaultConfig?: Record<string, any> = {};

  /**
   * @default "any"
   */
  _configurableFields: string[] | "any" = "any";

  /**
   * @default ""
   */
  _configPrefix: string;

  /**
   * Methods which should be called after the model is initialized.
   * The key will be the method name, and the value will be the arguments.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _queuedMethodOperations: Record<string, any> = {};

  constructor(fields: ConfigurableModelFields) {
    super(fields);
    this._defaultConfig = fields.defaultConfig ?? {};

    if (fields.configurableFields === "any") {
      this._configurableFields = "any";
    } else {
      this._configurableFields = fields.configurableFields ?? [
        "model",
        "modelProvider",
      ];
    }

    if (fields.configPrefix) {
      this._configPrefix = fields.configPrefix.endsWith("_")
        ? fields.configPrefix
        : `${fields.configPrefix}_`;
    } else {
      this._configPrefix = "";
    }

    this._queuedMethodOperations =
      fields.queuedMethodOperations ?? this._queuedMethodOperations;
  }

  async _model(config?: RunnableConfig) {
    const params = { ...this._defaultConfig, ...this._modelParams(config) };
    let initializedModel = await _initChatModelHelper(
      params.model,
      params.modelProvider,
      params
    );

    // Apply queued method operations
    const queuedMethodOperationsEntries = Object.entries(
      this._queuedMethodOperations
    );
    if (queuedMethodOperationsEntries.length > 0) {
      for (const [method, args] of queuedMethodOperationsEntries) {
        if (
          method in initializedModel &&
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          typeof (initializedModel as any)[method] === "function"
        ) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          initializedModel = await (initializedModel as any)[method](...args);
        }
      }
    }

    return initializedModel;
  }

  async _generate(
    messages: BaseMessage[],
    options?: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const model = await this._model(options);
    return model._generate(messages, options ?? {}, runManager);
  }

  override bindTools(
    tools: BindToolsInput[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    params?: Record<string, any>
  ): _ConfigurableModel<RunInput, CallOptions> {
    this._queuedMethodOperations.bindTools = [tools, params];
    return new _ConfigurableModel<RunInput, CallOptions>({
      defaultConfig: this._defaultConfig,
      configurableFields: this._configurableFields,
      configPrefix: this._configPrefix,
      queuedMethodOperations: this._queuedMethodOperations,
    });
  }

  // Extract the input types from the `BaseModel` class.
  withStructuredOutput: BaseChatModel["withStructuredOutput"] = (
    schema,
    ...args
  ): ReturnType<BaseChatModel["withStructuredOutput"]> => {
    this._queuedMethodOperations.withStructuredOutput = [schema, ...args];
    return new _ConfigurableModel<RunInput, CallOptions>({
      defaultConfig: this._defaultConfig,
      configurableFields: this._configurableFields,
      configPrefix: this._configPrefix,
      queuedMethodOperations: this._queuedMethodOperations,
    }) as unknown as ReturnType<BaseChatModel["withStructuredOutput"]>;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _modelParams(config?: RunnableConfig): Record<string, any> {
    const configurable = config?.configurable ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let modelParams: Record<string, any> = {};

    for (const [key, value] of Object.entries(configurable)) {
      if (key.startsWith(this._configPrefix)) {
        const strippedKey = this._removePrefix(key, this._configPrefix);
        modelParams[strippedKey] = value;
      }
    }

    if (this._configurableFields !== "any") {
      modelParams = Object.fromEntries(
        Object.entries(modelParams).filter(([key]) =>
          this._configurableFields.includes(key)
        )
      );
    }

    return modelParams;
  }

  _removePrefix(str: string, prefix: string): string {
    return str.startsWith(prefix) ? str.slice(prefix.length) : str;
  }

  /**
   * Bind config to a Runnable, returning a new Runnable.
   * @param {RunnableConfig | undefined} [config] - The config to bind.
   * @returns {RunnableBinding<RunInput, RunOutput, CallOptions>} A new RunnableBinding with the bound config.
   */
  withConfig(
    config?: RunnableConfig
  ): RunnableBinding<RunInput, AIMessageChunk, CallOptions> {
    const mergedConfig: RunnableConfig = { ...(config || {}) };
    const modelParams = this._modelParams(mergedConfig);

    const remainingConfig: RunnableConfig = Object.fromEntries(
      Object.entries(mergedConfig).filter(([k]) => k !== "configurable")
    );

    remainingConfig.configurable = Object.fromEntries(
      Object.entries(mergedConfig.configurable || {}).filter(
        ([k]) =>
          this._configPrefix &&
          !Object.keys(modelParams).includes(
            this._removePrefix(k, this._configPrefix)
          )
      )
    );

    const newConfigurableModel = new _ConfigurableModel<RunInput, CallOptions>({
      defaultConfig: { ...this._defaultConfig, ...modelParams },
      configurableFields: Array.isArray(this._configurableFields)
        ? [...this._configurableFields]
        : this._configurableFields,
      configPrefix: this._configPrefix,
      queuedMethodOperations: this._queuedMethodOperations,
    });

    return new RunnableBinding<RunInput, AIMessageChunk, CallOptions>({
      config: mergedConfig,
      bound: newConfigurableModel,
    });
  }

  async invoke(
    input: RunInput,
    options?: CallOptions
  ): Promise<AIMessageChunk> {
    const model = await this._model(options);
    const config = ensureConfig(options);
    return model.invoke(input, config);
  }

  async stream(
    input: RunInput,
    options?: CallOptions
  ): Promise<IterableReadableStream<AIMessageChunk>> {
    const model = await this._model(options);
    const wrappedGenerator = new AsyncGeneratorWithSetup({
      generator: await model.stream(input, options),
      config: options,
    });
    await wrappedGenerator.setup;
    return IterableReadableStream.fromAsyncGenerator(wrappedGenerator);
  }

  async batch(
    inputs: RunInput[],
    options?: Partial<CallOptions> | Partial<CallOptions>[],
    batchOptions?: RunnableBatchOptions & { returnExceptions?: false }
  ): Promise<AIMessageChunk[]>;

  async batch(
    inputs: RunInput[],
    options?: Partial<CallOptions> | Partial<CallOptions>[],
    batchOptions?: RunnableBatchOptions & { returnExceptions: true }
  ): Promise<(AIMessageChunk | Error)[]>;

  async batch(
    inputs: RunInput[],
    options?: Partial<CallOptions> | Partial<CallOptions>[],
    batchOptions?: RunnableBatchOptions
  ): Promise<(AIMessageChunk | Error)[]>;

  async batch(
    inputs: RunInput[],
    options?: Partial<CallOptions> | Partial<CallOptions>[],
    batchOptions?: RunnableBatchOptions
  ): Promise<(AIMessageChunk | Error)[]> {
    // We can super this since the base runnable implementation of
    // `.batch` will call `.invoke` on each input.
    return super.batch(inputs, options, batchOptions);
  }

  async *transform(
    generator: AsyncGenerator<RunInput>,
    options: CallOptions
  ): AsyncGenerator<AIMessageChunk> {
    const model = await this._model(options);
    const config = ensureConfig(options);

    yield* model.transform(generator, config);
  }

  async *streamLog(
    input: RunInput,
    options?: Partial<CallOptions>,
    streamOptions?: Omit<LogStreamCallbackHandlerInput, "autoClose">
  ): AsyncGenerator<RunLogPatch> {
    const model = await this._model(options);
    const config = ensureConfig(options);

    yield* model.streamLog(input, config, {
      ...streamOptions,
      _schemaFormat: "original",
      includeNames: streamOptions?.includeNames,
      includeTypes: streamOptions?.includeTypes,
      includeTags: streamOptions?.includeTags,
      excludeNames: streamOptions?.excludeNames,
      excludeTypes: streamOptions?.excludeTypes,
      excludeTags: streamOptions?.excludeTags,
    });
  }

  streamEvents(
    input: RunInput,
    options: Partial<CallOptions> & { version: "v1" | "v2" },
    streamOptions?: Omit<EventStreamCallbackHandlerInput, "autoClose">
  ): IterableReadableStream<StreamEvent>;

  streamEvents(
    input: RunInput,
    options: Partial<CallOptions> & {
      version: "v1" | "v2";
      encoding: "text/event-stream";
    },
    streamOptions?: Omit<EventStreamCallbackHandlerInput, "autoClose">
  ): IterableReadableStream<Uint8Array>;

  streamEvents(
    input: RunInput,
    options: Partial<CallOptions> & {
      version: "v1" | "v2";
      encoding?: "text/event-stream" | undefined;
    },
    streamOptions?: Omit<EventStreamCallbackHandlerInput, "autoClose">
  ): IterableReadableStream<StreamEvent | Uint8Array> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const outerThis = this;
    async function* wrappedGenerator() {
      const model = await outerThis._model(options);
      const config = ensureConfig(options);
      const eventStream = model.streamEvents(input, config, streamOptions);

      for await (const chunk of eventStream) {
        yield chunk;
      }
    }
    return IterableReadableStream.fromAsyncGenerator(wrappedGenerator());
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface InitChatModelFields extends Partial<Record<string, any>> {
  modelProvider?: string;
  configurableFields?: string[] | "any";
  configPrefix?: string;
}

export type ConfigurableFields = "any" | string[];

export async function initChatModel<
  RunInput extends BaseLanguageModelInput = BaseLanguageModelInput,
  CallOptions extends ConfigurableChatModelCallOptions = ConfigurableChatModelCallOptions
>(
  model: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fields?: Partial<Record<string, any>> & {
    modelProvider?: string;
    configurableFields?: never;
    configPrefix?: string;
  }
): Promise<_ConfigurableModel<RunInput, CallOptions>>;

export async function initChatModel<
  RunInput extends BaseLanguageModelInput = BaseLanguageModelInput,
  CallOptions extends ConfigurableChatModelCallOptions = ConfigurableChatModelCallOptions
>(
  model: never,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: Partial<Record<string, any>> & {
    modelProvider?: string;
    configurableFields?: never;
    configPrefix?: string;
  }
): Promise<_ConfigurableModel<RunInput, CallOptions>>;

export async function initChatModel<
  RunInput extends BaseLanguageModelInput = BaseLanguageModelInput,
  CallOptions extends ConfigurableChatModelCallOptions = ConfigurableChatModelCallOptions
>(
  model?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: Partial<Record<string, any>> & {
    modelProvider?: string;
    configurableFields?: ConfigurableFields;
    configPrefix?: string;
  }
): Promise<_ConfigurableModel<RunInput, CallOptions>>;

// ################################# FOR CONTRIBUTORS #################################
//
// If adding support for a new provider, please append the provider
// name to the supported list in the docstring below.
//
// ####################################################################################

/**
 * Initialize a ChatModel from the model name and provider.
 * Must have the integration package corresponding to the model provider installed.
 *
 * @template {extends BaseLanguageModelInput = BaseLanguageModelInput} RunInput - The input type for the model.
 * @template {extends ConfigurableChatModelCallOptions = ConfigurableChatModelCallOptions} CallOptions - Call options for the model.
 *
 * @param {string | ChatModelProvider} [model] - The name of the model, e.g. "gpt-4", "claude-3-opus-20240229".
 * @param {Object} [fields] - Additional configuration options.
 * @param {string} [fields.modelProvider] - The model provider. Supported values include:
 *   - openai (@langchain/openai)
 *   - anthropic (@langchain/anthropic)
 *   - azure_openai (@langchain/openai)
 *   - google-vertexai (@langchain/google-vertexai)
 *   - google-vertexai-web (@langchain/google-vertexai-web)
 *   - google-genai (@langchain/google-genai)
 *   - bedrock (@langchain/aws)
 *   - cohere (@langchain/cohere)
 *   - fireworks (@langchain/community/chat_models/fireworks)
 *   - together (@langchain/community/chat_models/togetherai)
 *   - mistralai (@langchain/mistralai)
 *   - groq (@langchain/groq)
 *   - ollama (@langchain/ollama)
 *   - cerebras (@langchain/cerebras)
 *   - deepseek (@langchain/deepseek)
 * @param {string[] | "any"} [fields.configurableFields] - Which model parameters are configurable:
 *   - undefined: No configurable fields.
 *   - "any": All fields are configurable. (See Security Note in description)
 *   - string[]: Specified fields are configurable.
 * @param {string} [fields.configPrefix] - Prefix for configurable fields at runtime.
 * @param {Record<string, any>} [fields.params] - Additional keyword args to pass to the ChatModel constructor.
 * @returns {Promise<_ConfigurableModel<RunInput, CallOptions>>} A class which extends BaseChatModel.
 * @throws {Error} If modelProvider cannot be inferred or isn't supported.
 * @throws {Error} If the model provider integration package is not installed.
 *
 * @example Initialize non-configurable models
 * ```typescript
 * import { initChatModel } from "langchain/chat_models/universal";
 *
 * const gpt4 = await initChatModel("gpt-4", {
 *   modelProvider: "openai",
 *   temperature: 0.25,
 * });
 * const gpt4Result = await gpt4.invoke("what's your name");
 *
 * const claude = await initChatModel("claude-3-opus-20240229", {
 *   modelProvider: "anthropic",
 *   temperature: 0.25,
 * });
 * const claudeResult = await claude.invoke("what's your name");
 *
 * const gemini = await initChatModel("gemini-1.5-pro", {
 *   modelProvider: "google-vertexai",
 *   temperature: 0.25,
 * });
 * const geminiResult = await gemini.invoke("what's your name");
 * ```
 *
 * @example Create a partially configurable model with no default model
 * ```typescript
 * import { initChatModel } from "langchain/chat_models/universal";
 *
 * const configurableModel = await initChatModel(undefined, {
 *   temperature: 0,
 *   configurableFields: ["model", "apiKey"],
 * });
 *
 * const gpt4Result = await configurableModel.invoke("what's your name", {
 *   configurable: {
 *     model: "gpt-4",
 *   },
 * });
 *
 * const claudeResult = await configurableModel.invoke("what's your name", {
 *   configurable: {
 *     model: "claude-3-5-sonnet-20240620",
 *   },
 * });
 * ```
 *
 * @example Create a fully configurable model with a default model and a config prefix
 * ```typescript
 * import { initChatModel } from "langchain/chat_models/universal";
 *
 * const configurableModelWithDefault = await initChatModel("gpt-4", {
 *   modelProvider: "openai",
 *   configurableFields: "any",
 *   configPrefix: "foo",
 *   temperature: 0,
 * });
 *
 * const openaiResult = await configurableModelWithDefault.invoke(
 *   "what's your name",
 *   {
 *     configurable: {
 *       foo_apiKey: process.env.OPENAI_API_KEY,
 *     },
 *   }
 * );
 *
 * const claudeResult = await configurableModelWithDefault.invoke(
 *   "what's your name",
 *   {
 *     configurable: {
 *       foo_model: "claude-3-5-sonnet-20240620",
 *       foo_modelProvider: "anthropic",
 *       foo_temperature: 0.6,
 *       foo_apiKey: process.env.ANTHROPIC_API_KEY,
 *     },
 *   }
 * );
 * ```
 *
 * @example Bind tools to a configurable model:
 * ```typescript
 * import { initChatModel } from "langchain/chat_models/universal";
 * import { z } from "zod";
 * import { tool } from "@langchain/core/tools";
 *
 * const getWeatherTool = tool(
 *   (input) => {
 *     // Do something with the input
 *     return JSON.stringify(input);
 *   },
 *   {
 *     schema: z
 *       .object({
 *         location: z
 *           .string()
 *           .describe("The city and state, e.g. San Francisco, CA"),
 *       })
 *       .describe("Get the current weather in a given location"),
 *     name: "GetWeather",
 *     description: "Get the current weather in a given location",
 *   }
 * );
 *
 * const getPopulationTool = tool(
 *   (input) => {
 *     // Do something with the input
 *     return JSON.stringify(input);
 *   },
 *   {
 *     schema: z
 *       .object({
 *         location: z
 *           .string()
 *           .describe("The city and state, e.g. San Francisco, CA"),
 *       })
 *       .describe("Get the current population in a given location"),
 *     name: "GetPopulation",
 *     description: "Get the current population in a given location",
 *   }
 * );
 *
 * const configurableModel = await initChatModel("gpt-4", {
 *   configurableFields: ["model", "modelProvider", "apiKey"],
 *   temperature: 0,
 * });
 *
 * const configurableModelWithTools = configurableModel.bind({
 *   tools: [getWeatherTool, getPopulationTool],
 * });
 *
 * const configurableToolResult = await configurableModelWithTools.invoke(
 *   "Which city is hotter today and which is bigger: LA or NY?",
 *   {
 *     configurable: {
 *       apiKey: process.env.OPENAI_API_KEY,
 *     },
 *   }
 * );
 *
 * const configurableToolResult2 = await configurableModelWithTools.invoke(
 *   "Which city is hotter today and which is bigger: LA or NY?",
 *   {
 *     configurable: {
 *       model: "claude-3-5-sonnet-20240620",
 *       apiKey: process.env.ANTHROPIC_API_KEY,
 *     },
 *   }
 * );
 * ```
 *
 * @description
 * This function initializes a ChatModel based on the provided model name and provider.
 * It supports various model providers and allows for runtime configuration of model parameters.
 *
 * Security Note: Setting `configurableFields` to "any" means fields like api_key, base_url, etc.
 * can be altered at runtime, potentially redirecting model requests to a different service/user.
 * Make sure that if you're accepting untrusted configurations, you enumerate the
 * `configurableFields` explicitly.
 *
 * The function will attempt to infer the model provider from the model name if not specified.
 * Certain model name prefixes are associated with specific providers:
 * - gpt-3... or gpt-4... -> openai
 * - claude... -> anthropic
 * - amazon.... -> bedrock
 * - gemini... -> google-vertexai
 * - command... -> cohere
 * - accounts/fireworks... -> fireworks
 *
 * @since 0.2.11
 * @version 0.2.11
 */
export async function initChatModel<
  RunInput extends BaseLanguageModelInput = BaseLanguageModelInput,
  CallOptions extends ConfigurableChatModelCallOptions = ConfigurableChatModelCallOptions
>(
  model?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fields?: Partial<Record<string, any>> & {
    modelProvider?: string;
    configurableFields?: string[] | "any";
    configPrefix?: string;
  }
): Promise<_ConfigurableModel<RunInput, CallOptions>> {
  const { configurableFields, configPrefix, modelProvider, ...params } = {
    configPrefix: "",
    ...(fields ?? {}),
  };
  let configurableFieldsCopy = Array.isArray(configurableFields)
    ? [...configurableFields]
    : configurableFields;

  if (!model && configurableFieldsCopy === undefined) {
    configurableFieldsCopy = ["model", "modelProvider"];
  }
  if (configPrefix && configurableFieldsCopy === undefined) {
    console.warn(
      `{ configPrefix: ${configPrefix} } has been set but no fields are configurable. Set ` +
        `{ configurableFields: [...] } to specify the model params that are ` +
        `configurable.`
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paramsCopy: Record<string, any> = { ...params };

  if (configurableFieldsCopy === undefined) {
    return new _ConfigurableModel<RunInput, CallOptions>({
      defaultConfig: {
        ...paramsCopy,
        model,
        modelProvider,
      },
      configPrefix,
    });
  } else {
    if (model) {
      paramsCopy.model = model;
    }
    if (modelProvider) {
      paramsCopy.modelProvider = modelProvider;
    }
    return new _ConfigurableModel<RunInput, CallOptions>({
      defaultConfig: paramsCopy,
      configPrefix,
      configurableFields: configurableFieldsCopy,
    });
  }
}
