import { OpenAI as OpenAIClient, type ClientOptions } from "openai";
import { Runnable, type RunnableConfig } from "@langchain/core/runnables";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { wrapOpenAIClientError } from "../utils/client.js";
import { toDecisionInput } from "./input.js";
import {
  parseAnswers,
  parseQuestions,
  responseSchema,
  toWireQuestion,
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
  /** Falls back to the `OPENAI_API_KEY` environment variable. */
  apiKey?: string;
  /** OpenAI SDK client options, such as `baseURL`, `timeout` or `fetch`. */
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

  constructor(fields: OpenAIDecisionsFields) {
    const { apiKey, ...kwargs } = fields;
    super(kwargs);
    if (!fields.model?.trim())
      throw new Error("An OpenAI Decisions model is required.");
    this.model = fields.model;
    this.client = new OpenAIClient({
      ...fields.configuration,
      apiKey: apiKey ?? getEnvironmentVariable("OPENAI_API_KEY"),
    });
  }

  async invoke<const Q extends Questions>(
    request: DecisionRequest<Q>,
    options?: Partial<RunnableConfig>
  ): Promise<DecisionResult<Q>> {
    return this._callWithConfig(
      (request: DecisionRequest<Q>, config?: Partial<RunnableConfig>) =>
        this.decide(request, config?.signal),
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

  protected async decide<Q extends Questions>(
    { input, questions }: DecisionRequest<Q>,
    signal?: AbortSignal
  ): Promise<DecisionResult<Q>> {
    parseQuestions(questions);
    const body = {
      model: this.model,
      input: toDecisionInput(input),
      questions: Object.entries(questions).map(([name, question]) =>
        toWireQuestion(name, question)
      ),
    };
    let data: unknown;
    let response: Response;
    try {
      ({ data, response } = await this.client
        .post<unknown>("/decisions", { body, signal })
        .withResponse());
    } catch (error) {
      throw wrapOpenAIClientError(error);
    }
    const parsed = responseSchema.safeParse(data);
    if (!parsed.success)
      throw new Error("Invalid response from the OpenAI Decisions API.", {
        cause: parsed.error,
      });
    return {
      answers: parseAnswers(questions, parsed.data.answers),
      model: parsed.data.model,
      requestId: response.headers.get("x-request-id") ?? undefined,
      usage_metadata: parsed.data.usage,
    };
  }
}
