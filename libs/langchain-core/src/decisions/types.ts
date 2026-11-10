import * as z from "zod/v4";

import type { BaseMessage } from "../messages/base.js";
import type { UsageMetadata } from "../messages/metadata.js";

const jsonValueSchema = z.json();

/** Any value expressible in JSON. */
export type JsonValue = z.infer<typeof jsonValueSchema>;

const contentSchema = z.union([
  z.string(),
  z.record(z.string(), jsonValueSchema),
  z.array(jsonValueSchema),
]);

/** Text, a JSON object, or a JSON array used in question instructions. */
export type Content = z.infer<typeof contentSchema>;

/** A value allowed below the root of `State`. */
export type StateValue =
  | string
  | number
  | boolean
  | null
  | BaseMessage
  | StateValue[]
  | { [key: string]: StateValue };

/**
 * Root state accepted by decision models.
 *
 * State is a string, JSON object, or JSON array. LangChain `BaseMessage` objects
 * and message arrays can appear at the root or at any depth inside objects and
 * arrays.
 *
 * LangChain standard media blocks (for example `{ type: "image", data: ...,
 * mimeType: ... }`) may appear anywhere in the state. Each provider documents
 * which media it supports and how it sends state its API cannot accept natively.
 */
export type State =
  | string
  | BaseMessage
  | StateValue[]
  | { [key: string]: StateValue };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// Unlike `z.record`, keeps an own `__proto__` key, which can be a valid label
// or question ID.
function recordOf<T extends z.ZodType>(valueSchema: T) {
  return z
    .custom<Record<string, unknown>>(isPlainObject, "Expected an object.")
    .transform((record, ctx) => {
      const entries: [string, z.output<T>][] = [];
      for (const [key, value] of Object.entries(record)) {
        const result = valueSchema.safeParse(value);
        if (result.success) {
          entries.push([key, result.data]);
        } else {
          for (const issue of result.error.issues) {
            ctx.issues.push({
              code: "custom",
              message: issue.message,
              input: value,
              path: [key, ...issue.path],
            });
          }
        }
      }
      return Object.fromEntries(entries) as Record<string, z.output<T>>;
    });
}

const noulCriteriaSchema = z.strictObject({
  true: jsonValueSchema.optional(),
  false: jsonValueSchema.optional(),
});

const noulSchema = z.strictObject({
  type: z.literal("noul"),
  instructions: contentSchema,
  criteria: noulCriteriaSchema.nullish(),
});

const choiceSchema = z.strictObject({
  type: z.literal("choice"),
  criteria: recordOf(jsonValueSchema).refine(
    (criteria) => Object.keys(criteria).length >= 1,
    "Choice question must have at least 1 option."
  ),
  instructions: contentSchema,
});

const scoreSchema = z.strictObject({
  type: z.literal("score"),
  criteria: z
    .array(jsonValueSchema)
    .min(2, "Score question must have at least 2 ordered levels."),
  instructions: contentSchema,
});

const boxSchema = z.strictObject({
  type: z.literal("box"),
  instructions: contentSchema,
});

const questionSchema = z.discriminatedUnion("type", [
  noulSchema,
  choiceSchema,
  scoreSchema,
  boxSchema,
]);

/**
 * Optional descriptions for the two outcomes of a `Noul` question.
 *
 * Criteria clarify what should count as yes and no when the instructions alone
 * leave room for interpretation. The keys are literally `true` and `false`.
 */
export type NoulCriteria = z.infer<typeof noulCriteriaSchema>;

/**
 * Ask a binary question and receive the probability that its answer is yes.
 *
 * A value near `1` indicates strong support for yes, near `0` strong support
 * for no, and near `0.5` uncertainty. Noul answers have no separate confidence.
 *
 * @example
 * ```ts
 * const response = await model.invoke({
 *   state: "Production is down. Please help immediately.",
 *   questions: {
 *     urgent: {
 *       type: "noul",
 *       instructions: "Does this message require an urgent response?",
 *     },
 *   },
 * });
 * if (response.nouls.urgent.noul >= 0.8) pageOnCallEngineer();
 * ```
 */
export type Noul = z.infer<typeof noulSchema>;

/**
 * Select one label from a fixed set of alternatives.
 *
 * `criteria` maps each label to its description, which may be text, JSON, or
 * `null`. Include an `other` label when the alternatives may not cover every
 * input.
 *
 * @example
 * ```ts
 * const response = await model.invoke({
 *   state: "Stripe fails whenever I connect my account.",
 *   questions: {
 *     department: {
 *       type: "choice",
 *       instructions: "Which team should handle this request?",
 *       criteria: {
 *         billing: "Payment, invoice, or subscription issues.",
 *         technical: "Product bugs or integration failures.",
 *       },
 *     },
 *   },
 * });
 * const { choice, confidence } = response.choices.department;
 * ```
 */
export type Choice = z.infer<typeof choiceSchema>;

/**
 * Evaluate state against an ordered rubric.
 *
 * `criteria` lists two or more levels, low to high, numbered from zero. The
 * returned score is an expected value and may fall between levels.
 *
 * @example
 * ```ts
 * const response = await model.invoke({
 *   state: "This has failed three times. Fix it now.",
 *   questions: {
 *     frustration: {
 *       type: "score",
 *       instructions: "How frustrated does the customer appear?",
 *       criteria: ["Calm.", "Concerned but civil.", "Very angry."],
 *     },
 *   },
 * });
 * response.scores.frustration.score; // May be fractional, e.g. 1.35.
 * ```
 */
export type Score = z.infer<typeof scoreSchema>;

/**
 * Locate what the instructions describe in an image in the state.
 *
 * The answer gives the edges of a box as fractions of the image height and
 * width.
 */
export type Box = z.infer<typeof boxSchema>;

/** A question accepted by decision models, discriminated by `type`. */
export type Question = z.infer<typeof questionSchema>;

/** Complete input for one decision model invocation. */
export interface ClassifierRequest {
  /** Text, structured JSON, or LangChain messages to classify. */
  state: State;
  /** Non-empty map of answer IDs to typed questions. */
  questions: Record<string, Question>;
}

const probabilitySchema = z.number().min(0).max(1);

const noulAnswerSchema = z.object({
  type: z.literal("noul"),
  noul: probabilitySchema,
});

const choiceAnswerSchema = z.object({
  type: z.literal("choice"),
  choice: z.string(),
  probabilities: recordOf(z.number()),
  confidence: probabilitySchema,
});

const scoreAnswerSchema = z.object({
  type: z.literal("score"),
  score: z.number(),
  legend: recordOf(jsonValueSchema),
  probabilities: recordOf(z.number()),
  confidence: probabilitySchema,
});

const boxCoordinatesSchema = z.object({
  top: z.number(),
  bottom: z.number(),
  left: z.number(),
  right: z.number(),
});

const boxAnswerSchema = z.object({
  type: z.literal("box"),
  box: boxCoordinatesSchema,
  confidence: probabilitySchema
    .nullish()
    .transform((value) => value ?? undefined),
});

const answerSchema = z.discriminatedUnion("type", [
  noulAnswerSchema,
  choiceAnswerSchema,
  scoreAnswerSchema,
  boxAnswerSchema,
]);

/** Probability, from `0` to `1`, that a `Noul` question's answer is yes. */
export type NoulAnswer = z.infer<typeof noulAnswerSchema>;

/**
 * Selected `Choice` label with its probability distribution and confidence.
 *
 * `probabilities` is keyed by label. Each provider documents how it derives
 * `confidence`.
 */
export type ChoiceAnswer = z.infer<typeof choiceAnswerSchema>;

/**
 * Expected `Score` value with its rubric, distribution, and confidence.
 *
 * `legend` and `probabilities` are keyed by zero-based level. They are typed
 * `Record<string, ...>` because JSON keys are strings; `legend[0]` still works.
 */
export type ScoreAnswer = z.infer<typeof scoreAnswerSchema>;

/** Edges of a box as fractions of the image height and width, from `0` to `1`. */
export type BoxCoordinates = z.infer<typeof boxCoordinatesSchema>;

/** Location of what a `Box` question describes. */
export type BoxAnswer = z.infer<typeof boxAnswerSchema>;

/** An answer returned by decision models, discriminated by `type`. */
export type Answer = z.infer<typeof answerSchema>;

const usageSchema = z
  .looseObject({
    input_tokens: z.number().nullish(),
    output_tokens: z.number().nullish(),
    total_tokens: z.number().nullish(),
  })
  .transform((usage) => {
    const input_tokens = usage.input_tokens ?? 0;
    const output_tokens = usage.output_tokens ?? 0;
    return {
      ...usage,
      input_tokens,
      output_tokens,
      total_tokens: usage.total_tokens || input_tokens + output_tokens,
    } as UsageMetadata;
  });

const responseSchema = z.object({
  model: z.string(),
  answers: recordOf(answerSchema),
  usage_metadata: usageSchema
    .nullish()
    .transform((value) => value ?? undefined),
  requestId: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
});

/** Fields a provider supplies to build a `ClassifierResponse`. */
export interface ClassifierResponseFields {
  /** Model that answered the request. */
  model: string;
  /** All answers keyed by their question IDs. */
  answers: Record<string, unknown>;
  /**
   * Token usage, or omitted when not reported. A missing count is treated as
   * `0`, and `total_tokens` defaults to their sum.
   */
  usage_metadata?: Partial<UsageMetadata> | null;
  /** Provider request ID, useful when diagnosing a request with support. */
  requestId?: string | null;
}

/**
 * Typed answers and metadata returned from one classification request.
 *
 * Read every answer from `answers`, or use `nouls`, `choices`, `scores`, and
 * `boxes` for views filtered by answer type. The views are non-enumerable so
 * they are not duplicated into traces or `JSON.stringify` output.
 */
export interface ClassifierResponse {
  /** Model that answered the request. */
  model: string;
  /** All answers keyed by their question IDs. */
  answers: Record<string, Answer>;
  /** Token usage reported for the request, if any. */
  usage_metadata?: UsageMetadata;
  /** Provider request ID, useful when diagnosing a request with support. */
  requestId?: string;
  /** Binary answers keyed by question ID. */
  readonly nouls: Record<string, NoulAnswer>;
  /** Categorical answers keyed by question ID. */
  readonly choices: Record<string, ChoiceAnswer>;
  /** Ordinal answers keyed by question ID. */
  readonly scores: Record<string, ScoreAnswer>;
  /** Localization answers keyed by question ID. */
  readonly boxes: Record<string, BoxAnswer>;
}

function withAnswerViews(
  response: Omit<ClassifierResponse, "nouls" | "choices" | "scores" | "boxes">
): ClassifierResponse {
  const define = (name: string, type: Answer["type"]) => {
    Object.defineProperty(response, name, {
      enumerable: false,
      configurable: true,
      get() {
        return Object.fromEntries(
          Object.entries(response.answers).filter(
            ([, answer]) => answer.type === type
          )
        );
      },
    });
  };
  define("nouls", "noul");
  define("choices", "choice");
  define("scores", "score");
  define("boxes", "box");
  return response as ClassifierResponse;
}

// Names the field path and the kind of problem, never the caller's values or
// unknown key names, so the message is safe to log.
function describeIssue(issue: z.core.$ZodIssue): string {
  const path = issue.path.map(String).join(".");
  const message =
    issue.code === "unrecognized_keys" ? "Unrecognized key." : issue.message;
  return path ? `${path}: ${message}` : message;
}

/**
 * Validates a questions map.
 *
 * Every question must match its type's schema, including required
 * `instructions` and each type's minimum number of options, and unknown keys
 * are rejected. The map itself is returned unchanged.
 *
 * @throws Error naming the invalid question ID.
 */
export function parseQuestions(
  questions: Record<string, Question>
): Record<string, Question> {
  if (
    typeof questions !== "object" ||
    questions === null ||
    Array.isArray(questions) ||
    Object.keys(questions).length === 0
  ) {
    throw new Error("Decision models require at least one question.");
  }
  for (const [id, question] of Object.entries(questions)) {
    let result: ReturnType<typeof questionSchema.safeParse>;
    try {
      result = questionSchema.safeParse(question);
    } catch {
      throw new Error(
        `Invalid question "${id}": content is too deeply nested or circular.`
      );
    }
    if (!result.success) {
      throw new Error(
        `Invalid question "${id}": ${describeIssue(result.error.issues[0])}`
      );
    }
  }
  return questions;
}

/**
 * Validates a provider's response and returns a `ClassifierResponse`.
 *
 * Unknown answer types are rejected; unknown fields are dropped. Partial usage
 * is completed with zero counts and a summed `total_tokens`.
 *
 * @throws Error if the response does not match the expected shape.
 */
export function parseClassifierResponse(
  fields: ClassifierResponseFields
): ClassifierResponse {
  const result = responseSchema.safeParse(fields);
  if (!result.success) {
    throw new Error(
      `Invalid decision model response: ${describeIssue(result.error.issues[0])}`
    );
  }
  const { usage_metadata, requestId, ...rest } = result.data;
  return withAnswerViews({
    ...rest,
    ...(usage_metadata === undefined ? {} : { usage_metadata }),
    ...(requestId === undefined ? {} : { requestId }),
  });
}
