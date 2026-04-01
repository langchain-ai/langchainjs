import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  LLM,
  type BaseLLMCallOptions,
  type BaseLLMParams,
} from "@langchain/core/language_models/llms";
import { GenerationChunk } from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { convertEventStreamToIterableReadableDataStream } from "./utils/event_source_parse.js";

interface TogetherAIInferenceResult {
  object: string;
  status: string;
  prompt: Array<string>;
  model: string;
  model_owner: string;
  tags: object;
  num_returns: number;
  args: {
    model: string;
    prompt: string;
    temperature: number;
    top_p: number;
    top_k: number;
    max_tokens: number;
    stop: string[];
  };
  subjobs: unknown[];
  output?: {
    choices: Array<{
      finish_reason: string;
      index: number;
      text: string;
    }>;
    raw_compute_time: number;
    result_type: string;
  };
  choices?: Array<{
    finish_reason: string;
    index: number;
    text: string;
  }>;
}

export interface TogetherAIInputs extends BaseLLMParams {
  /**
   * The API key to use for the Together AI API.
   * @default {process.env.TOGETHER_AI_API_KEY}
   */
  apiKey?: string;
  /**
   * The name of the model to query.
   * Alias for `model`.
   */
  modelName?: string;
  /**
   * The name of the model to query.
   */
  model?: string;
  /**
   * A decimal number that determines the degree of randomness in the response.
   * @default {0.7}
   */
  temperature?: number;
  /**
   * Whether or not to stream tokens as they are generated.
   * @default {false}
   */
  streaming?: boolean;
  /**
   * Nucleus sampling threshold.
   * @default {0.7}
   */
  topP?: number;
  /**
   * Limit the number of token candidates considered at each step.
   * @default {50}
   */
  topK?: number;
  /**
   * A number that controls repetition.
   * @default {1}
   */
  repetitionPenalty?: number;
  /**
   * An integer that specifies how many top token log probabilities are included.
   */
  logprobs?: number;
  /**
   * Run an LLM-based safeguard model on top of any model.
   */
  safetyModel?: string;
  /**
   * Limit the number of generated tokens.
   */
  maxTokens?: number;
  /**
   * A list of tokens at which the generation should stop.
   */
  stop?: string[];
}

export interface TogetherAICallOptions
  extends
    BaseLLMCallOptions,
    Pick<
      TogetherAIInputs,
      | "modelName"
      | "model"
      | "temperature"
      | "topP"
      | "topK"
      | "repetitionPenalty"
      | "logprobs"
      | "safetyModel"
      | "maxTokens"
      | "stop"
    > {}

export class TogetherAI extends LLM<TogetherAICallOptions> {
  lc_serializable = true;

  lc_namespace = ["langchain", "llms", "together_ai"];

  static inputs: TogetherAIInputs;

  temperature = 0.7;

  topP = 0.7;

  topK = 50;

  modelName: string;

  model: string;

  streaming = false;

  repetitionPenalty = 1;

  logprobs?: number;

  maxTokens?: number;

  safetyModel?: string;

  stop?: string[];

  private apiKey: string;

  private inferenceAPIUrl = "https://api.together.xyz/inference";

  static lc_name() {
    return "TogetherAI";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "TOGETHER_AI_API_KEY",
    };
  }

  get lc_aliases(): { [key: string]: string } | undefined {
    return {
      apiKey: "together_ai_api_key",
    };
  }

  private isChatModel(modelName: string): boolean {
    const chatModelPatterns = [/instruct/i, /chat/i, /vision/i, /turbo/i];
    return chatModelPatterns.some((pattern) => pattern.test(modelName));
  }

  constructor(inputs: TogetherAIInputs) {
    super(inputs);
    this._addVersion("@langchain/together-ai", __PKG_VERSION__);
    const apiKey =
      inputs.apiKey ?? getEnvironmentVariable("TOGETHER_AI_API_KEY");
    if (!apiKey) {
      throw new Error("TOGETHER_AI_API_KEY not found.");
    }
    if (!inputs.model && !inputs.modelName) {
      throw new Error("Model name is required for TogetherAI.");
    }
    this.apiKey = apiKey;
    this.temperature = inputs.temperature ?? this.temperature;
    this.topK = inputs.topK ?? this.topK;
    this.topP = inputs.topP ?? this.topP;
    this.modelName = inputs.model ?? inputs.modelName ?? "";
    this.model = this.modelName;
    this.streaming = inputs.streaming ?? this.streaming;
    this.repetitionPenalty =
      inputs.repetitionPenalty ?? this.repetitionPenalty;
    this.logprobs = inputs.logprobs;
    this.safetyModel = inputs.safetyModel;
    this.maxTokens = inputs.maxTokens;
    this.stop = inputs.stop;

    if (this.isChatModel(this.model)) {
      console.warn(
        `Warning: Model '${this.model}' appears to be a chat/instruct model. ` +
          "Consider using ChatTogetherAI from @langchain/together-ai instead."
      );
    }
  }

  _llmType() {
    return "together_ai";
  }

  private constructHeaders() {
    return {
      accept: "application/json",
      "content-type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  private constructBody(prompt: string, options?: this["ParsedCallOptions"]) {
    return {
      model: options?.model ?? options?.modelName ?? this.model,
      prompt,
      temperature: options?.temperature ?? this.temperature,
      top_k: options?.topK ?? this.topK,
      top_p: options?.topP ?? this.topP,
      repetition_penalty:
        options?.repetitionPenalty ?? this.repetitionPenalty,
      logprobs: options?.logprobs ?? this.logprobs,
      stream_tokens: this.streaming,
      safety_model: options?.safetyModel ?? this.safetyModel,
      max_tokens: options?.maxTokens ?? this.maxTokens,
      stop: options?.stop ?? this.stop,
    };
  }

  async completionWithRetry(prompt: string, options?: this["ParsedCallOptions"]) {
    return this.caller.call(async () => {
      const fetchResponse = await fetch(this.inferenceAPIUrl, {
        method: "POST",
        headers: {
          ...this.constructHeaders(),
        },
        body: JSON.stringify(this.constructBody(prompt, options)),
      });
      if (fetchResponse.status === 200) {
        return fetchResponse.json();
      }
      const errorResponse = await fetchResponse.json();
      throw new Error(
        `Error getting prompt completion from Together AI. ${JSON.stringify(
          errorResponse,
          null,
          2
        )}`
      );
    });
  }

  async _call(
    prompt: string,
    options?: this["ParsedCallOptions"]
  ): Promise<string> {
    const response: TogetherAIInferenceResult = await this.completionWithRetry(
      prompt,
      options
    );

    if (!response.output && !response.choices) {
      throw new Error(
        `Unexpected response format from Together AI. The model '${this.model}' may require the ChatTogetherAI class instead of TogetherAI class. ` +
          `Response: ${JSON.stringify(response, null, 2)}`
      );
    }

    if (response.output) {
      return response.output.choices?.[0]?.text ?? "";
    }
    return response.choices?.[0]?.text ?? "";
  }

  async *_streamResponseChunks(
    prompt: string,
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<GenerationChunk> {
    const fetchResponse = await fetch(this.inferenceAPIUrl, {
      method: "POST",
      headers: {
        ...this.constructHeaders(),
      },
      body: JSON.stringify(this.constructBody(prompt, options)),
    });

    if (fetchResponse.status !== 200 || !fetchResponse.body) {
      const errorResponse = await fetchResponse.json();
      throw new Error(
        `Error getting prompt completion from Together AI. ${JSON.stringify(
          errorResponse,
          null,
          2
        )}`
      );
    }
    const stream = convertEventStreamToIterableReadableDataStream(
      fetchResponse.body
    );
    for await (const chunk of stream) {
      if (chunk !== "[DONE]") {
        const parsedChunk = JSON.parse(chunk);
        const generationChunk = new GenerationChunk({
          text: parsedChunk.choices[0].text ?? "",
        });
        yield generationChunk;
        // eslint-disable-next-line no-void
        void runManager?.handleLLMNewToken(generationChunk.text ?? "");
      }
    }
  }
}
