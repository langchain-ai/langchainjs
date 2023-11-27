import type { OpenAI as OpenAIClient } from "openai";

import { TiktokenModel } from "js-tiktoken/lite";
import type { BaseLanguageModelCallOptions } from "@langchain/core/language_models/base";

// reexport this type from the included package so we can easily override and extend it if needed in the future
// also makes it easier for folks to import this type without digging around into the dependent packages
export type { TiktokenModel };

export declare interface OpenAIBaseInput {
  /** Sampling temperature to use */
  temperature: number;

  /**
   * Maximum number of tokens to generate in the completion. -1 returns as many
   * tokens as possible given the prompt and the model's maximum context size.
   */
  maxTokens?: number;

  /** Total probability mass of tokens to consider at each step */
  topP: number;

  /** Penalizes repeated tokens according to frequency */
  frequencyPenalty: number;

  /** Penalizes repeated tokens */
  presencePenalty: number;

  /** Number of completions to generate for each prompt */
  n: number;

  /** Dictionary used to adjust the probability of specific tokens being generated */
  logitBias?: Record<string, number>;

  /** Unique string identifier representing your end-user, which can help OpenAI to monitor and detect abuse. */
  user?: string;

  /** Whether to stream the results or not. Enabling disables tokenUsage reporting */
  streaming: boolean;

  /** Model name to use */
  modelName: string;

  /** Holds any additional parameters that are valid to pass to {@link
   * https://platform.openai.com/docs/api-reference/completions/create |
   * `openai.createCompletion`} that are not explicitly specified on this class.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modelKwargs?: Record<string, any>;

  /** List of stop words to use when generating */
  stop?: string[];

  /**
   * Timeout to use when making requests to OpenAI.
   */
  timeout?: number;

  /**
   * API key to use when making requests to OpenAI. Defaults to the value of
   * `OPENAI_API_KEY` environment variable.
   */
  openAIApiKey?: string;
}

// TODO use OpenAI.Core.RequestOptions when SDK is updated to make it available
export type OpenAICoreRequestOptions<
  Req extends object = Record<string, unknown>
> = {
  path?: string;
  query?: Req | undefined;
  body?: Req | undefined;
  headers?: Record<string, string | null | undefined> | undefined;

  maxRetries?: number;
  stream?: boolean | undefined;
  timeout?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  httpAgent?: any;
  signal?: AbortSignal | undefined | null;
  idempotencyKey?: string;
};

export interface OpenAICallOptions extends BaseLanguageModelCallOptions {
  /**
   * Additional options to pass to the underlying axios request.
   */
  options?: OpenAICoreRequestOptions;
}

/**
 * Input to OpenAI class.
 */
export declare interface OpenAIInput extends OpenAIBaseInput {
  /** Generates `bestOf` completions server side and returns the "best" */
  bestOf?: number;

  /** Batch size to use when passing multiple documents to generate */
  batchSize: number;
}

/**
 * @deprecated Use "baseURL", "defaultHeaders", and "defaultParams" instead.
 */
export interface LegacyOpenAIInput {
  /** @deprecated Use baseURL instead */
  basePath?: string;
  /** @deprecated Use defaultHeaders and defaultQuery instead */
  baseOptions?: {
    headers?: Record<string, string>;
    params?: Record<string, string>;
  };
}

export interface OpenAIChatInput extends OpenAIBaseInput {
  /** ChatGPT messages to pass as a prefix to the prompt */
  prefixMessages?: OpenAIClient.Chat.CreateChatCompletionRequestMessage[];
}

export declare interface AzureOpenAIInput {
  /**
   * API version to use when making requests to Azure OpenAI.
   */
  azureOpenAIApiVersion?: string;

  /**
   * API key to use when making requests to Azure OpenAI.
   */
  azureOpenAIApiKey?: string;

  /**
   * Azure OpenAI API instance name to use when making requests to Azure OpenAI.
   * this is the name of the instance you created in the Azure portal.
   * e.g. "my-openai-instance"
   * this will be used in the endpoint URL: https://my-openai-instance.openai.azure.com/openai/deployments/{DeploymentName}/
   */
  azureOpenAIApiInstanceName?: string;

  /**
   * Azure OpenAI API deployment name to use for completions when making requests to Azure OpenAI.
   * This is the name of the deployment you created in the Azure portal.
   * e.g. "my-openai-deployment"
   * this will be used in the endpoint URL: https://{InstanceName}.openai.azure.com/openai/deployments/my-openai-deployment/
   */
  azureOpenAIApiDeploymentName?: string;

  /**
   * Azure OpenAI API deployment name to use for embedding when making requests to Azure OpenAI.
   * This is the name of the deployment you created in the Azure portal.
   * This will fallback to azureOpenAIApiDeploymentName if not provided.
   * e.g. "my-openai-deployment"
   * this will be used in the endpoint URL: https://{InstanceName}.openai.azure.com/openai/deployments/my-openai-deployment/
   */
  azureOpenAIApiEmbeddingsDeploymentName?: string;

  /**
   * Azure OpenAI API deployment name to use for completions when making requests to Azure OpenAI.
   * Completions are only available for gpt-3.5-turbo and text-davinci-003 deployments.
   * This is the name of the deployment you created in the Azure portal.
   * This will fallback to azureOpenAIApiDeploymentName if not provided.
   * e.g. "my-openai-deployment"
   * this will be used in the endpoint URL: https://{InstanceName}.openai.azure.com/openai/deployments/my-openai-deployment/
   */
  azureOpenAIApiCompletionsDeploymentName?: string;

  /**
   * Custom endpoint for Azure OpenAI API. This is useful in case you have a deployment in another region.
   * e.g. setting this value to "https://westeurope.api.cognitive.microsoft.com/openai/deployments"
   * will be result in the endpoint URL: https://westeurope.api.cognitive.microsoft.com/openai/deployments/{DeploymentName}/
   */
  azureOpenAIBasePath?: string;
}
