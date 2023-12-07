import type { TiktokenModel } from "js-tiktoken/lite";
import {
  type OpenAIClientOptions as AzureOpenAIClientOptions,
  OpenAIClient as AzureOpenAIClient,
  AzureKeyCredential,
  Completions,
  Choice,
} from "@azure/openai";
import { calculateMaxTokens } from "../base_language/count_tokens.js";
import {
  AzureOpenAIInput,
  OpenAICallOptions,
  OpenAIInput
} from "../types/openai-types.js";
import { BaseLLM, BaseLLMParams } from "./base.js";
import { CallbackManagerForLLMRun } from "../callbacks/manager.js";
import { chunkArray } from "../util/chunk.js";
import { GenerationChunk, LLMResult } from "../schema/index.js";
import { getEnvironmentVariable } from "../util/env.js";
import { AzureOpenAIChat } from "./azure_openai-chat.js";
import { TokenUsage } from "./openai.js";
import { promptLayerTrackRequest } from "../util/prompt-layer.js";

export class AzureOpenAI<
    CallOptions extends OpenAICallOptions = OpenAICallOptions
  >
  extends BaseLLM<CallOptions>
  implements OpenAIInput, AzureOpenAIInput
{
  static lc_name() {
    return "AzureOpenAI";
  }

  get callKeys() {
    return [...super.callKeys, "options"];
  }

  lc_serializable = true;

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      azureOpenAIApiKey: "AZURE_OPENAI_API_KEY",
      azureOpenAIEndpoint: "AZURE_OPENAI_API_ENDPOINT",
      azureOpenAIApiDeploymentName: "AZURE_OPENAI_API_DEPLOYMENT_NAME",
    };
  }

  get lc_aliases(): Record<string, string> {
    return {
      modelName: "model",
      azureOpenAIApiKey: "azure_openai_api_key",
      azureOpenAIEndpoint: "azure_openai_api_endpoint",
      azureOpenAIApiDeploymentName: "azure_openai_api_deployment_name",
    };
  }

  temperature = 0.7;

  maxTokens = 256;

  topP = 1;

  frequencyPenalty = 0;

  presencePenalty = 0;

  n = 1;

  bestOf?: number;

  logitBias?: Record<string, number>;

  modelName = "gpt-3.5-turbo-instruct";

  modelKwargs?: OpenAIInput["modelKwargs"];

  batchSize = 20;

  timeout?: number;

  stop?: string[];

  user?: string;

  streaming = false;

  azureOpenAIApiKey?: string;

  azureOpenAIEndpoint?: string;

  azureOpenAIApiDeploymentName?: string;

  logprobs?: number;

  echo?: boolean;

  private client: AzureOpenAIClient;

  constructor(
    fields?: Partial<OpenAIInput> &
      Partial<AzureOpenAIInput> &
      BaseLLMParams & {
        configuration?: AzureOpenAIClientOptions;
      }
  ) {
    if (
      (fields?.modelName?.startsWith("gpt-3.5-turbo") ||
        fields?.modelName?.startsWith("gpt-4")) &&
      !fields?.modelName?.includes("-instruct")
    ) {
      // eslint-disable-next-line no-constructor-return
      return new AzureOpenAIChat(fields) as unknown as AzureOpenAI<CallOptions>;
    }
    super(fields ?? {});

    this.azureOpenAIEndpoint =
      fields?.azureOpenAIEndpoint ??
      getEnvironmentVariable("AZURE_OPENAI_API_ENDPOINT");

    this.azureOpenAIApiDeploymentName =
      fields?.azureOpenAIApiDeploymentName ??
      getEnvironmentVariable("AZURE_OPENAI_API_DEPLOYMENT_NAME");

    this.azureOpenAIApiKey =
      fields?.azureOpenAIApiKey ??
      getEnvironmentVariable("AZURE_OPENAI_API_KEY");

    if (!this.azureOpenAIApiKey) {
      throw new Error("Azure OpenAI API key not found");
    }

    if (!this.azureOpenAIEndpoint) {
      throw new Error("Azure OpenAI Endpoint not found");
    }

    if (!this.azureOpenAIApiDeploymentName) {
      throw new Error("Azure OpenAI Completion Deployment name not found");
    }

    this.maxTokens = fields?.maxTokens ?? this.maxTokens;
    this.temperature = fields?.temperature ?? this.temperature;
    this.topP = fields?.topP ?? this.topP;
    this.logitBias = fields?.logitBias;
    this.user = fields?.user;
    this.n = fields?.n ?? this.n;
    this.logprobs = fields?.logprobs;
    this.echo = fields?.echo;
    this.stop = fields?.stop;
    this.presencePenalty = fields?.presencePenalty ?? this.presencePenalty;
    this.frequencyPenalty = fields?.frequencyPenalty ?? this.frequencyPenalty;
    this.bestOf = fields?.bestOf ?? this.bestOf;
    this.modelName = fields?.modelName ?? this.modelName;
    this.modelKwargs = fields?.modelKwargs ?? {};
    this.streaming = fields?.streaming ?? false;
    this.batchSize = fields?.batchSize ?? this.batchSize;

    if (this.streaming && this.bestOf && this.bestOf > 1) {
      throw new Error("Cannot stream results when bestOf > 1");
    }

    const azureKeyCredential: AzureKeyCredential = new AzureKeyCredential(
      this.azureOpenAIApiKey
    );
    this.client = new AzureOpenAIClient(
      this.azureOpenAIEndpoint ?? "",
      azureKeyCredential
    );
  }

  async *_streamResponseChunks(
    input: string,
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<GenerationChunk> {
    if (!this.azureOpenAIApiDeploymentName) {
      throw new Error("Azure OpenAI Completion Deployment name not found");
    }

    const stream = await this.client.listCompletions(
      this.azureOpenAIApiDeploymentName,
      [input],
      {
        maxTokens: this.maxTokens,
        temperature: this.temperature,
        topP: this.topP,
        logitBias: this.logitBias,
        user: this.user,
        n: this.n,
        logprobs: this.logprobs,
        echo: this.echo,
        stop: this.stop,
        presencePenalty: this.presencePenalty,
        frequencyPenalty: this.frequencyPenalty,
        bestOf: this.bestOf,
        stream: this.streaming,
        model: this.modelName,
        requestOptions: {
          timeout: options?.timeout,
        },
        abortSignal: options?.signal ?? undefined,
        ...this.modelKwargs,
      }
    );

    for await (const data of stream) {
      const choice = data?.choices[0];
      if (!choice) {
        continue;
      }
      const chunk = new GenerationChunk({
        text: choice.text,
        generationInfo: {
          finishReason: choice.finishReason,
        },
      });
      yield chunk;
      // eslint-disable-next-line no-void
      void runManager?.handleLLMNewToken(chunk.text ?? "");
    }

    if (options.signal?.aborted) {
      throw new Error("AbortError");
    }
  }

  async _generate(
    prompts: string[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<LLMResult> {
    if (!this.azureOpenAIApiDeploymentName) {
      throw new Error("Azure OpenAI Completion Deployment name not found");
    }

    if (this.maxTokens === -1) {
      if (prompts.length !== 1) {
        throw new Error(
          "max_tokens set to -1 not supported for multiple inputs"
        );
      }
      this.maxTokens = await calculateMaxTokens({
        prompt: prompts[0],
        // Cast here to allow for other models that may not fit the union
        modelName: this.modelName as TiktokenModel,
      });
    }

    const subPrompts = chunkArray(prompts, this.batchSize);

    if (this.streaming) {
      const choices: Choice[] = [];

      for (let i = 0; i < subPrompts.length; i += 1) {
        let response: Omit<Completions, "choices" | "usage"> | undefined;

        const stream = await this.client.listCompletions(
          this.azureOpenAIApiDeploymentName,
          subPrompts[i],
          {
            maxTokens: this.maxTokens,
            temperature: this.temperature,
            topP: this.topP,
            logitBias: this.logitBias,
            user: this.user,
            n: this.n,
            logprobs: this.logprobs,
            echo: this.echo,
            stop: this.stop,
            presencePenalty: this.presencePenalty,
            frequencyPenalty: this.frequencyPenalty,
            bestOf: this.bestOf,
            stream: this.streaming,
            model: this.modelName,
            requestOptions: {
              timeout: options?.timeout,
            },
            abortSignal: options?.signal ?? undefined,
            ...this.modelKwargs,
          }
        );
        for await (const message of stream) {
          if (!response) {
            response = {
              id: message.id,
              created: message.created,
              promptFilterResults: message.promptFilterResults,
            };
          }

          // on all messages, update choice
          for (const part of message.choices) {
            if (!choices[part.index]) {
              choices[part.index] = part;
            } else {
              const choice = choices[part.index];
              choice.text += part.text;
              choice.finishReason = part.finishReason;
              choice.logprobs = part.logprobs;
            }
            void runManager?.handleLLMNewToken(part.text, {
              prompt: Math.floor(part.index / this.n),
              completion: part.index % this.n,
            });
          }
        }
        if (options.signal?.aborted) {
          throw new Error("AbortError");
        }
      }
      const generations = chunkArray(choices, this.n).map((promptChoices) =>
        promptChoices.map((choice) => ({
          text: choice.text ?? "",
          generationInfo: {
            finishReason: choice.finishReason,
            logprobs: choice.logprobs,
          },
        }))
      );
      return {
        generations,
        llmOutput: {
          tokenUsage: {
            completionTokens: undefined,
            promptTokens: undefined,
            totalTokens: undefined,
          },
        },
      };
    } else {
      const tokenUsage: TokenUsage = {};
      const subPrompts = chunkArray(prompts, this.batchSize);
      const choices: Choice[] = [];

      for (let i = 0; i < subPrompts.length; i += 1) {
        const data = await this.client.getCompletions(
          this.azureOpenAIApiDeploymentName,
          prompts,
          {
            maxTokens: this.maxTokens,
            temperature: this.temperature,
            topP: this.topP,
            logitBias: this.logitBias,
            user: this.user,
            n: this.n,
            logprobs: this.logprobs,
            echo: this.echo,
            stop: this.stop,
            presencePenalty: this.presencePenalty,
            frequencyPenalty: this.frequencyPenalty,
            bestOf: this.bestOf,
            stream: this.streaming,
            model: this.modelName,
            requestOptions: {
              timeout: options?.timeout,
            },
            abortSignal: options?.signal ?? undefined,
            ...this.modelKwargs,
          }
        );

        choices.push(...data.choices);

        tokenUsage.completionTokens = (tokenUsage.completionTokens ?? 0) + data.usage.completionTokens;
        tokenUsage.promptTokens = (tokenUsage.promptTokens ?? 0) + data.usage.promptTokens;
        tokenUsage.totalTokens = (tokenUsage.totalTokens ?? 0) + data.usage.totalTokens;
      }

      const generations = chunkArray(choices, this.n).map(
        (promptChoices) =>
          promptChoices.map((choice) => {
            void runManager?.handleLLMNewToken(choice.text, {
              prompt: Math.floor(choice.index / this.n),
              completion: choice.index % this.n,
            });
            return {
              text: choice.text ?? "",
              generationInfo: {
                finishReason: choice.finishReason,
                logprobs: choice.logprobs,
              },
            };
          })
      );

      return {
        generations,
        llmOutput: {
          tokenUsage: {
            completionTokens: tokenUsage.completionTokens,
            promptTokens: tokenUsage.promptTokens,
            totalTokens: tokenUsage.totalTokens
          },
        },
      };
    }
  }

  _llmType() {
    return "azure_openai";
  }
}

/**
 * PromptLayer wrapper to OpenAI
 * @augments OpenAI
 */
export class PromptLayerAzureOpenAI extends AzureOpenAI {
  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      promptLayerApiKey: "PROMPTLAYER_API_KEY",
    };
  }

  lc_serializable = false;

  promptLayerApiKey?: string;

  plTags?: string[];

  returnPromptLayerId?: boolean;

  constructor(
    fields?: ConstructorParameters<typeof AzureOpenAI>[0] & {
      promptLayerApiKey?: string;
      plTags?: string[];
      returnPromptLayerId?: boolean;
    }
  ) {
    super(fields);

    this.plTags = fields?.plTags ?? [];
    this.promptLayerApiKey =
      fields?.promptLayerApiKey ??
      getEnvironmentVariable("PROMPTLAYER_API_KEY");

    this.returnPromptLayerId = fields?.returnPromptLayerId;
    if (!this.promptLayerApiKey) {
      throw new Error("Missing PromptLayer API key");
    }
  }

  async _generate(
    prompts: string[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<LLMResult> {
    const requestStartTime = Date.now();
    const generations = await super._generate(prompts, options, runManager);

    for (let i = 0; i < generations.generations.length; i += 1) {
      const requestEndTime = Date.now();
      const parsedResp = {
        text: generations.generations[i][0].text,
        llm_output: generations.llmOutput,
      };

      const promptLayerRespBody = await promptLayerTrackRequest(
        this.caller,
        "langchain.PromptLayerOpenAI",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { ...this._identifyingParams(), prompt: prompts[i] } as any,
        this.plTags,
        parsedResp,
        requestStartTime,
        requestEndTime,
        this.promptLayerApiKey
      );

      let promptLayerRequestId;
      if (this.returnPromptLayerId === true) {
        if (promptLayerRespBody && promptLayerRespBody.success === true) {
          promptLayerRequestId = promptLayerRespBody.request_id;
        }

        generations.generations[i][0].generationInfo = {
          ...generations.generations[i][0].generationInfo,
          promptLayerRequestId,
        };
      }
    }

    return generations;
  }
}

export { AzureOpenAIChat, PromptLayerAzureOpenAIChat } from "./azure_openai-chat.js";