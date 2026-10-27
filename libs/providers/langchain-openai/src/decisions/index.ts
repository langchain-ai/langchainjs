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
  type DecisionInput,
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

export interface OpenAIDecisionsFields<Q extends Questions = Questions> {
  /** Decisions model name, such as `gpt-6-luna`. */
  model: string;
  /** Named questions to ask. Answers are returned under the same names. */
  questions?: Q;
  /** Falls back to the `OPENAI_API_KEY` environment variable. */
  apiKey?: string;
  /** OpenAI SDK client options, such as `baseURL`, `timeout` or `fetch`. */
  configuration?: Omit<ClientOptions, "apiKey">;
}

/**
 * Ask typed questions about text, messages or JSON state with the OpenAI Decisions
 * API (beta).
 *
 * @example
 * ```ts
 * const triage = new OpenAIDecisions({
 *   model: "gpt-6-luna",
 *   questions: {
 *     urgent: { type: "predicate", instructions: "Is this urgent?" },
 *     team: {
 *       type: "choice",
 *       instructions: "Which team should handle this?",
 *       choices: { billing: "Payments", technical: null },
 *     },
 *   },
 * });
 * const { answers } = await triage.invoke("I was charged twice!");
 * if (answers.team.type === "choice") answers.team.choice; // "billing" | "technical"
 * ```
 */
export class OpenAIDecisions<
  const Q extends Questions = Record<never, never>,
> extends Runnable<DecisionInput, DecisionResult<Q>> {
  static lc_name() {
    return "OpenAIDecisions";
  }

  lc_namespace = ["langchain", "openai", "decisions"];

  readonly model: string;

  readonly questions: Q;

  protected client: OpenAIClient;

  private fields: OpenAIDecisionsFields<Q>;

  constructor(fields: OpenAIDecisionsFields<Q>) {
    const { apiKey, ...kwargs } = fields;
    super(kwargs);
    if (!fields.model?.trim())
      throw new Error("An OpenAI Decisions model is required.");
    this.fields = fields;
    this.model = fields.model;
    this.questions = parseQuestions(fields.questions ?? ({} as Q));
    this.client = new OpenAIClient({
      ...fields.configuration,
      apiKey: apiKey ?? getEnvironmentVariable("OPENAI_API_KEY"),
    });
  }

  /** Returns a copy that asks different questions with the same model and client options. */
  withQuestions<const R extends Questions>(questions: R): OpenAIDecisions<R> {
    return new OpenAIDecisions({ ...this.fields, questions });
  }

  async invoke(
    input: DecisionInput,
    options?: Partial<RunnableConfig>
  ): Promise<DecisionResult<Q>> {
    return this._callWithConfig(
      (input: DecisionInput, config?: Partial<RunnableConfig>) =>
        this.decide(input, config?.signal),
      input,
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
    );
  }

  protected async decide(
    input: DecisionInput,
    signal?: AbortSignal
  ): Promise<DecisionResult<Q>> {
    const names = Object.keys(this.questions);
    if (!names.length)
      throw new Error(
        "OpenAIDecisions has no questions. Pass `questions` or call `withQuestions()`."
      );
    const body = {
      model: this.model,
      input: toDecisionInput(input),
      questions: names.map((name) =>
        toWireQuestion(name, this.questions[name])
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
      answers: parseAnswers(this.questions, parsed.data.answers),
      model: parsed.data.model,
      requestId: response.headers.get("x-request-id") ?? undefined,
      usage_metadata: parsed.data.usage,
    };
  }
}
