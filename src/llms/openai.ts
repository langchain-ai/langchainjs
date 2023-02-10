import {
  Configuration,
  OpenAIApi,
  CreateCompletionRequest,
  CreateCompletionResponseChoicesInner,
} from "openai";
import { backOff } from "exponential-backoff";
import { BaseLLM, LLMResult, LLMCallbackManager } from ".";

interface InvocationParams {
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  n: number;
  bestOf: number;
  requestTimeout?: number | [number, number];
  logitBias?: Record<string, number>;
}

type TokenUsage = {
  completionTokens?: number;
  promptTokens?: number;
  totalTokens?: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Kwargs = Record<string, any>;

const chunkArray = <T>(arr: T[], chunkSize: number) =>
  arr.reduce((chunks, elem, index) => {
    const chunkIndex = Math.floor(index / chunkSize);
    const chunk = chunks[chunkIndex] || [];
    // eslint-disable-next-line no-param-reassign
    chunks[chunkIndex] = chunk.concat([elem]);
    return chunks;
  }, [] as T[][]);

export class OpenAI extends BaseLLM implements InvocationParams {
  temperature: number;

  maxTokens: number;

  topP: number;

  frequencyPenalty: number;

  presencePenalty: number;

  n: number;

  bestOf: number;

  requestTimeout?: number | [number, number];

  logitBias?: Record<string, number>;

  modelName = "text-davinci-003";

  modelKwargs?: Kwargs;

  batchSize = 20;

  maxRetries = 6;

  private client: OpenAIApi;

  constructor(
    fields: InvocationParams & {
      callbackManager?: LLMCallbackManager;
      verbose?: boolean;
      modelName?: string;
      modelKwargs?: Kwargs;
      openAIApiKey?: string;
      batchSize?: number;
      maxRetries?: number;
    }
  ) {
    super(fields.callbackManager, fields.verbose);

    this.modelName = fields.modelName ?? this.modelName;
    this.modelKwargs = fields.modelKwargs ?? {};
    this.batchSize = fields.batchSize ?? this.batchSize;
    this.maxRetries = fields.maxRetries ?? this.maxRetries;

    this.temperature = fields.temperature;
    this.maxTokens = fields.maxTokens;
    this.topP = fields.topP;
    this.frequencyPenalty = fields.frequencyPenalty;
    this.presencePenalty = fields.presencePenalty;
    this.n = fields.n;
    this.bestOf = fields.bestOf;
    this.requestTimeout = fields.requestTimeout;
    this.logitBias = fields.logitBias;

    const clientConfig = new Configuration({
      apiKey: fields.openAIApiKey ?? process.env.OPENAI_API_KEY,
    });
    this.client = new OpenAIApi(clientConfig);
  }

  invocationParams(): InvocationParams & Kwargs {
    return {
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      topP: this.topP,
      frequencyPenalty: this.frequencyPenalty,
      presencePenalty: this.presencePenalty,
      n: this.n,
      bestOf: this.bestOf,
      requestTimeout: this.requestTimeout,
      logitBias: this.logitBias,
      ...this.modelKwargs,
    };
  }

  identifyingParams() {
    return {
      modelName: this.modelName,
      ...this.invocationParams(),
    };
  }

  async _generate(prompts: string[], _?: string[]): Promise<LLMResult> {
    const params = this.invocationParams();

    params.maxTokens = this.maxTokens;

    const subPrompts = chunkArray(prompts, this.batchSize);
    const choices: CreateCompletionResponseChoicesInner[] = [];
    const tokenUsage: TokenUsage = {};

    for (let i = 0; i < subPrompts.length; i += 1) {
      const { data } = await this.completionWithRetry({
        ...this.invocationParams,
        prompt: subPrompts[i],
        model: this.modelName,
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
