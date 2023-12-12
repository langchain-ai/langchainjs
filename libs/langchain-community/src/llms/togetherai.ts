import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  LLM,
  type BaseLLMCallOptions,
  type BaseLLMParams,
} from "@langchain/core/language_models/llms";
import { GenerationChunk } from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { convertEventStreamToIterableReadableDataStream } from "../utils/event_source_parse.js";

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
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subjobs: Array<any>;
  output: {
    choices: Array<{
      finish_reason: string;
      index: number;
      text: string;
    }>;
    raw_compute_time: number;
    result_type: string;
  };
}

/**
 * Note that the modelPath is the only required parameter. For testing you
 * can set this in the environment variable `LLAMA_PATH`.
 */
export interface TogetherAIInputs extends BaseLLMParams {
  /**
   * The API key to use for the TogetherAI API.
   * @default {process.env.TOGETHER_AI_API_KEY}
   */
  apiKey?: string;
  /**
   * The name of the model to query.
   */
  modelName: string;
  /**
   * A decimal number that determines the degree of randomness in the response.
   * A value of 1 will always yield the same output.
   * A temperature less than 1 favors more correctness and is appropriate for question answering or summarization.
   * A value greater than 1 introduces more randomness in the output.
   * @default {0.7}
   */
  temperature?: number;
  /**
   * Whether or not to stream tokens as they are generated.
   * @default {false}
   */
  streaming?: boolean;
  /**
   * The `topP` (nucleus) parameter is used to dynamically adjust the number of choices for each predicted token based on the cumulative probabilities.
   * It specifies a probability threshold, below which all less likely tokens are filtered out.
   * This technique helps to maintain diversity and generate more fluent and natural-sounding text.
   * @default {0.7}
   */
  topP?: number;
  /**
   * The `topK` parameter is used to limit the number of choices for the next predicted word or token.
   * It specifies the maximum number of tokens to consider at each step, based on their probability of occurrence.
   * This technique helps to speed up the generation process and can improve the quality of the generated text by focusing on the most likely options.
   * @default {50}
   */
  topK?: number;
  /**
   * A number that controls the diversity of generated text by reducing the likelihood of repeated sequences.
   * Higher values decrease repetition.
   * @default {1}
   */
  repetitionPenalty?: number;
  /**
   * An integer that specifies how many top token log probabilities are included in the response for each token generation step.
   */
  logprobs?: number;
  /**
   * Run an LLM-based input-output safeguard model on top of any model.
   */
  safetyModel?: string;
}

export interface TogetherAICallOptions
  extends BaseLLMCallOptions,
    Pick<
      TogetherAIInputs,
      | "modelName"
      | "temperature"
      | "topP"
      | "topK"
      | "repetitionPenalty"
      | "logprobs"
      | "safetyModel"
    > {}

export class TogetherAI extends LLM<TogetherAICallOptions> {
  lc_serializable = true;

  declare CallOptions: TogetherAICallOptions;

  static inputs: TogetherAIInputs;

  temperature = 0.7;

  topP = 0.7;

  topK = 50;

  modelName: string;

  streaming = false;

  repetitionPenalty = 1;

  logprobs?: number;

  safetyModel?: string;

  private apiKey: string;

  private inferenceUrl = "https://api.together.xyz/inference";

  static lc_name() {
    return "TogetherAI";
  }

  constructor(inputs: TogetherAIInputs) {
    super(inputs);
    const apiKey =
      inputs.apiKey ?? getEnvironmentVariable("TOGETHER_AI_API_KEY");
    if (!apiKey) {
      throw new Error("TOGETHER_AI_API_KEY not found.");
    }
    this.apiKey = apiKey;
    this.temperature = inputs?.temperature ?? this.temperature;
    this.topK = inputs?.topK ?? this.topK;
    this.topP = inputs?.topP ?? this.topP;
    this.modelName = inputs.modelName;
    this.streaming = inputs.streaming ?? this.streaming;
    this.repetitionPenalty = inputs.repetitionPenalty ?? this.repetitionPenalty;
    this.logprobs = inputs.logprobs;
    this.safetyModel = inputs.safetyModel;
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
    const body = {
      model: options?.modelName ?? this?.modelName,
      prompt,
      temperature: this?.temperature ?? options?.temperature,
      top_k: this?.topK ?? options?.topK,
      top_p: this?.topP ?? options?.topP,
      repetition_penalty: this?.repetitionPenalty ?? options?.repetitionPenalty,
      logprobs: this?.logprobs ?? options?.logprobs,
      stream_tokens: this?.streaming,
      safety_model: this?.safetyModel ?? options?.safetyModel,
    };
    return body;
  }

  async completionWithRetry(
    prompt: string,
    options?: this["ParsedCallOptions"]
  ) {
    return this.caller.call(async () => {
      const fetchResponse = await fetch(this.inferenceUrl, {
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

  /** @ignore */
  async _call(
    prompt: string,
    options?: this["ParsedCallOptions"]
  ): Promise<string> {
    const response: TogetherAIInferenceResult = await this.completionWithRetry(
      prompt,
      options
    );
    const outputText = response.output.choices[0].text;
    return outputText ?? "";
  }

  async *_streamResponseChunks(
    prompt: string,
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<GenerationChunk> {
    const fetchResponse = await fetch(this.inferenceUrl, {
      method: "POST",
      headers: {
        ...this.constructHeaders(),
      },
      body: JSON.stringify(this.constructBody(prompt, options)),
    });

    if (fetchResponse.status !== 200 ?? !fetchResponse.body) {
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
