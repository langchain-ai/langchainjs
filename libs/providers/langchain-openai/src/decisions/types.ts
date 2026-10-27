import type { OpenAI as OpenAIClient } from "openai";
import type { BaseMessage, UsageMetadata } from "@langchain/core/messages";

type WireQuestion =
  OpenAIClient.DecisionCreateParams["questions"] extends (infer Q)[]
    ? Q
    : never;

/** Estimate the probability that a condition is true. */
export interface Predicate {
  type: "predicate";
  instructions: string;
}

/** Select one option. Keys are the option values; values describe when each applies. */
export interface Choice<K extends string = string> {
  type: "choice";
  instructions: string;
  choices: Record<K, string | null>;
}

/** One level of a `Score` rubric. */
export type Level = OpenAIClient.DecisionCreateParams.QuestionParamScore.Level;

/** Rate the input against two or more levels, ordered lowest to highest. */
export interface Score {
  type: "score";
  instructions: string;
  levels: readonly (string | Level)[];
}

export type Question = Predicate | Choice | Score;

export type Questions = Record<string, Question>;

export type PredicateAnswer = Omit<
  OpenAIClient.Decision.AnswerResourcePredicate,
  "name"
>;

export type ChoiceAnswer<K extends string = string> = Omit<
  OpenAIClient.Decision.AnswerResourceChoice,
  "name" | "choice" | "probabilities"
> & {
  choice: K;
  probabilities: { value: K; probability: number }[];
};

/** `score` is the probability-weighted average of the zero-based level indices. */
export type ScoreAnswer = Omit<
  OpenAIClient.Decision.AnswerResourceScore,
  "name"
>;

export type RefusalAnswer = Omit<
  OpenAIClient.Decision.AnswerResourceRefusal,
  "name"
>;

export type Answer =
  | PredicateAnswer
  | ChoiceAnswer
  | ScoreAnswer
  | RefusalAnswer;

/** The answer type a question produces. */
export type AnswerFor<T extends Question> = T extends Predicate
  ? PredicateAnswer
  : T extends Choice
    ? ChoiceAnswer<Extract<keyof T["choices"], string>>
    : T extends Score
      ? ScoreAnswer
      : never;

/** Answers keyed by question name, typed from the questions that were asked. */
export type Answers<Q extends Questions> = {
  -readonly [K in keyof Q]: AnswerFor<Q[K]> | RefusalAnswer;
};

/**
 * Text, LangChain messages, or JSON state to evaluate. Messages are sent as a native
 * conversation; JSON objects, which may contain messages, as an `input_json` part.
 */
export type DecisionInput =
  | string
  | BaseMessage
  | BaseMessage[]
  | Record<string, unknown>
  | Record<string, unknown>[];

/** One Decisions request: what to evaluate and the named questions to ask. */
export interface DecisionRequest<Q extends Questions = Questions> {
  input: DecisionInput;
  questions: Q;
}

export interface DecisionResult<Q extends Questions = Questions> {
  answers: Answers<Q>;
  /** The model that answered, as reported by the API. */
  model: string;
  requestId?: string;
  /** Read by LangSmith to record token usage on the traced run. */
  usage_metadata: UsageMetadata;
}

/** Converts a named question to the shape the Decisions API expects. */
export function toWireQuestion(name: string, question: Question): WireQuestion {
  const { type, instructions } = question;
  if (type === "predicate") return { type, name, instructions };
  if (type === "choice") {
    return {
      type,
      name,
      instructions,
      choices: Object.entries(question.choices).map(([value, description]) =>
        description == null ? { value } : { value, description }
      ),
    };
  }
  return {
    type,
    name,
    instructions,
    levels: question.levels.map((level) =>
      typeof level === "string" ? { label: level } : level
    ),
  };
}
