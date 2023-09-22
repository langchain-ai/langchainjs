import { BaseLLMParams } from "../llms/base.js";

export interface GoogleVertexAIConnectionParams<AuthOptions> {
  /** Hostname for the API call */
  endpoint?: string;

  authOptions?: AuthOptions;

  /** Region where the LLM is stored */
  location?: string;

  /** The version of the API functions. Part of the path. */
  apiVersion?: string;
}

export interface GoogleVertexAIModelParams {
  /** Model to use */
  model?: string;

  /** Sampling temperature to use */
  temperature?: number;

  /**
   * Maximum number of tokens to generate in the completion.
   */
  maxOutputTokens?: number;

  /**
   * Top-p changes how the model selects tokens for output.
   *
   * Tokens are selected from most probable to least until the sum
   * of their probabilities equals the top-p value.
   *
   * For example, if tokens A, B, and C have a probability of
   * .3, .2, and .1 and the top-p value is .5, then the model will
   * select either A or B as the next token (using temperature).
   */
  topP?: number;

  /**
   * Top-k changes how the model selects tokens for output.
   *
   * A top-k of 1 means the selected token is the most probable among
   * all tokens in the model’s vocabulary (also called greedy decoding),
   * while a top-k of 3 means that the next token is selected from
   * among the 3 most probable tokens (using temperature).
   */
  topK?: number;
}

export interface GoogleVertexAIBaseLLMInput<AuthOptions>
  extends BaseLLMParams,
    GoogleVertexAIConnectionParams<AuthOptions>,
    GoogleVertexAIModelParams {}

export interface GoogleVertexAIResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

export interface GoogleVertexAIBasePrediction extends GoogleVertexAIResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  safetyAttributes?: any;
}

export interface GoogleVertexAILLMResponse<
  PredictionType extends GoogleVertexAIBasePrediction
> {
  data: {
    predictions: PredictionType[];
  };
}

export interface GoogleVertexAIAbstractedClient {
  request: (opts: {
    url?: string;
    method?: "GET" | "POST";
    data?: unknown;
  }) => unknown;
  getProjectId: () => Promise<string>;
}
