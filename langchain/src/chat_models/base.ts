import {
  BaseLanguageModelInput,
  ToolDefinition,
} from "@langchain/core/language_models/base";
import {
  BaseChatModel,
  type BaseChatModelCallOptions,
} from "@langchain/core/language_models/chat_models";
import { BaseMessage, type AIMessageChunk } from "@langchain/core/messages";
import {
  Runnable,
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

// TODO: remove once `EventStreamCallbackHandlerInput` is exposed in core.
interface EventStreamCallbackHandlerInput
  extends Omit<LogStreamCallbackHandlerInput, "_schemaFormat"> {}

export type ChatModelProvider =
  | "openai"
  | "anthropic"
  | "azure_openai"
  | "cohere"
  | "google_vertexai"
  | "google_genai"
  | "ollama"
  | "together"
  | "fireworks"
  | "mistralai"
  | "groq"
  | "bedrock";

const _SUPPORTED_PROVIDERS: Array<ChatModelProvider> = [
  "openai",
  "anthropic",
  "azure_openai",
  "cohere",
  "google_vertexai",
  "google_genai",
  "ollama",
  "together",
  "fireworks",
  "mistralai",
  "groq",
  "bedrock",
];

abstract class BaseChatModelWithBindTools extends BaseChatModel {
  abstract override bindTools(
    _tools: (
      | StructuredToolInterface
      | Record<string, unknown>
      | ToolDefinition
      | RunnableToolLike
    )[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _kwargs?: Record<string, any>
  ): Runnable<BaseLanguageModelInput, AIMessageChunk, BaseChatModelCallOptions>;

  _llmType(): string {
    return "chat_model";
  }

  abstract _generate(
    _messages: BaseMessage[],
    _config?: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult>;
}

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
  kwargs: Record<string, any> = {}
): Promise<BaseChatModelWithBindTools> {
  const modelProviderCopy = modelProvider || _attemptInferModelProvider(model);
  if (!modelProviderCopy) {
    throw new Error(
      `Unable to infer model provider for { model: ${model} }, please specify modelProvider directly.`
    );
  }

  try {
    switch (modelProviderCopy) {
      case "openai": {
        const { ChatOpenAI } = await import("@langchain/openai");
        return new ChatOpenAI({ model, ...kwargs });
      }
      case "anthropic": {
        const { ChatAnthropic } = await import("@langchain/anthropic");
        return new ChatAnthropic({ model, ...kwargs });
      }
      case "azure_openai": {
        const { AzureChatOpenAI } = await import("@langchain/openai");
        return new AzureChatOpenAI({ model, ...kwargs });
      }
      case "cohere": {
        const { ChatCohere } = await import("@langchain/cohere");
        return new ChatCohere({ model, ...kwargs });
      }
      case "google_vertexai": {
        const { ChatVertexAI } = await import("@langchain/google-vertexai");
        return new ChatVertexAI({ model, ...kwargs });
      }
      case "google_genai": {
        const { ChatGoogleGenerativeAI } = await import(
          "@langchain/google-genai"
        );
        return new ChatGoogleGenerativeAI({ model, ...kwargs });
      }
      case "ollama": {
        const { ChatOllama } = await import("@langchain/ollama");
        return new ChatOllama({ model, ...kwargs });
      }
      case "mistralai": {
        const { ChatMistralAI } = await import("@langchain/mistralai");
        return new ChatMistralAI({ model, ...kwargs });
      }
      case "groq": {
        const { ChatGroq } = await import("@langchain/groq");
        return new ChatGroq({ model, ...kwargs });
      }
      case "bedrock": {
        const { ChatBedrockConverse } = await import("@langchain/aws");
        return new ChatBedrockConverse({ model, ...kwargs });
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
        return new ChatFireworks({ model, ...kwargs });
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
        return new ChatTogetherAI({ model, ...kwargs });
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
 * Check if a package is installed and can be imported.
 * @param {string} pkg The name of the package to check.
 * @throws {Error} If the package is not installed.
 */
export function _checkPackage(pkg: string): void {
  try {
    require.resolve(pkg);
  } catch (error) {
    throw new Error(
      `Unable to import ${pkg}. Please install with ` +
        `\`npm install ${pkg}\` or \`yarn add ${pkg}\``
    );
  }
}

/**
 * Attempts to infer the model provider based on the given model name.
 *
 * @param {string} modelName - The name of the model to infer the provider for.
 * @returns {string | undefined} The inferred model provider name, or undefined if unable to infer.
 *
 * @example
 * _attemptInferModelProvider("gpt-4"); // returns "openai"
 * _attemptInferModelProvider("claude-2"); // returns "anthropic"
 * _attemptInferModelProvider("unknown-model"); // returns undefined
 */
export function _attemptInferModelProvider(
  modelName: string
): string | undefined {
  if (modelName.startsWith("gpt-3") || modelName.startsWith("gpt-4")) {
    return "openai";
  } else if (modelName.startsWith("claude")) {
    return "anthropic";
  } else if (modelName.startsWith("command")) {
    return "cohere";
  } else if (modelName.startsWith("accounts/fireworks")) {
    return "fireworks";
  } else if (modelName.startsWith("gemini")) {
    return "google_vertexai";
  } else if (modelName.startsWith("amazon.")) {
    return "bedrock";
  } else {
    return undefined;
  }
}

interface ConfigurableModelFields {
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
> extends Runnable<RunInput, AIMessageChunk, CallOptions> {
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
    super();
    this._defaultConfig = fields.defaultConfig ?? {};

    if (fields.configurableFields === "any") {
      this._configurableFields = "any";
    } else {
      this._configurableFields = fields.configurableFields ?? "any";
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

  bindTools(
    tools: (
      | StructuredToolInterface
      | Record<string, unknown>
      | ToolDefinition
      | RunnableToolLike
    )[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    kwargs?: Record<string, any>
  ): _ConfigurableModel<RunInput, CallOptions> {
    this._queuedMethodOperations.bindTools = [tools, kwargs];
    return new _ConfigurableModel<RunInput, CallOptions>({
      defaultConfig: this._defaultConfig,
      configurableFields: this._configurableFields,
      configPrefix: this._configPrefix,
      queuedMethodOperations: this._queuedMethodOperations,
    });
  }

  withStructuredOutput: BaseChatModel["withStructuredOutput"] = (
    schema,
    ...args
  ): // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Runnable<RunInput, { raw: BaseMessage; parsed: any }, CallOptions> => {
    this._queuedMethodOperations.withStructuredOutput = [schema, ...args];
    return new _ConfigurableModel<RunInput, CallOptions>({
      defaultConfig: this._defaultConfig,
      configurableFields: this._configurableFields,
      configPrefix: this._configPrefix,
      queuedMethodOperations: this._queuedMethodOperations,
    }) as unknown as Runnable<
      RunInput,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { raw: BaseMessage; parsed: any },
      CallOptions
    >;
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
    return model.invoke(input, options);
  }

  async stream(
    input: RunInput,
    options?: CallOptions
  ): Promise<IterableReadableStream<AIMessageChunk>> {
    const model = await this._model(options);
    const config = ensureConfig(options);
    const wrappedGenerator = new AsyncGeneratorWithSetup({
      generator: await model.stream(input, config),
      config,
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
    // If options is undefined, null, an object, or an array with 0 or 1 element
    if (
      !options ||
      !Array.isArray(options) ||
      (Array.isArray(options) && options.length <= 1)
    ) {
      const config = Array.isArray(options) ? options[0] : options;
      const model = await this._model(config);
      return model.batch(inputs, config, {
        ...batchOptions,
        returnExceptions: batchOptions?.returnExceptions ?? false,
      });
    } else {
      // If multiple configs, use the base Runnable.batch implementation
      return super.batch(inputs, options, batchOptions);
    }
  }

  async *transform(
    generator: AsyncGenerator<RunInput>,
    options: CallOptions
  ): AsyncGenerator<AIMessageChunk> {
    const model = await this._model(options);
    const config = ensureConfig(options);

    for await (const chunk of generator) {
      yield* model.transform(
        (async function* () {
          yield chunk;
        })(),
        config
      );
    }
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
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    void (async () => {
      try {
        const model = await this._model(options);
        const config = ensureConfig(options);
        const eventStream = model.streamEvents(input, config, streamOptions);

        for await (const chunk of eventStream) {
          await writer.write(chunk);
        }
      } finally {
        await writer.close();
      }
    })();

    return IterableReadableStream.fromReadableStream(stream.readable);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface InitChatModelFields extends Partial<Record<string, any>> {
  modelProvider?: string;
  configurableFields?: string[] | "any";
  configPrefix?: string;
}

export type ConfigurableFields = "any" | string[];

export async function initChatModel(
  model: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fields?: Partial<Record<string, any>> & {
    modelProvider?: string;
    configurableFields?: never;
    configPrefix?: string;
  }
): Promise<BaseChatModelWithBindTools>;

export async function initChatModel(
  model: never,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: Partial<Record<string, any>> & {
    modelProvider?: string;
    configurableFields?: never;
    configPrefix?: string;
  }
): Promise<_ConfigurableModel>;

export async function initChatModel(
  model?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: Partial<Record<string, any>> & {
    modelProvider?: string;
    configurableFields?: ConfigurableFields;
    configPrefix?: string;
  }
): Promise<_ConfigurableModel>;

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
 * @param {string | ChatModelProvider} [model] - The name of the model, e.g. "gpt-4", "claude-3-opus-20240229".
 * @param {Object} [fields] - Additional configuration options.
 * @param {string} [fields.modelProvider] - The model provider. Supported values include:
 *   - openai (@langchain/openai)
 *   - anthropic (@langchain/anthropic)
 *   - azure_openai (@langchain/openai)
 *   - google_vertexai (@langchain/google-vertexai)
 *   - google_genai (@langchain/google-genai)
 *   - bedrock (@langchain/aws)
 *   - cohere (@langchain/cohere)
 *   - fireworks (@langchain/community/chat_models/fireworks)
 *   - together (@langchain/community/chat_models/togetherai)
 *   - mistralai (@langchain/mistralai)
 *   - groq (@langchain/groq)
 *   - ollama (@langchain/ollama)
 * @param {string[] | "any"} [fields.configurableFields] - Which model parameters are configurable:
 *   - undefined: No configurable fields.
 *   - "any": All fields are configurable. (See Security Note in description)
 *   - string[]: Specified fields are configurable.
 * @param {string} [fields.configPrefix] - Prefix for configurable fields at runtime.
 * @param {Record<string, any>} [fields.kwargs] - Additional keyword args to pass to the ChatModel constructor.
 * @returns {Promise<BaseChatModelWithBindTools>} A class which extends BaseChatModelWithBindTools that implements `bindTools` for proper typing.
 * @throws {Error} If modelProvider cannot be inferred or isn't supported.
 * @throws {Error} If the model provider integration package is not installed.
 *
 * @example Initialize non-configurable models
 * ```typescript
 * import { initChatModel } from "langchain/chat_models";
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
 *   modelProvider: "google_vertexai",
 *   temperature: 0.25,
 * });
 * const geminiResult = await gemini.invoke("what's your name");
 * ```
 *
 * @example Create a partially configurable model with no default model
 * ```typescript
 * import { initChatModel } from "langchain/chat_models";
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
 * import { initChatModel } from "langchain/chat_models";
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
 * import { initChatModel } from "langchain/chat_models";
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
 * - gemini... -> google_vertexai
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
): Promise<
  BaseChatModelWithBindTools | _ConfigurableModel<RunInput, CallOptions>
> {
  const { configurableFields, configPrefix, modelProvider, ...kwargs } = {
    configPrefix: "",
    ...(fields ?? {}),
  };
  let configurableFieldsCopy = configurableFields;

  if (!model && !configurableFieldsCopy) {
    configurableFieldsCopy = ["model", "modelProvider"];
  }
  if (configPrefix && !configurableFieldsCopy) {
    console.warn(
      `{ configPrefix: ${configPrefix} } has been set but no fields are configurable. Set ` +
        `{ configurableFields: [...] } to specify the model params that are ` +
        `configurable.`
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kwargsCopy: Record<string, any> = { ...kwargs };

  if (!configurableFieldsCopy) {
    return _initChatModelHelper(model ?? "", modelProvider, kwargsCopy);
  } else {
    if (model) {
      kwargsCopy.model = model;
    }
    if (modelProvider) {
      kwargsCopy.modelProvider = modelProvider;
    }
    return new _ConfigurableModel<RunInput, CallOptions>({
      defaultConfig: kwargsCopy,
      configPrefix,
      configurableFields: configurableFieldsCopy,
    });
  }
}
