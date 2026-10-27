import * as z from "zod/v4";
import type { BaseMessage, UsageMetadata } from "@langchain/core/messages";

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
export interface Level {
  label: string;
  description?: string;
}

/** Rate the input against two or more levels, ordered lowest to highest. */
export interface Score {
  type: "score";
  instructions: string;
  levels: readonly (string | Level)[];
}

export type Question = Predicate | Choice | Score;

export type Questions = Record<string, Question>;

export interface PredicateAnswer {
  type: "predicate";
  probability: number;
}

export interface ChoiceAnswer<K extends string = string> {
  type: "choice";
  choice: K;
  confidence: number;
  probabilities: Record<K, number>;
}

export interface ScoreAnswer {
  type: "score";
  /** Probability-weighted average of the zero-based level indices. */
  score: number;
  confidence: number;
  /** Levels in rubric order, so `levels[i]` is level `i`. */
  levels: { label: string; probability: number }[];
}

export interface RefusalAnswer {
  type: "refusal";
  reason?: string;
}

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
  usage_metadata: UsageMetadata;
}

type DecisionValue =
  | string
  | number
  | boolean
  | null
  | Date
  | BaseMessage
  | DecisionValue[]
  | { [key: string]: DecisionValue | undefined };

/** Text, LangChain messages, or JSON state to evaluate. */
export type DecisionInput =
  | string
  | BaseMessage
  | DecisionValue[]
  | { [key: string]: DecisionValue | undefined };

const instructionsSchema = z
  .string()
  .trim()
  .min(1, "Question instructions must not be empty.");

const questionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("predicate"), instructions: instructionsSchema }),
  z.object({
    type: z.literal("choice"),
    instructions: instructionsSchema,
    choices: z
      .record(z.string(), z.string().nullable())
      .refine((choices) => Object.keys(choices).length > 0, {
        message: "Choice requires at least one option.",
      }),
  }),
  z.object({
    type: z.literal("score"),
    instructions: instructionsSchema,
    levels: z
      .array(
        z.union([
          z.string().min(1, "Score labels must not be empty."),
          z.object({
            label: z.string().min(1, "Score labels must not be empty."),
            description: z.string().optional(),
          }),
        ])
      )
      .min(2, "Score requires at least two levels."),
  }),
]);

/** Validates questions, naming the offending question in the error. */
export function parseQuestions<Q extends Questions>(questions: Q): Q {
  if (!Object.keys(questions ?? {}).length)
    throw new Error("OpenAI Decisions requires at least one question.");
  for (const [name, question] of Object.entries(questions)) {
    const result = questionSchema.safeParse(question);
    if (!result.success) {
      const issue = result.error.issues[0];
      const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
      throw new Error(
        `Invalid OpenAI Decisions question "${name}": ${path}${issue.message}`
      );
    }
  }
  return questions;
}

/** Converts a question to the shape the Decisions API expects. */
export function toWireQuestion(name: string, question: Question) {
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

const probability = z.number().min(0).max(1);

const answerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("predicate"), probability }),
  z
    .object({
      type: z.literal("choice"),
      choice: z.union([z.string(), z.boolean()]),
      confidence: probability,
      probabilities: z.array(
        z.object({ value: z.union([z.string(), z.boolean()]), probability })
      ),
    })
    .transform(({ choice, probabilities, ...answer }): ChoiceAnswer => ({
      ...answer,
      choice: String(choice),
      probabilities: Object.fromEntries(
        probabilities.map((item) => [String(item.value), item.probability])
      ),
    })),
  z
    .object({
      type: z.literal("score"),
      score: z.number(),
      confidence: probability,
      probabilities: z
        .array(
          z.object({
            value: z.number().int().nonnegative(),
            label: z.string(),
            probability,
          })
        )
        .transform((levels) => [...levels].sort((a, b) => a.value - b.value))
        .refine((levels) => levels.every((level, i) => level.value === i), {
          message: "Score levels must be indexed from 0 without gaps.",
        }),
    })
    .transform(({ probabilities, ...answer }): ScoreAnswer => ({
      ...answer,
      levels: probabilities.map(({ label, probability }) => ({
        label,
        probability,
      })),
    })),
  z.object({ type: z.literal("refusal"), reason: z.string().optional() }),
]);

const tokens = z.number().int().nonnegative().nullish();

export const responseSchema = z.object({
  model: z.string(),
  answers: z.array(z.looseObject({ name: z.string(), type: z.string() })),
  usage: z
    .object({ input_tokens: tokens, output_tokens: tokens })
    .nullish()
    .transform((usage): UsageMetadata => ({
      input_tokens: usage?.input_tokens ?? 0,
      output_tokens: usage?.output_tokens ?? 0,
      total_tokens: (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0),
    })),
});

/** Matches each asked question to its answer, failing if one is missing or mistyped. */
export function parseAnswers<Q extends Questions>(
  questions: Q,
  answers: z.infer<typeof responseSchema>["answers"]
): Answers<Q> {
  const byName = new Map(answers.map((answer) => [answer.name, answer]));
  const entries = Object.entries(questions).map(([name, question]) => {
    const result = answerSchema.safeParse(byName.get(name));
    if (
      !result.success ||
      (result.data.type !== question.type && result.data.type !== "refusal")
    ) {
      throw new Error(
        `Invalid response from the OpenAI Decisions API: no valid ${question.type} answer for question "${name}".`,
        { cause: result.error }
      );
    }
    return [name, result.data];
  });
  return Object.fromEntries(entries);
}
