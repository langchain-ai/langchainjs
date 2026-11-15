import {
  parseQuestions,
  type JsonValue,
  type Question,
} from "@langchain/core/decisions";

import { TypeSafeError } from "./utils/errors.js";

export type {
  Answer,
  Box,
  BoxAnswer,
  BoxCoordinates,
  Choice,
  ChoiceAnswer,
  ClassifierRequest,
  ClassifierResponse,
  Content,
  Noul,
  NoulAnswer,
  NoulCriteria,
  Question,
  Score,
  ScoreAnswer,
  State,
} from "@langchain/core/decisions";

/**
 * Validates questions built at construction time, so a bad config fails
 * when the middleware is created rather than mid-run.
 *
 * @throws TypeSafeError naming the invalid question.
 */
export function validateQuestions(
  questions: Record<string, Question>
): Record<string, Question> {
  try {
    return parseQuestions(questions);
  } catch (error) {
    throw new TypeSafeError(
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Converts a question to its wire form.
 *
 * Two behaviors are pinned by tests:
 *
 * 1. Field order matches the Python package's wire output: `type,
 *    instructions, criteria` for Noul and `type, criteria, instructions`
 *    for Choice and Score. Order shifts answers slightly when measured live,
 *    so it is kept stable.
 * 2. An absent optional field is omitted; a `null` value inside `criteria`
 *    is preserved.
 */
export function serializeQuestion(question: Question): Record<string, unknown> {
  if (question.type === "box") {
    return { type: "box", instructions: question.instructions };
  }
  if (question.type === "noul") {
    const wire: Record<string, unknown> = {
      type: "noul",
      instructions: question.instructions,
    };
    if (question.criteria != null) {
      const criteria: Record<string, JsonValue> = {};
      if (question.criteria.true !== undefined) {
        criteria.true = question.criteria.true;
      }
      if (question.criteria.false !== undefined) {
        criteria.false = question.criteria.false;
      }
      wire.criteria = criteria;
    }
    return wire;
  }
  return {
    type: question.type,
    criteria: question.criteria,
    instructions: question.instructions,
  };
}
