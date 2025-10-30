import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { BaseLLM, BaseLLMParams } from "@langchain/core/language_models/llms";
import { Stream, WatsonXAI } from "@ibm-cloud/watsonx-ai";
import {
  RequestCallbacks,
  ReturnOptionProperties,
  TextGenLengthPenalty,
  TextGenParameters,
  TextTokenizationParams,
  TextTokenizeParameters,
} from "@ibm-cloud/watsonx-ai/dist/watsonx-ai-ml/vml_v1.js";
import {
  Generation,
  LLMResult,
  GenerationChunk,
} from "@langchain/core/outputs";
import { BaseLanguageModelCallOptions } from "@langchain/core/language_models/base";
import { AsyncCaller } from "@langchain/core/utils/async_caller";
import {
  CreateCompletionsParams,
  Gateway,
  TextCompletionStream,
} from "@ibm-cloud/watsonx-ai/gateway";
import {
  authenticateAndSetGatewayInstance,
  authenticateAndSetInstance,
  checkValidProps,
  expectOneOf,
} from "../utils/ibm.js";
import {
  GenerationInfo,
  ResponseChunk,
  TokenUsage,
  WatsonxAuth,
  WatsonxInit,
  WatsonxLLMBasicOptions,
  XOR,
} from "../types/ibm.js";

/**
 * Input to LLM class.
 */

/** Parameters for basic llm invoke */
export interface WatsonxLLMParams {
  maxNewTokens?: number;
  maxTokens?: number;
  decodingMethod?: TextGenParameters.Constants.DecodingMethod | string;
  lengthPenalty?: TextGenLengthPenalty;
  minNewTokens?: number;
  randomSeed?: number;
  stopSequence?: string[];
  temperature?: number;
  timeLimit?: number;
  topK?: number;
  topP?: number;
  repetitionPenalty?: number;
  truncateInpuTokens?: number;
  returnOptions?: ReturnOptionProperties;
  includeStopSequence?: boolean;
  headers?: Record<string, any>;
  signal?: AbortSignal;
}
/** Parameters for basic llm invoke */
export interface WatsonxDeploymentLLMParams {
  idOrName: string;
}
/** Gateway parameters */

interface WatsonxLLMGatewayKwargs
  extends Omit<
    CreateCompletionsParams,
    keyof WatsonxLLMParams | "model" | "stream" | "prompt" | "maxTokens"
  > {}

export interface WatsonxLLMGatewayParams
  extends WatsonxInit,
    Omit<
      CreateCompletionsParams,
      keyof WatsonxLLMGatewayKwargs | "stream" | "prompt"
    > {
  /** Additional parameters usable only in model gateway */
  modelGatewayKwargs?: WatsonxLLMGatewayKwargs;
  modelGateway: boolean;
}

/** Call interface for second parameter of inbuild methods */
export interface WatsonxCallOptionsLLM
  extends BaseLanguageModelCallOptions,
    Partial<WatsonxInit> {
  maxRetries?: number;
  parameters?: XOR<Partial<WatsonxLLMParams>, Partial<WatsonxLLMGatewayParams>>;
  watsonxCallbacks?: RequestCallbacks;
}

/** Constructor input interfaces for each mode */

export interface WatsonxInputLLM
  extends WatsonxLLMBasicOptions,
    WatsonxLLMParams {
  model: string;
  spaceId?: string;
  projectId?: string;
}

export interface WatsonxDeployedInputLLM
  extends WatsonxLLMBasicOptions,
    WatsonxDeploymentLLMParams {}

export interface WatsonxGatewayInputLLM
  extends WatsonxLLMBasicOptions,
    WatsonxLLMGatewayParams {}

// Combined input for chat excluding each mode to not be present at the same time
export type WatsonxLLMConstructor = XOR<
  XOR<WatsonxInputLLM, WatsonxDeployedInputLLM>,
  WatsonxGatewayInputLLM
> &
  WatsonxAuth;

/**
 * Integration with an LLM.
 */
export class WatsonxLLM<
    CallOptions extends WatsonxCallOptionsLLM = WatsonxCallOptionsLLM
  >
  extends BaseLLM<CallOptions>
  implements BaseLLMParams
{
  // Used for tracing, replace with the same name as your class
  static lc_name() {
    return "WatsonxLLM";
  }

  lc_serializable = true;

  streaming = false;

  model: string;

  maxRetries = 0;

  version = "2024-05-31";

  serviceUrl: string;

  maxTokens?: number;

  maxNewTokens?: number;

  spaceId?: string;

  projectId?: string;

  idOrName?: string;

  decodingMethod?:
    | WatsonXAI.TextGenParameters.Constants.DecodingMethod
    | string;

  lengthPenalty?: TextGenLengthPenalty;

  minNewTokens?: number;

  randomSeed?: number;

  stopSequence?: string[];

  temperature?: number;

  timeLimit?: number;

  topK?: number;

  topP?: number;

  repetitionPenalty?: number;

  truncateInpuTokens?: number;

  returnOptions?: ReturnOptionProperties;

  includeStopSequence?: boolean;

  maxConcurrency?: number;

  watsonxCallbacks?: RequestCallbacks;

  modelGateway = false;

  modelGatewayKwargs: WatsonxLLMGatewayKwargs = {};

  protected service?: WatsonXAI;

  protected gateway?: Gateway;

  private checkValidProperties(
    fields:
      | WatsonxLLMConstructor
      | XOR<Partial<WatsonxLLMParams>, Partial<WatsonxLLMGatewayParams>>,
    includeCommonProps = true
  ) {
    const authProps = [
      "serviceUrl",
      "watsonxAIApikey",
      "watsonxAIBearerToken",
      "watsonxAIUsername",
      "watsonxAIPassword",
      "watsonxAIUrl",
      "watsonxAIAuthType",
      "disableSSL",
    ];

    const sharedProps = [
      "maxRetries",
      "watsonxCallbacks",
      "authenticator",
      "serviceUrl",
      "version",
      "streaming",
      "callbackManager",
      "callbacks",
      "maxConcurrency",
      "cache",
      "metadata",
      "concurrency",
      "onFailedAttempt",
      "concurrency",
      "verbose",
      "tags",
    ];

    const gatewayProps = [
      "temperature",
      "topP",
      "model",
      "modelGatewayKwargs",
      "modelGateway",
      "verbose",
      "tags",
      "maxTokens",
    ];

    const deploymentProps = ["idOrName"];

    const projectOrSpaceProps = [
      "spaceId",
      "projectId",
      "temperature",
      "topP",
      "timeLimit",
      "model",
      "maxNewTokens",
      "decodingMethod",
      "lengthPenalty",
      "minNewTokens",
      "randomSeed",
      "stopSequence",
      "topK",
      "repetitionPenalty",
      "truncateInpuTokens",
      "returnOptions",
      "includeStopSequence",
    ];

    const validProps: string[] = [];
    if (includeCommonProps) validProps.push(...authProps, ...sharedProps);

    if (this.modelGateway) {
      validProps.push(...gatewayProps);
    } else if (this.idOrName) {
      validProps.push(...deploymentProps);
    } else if (this.spaceId || this.projectId) {
      validProps.push(...projectOrSpaceProps);
    }
    checkValidProps(fields, validProps);
  }

  constructor(fields: WatsonxLLMConstructor) {
    super(fields);
    expectOneOf(
      fields,
      ["spaceId", "projectId", "idOrName", "modelGateway"],
      true
    );
    this.idOrName = fields?.idOrName;
    this.projectId = fields?.projectId;
    this.modelGateway = fields.modelGateway || this.modelGateway;
    this.spaceId = fields?.spaceId;

    this.checkValidProperties(fields);

    this.model = fields.model ?? this.model;
    this.serviceUrl = fields.serviceUrl;
    this.version = fields.version;

    this.topP = fields.topP;
    this.temperature = fields.temperature;
    this.maxNewTokens = fields.maxNewTokens ?? fields.maxTokens;
    this.decodingMethod = fields.decodingMethod;
    this.lengthPenalty = fields.lengthPenalty;
    this.minNewTokens = fields.minNewTokens;
    this.maxTokens = fields.maxTokens;
    this.randomSeed = fields.randomSeed;
    this.stopSequence = fields.stopSequence;
    this.timeLimit = fields.timeLimit;
    this.topK = fields.topK;
    this.repetitionPenalty = fields.repetitionPenalty;
    this.truncateInpuTokens = fields.truncateInpuTokens;
    this.returnOptions = fields.returnOptions;
    this.includeStopSequence = fields.includeStopSequence;

    this.modelGatewayKwargs =
      fields.modelGatewayKwargs || this.modelGatewayKwargs;

    this.maxRetries = fields.maxRetries || this.maxRetries;
    this.maxConcurrency = fields.maxConcurrency;
    this.streaming = fields.streaming || this.streaming;
    this.watsonxCallbacks = fields.watsonxCallbacks || this.watsonxCallbacks;

    const {
      watsonxAIApikey,
      watsonxAIAuthType,
      watsonxAIBearerToken,
      watsonxAIUsername,
      watsonxAIPassword,
      watsonxAIUrl,
      disableSSL,
      version,
      serviceUrl,
    } = fields;

    const authData = {
      watsonxAIApikey,
      watsonxAIAuthType,
      watsonxAIBearerToken,
      watsonxAIUsername,
      watsonxAIPassword,
      watsonxAIUrl,
      disableSSL,
      version,
      serviceUrl,
    };

    if (this.modelGateway) {
      const gateway = authenticateAndSetGatewayInstance(authData);

      if (gateway) this.gateway = gateway;
      else throw new Error("You have not provided any type of authentication");
    } else {
      const service = authenticateAndSetInstance(authData);

      if (service) this.service = service;
      else throw new Error("You have not provided any type of authentication");
    }
  }

  get lc_secrets(): { [key: string]: string } {
    return {
      authenticator: "AUTHENTICATOR",
      apiKey: "WATSONX_AI_APIKEY",
      apikey: "WATSONX_AI_APIKEY",
      watsonxAIAuthType: "WATSONX_AI_AUTH_TYPE",
      watsonxAIApikey: "WATSONX_AI_APIKEY",
      watsonxAIBearerToken: "WATSONX_AI_BEARER_TOKEN",
      watsonxAIUsername: "WATSONX_AI_USERNAME",
      watsonxAIPassword: "WATSONX_AI_PASSWORD",
      watsonxAIUrl: "WATSONX_AI_URL",
    };
  }

  get lc_aliases(): { [key: string]: string } {
    return {
      authenticator: "authenticator",
      apikey: "watsonx_ai_apikey",
      apiKey: "watsonx_ai_apikey",
      watsonxAIAuthType: "watsonx_ai_auth_type",
      watsonxAIApikey: "watsonx_ai_apikey",
      watsonxAIBearerToken: "watsonx_ai_bearer_token",
      watsonxAIUsername: "watsonx_ai_username",
      watsonxAIPassword: "watsonx_ai_password",
      watsonxAIUrl: "watsonx_ai_url",
    };
  }

  invocationParams(options: this["ParsedCallOptions"]) {
    const { parameters } = options;
    const { signal, maxRetries, maxConcurrency, timeout, ...rest } = options;
    if (parameters) this.checkValidProperties(parameters, false);
    if (this.idOrName && Object.keys(rest).length > 0)
      throw new Error("Options cannot be provided to a deployed model");
    if (this.idOrName) return undefined;


    if (this.modelGateway) {
      const modelGatewayParams: Record<string, any> = {
        ...this?.modelGatewayKwargs,
        ...parameters?.modelGatewayKwargs,
      };
      return {
        stop: options?.stop ?? this.stopSequence,
        temperature: parameters?.temperature ?? this.temperature,
        topP: parameters?.topP ?? this.topP,
        maxTokens: parameters?.maxTokens ?? this.maxTokens,
        ...modelGatewayParams,
      };
    }

    return {
      stop_sequences: options?.stop ?? this.stopSequence,
      temperature: parameters?.temperature ?? this.temperature,
      top_p: parameters?.topP ?? this.topP,
      max_new_tokens:
        parameters?.maxNewTokens ??
        this.maxNewTokens ??
        parameters?.maxTokens ??
        this.maxTokens,
      decoding_method: parameters?.decodingMethod ?? this.decodingMethod,
      length_penalty: parameters?.lengthPenalty ?? this.lengthPenalty,
      min_new_tokens: parameters?.minNewTokens ?? this.minNewTokens,
      random_seed: parameters?.randomSeed ?? this.randomSeed,
      time_limit: parameters?.timeLimit ?? this.timeLimit ?? timeout,
      top_k: parameters?.topK ?? this.topK,
      repetition_penalty:
        parameters?.repetitionPenalty ?? this.repetitionPenalty,
      truncate_input_tokens:
        parameters?.truncateInpuTokens ?? this.truncateInpuTokens,
      return_options: parameters?.returnOptions ?? this.returnOptions,
      include_stop_sequence:
        parameters?.includeStopSequence ?? this.includeStopSequence,
    };
  }

  invocationCallbacks(options: this["ParsedCallOptions"]) {
    return options.watsonxCallbacks ?? this.watsonxCallbacks;
  }

  scopeId() {
    if (this.projectId)
      return { projectId: this.projectId, modelId: this.model };
    else if (this.spaceId)
      return { spaceId: this.spaceId, modelId: this.model };
    else if (this.idOrName)
      return { idOrName: this.idOrName, modelId: this.model };
    else if (this.modelGateway) return { modelId: this.model };
    else
      throw new Error(
        "Invalid mode type. Please make sure you have provided correct parameters"
      );
  }

  async listModels() {
    if (this.service) {
      const { service } = this;
      const listModelParams = {
        filters: "function_text_generation",
      };
      const listModels = await this.completionWithRetry(() =>
        service.listFoundationModelSpecs(listModelParams)
      );
      return listModels.result.resources?.map((item) => item.model_id);
    } else {
      throw new Error("This method is not supported in this model gateway");
    }
  }

  private async generateSingleMessage(
    input: string,
    options: this["ParsedCallOptions"],
    stream: true
  ): Promise<
    | Stream<WatsonXAI.ObjectStreamed<WatsonXAI.TextGenResponse>>
    | Stream<TextCompletionStream>
  >;

  private async generateSingleMessage(
    input: string,
    options: this["ParsedCallOptions"],
    stream: false
  ): Promise<Generation[]>;

  private async generateSingleMessage(
    input: string,
    options: this["ParsedCallOptions"],
    stream: boolean
  ) {
    const {
      signal,
      stop,
      maxRetries,
      maxConcurrency,
      timeout,
      ...requestOptions
    } = options;
    const parameters = this.invocationParams(options);
    const watsonxCallbacks = this.invocationCallbacks(options);

    if (stream) {
      if (this.service) {
        if (this.idOrName) {
          return await this.service.deploymentGenerateTextStream({
            idOrName: this.idOrName,
            ...requestOptions,
            parameters: {
              ...parameters,
              prompt_variables: {
                input,
              },
            },
            returnObject: true,
            signal,
          });
        } else {
          return await this.service.generateTextStream(
            {
              input,
              parameters,
              ...this.scopeId(),
              ...requestOptions,
              returnObject: true,
              signal,
            },
            watsonxCallbacks
          );
        }
      } else if (this.gateway) {
        return await this.gateway.completion.create({
          ...parameters,
          model: this.model,
          prompt: input,
          stream: true,
          signal,
        });
      }
    } else {
      if (this.service) {
        const tokenUsage = { generated_token_count: 0, input_token_count: 0 };

        const textGenerationPromise = this.idOrName
          ? this.service.deploymentGenerateText(
              {
                ...requestOptions,
                idOrName: this.idOrName,
                parameters: {
                  ...parameters,
                  prompt_variables: {
                    input,
                  },
                },
                signal,
              },
              watsonxCallbacks
            )
          : this.service.generateText(
              {
                input,
                parameters,
                ...this.scopeId(),
                ...requestOptions,
                signal,
              },
              watsonxCallbacks
            );

        const textGeneration = await textGenerationPromise;
        const singleGeneration: Generation[] =
          textGeneration.result.results.map((result) => {
            tokenUsage.generated_token_count += result.generated_token_count
              ? result.generated_token_count
              : 0;
            tokenUsage.input_token_count += result.input_token_count
              ? result.input_token_count
              : 0;
            return {
              text: result.generated_text,
              generationInfo: {
                stop_reason: result.stop_reason,
                input_token_count: result.input_token_count,
                generated_token_count: result.generated_token_count,
              },
            };
          });
        return singleGeneration;
      } else if (this.gateway) {
        const textGeneration = await this.gateway.completion.create({
          ...parameters,
          prompt: input,
          model: this.model,
          signal,
        });
        const tokenUsage = textGeneration.result.usage;
        const singleGeneration: Generation[] =
          textGeneration.result.choices.map((choice) => {
            return {
              text: choice.text ?? "",
              generationInfo: {
                stop_reason: choice.finish_reason,
                input_token_count: tokenUsage?.prompt_tokens,
                generated_token_count: tokenUsage?.completion_tokens,
              },
            };
          });
        return singleGeneration;
      }
    }
    throw new Error(
      "No service or gateway set. Please check your intsance init"
    );
  }

  async completionWithRetry<T>(
    callback: () => T,
    options?: this["ParsedCallOptions"]
  ) {
    const caller = new AsyncCaller({
      maxConcurrency: options?.maxConcurrency || this.maxConcurrency,
      maxRetries: this.maxRetries,
    });
    const result = options
      ? caller.callWithOptions(
          {
            signal: options.signal,
          },
          async () => callback()
        )
      : caller.call(async () => callback());

    return result;
  }

  async _generate(
    prompts: string[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<LLMResult> {
    const tokenUsage: TokenUsage = {
      generated_token_count: 0,
      input_token_count: 0,
    };
    if (this.streaming) {
      const generations: Generation[][] = await Promise.all(
        prompts.map(async (prompt, promptIdx) => {
          if (options.signal?.aborted) {
            throw new Error("AbortError");
          }

          const stream = this._streamResponseChunks(prompt, options);
          const geneartionsArray: GenerationInfo[] = [];

          for await (const chunk of stream) {
            const completion = chunk?.generationInfo?.completion ?? 0;
            const generationInfo: GenerationInfo = {
              text: "",
              stop_reason: "",
              generated_token_count: 0,
              input_token_count: 0,
            };
            geneartionsArray[completion] ??= generationInfo;
            geneartionsArray[completion].generated_token_count =
              chunk?.generationInfo?.usage_metadata.generated_token_count ?? 0;
            geneartionsArray[completion].input_token_count +=
              chunk?.generationInfo?.usage_metadata.input_token_count ?? 0;
            geneartionsArray[completion].stop_reason =
              chunk?.generationInfo?.stop_reason;
            geneartionsArray[completion].text += chunk.text;
            if (chunk.text)
              // eslint-disable-next-line no-void
              void runManager?.handleLLMNewToken(chunk.text, {
                prompt: promptIdx,
                completion: 0,
              });
          }

          return geneartionsArray.map((item) => {
            const { text, ...rest } = item;
            tokenUsage.generated_token_count = rest.generated_token_count;
            tokenUsage.input_token_count += rest.input_token_count;

            return {
              text,
              generationInfo: rest,
            };
          });
        })
      );
      const result: LLMResult = { generations, llmOutput: { tokenUsage } };
      return result;
    } else {
      const generations: Generation[][] = await Promise.all(
        prompts.map(async (prompt) => {
          if (options.signal?.aborted) {
            throw new Error("AbortError");
          }

          const callback = () =>
            this.generateSingleMessage(prompt, options, false);
          type ReturnMessage = ReturnType<typeof callback>;

          const response = await this.completionWithRetry<ReturnMessage>(
            callback,
            options
          );
          const [generated_token_count, input_token_count] = response.reduce(
            (acc, curr) => {
              let generated = 0;
              let inputed = 0;
              if (curr?.generationInfo?.generated_token_count)
                generated = curr.generationInfo.generated_token_count + acc[0];
              if (curr?.generationInfo?.input_token_count)
                inputed = curr.generationInfo.input_token_count + acc[1];
              return [generated, inputed];
            },
            [0, 0]
          );
          tokenUsage.generated_token_count += generated_token_count;
          tokenUsage.input_token_count += input_token_count;
          return response;
        })
      );

      const result: LLMResult = { generations, llmOutput: { tokenUsage } };
      return result;
    }
  }

  async getNumTokens(
    content: string,
    options?: TextTokenizeParameters
  ): Promise<number> {
    if (this.service) {
      const { service } = this;
      const params: TextTokenizationParams = {
        ...this.scopeId(),
        input: content,
        parameters: options,
      };
      const callback = () => service.tokenizeText(params);
      type ReturnTokens = ReturnType<typeof callback>;

      const response = await this.completionWithRetry<ReturnTokens>(callback);
      return response.result.result.token_count;
    } else throw new Error("This method is not supported in model gateway");
  }

  async *_streamResponseChunks(
    prompt: string,
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<GenerationChunk> {
    const callback = () => this.generateSingleMessage(prompt, options, true);
    type ReturnStream = ReturnType<typeof callback>;
    const streamInferDeployedPrompt =
      await this.completionWithRetry<ReturnStream>(callback);
    const responseChunk: ResponseChunk = {
      id: 0,
      event: "",
      data: {
        results: [],
      },
    };
    for await (const chunk of streamInferDeployedPrompt) {
      if (options.signal?.aborted) {
        throw new Error("AbortError");
      }

      const results =
        "model_id" in chunk.data
          ? chunk.data.results.entries()
          : chunk.data.choices.entries();
      const usage = "usage" in chunk.data ? chunk.data.usage : {};
      for (const [index, item] of results) {
        const params =
          "generated_text" in item
            ? {
                text: item.generated_text,
                generationInfo: {
                  stop_reason: item.stop_reason,
                  completion: index,
                  usage_metadata: {
                    generated_token_count: item.generated_token_count,
                    input_token_count: item.input_token_count,
                    stop_reason: item.stop_reason,
                  },
                },
              }
            : {
                text: item.text ?? "",
                generationInfo: {
                  stop_reason: item.finish_reason,
                  completion: index,
                  usage_metadata: {
                    generated_token_count: usage?.completion_tokens,
                    input_token_count: usage?.prompt_tokens,
                    stop_reason: item.finish_reason,
                  },
                },
              };
        yield new GenerationChunk(params);
        if (!this.streaming)
          // eslint-disable-next-line no-void
          void runManager?.handleLLMNewToken(
            "generated_text" in item ? item.generated_text : item.text ?? ""
          );
      }
      Object.assign(responseChunk, { id: 0, event: "", data: {} });
    }
  }

  _llmType() {
    return "watsonx";
  }
}
