import type { JsonValue, Question } from "@langchain/core/decisions";
import type { GoogleDecisions } from "../../decisions/types.js";
import { InvalidInputError } from "../../utils/errors.js";
import { convertContentToDecisionsInstructions } from "./state.js";

function defineOwn<T>(target: Record<string, T>, key: string, value: T): void {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

function stringifyCriterion(value: JsonValue, questionId: string): string {
  if (typeof value === "string") {
    return value;
  }
  try {
    const serialized = JSON.stringify(value);
    if (typeof serialized === "string") {
      return serialized;
    }
  } catch {
    // Handled below without echoing caller criterion content.
  }
  throw new InvalidInputError(
    `Criteria in Gemini Decisions question "${questionId}" could not be serialized.`
  );
}

/**
 * Converts a single `@langchain/core/decisions` `Question` into its Gemini
 * Decisions API wire representation.
 */
export function convertQuestionToDecisionsQuestion(
  id: string,
  question: Question
): GoogleDecisions.Question {
  if (question.type === "box") {
    throw new InvalidInputError(
      `Question "${id}" uses type "box", which is not supported by the Gemini Decisions API. Supported types are "noul", "choice", and "score".`
    );
  }

  const instructions = convertContentToDecisionsInstructions(
    question.instructions
  );

  if (question.type === "noul") {
    const wire: GoogleDecisions.NoulQuestion = {
      type: "noul",
      instructions,
    };
    if (question.criteria != null) {
      const criteria: GoogleDecisions.Criteria = {};
      if (
        question.criteria.true !== undefined &&
        question.criteria.true !== null
      ) {
        criteria.true_description = stringifyCriterion(
          question.criteria.true,
          id
        );
      }
      if (
        question.criteria.false !== undefined &&
        question.criteria.false !== null
      ) {
        criteria.false_description = stringifyCriterion(
          question.criteria.false,
          id
        );
      }
      if (
        criteria.true_description !== undefined ||
        criteria.false_description !== undefined
      ) {
        wire.criteria = criteria;
      }
    }
    return wire;
  }

  if (question.type === "choice") {
    const criteria: Record<string, string> = {};
    for (const [label, description] of Object.entries(question.criteria)) {
      const wireDesc =
        description === null ? "" : stringifyCriterion(description, id);
      defineOwn(criteria, label, wireDesc);
    }
    return {
      type: "choice",
      instructions,
      criteria,
    };
  }

  return {
    type: "score",
    instructions,
    criteria: question.criteria.map((level) =>
      level === null ? "" : stringifyCriterion(level, id)
    ),
  };
}

/**
 * Converts a map of validated `@langchain/core/decisions` questions into the
 * `CreateDecisionRequest.questions` map.
 *
 * Question keys and option/level cardinality limits are intentionally passed
 * through for the Gemini Decisions API to validate; `Object.defineProperty` is
 * used so an own `"__proto__"` key is preserved across `JSON.stringify`.
 */
export function convertQuestionsToDecisionsQuestions(
  questions: Record<string, Question>
): Record<string, GoogleDecisions.Question> {
  const wireQuestions: Record<string, GoogleDecisions.Question> = {};
  for (const [id, question] of Object.entries(questions)) {
    defineOwn(
      wireQuestions,
      id,
      convertQuestionToDecisionsQuestion(id, question)
    );
  }
  return wireQuestions;
}
