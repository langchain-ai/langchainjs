import { AxiosRequestConfig } from "axios";
import { ChatCompletionRequestMessage } from "openai";

import { BaseLanguageModelCallOptions } from "../base_language/index.js";

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
}

export interface OpenAICallOptions extends BaseLanguageModelCallOptions {
  /**
   * Abort signal to use for cancelling in-flight requests.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
   */
  signal?: AbortSignal;

  /**
   * Additional options to pass to the underlying axios request.
   */
  options?: AxiosRequestConfig;
}

/**
 * Input to OpenAI class.
 */
export declare interface OpenAIInput extends OpenAIBaseInput {
  /** Generates `bestOf` completions server side and returns the "best" */
  bestOf: number;

  /** Batch size to use when passing multiple documents to generate */
  batchSize: number;
}

export interface OpenAIChatInput extends OpenAIBaseInput {
  /** ChatGPT messages to pass as a prefix to the prompt */
  prefixMessages?: ChatCompletionRequestMessage[];
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
}
