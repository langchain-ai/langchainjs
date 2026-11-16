/* oxlint-disable @typescript-eslint/no-namespace */

import type { Callbacks } from "@langchain/core/callbacks/manager";
import type { AsyncCallerParams } from "@langchain/core/utils/async_caller";
import type { Decisions as DecisionsNamespace } from "../api_types/interactions.js";
import type { Gemini } from "../chat_models/types.js";
import type { ApiClient, WebApiClientParams } from "../clients/index.js";
import type { GooglePlatformType } from "../utils/connection.js";

/**
 * Narrowed TypeScript representations of the sparktype-generated `Decisions`
 * wire schemas in `../api_types/interactions.js`.
 *
 * OpenAPI `"const"` discriminators (`"noul"`, `"choice"`, `"score"`) and
 * `additionalProperties` maps are emitted as `unknown` / `Record<string, unknown>`
 * by sparktype; narrowing them here enables compile-time checking without
 * modifying generated files.
 */
export namespace GoogleDecisions {
  export type Input =
    | Gemini.Interactions.Content
    | Array<Gemini.Interactions.Content>
    | string;

  export type Criteria = DecisionsNamespace.Criteria;

  export type ChoiceQuestion = Omit<
    DecisionsNamespace.ChoiceQuestion,
    "type" | "instructions" | "criteria"
  > & {
    type: "choice";
    instructions: Input;
    criteria: Record<string, string>;
  };

  export type NoulQuestion = Omit<
    DecisionsNamespace.NoulQuestion,
    "type" | "instructions"
  > & {
    type: "noul";
    instructions: Input;
  };

  export type ScoreQuestion = Omit<
    DecisionsNamespace.ScoreQuestion,
    "type" | "instructions"
  > & {
    type: "score";
    instructions: Input;
  };

  export type Question = ChoiceQuestion | NoulQuestion | ScoreQuestion;

  export type CreateDecisionRequest = Omit<
    DecisionsNamespace.CreateDecisionRequest,
    "input" | "questions"
  > & {
    input: Input;
    questions: Record<string, Question>;
  };

  export type ChoiceAnswer = Omit<
    DecisionsNamespace.ChoiceAnswer,
    "type" | "probabilities"
  > & {
    type: "choice";
    probabilities?: Record<string, number>;
  };

  export type NoulAnswer = Omit<DecisionsNamespace.NoulAnswer, "type"> & {
    type: "noul";
  };

  export type ScoreAnswer = Omit<
    DecisionsNamespace.ScoreAnswer,
    "type" | "legend" | "probabilities"
  > & {
    type: "score";
    legend?: Record<string, string>;
    probabilities?: Record<string, number>;
  };

  export type Answer = ChoiceAnswer | NoulAnswer | ScoreAnswer;

  export type PromptFeedback = DecisionsNamespace.PromptFeedback;

  export type CreateDecisionResponse = Omit<
    DecisionsNamespace.CreateDecisionResponse,
    "answers"
  > & {
    readonly answers?: Record<string, Answer>;
  };
}

/**
 * Request-level configuration fields supported by `GoogleClassifier`.
 */
export interface GoogleClassifierFields {
  /**
   * Custom HTTP headers included with every request to the Gemini Decisions API.
   */
  customHeaders?: Record<string, string>;

  /**
   * Default media resolution applied to input image and video content blocks
   * that do not specify their own resolution (`"low"`, `"medium"`, `"high"`, or
   * `"ultra_high"` for images).
   */
  mediaResolution?:
    | Gemini.Shared.MediaResolution
    | Gemini.Interactions.MediaResolution;

  /**
   * OpenAI-compatible alias for input media detail (`"auto"`, `"low"`, `"high"`).
   * If both `mediaResolution` and `detail` are provided, `mediaResolution` wins.
   */
  detail?: "auto" | "low" | "high";
}

/**
 * Shared configuration parameters for `BaseGoogleClassifier`.
 */
export interface BaseGoogleClassifierParams
  extends AsyncCallerParams, GoogleClassifierFields {
  /**
   * Gemini Decisions model identifier. Defaults to `"gemini-decision-1"`.
   */
  model?: string;

  /**
   * Optional callbacks attached to every invocation of this classifier.
   */
  callbacks?: Callbacks;

  /**
   * Optional tags attached to every invocation of this classifier.
   */
  tags?: string[];

  /**
   * Optional metadata attached to every invocation of this classifier.
   */
  metadata?: Record<string, unknown>;

  /**
   * Custom `ApiClient` instance used to authenticate and send HTTP requests.
   */
  apiClient?: ApiClient;

  /**
   * Custom API host or base URL override (e.g. `"generativelanguage.googleapis.com"`
   * or `"http://localhost:8080"`).
   */
  endpoint?: string;

  /**
   * Google Cloud region when targeting Vertex AI. Defaults to `"global"`.
   */
  location?: string;

  /**
   * API version path segment. Defaults to `"v1beta"` for the Gemini Developer API
   * and `"v1"` for Vertex AI.
   */
  apiVersion?: string;

  /**
   * Explicit Google platform selection (`"gai"` for Gemini Developer API,
   * `"gcp"` for Vertex AI).
   */
  platformType?: GooglePlatformType;

  /**
   * Shorthand to route requests to Vertex AI (`platformType: "gcp"`).
   */
  vertexai?: boolean;
}

/**
 * Configuration parameters for the web-compatible `GoogleClassifier`.
 */
export interface GoogleClassifierParams
  extends BaseGoogleClassifierParams, WebApiClientParams {
  /** @deprecated Import from `@langchain/google/node` to configure Google Auth options. */
  authOptions?: never;
}
