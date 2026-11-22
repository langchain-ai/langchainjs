import {
  parseClassifierResponse,
  type ClassifierResponse,
  type JsonValue,
  type Question,
} from "@langchain/core/decisions";
import type { GoogleDecisions } from "../../decisions/types.js";
import {
  decisionBlockedErrorFromFeedback,
  MalformedOutputError,
} from "../../utils/errors.js";
import { convertInteractionsUsageToUsageMetadata } from "../interactions/messages.js";

function defineOwn<T>(target: Record<string, T>, key: string, value: T): void {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

function copyRecord<T>(
  record: Record<string, T> | undefined
): Record<string, T> | undefined {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return undefined;
  }
  const out: Record<string, T> = {};
  for (const [key, value] of Object.entries(record)) {
    defineOwn(out, key, value);
  }
  return out;
}

function restoreScoreLegend(
  rawLegend: Record<string, string> | undefined,
  question: Question | undefined
): Record<string, JsonValue> | undefined {
  if (!rawLegend || typeof rawLegend !== "object" || Array.isArray(rawLegend)) {
    return undefined;
  }
  const out: Record<string, JsonValue> = {};
  const originalCriteria =
    question?.type === "score" ? question.criteria : undefined;
  for (const [key, wireValue] of Object.entries(rawLegend)) {
    const index = Number(key);
    const original =
      originalCriteria &&
      Number.isInteger(index) &&
      String(index) === key &&
      index >= 0 &&
      index < originalCriteria.length
        ? originalCriteria[index]
        : undefined;
    defineOwn(
      out,
      key,
      original !== undefined && typeof original !== "string"
        ? original
        : wireValue
    );
  }
  return out;
}

/**
 * Converts a Gemini `CreateDecisionResponse` payload into a validated
 * `@langchain/core/decisions` `ClassifierResponse`.
 */
export function convertDecisionsResponseToClassifierResponse(params: {
  data: GoogleDecisions.CreateDecisionResponse;
  model: string;
  questions: Record<string, Question>;
  requestId?: string | null;
}): ClassifierResponse {
  const { data, model, questions, requestId } = params;

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new MalformedOutputError({
      message: "Gemini Decisions API returned a non-object response body.",
    });
  }

  if (data.prompt_feedback) {
    const blockedError = decisionBlockedErrorFromFeedback(data.prompt_feedback);
    if (blockedError) {
      throw blockedError;
    }
  }

  if (
    !data.answers ||
    typeof data.answers !== "object" ||
    Array.isArray(data.answers)
  ) {
    throw new MalformedOutputError({
      message: "Gemini Decisions API response did not include answers.",
    });
  }

  const normalizedAnswers: Record<string, unknown> = {};
  for (const [id, rawAnswer] of Object.entries(data.answers)) {
    if (!rawAnswer || typeof rawAnswer !== "object") {
      defineOwn(normalizedAnswers, id, rawAnswer);
      continue;
    }
    if (rawAnswer.type === "noul") {
      defineOwn(normalizedAnswers, id, {
        type: "noul",
        noul: rawAnswer.noul,
      });
    } else if (rawAnswer.type === "choice") {
      defineOwn(normalizedAnswers, id, {
        type: "choice",
        choice: rawAnswer.choice,
        probabilities: copyRecord(rawAnswer.probabilities),
        confidence: rawAnswer.confidence,
      });
    } else if (rawAnswer.type === "score") {
      const question = Object.hasOwn(questions, id) ? questions[id] : undefined;
      defineOwn(normalizedAnswers, id, {
        type: "score",
        score: rawAnswer.score,
        legend: restoreScoreLegend(rawAnswer.legend, question),
        probabilities: copyRecord(rawAnswer.probabilities),
        confidence: rawAnswer.confidence,
      });
    } else {
      defineOwn(normalizedAnswers, id, rawAnswer);
    }
  }

  const usageMetadata = convertInteractionsUsageToUsageMetadata(data.usage);

  try {
    return parseClassifierResponse({
      model,
      answers: normalizedAnswers,
      usage_metadata: usageMetadata,
      requestId,
    });
  } catch (error) {
    throw new MalformedOutputError({
      message:
        error instanceof Error
          ? error.message
          : "Invalid Gemini Decisions API response.",
      cause: error,
    });
  }
}
