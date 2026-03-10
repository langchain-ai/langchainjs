import { OpenAIClient, type ClientOptions } from "@langchain/openai";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { GenerationChunk, type LLMResult } from "@langchain/core/outputs";
import {
  BaseLLM,
  type BaseLLMParams,
} from "@langchain/core/language_models/llms";

/**
 * Input parameters for the Infomaniak LLM.
 */
export interface InfomaniakLLMInput extends BaseLLMParams {
  /**
   * The Infomaniak API key (Bearer token).
   * @default process.env.INFOMANIAK_API_KEY
   */
  apiKey?: string;

  /**
   * The Infomaniak AI product ID.
   * @default process.env.INFOMANIAK_PRODUCT_ID
   */
  productId?: string;

  /**
   * The name of the model to use.
   * @default "qwen3"
   */
  model?: string;

  /**
   * The temperature to use for sampling (0-2).
   */
  temperature?: number;

  /**
   * The maximum number of tokens to generate.
   */
  maxTokens?: number;

  /**
   * Nucleus sampling parameter.
   */
  topP?: number;

  /**
   * Penalizes repeated tokens by frequency.
   */
  frequencyPenalty?: number;

  /**
   * Penalizes repeated tokens by presence.
   */
  presencePenalty?: number;

  /**
   * Up to 4 sequences where the API will stop generating further tokens.
   */
  stop?: string[];

  /**
   * Whether or not to stream responses.
   */
  streaming?: boolean;

  /**
   * Additional OpenAI client configuration.
   */
  configuration?: ClientOptions;
}

/**
 * Infomaniak LLM (text completion) integration.
 *
 * This uses the Infomaniak OpenAI-compatible chat completions endpoint
 * under the hood, wrapping prompts as user messages and returning the
 * assistant response as plain text.
 *
 * Setup:
 * ```bash
 * npm install @langchain/infomaniak
 * export INFOMANIAK_API_KEY="your-api-token"
 * export INFOMANIAK_PRODUCT_ID="your-product-id"
 * ```
 *
 * @example
 * ```typescript
 * import { InfomaniakLLM } from "@langchain/infomaniak";
 *
 * const llm = new InfomaniakLLM({
 *   model: "qwen3",
 *   temperature: 0.7,
 * });
 *
 * const result = await llm.invoke("Tell me a joke");
 * console.log(result);
 * ```
 */
export class InfomaniakLLM extends BaseLLM {
  static lc_name() {
    return "InfomaniakLLM";
  }

  _llmType() {
    return "infomaniak";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "INFOMANIAK_API_KEY",
    };
  }

  lc_serializable = true;

  lc_namespace = ["langchain", "llms", "infomaniak"];

  model = "qwen3";

  temperature?: number;

  maxTokens?: number;

  topP?: number;

  frequencyPenalty?: number;

  presencePenalty?: number;

  stop?: string[];

  streaming = false;

  protected client: InstanceType<typeof OpenAIClient>;

  protected clientConfig: ClientOptions;

  constructor(fields?: InfomaniakLLMInput) {
    super(fields ?? {});
    this._addVersion("@langchain/infomaniak", __PKG_VERSION__);

    const apiKey =
      fields?.apiKey ?? getEnvironmentVariable("INFOMANIAK_API_KEY");
    if (!apiKey) {
      throw new Error(
        `Infomaniak API key not found. Please set the INFOMANIAK_API_KEY environment variable or pass the key into the "apiKey" field.`
      );
    }

    const productId =
      fields?.productId ?? getEnvironmentVariable("INFOMANIAK_PRODUCT_ID");
    if (!productId) {
      throw new Error(
        `Infomaniak product ID not found. Please set the INFOMANIAK_PRODUCT_ID environment variable or pass the ID into the "productId" field.`
      );
    }

    const baseURL = `https://api.infomaniak.com/2/ai/${productId}/openai/v1`;

    this.model = fields?.model ?? this.model;
    this.temperature = fields?.temperature;
    this.maxTokens = fields?.maxTokens;
    this.topP = fields?.topP;
    this.frequencyPenalty = fields?.frequencyPenalty;
    this.presencePenalty = fields?.presencePenalty;
    this.stop = fields?.stop;
    this.streaming = fields?.streaming ?? false;

    this.clientConfig = {
      apiKey,
      baseURL,
      dangerouslyAllowBrowser: true,
      ...fields?.configuration,
    };

    this.client = new OpenAIClient({
      ...this.clientConfig,
      maxRetries: 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
  }

  /**
   * Generate text completions for an array of prompts.
   *
   * Uses the chat completions API with each prompt wrapped as a user message.
   */
  async _generate(
    prompts: string[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<LLMResult> {
    const generations = [];

    for (const prompt of prompts) {
      if (this.streaming) {
        let text = "";
        const stream = await this.client.chat.completions.create(
          {
            model: this.model,
            messages: [{ role: "user", content: prompt }],
            temperature: this.temperature,
            max_tokens: this.maxTokens ?? undefined,
            top_p: this.topP,
            frequency_penalty: this.frequencyPenalty,
            presence_penalty: this.presencePenalty,
            stop: options.stop ?? this.stop,
            stream: true,
          },
          { signal: options.signal }
        );

        for await (const chunk of stream) {
          if (options.signal?.aborted) {
            throw new Error("AbortError");
          }
          const delta = chunk.choices[0]?.delta?.content ?? "";
          text += delta;
          await runManager?.handleLLMNewToken(delta);
        }

        generations.push([{ text, generationInfo: {} }]);
      } else {
        const response = await this.caller.call(async () =>
          this.client.chat.completions.create(
            {
              model: this.model,
              messages: [{ role: "user", content: prompt }],
              temperature: this.temperature,
              max_tokens: this.maxTokens ?? undefined,
              top_p: this.topP,
              frequency_penalty: this.frequencyPenalty,
              presence_penalty: this.presencePenalty,
              stop: options.stop ?? this.stop,
              stream: false,
            },
            { signal: options.signal }
          )
        );

        const text = response.choices[0]?.message?.content ?? "";
        generations.push([
          {
            text,
            generationInfo: {
              finishReason: response.choices[0]?.finish_reason,
              usage: response.usage,
            },
          },
        ]);
      }
    }

    return { generations };
  }

  async *_streamResponseChunks(
    prompt: string,
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<GenerationChunk> {
    const stream = await this.client.chat.completions.create(
      {
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        temperature: this.temperature,
        max_tokens: this.maxTokens ?? undefined,
        top_p: this.topP,
        frequency_penalty: this.frequencyPenalty,
        presence_penalty: this.presencePenalty,
        stop: options.stop ?? this.stop,
        stream: true,
      },
      { signal: options.signal }
    );

    for await (const chunk of stream) {
      if (options.signal?.aborted) {
        return;
      }
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) {
        const generationChunk = new GenerationChunk({ text: delta });
        yield generationChunk;
        await runManager?.handleLLMNewToken(delta);
      }
    }
  }
}
