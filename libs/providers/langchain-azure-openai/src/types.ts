import type {
  OpenAIClientOptions,
  AzureExtensionsOptions,
  ChatRequestMessage,
} from "@azure/openai";
import type { BaseLanguageModelCallOptions } from "@langchain/core/language_models/base";
import type { TiktokenModel } from "js-tiktoken/lite";
import type { EmbeddingsParams } from "@langchain/core/embeddings";
import type { KeyCredential, TokenCredential } from "@azure/core-auth";

// reexport this type from the included package so we can easily override and extend it if needed in the future
// also makes it easier for folks to import this type without digging around into the dependent packages
export type { TiktokenModel };

export declare interface AzureOpenAIInput {
  openAIApiKey?: string;

  /**
   * API key to use when making requests to Azure OpenAI.
   * Alias for `apiKey`
   */
  azureOpenAIApiKey?: string;
  /**
   * API key to use when making requests to Azure OpenAI.
   */
  apiKey?: string;

  /**
   * Endpoint to use when making requests to Azure OpenAI
   */
  azureOpenAIEndpoint?: string;

  /**
   * Azure OpenAI API deployment name to use for completions when making requests to Azure OpenAI.
   * This is the name of the deployment you created in the Azure portal.
   * e.g. "my-openai-deployment"
   * this will be used in the endpoint URL: https://{InstanceName}.openai.azure.com/openai/deployments/my-openai-deployment/
   */
  azureOpenAIApiDeploymentName?: string;

  /** @deprecated Use "azureOpenAIApiDeploymentName" instead. */
  azureOpenAIEmbeddingsApiDeploymentName?: string;

  /**
   * API version to use when making requests to Azure OpenAI.
   */
  azureOpenAIApiVersion?: string;

  credentials?: KeyCredential | TokenCredential;
}

export declare interface OpenAIBaseInput {
  /**
   * Maximum number of tokens to generate in the completion. -1 returns as many
   * tokens as possible given the prompt and the model's maximum context size.
   */
  maxTokens?: number;

  /**
   * The sampling temperature to use that controls the apparent creativity of generated completions.
   * Higher values will make output more random while lower values will make results more focused
   * and deterministic.
   * It is not recommended to modify temperature and top_p for the same completions request as the
   * interaction of these two settings is difficult to predict.
   */
  temperature: number;

  /**
   * An alternative to sampling with temperature called nucleus sampling. This value causes the
   * model to consider the results of tokens with the provided probability mass. As an example, a
   * value of 0.15 will cause only the tokens comprising the top 15% of probability mass to be
   * considered.
   * It is not recommended to modify temperature and top_p for the same completions request as the
   * interaction of these two settings is difficult to predict.
   */
  topP: number;

  /**
   * A map between GPT token IDs and bias scores that influences the probability of specific tokens
   * appearing in a completions response. Token IDs are computed via external tokenizer tools, while
   * bias scores reside in the range of -100 to 100 with minimum and maximum values corresponding to
   * a full ban or exclusive selection of a token, respectively. The exact behavior of a given bias
   * score varies by model.
   */
  logitBias?: Record<string, number>;

  /**
   * An identifier for the caller or end user of the operation. This may be used for tracking
   * or rate-limiting purposes.
   */
  user?: string;

  /**
   * The number of completions choices that should be generated per provided prompt as part of an
   * overall completions response.
   * Because this setting can generate many completions, it may quickly consume your token quota.
   * Use carefully and ensure reasonable settings for max_tokens and stop.
   */
  n: number;

  /**
   * A value that influences the probability of generated tokens appearing based on their existing
   * presence in generated text.
   * Positive values will make tokens less likely to appear when they already exist and increase the
   * model's likelihood to output new topics.
   */
  presencePenalty: number;

  /**
   * A value that influences the probability of generated tokens appearing based on their cumulative
   * frequency in generated text.
   * Positive values will make tokens less likely to appear as their frequency increases and
   * decrease the likelihood of the model repeating the same statements verbatim.
   */
  frequencyPenalty: number;

  /** A collection of textual sequences that will end completions generation. */
  stop?: string[];
  /** A collection of textual sequences that will end completions generation. */
  stopSequences?: string[];

  /** Whether to stream the results or not. Enabling disables tokenUsage reporting */
  streaming: boolean;

  /** Model name to use */
  model?: string;

  /** Holds any additional parameters that are valid to pass to {@link
   * https://platform.openai.com/docs/api-reference/completions/create |
   * `openai.createCompletion`} that are not explicitly specified on this class.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modelKwargs?: Record<string, any>;

  /**
   * Timeout to use when making requests to OpenAI.
   */
  timeout?: number;
}

export declare interface OpenAIInput extends OpenAIBaseInput {
  /**
   * A value that controls the emission of log probabilities for the provided number of most likely
   * tokens within a completions response.
   */
  logprobs?: number;

  /**
   * A value specifying whether completions responses should include input prompts as prefixes to
   * their generated output.
   */
  echo?: boolean;

  /**
   * A value that controls how many completions will be internally generated prior to response
   * formulation.
   * When used together with n, best_of controls the number of candidate completions and must be
   * greater than n.
   * Because this setting can generate many completions, it may quickly consume your token quota.
   * Use carefully and ensure reasonable settings for max_tokens and stop.
   */
  bestOf?: number;

  /** Batch size to use when passing multiple documents to generate */
  batchSize: number;
}

export interface OpenAICallOptions extends BaseLanguageModelCallOptions {
  /**
   * Additional options to pass to the underlying axios request.
   */
  options?: OpenAIClientOptions;
}

export interface OpenAIChatInput extends OpenAIBaseInput {
  /** ChatGPT messages to pass as a prefix to the prompt */
  prefixMessages?: ChatRequestMessage[];

  azureExtensionOptions?: AzureExtensionsOptions;
}

export interface OpenAIChatCallOptions extends OpenAICallOptions {
  promptIndex?: number;
}

export interface AzureOpenAIEmbeddingsParams extends EmbeddingsParams {
  /**
   * An identifier for the caller or end user of the operation. This may be used for tracking
   * or rate-limiting purposes.
   */
  user?: string;
  /**
   * The model name to provide as part of this embeddings request.
   * Not applicable to Azure OpenAI, where deployment information should be included in the Azure
   * resource URI that's connected to.
   * Alias for `model`
   */
  modelName?: string;
  /**
   * The model name to provide as part of this embeddings request.
   * Not applicable to Azure OpenAI, where deployment information should be included in the Azure
   * resource URI that's connected to.
   */
  model?: string;

  /**
   * The maximum number of documents to embed in a single request. This is
   * limited by the OpenAI API to a maximum of 2048.
   */
  batchSize?: number;

  /**
   * Whether to strip new lines from the input text. This is recommended by
   * OpenAI for older models, but may not be suitable for all use cases.
   * See: https://github.com/openai/openai-python/issues/418#issuecomment-1525939500
   */
  stripNewLines?: boolean;

  /**
   * Timeout to use when making requests to OpenAI.
   */
  timeout?: number;
}
