import { OpenAI as OpenAIClient, type ClientOptions } from "openai";
import { Runnable, type RunnableConfig } from "@langchain/core/runnables";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { resolveLangSmithGatewayConfig } from "@langchain/core/utils/gateway";
import { wrapOpenAIClientError } from "../utils/client.js";
import { toDecisionInput } from "./input.js";
import { convertResponsesUsageToUsageMetadata } from "../converters/responses.js";
import {
  toQuestionParam,
  type Answers,
  type DecisionRequest,
  type DecisionResult,
  type Questions,
} from "./types.js";

export type {
  Answer,
  AnswerFor,
  Answers,
  Choice,
  ChoiceAnswer,
  DecisionInput,
  DecisionRequest,
  DecisionResult,
  Level,
  Predicate,
  PredicateAnswer,
  Question,
  Questions,
  RefusalAnswer,
  Score,
  ScoreAnswer,
} from "./types.js";

export interface OpenAIDecisionsFields {
  /** Decisions model name, such as `gpt-6-luna`. */
  model: string;
  /**
   * Falls back to the LangSmith gateway key when routing through the gateway, then
   * to the `OPENAI_API_KEY` environment variable.
   */
  apiKey?: string;
  /**
   * OpenAI SDK client options, such as `baseURL`, `timeout` or `fetch`. Without a
   * `baseURL`, `OPENAI_API_BASE` or `OPENAI_BASE_URL`, setting `LANGSMITH_GATEWAY`
   * routes requests through the LangSmith gateway, as with `ChatOpenAI`.
   */
  configuration?: Omit<ClientOptions, "apiKey">;
}

/**
 * Ask typed questions about text, messages or JSON state with the OpenAI Decisions
 * API (beta). Answer types are inferred from the questions passed to `invoke`.
 *
 * @example
 * ```ts
 * const decisions = new OpenAIDecisions({ model: "gpt-6-luna" });
 * const { answers } = await decisions.invoke({
 *   input: "I was charged twice!",
 *   questions: {
 *     urgent: { type: "predicate", instructions: "Is this urgent?" },
 *     team: {
 *       type: "choice",
 *       instructions: "Which team should handle this?",
 *       choices: { billing: "Payments", technical: null },
 *     },
 *   },
 * });
 * if (answers.team.type === "choice") answers.team.choice; // "billing" | "technical"
 * ```
 */
export class OpenAIDecisions extends Runnable<DecisionRequest, DecisionResult> {
  static lc_name() {
    return "OpenAIDecisions";
  }

  lc_namespace = ["langchain", "openai", "decisions"];

  readonly model: string;

  protected client: OpenAIClient;

  constructor(model: string, fields?: Omit<OpenAIDecisionsFields, "model">);
  constructor(fields: OpenAIDecisionsFields);
  constructor(
    modelOrFields: string | OpenAIDecisionsFields,
    fieldsArg?: Omit<OpenAIDecisionsFields, "model">
  ) {
    const fields =
      typeof modelOrFields === "string"
        ? { ...fieldsArg, model: modelOrFields }
        : modelOrFields;
    const { apiKey, ...kwargs } = fields;
    super(kwargs);
    if (!fields.model?.trim())
      throw new Error("An OpenAI Decisions model is required.");
    this.model = fields.model;
    const gateway = resolveLangSmithGatewayConfig({
      baseURL:
        fields.configuration?.baseURL ??
        (getEnvironmentVariable("OPENAI_API_BASE") ||
          getEnvironmentVariable("OPENAI_BASE_URL") ||
          undefined),
      providerPath: "openai/v1",
    });
    this.client = new OpenAIClient({
      ...fields.configuration,
      baseURL: gateway.baseURL,
      apiKey:
        apiKey ?? gateway.apiKey ?? getEnvironmentVariable("OPENAI_API_KEY"),
    });
  }

  async invoke<const Q extends Questions>(
    request: DecisionRequest<Q>,
    options?: Partial<RunnableConfig>
  ): Promise<DecisionResult<Q>> {
    return this._callWithConfig(
      async (
        { input, questions }: DecisionRequest<Q>,
        config?: Partial<RunnableConfig>
      ): Promise<DecisionResult<Q>> => {
        const names = Object.keys(questions);
        if (!names.length)
          throw new Error("OpenAI Decisions requires at least one question.");
        let decision: OpenAIClient.Decision;
        let response: Response;
        try {
          ({ data: decision, response } = await this.client.decisions
            .create(
              {
                model: this.model,
                input: toDecisionInput(input),
                questions: names.map((name) =>
                  toQuestionParam(name, questions[name])
                ),
              },
              { signal: config?.signal }
            )
            .withResponse());
        } catch (error) {
          throw wrapOpenAIClientError(error);
        }
        const answers = new Map(
          decision.answers.map(({ name, ...answer }) => [name, answer])
        );
        for (const name of names)
          if (!answers.has(name))
            throw new Error(
              `OpenAI Decisions returned no answer for question "${name}".`
            );
        return {
          answers: Object.fromEntries(answers) as Answers<Q>,
          model: decision.model,
          requestId: response.headers.get("x-request-id") ?? undefined,
          usage_metadata: convertResponsesUsageToUsageMetadata(decision.usage),
        };
      },
      request,
      {
        ...options,
        runType: "llm",
        metadata: {
          ...options?.metadata,
          ls_provider: "openai",
          ls_model_name: this.model,
          ls_model_type: "chat",
        },
      }
    ) as Promise<DecisionResult<Q>>;
  }
}
