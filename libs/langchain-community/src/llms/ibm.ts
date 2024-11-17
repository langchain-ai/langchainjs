/* eslint-disable @typescript-eslint/no-unused-vars */
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { BaseLLM, BaseLLMParams } from "@langchain/core/language_models/llms";
import { WatsonXAI } from "@ibm-cloud/watsonx-ai";
import {
  DeploymentTextGenProperties,
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
import { authenticateAndSetInstance } from "../utils/ibm.js";
import {
  GenerationInfo,
  ResponseChunk,
  TokenUsage,
  WatsonxAuth,
  WatsonxParams,
} from "../types/ibm.js";

/**
 * Input to LLM class.
 */

export interface WatsonxCallOptionsLLM extends BaseLanguageModelCallOptions {
  maxRetries?: number;
  parameters?: Partial<WatsonxInputLLM>;
  idOrName?: string;
}

export interface WatsonxInputLLM extends WatsonxParams, BaseLLMParams {
  streaming?: boolean;
  maxNewTokens?: number;
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
}

/**
 * Integration with an LLM.
 */
export class WatsonxLLM<
    CallOptions extends WatsonxCallOptionsLLM = WatsonxCallOptionsLLM
  >
  extends BaseLLM<CallOptions>
  implements WatsonxInputLLM
{
  // Used for tracing, replace with the same name as your class
  static lc_name() {
    return "Watsonx";
  }

  lc_serializable = true;

  streaming = false;

  model: string;

  maxRetries = 0;

  version = "2024-05-31";

  serviceUrl: string;

  maxNewTokens?: number;

  spaceId?: string;

  projectId?: string;

  idOrName?: string;

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

  maxConcurrency?: number;

  private service: WatsonXAI;

  constructor(fields: WatsonxInputLLM & WatsonxAuth) {
    super(fields);
    this.model = fields.model ?? this.model;
    this.version = fields.version;
    this.maxNewTokens = fields.maxNewTokens ?? this.maxNewTokens;
    this.serviceUrl = fields.serviceUrl;
    this.decodingMethod = fields.decodingMethod;
    this.lengthPenalty = fields.lengthPenalty;
    this.minNewTokens = fields.minNewTokens;
    this.randomSeed = fields.randomSeed;
    this.stopSequence = fields.stopSequence;
    this.temperature = fields.temperature;
    this.timeLimit = fields.timeLimit;
    this.topK = fields.topK;
    this.topP = fields.topP;
    this.repetitionPenalty = fields.repetitionPenalty;
    this.truncateInpuTokens = fields.truncateInpuTokens;
    this.returnOptions = fields.returnOptions;
    this.includeStopSequence = fields.includeStopSequence;
    this.maxRetries = fields.maxRetries || this.maxRetries;
    this.maxConcurrency = fields.maxConcurrency;
    this.streaming = fields.streaming || this.streaming;
    if (
      (fields.projectId && fields.spaceId) ||
      (fields.idOrName && fields.projectId) ||
      (fields.spaceId && fields.idOrName)
    )
      throw new Error("Maximum 1 id type can be specified per instance");

    if (!fields.projectId && !fields.spaceId && !fields.idOrName)
      throw new Error(
        "No id specified! At least id of 1 type has to be specified"
      );
    this.projectId = fields?.projectId;
    this.spaceId = fields?.spaceId;
    this.idOrName = fields?.idOrName;

    this.serviceUrl = fields?.serviceUrl;
    const {
      watsonxAIApikey,
      watsonxAIAuthType,
      watsonxAIBearerToken,
      watsonxAIUsername,
      watsonxAIPassword,
      watsonxAIUrl,
      version,
      serviceUrl,
    } = fields;

    const auth = authenticateAndSetInstance({
      watsonxAIApikey,
      watsonxAIAuthType,
      watsonxAIBearerToken,
      watsonxAIUsername,
      watsonxAIPassword,
      watsonxAIUrl,
      version,
      serviceUrl,
    });
    if (auth) this.service = auth;
    else throw new Error("You have not provided one type of authentication");
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

  invocationParams(
    options: this["ParsedCallOptions"]
  ): TextGenParameters | DeploymentTextGenProperties {
    const { parameters } = options;

    return {
      max_new_tokens: parameters?.maxNewTokens ?? this.maxNewTokens,
      decoding_method: parameters?.decodingMethod ?? this.decodingMethod,
      length_penalty: parameters?.lengthPenalty ?? this.lengthPenalty,
      min_new_tokens: parameters?.minNewTokens ?? this.minNewTokens,
      random_seed: parameters?.randomSeed ?? this.randomSeed,
      stop_sequences: options?.stop ?? this.stopSequence,
      temperature: parameters?.temperature ?? this.temperature,
      time_limit: parameters?.timeLimit ?? this.timeLimit,
      top_k: parameters?.topK ?? this.topK,
      top_p: parameters?.topP ?? this.topP,
      repetition_penalty:
        parameters?.repetitionPenalty ?? this.repetitionPenalty,
      truncate_input_tokens:
        parameters?.truncateInpuTokens ?? this.truncateInpuTokens,
      return_options: parameters?.returnOptions ?? this.returnOptions,
      include_stop_sequence:
        parameters?.includeStopSequence ?? this.includeStopSequence,
    };
  }

  scopeId() {
    if (this.projectId)
      return { projectId: this.projectId, modelId: this.model };
    else if (this.spaceId)
      return { spaceId: this.spaceId, modelId: this.model };
    else if (this.idOrName)
      return { idOrName: this.idOrName, modelId: this.model };
    else return { spaceId: this.spaceId, modelId: this.model };
  }

  async listModels() {
    const listModelParams = {
      filters: "function_text_generation",
    };
    const listModels = await this.completionWithRetry(() =>
      this.service.listFoundationModelSpecs(listModelParams)
    );
    return listModels.result.resources?.map((item) => item.model_id);
  }

  private async generateSingleMessage(
    input: string,
    options: this["ParsedCallOptions"],
    stream: true
  ): Promise<AsyncIterable<string>>;

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
    const tokenUsage = { generated_token_count: 0, input_token_count: 0 };
    const idOrName = options?.idOrName ?? this.idOrName;
    const parameters = this.invocationParams(options);
    if (stream) {
      const textStream = idOrName
        ? await this.service.deploymentGenerateTextStream({
            idOrName,
            ...requestOptions,
            parameters: {
              ...parameters,
              prompt_variables: {
                input,
              },
            },
          })
        : await this.service.generateTextStream({
            input,
            parameters,
            ...this.scopeId(),
            ...requestOptions,
          });
      return textStream as unknown as AsyncIterable<string>;
    } else {
      const textGenerationPromise = idOrName
        ? this.service.deploymentGenerateText({
            ...requestOptions,
            idOrName,
            parameters: {
              ...parameters,
              prompt_variables: {
                input,
              },
            },
          })
        : this.service.generateText({
            input,
            parameters,
            ...this.scopeId(),
            ...requestOptions,
          });

      const textGeneration = await textGenerationPromise;
      const singleGeneration: Generation[] = textGeneration.result.results.map(
        (result) => {
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
        }
      );
      return singleGeneration;
    }
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
    _runManager?: CallbackManagerForLLMRun
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
          const callback = () =>
            this.generateSingleMessage(prompt, options, true);

          type ReturnMessage = ReturnType<typeof callback>;
          const stream = await this.completionWithRetry<ReturnMessage>(
            callback,
            options
          );

          const responseChunk: ResponseChunk = {
            id: 0,
            event: "",
            data: {
              results: [],
            },
          };
          const messages: ResponseChunk[] = [];
          type ResponseChunkKeys = keyof ResponseChunk;
          for await (const chunk of stream) {
            if (chunk.length > 0) {
              const index = chunk.indexOf(": ");
              const [key, value] = [
                chunk.substring(0, index) as ResponseChunkKeys,
                chunk.substring(index + 2),
              ];
              if (key === "id") {
                responseChunk[key] = Number(value);
              } else if (key === "event") {
                responseChunk[key] = String(value);
              } else {
                responseChunk[key] = JSON.parse(value);
              }
            } else if (chunk.length === 0) {
              messages.push(JSON.parse(JSON.stringify(responseChunk)));
              Object.assign(responseChunk, { id: 0, event: "", data: {} });
            }
          }

          const geneartionsArray: GenerationInfo[] = [];
          for (const message of messages) {
            message.data.results.forEach((item, index) => {
              const generationInfo: GenerationInfo = {
                text: "",
                stop_reason: "",
                generated_token_count: 0,
                input_token_count: 0,
              };
              void _runManager?.handleLLMNewToken(item.generated_text ?? "", {
                prompt: promptIdx,
                completion: 1,
              });
              geneartionsArray[index] ??= generationInfo;
              geneartionsArray[index].generated_token_count =
                item.generated_token_count;
              geneartionsArray[index].input_token_count +=
                item.input_token_count;
              geneartionsArray[index].stop_reason = item.stop_reason;
              geneartionsArray[index].text += item.generated_text;
            });
          }
          return geneartionsArray.map((item) => {
            const { text, ...rest } = item;
            tokenUsage.generated_token_count += rest.generated_token_count;
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
    const params: TextTokenizationParams = {
      ...this.scopeId(),
      input: content,
      parameters: options,
    };
    const callback = () => this.service.tokenizeText(params);
    type ReturnTokens = ReturnType<typeof callback>;

    const response = await this.completionWithRetry<ReturnTokens>(callback);
    return response.result.result.token_count;
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

      type Keys = keyof typeof responseChunk;
      if (chunk.length > 0) {
        const index = chunk.indexOf(": ");
        const [key, value] = [
          chunk.substring(0, index) as Keys,
          chunk.substring(index + 2),
        ];
        if (key === "id") {
          responseChunk[key] = Number(value);
        } else if (key === "event") {
          responseChunk[key] = String(value);
        } else {
          responseChunk[key] = JSON.parse(value);
        }
      } else if (
        chunk.length === 0 &&
        responseChunk.data?.results?.length > 0
      ) {
        for (const item of responseChunk.data.results) {
          yield new GenerationChunk({
            text: item.generated_text,
            generationInfo: {
              stop_reason: item.stop_reason,
            },
          });
          await runManager?.handleLLMNewToken(item.generated_text ?? "");
        }
        Object.assign(responseChunk, { id: 0, event: "", data: {} });
      }
    }
  }

  _llmType() {
    return "watsonx";
  }
}
