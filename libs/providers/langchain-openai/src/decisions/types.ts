import { z } from "zod/v3";
import type { BaseMessage, UsageMetadata } from "@langchain/core/messages";

export interface Predicate {
  type: "predicate";
  instructions: string;
}
export interface Choice {
  type: "choice";
  instructions: string;
  choices: Record<string, string | null>;
}
export interface Level {
  label: string;
  description?: string;
}
export interface Score {
  type: "score";
  instructions: string;
  levels: (string | Level)[];
}
export type Question = Predicate | Choice | Score;
export type DecisionState =
  | string
  | number
  | boolean
  | null
  | BaseMessage
  | DecisionState[]
  | { [key: string]: DecisionState };
export interface DecisionRequest {
  input: DecisionState;
  questions: Record<string, Question>;
}
const probability = z.number().min(0).max(1);
export const answerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("predicate"), probability }),
  z.object({
    type: z.literal("choice"),
    choice: z.union([z.string(), z.boolean()]),
    probabilities: z.record(z.number()),
    confidence: probability,
  }),
  z.object({
    type: z.literal("score"),
    score: z.number(),
    legend: z.record(z.string()),
    probabilities: z.record(z.number()),
    confidence: probability,
  }),
  z.object({ type: z.literal("refusal") }).passthrough(),
]);
export type Answer = z.infer<typeof answerSchema>;
export type PredicateAnswer = Extract<Answer, { type: "predicate" }>;
export type ChoiceAnswer = Extract<Answer, { type: "choice" }>;
export type ScoreAnswer = Extract<Answer, { type: "score" }>;
export type RefusalAnswer = Extract<Answer, { type: "refusal" }>;
export interface DecisionResponse {
  model: string;
  answers: Record<string, Answer>;
  predicates: Record<string, PredicateAnswer>;
  choices: Record<string, ChoiceAnswer>;
  scores: Record<string, ScoreAnswer>;
  refusals: Record<string, RefusalAnswer>;
  usage: { input_tokens?: number | null; output_tokens?: number | null };
  request_id: string | null;
  usage_metadata: UsageMetadata;
}
export function toQuestion(name: string, question: Question) {
  if (!question.instructions?.length)
    throw new Error("Question instructions must not be empty.");
  if (question.type === "predicate")
    return { type: question.type, name, instructions: question.instructions };
  if (question.type === "choice") {
    if (!Object.keys(question.choices).length)
      throw new Error("Choice requires at least one option.");
    return {
      type: question.type,
      name,
      instructions: question.instructions,
      choices: Object.entries(question.choices).map(([value, description]) =>
        description == null ? { value } : { value, description }
      ),
    };
  }
  if (question.type !== "score" || question.levels.length < 2)
    throw new Error("Score requires at least two levels.");
  const levels = question.levels.map((level) =>
    typeof level === "string" ? { label: level } : level
  );
  if (levels.some((level) => !level.label?.length))
    throw new Error("Score labels must not be empty.");
  return {
    type: question.type,
    name,
    instructions: question.instructions,
    levels,
  };
}
