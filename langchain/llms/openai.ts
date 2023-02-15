import type {
  Configuration as ConfigurationT,
  OpenAIApi as OpenAIApiT,
  CreateCompletionRequest,
  CreateCompletionResponseChoicesInner,
} from "openai";

import { backOff } from "exponential-backoff";
import { chunkArray } from "../util";
import { BaseLLM, LLMResult, LLMCallbackManager } from ".";

let Configuration: typeof ConfigurationT | null = null;
let OpenAIApi: typeof OpenAIApiT | null = null;

try {
  // eslint-disable-next-line global-require
  ({ Configuration, OpenAIApi } = require("openai"));
} catch {
  // ignore error
}

interface ModelParams {
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  n: number;
  bestOf: number;
  logitBias?: Record<string, number>;
}

type TokenUsage = {
  completionTokens?: number;
  promptTokens?: number;
  totalTokens?: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Kwargs = Record<string, any>;

export class OpenAI extends BaseLLM implements ModelParams {
  temperature = 0.7;

  maxTokens = 256;

  topP = 1;

  frequencyPenalty = 0;

  presencePenalty = 0;

  n = 1;

  bestOf = 1;

  logitBias?: Record<string, number>;

  modelName = "text-davinci-003";

  modelKwargs?: Kwargs;

  batchSize = 20;

  maxRetries = 6;

  stop?: string[];

  private client: OpenAIApiT;

  constructor(
    fields?: Partial<ModelParams> & {
      callbackManager?: LLMCallbackManager;
      verbose?: boolean;
      modelName?: string;
      modelKwargs?: Kwargs;
      openAIApiKey?: string;
      batchSize?: number;
      maxRetries?: number;
      stop?: string[];
    }
  ) {
    super(fields?.callbackManager, fields?.verbose);
    if (Configuration === null || OpenAIApi === null) {
      throw new Error(
        "Please install openai as a dependency with, e.g. `npm install -S openai`"
      );
    }

    this.modelName = fields?.modelName ?? this.modelName;
    this.modelKwargs = fields?.modelKwargs ?? {};
    this.batchSize = fields?.batchSize ?? this.batchSize;
    this.maxRetries = fields?.maxRetries ?? this.maxRetries;

    this.temperature = fields?.temperature ?? this.temperature;
    this.maxTokens = fields?.maxTokens ?? this.maxTokens;
    this.topP = fields?.topP ?? this.topP;
    this.frequencyPenalty = fields?.frequencyPenalty ?? this.frequencyPenalty;
    this.presencePenalty = fields?.presencePenalty ?? this.presencePenalty;
    this.n = fields?.n ?? this.n;
    this.bestOf = fields?.bestOf ?? this.bestOf;
    this.logitBias = fields?.logitBias;
    this.stop = fields?.stop;

    const clientConfig = new Configuration({
      apiKey: fields?.openAIApiKey ?? process.env.OPENAI_API_KEY,
    });
    this.client = new OpenAIApi(clientConfig);
  }

  invocationParams(): CreateCompletionRequest & Kwargs {
    return {
      model: this.modelName,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      top_p: this.topP,
      frequency_penalty: this.frequencyPenalty,
      presence_penalty: this.presencePenalty,
      n: this.n,
      best_of: this.bestOf,
      logit_bias: this.logitBias,
      stop: this.stop,
      ...this.modelKwargs,
    };
  }

  identifyingParams() {
    return {
      model_name: this.modelName,
      ...this.invocationParams(),
    };
  }

  async _generate(prompts: string[], stop?: string[]): Promise<LLMResult> {
    const subPrompts = chunkArray(prompts, this.batchSize);
    const choices: CreateCompletionResponseChoicesInner[] = [];
    const tokenUsage: TokenUsage = {};

    if (this.stop && stop) {
      throw new Error("Stop found in input and default params");
    }

    const params = this.invocationParams();
    params.stop = stop ?? params.stop;

    for (let i = 0; i < subPrompts.length; i += 1) {
      const { data } = await this.completionWithRetry({
        ...params,
        prompt: subPrompts[i],
      });
      choices.push(...data.choices);
      const {
        completion_tokens: completionTokens,
        prompt_tokens: promptTokens,
        total_tokens: totalTokens,
      } = data.usage ?? {};

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

    const generations = chunkArray(choices, this.n).map((promptChoices) =>
      promptChoices.map((choice) => ({
        text: choice.text ?? "",
        generationInfo: {
          finishReason: choice.finish_reason,
          logprobs: choice.logprobs,
        },
      }))
    );
    return {
      generations,
      llmOutput: { tokenUsage },
    };
  }

  completionWithRetry(request: CreateCompletionRequest) {
    const makeCompletionRequest = () => this.client.createCompletion(request);
    return backOff(makeCompletionRequest, {
      startingDelay: 4,
      maxDelay: 10,
      numOfAttempts: this.maxRetries,
      // TODO(sean) pass custom retry function to check error types.
    });
  }

  _llmType() {
    return "openai";
  }
}
