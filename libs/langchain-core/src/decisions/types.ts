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
 * leave room for interpretation. Both values accept any JSON value, so callers
 * can provide a short description or structured examples. The keys are
 * literally `true` and `false`.
 */
export type NoulCriteria = z.infer<typeof noulCriteriaSchema>;

/**
 * Ask a binary question and receive the probability that its answer is yes.
 *
 * Use `Noul` when the probability itself is useful to application code, such as
 * deciding whether a message reports a bug or requests a refund. A value near
 * `1` indicates strong support for yes, near `0` strong support for no, and
 * near `0.5` uncertainty. Noul answers have no separate confidence.
 *
 * Write the complete judgment in `instructions`, even when the question ID
 * seems self-explanatory. Optional `criteria` define the yes and no outcomes.
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
 * Use `Choice` for categorical decisions with no inherent ordering, such as
 * routing a support request, detecting a document type, or selecting an
 * intent. The answer includes the selected label, a probability for every
 * supplied label, and a confidence value.
 *
 * `criteria` maps each label to its description, which may be text, JSON, or
 * `null`. Include an `other` or `none_of_the_above` label when the alternatives
 * may not cover every input.
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
 *         sales: "Pricing or purchasing questions.",
 *       },
 *     },
 *   },
 * });
 * const department = response.choices.department;
 *
 * if (department.confidence >= 0.7) {
 *   routeTo(department.choice);
 * } else {
 *   routeToHumanTriage();
 * }
 * ```
 */
export type Choice = z.infer<typeof choiceSchema>;

/**
 * Evaluate state against an ordered rubric.
 *
 * Use `Score` when the answer lies on a spectrum whose levels can be described,
 * such as severity, urgency, or customer frustration. `criteria` lists two or
 * more levels, numbered from zero in their supplied order. The returned score
 * is an expected value and may fall between integer levels; the full
 * probability distribution remains available for custom decision logic.
 *
 * @example
 * ```ts
 * const response = await model.invoke({
 *   state: "This has failed three times. Fix it now.",
 *   questions: {
 *     frustration: {
 *       type: "score",
 *       instructions: "How frustrated does the customer appear?",
 *       criteria: [
 *         "Calm and neutral.",
 *         "Concerned but civil.",
 *         "Very angry or using strong language.",
 *       ],
 *     },
 *   },
 * });
 * const frustration = response.scores.frustration;
 *
 * frustration.score; // May be fractional, for example 1.35.
 * frustration.legend; // The original zero-based rubric.
 * frustration.probabilities; // Probability for each rubric level.
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

/** A discriminated union of question types accepted by decision models. */
export type Question = z.infer<typeof questionSchema>;

/**
 * Complete input for one decision model invocation.
 *
 * Keeping the state and questions in the runnable input ensures both values
 * participate in composition, batching, and tracing.
 */
export interface ClassifierRequest {
  /** Text, structured JSON, or LangChain messages to classify. */
  state: State;
  /** Non-empty map of answer IDs to typed classification questions. */
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
 * `choice` is one of the labels supplied in `Choice.criteria`. `probabilities`
 * keeps the complete distribution, keyed by label, so applications can use a
 * confidence measure or risk policy different from the provider's.
 * `confidence` is the certainty from `0` to `1` in the selected label. Each
 * provider documents how it derives it; choose thresholds according to the
 * consequences of an incorrect automated decision.
 */
export type ChoiceAnswer = z.infer<typeof choiceAnswerSchema>;

/**
 * Expected `Score` value with its rubric, distribution, and confidence.
 *
 * `score` is the expected position on the rubric and may be fractional, because
 * it summarizes the distribution rather than selecting one level. `legend`
 * holds the original rubric descriptions and `probabilities` the distribution,
 * both keyed by zero-based level. `confidence`, from `0` to `1`, is derived
 * from the level distribution.
 *
 * `legend` and `probabilities` are typed `Record<string, ...>` because JSON
 * keys are strings; `legend[0]` still works.
 */
export type ScoreAnswer = z.infer<typeof scoreAnswerSchema>;

/**
 * Edges of a box as fractions of the image height and width, from `0` to `1`.
 *
 * `top` and `bottom` are measured from the top of the image, `left` and
 * `right` from the left.
 */
export type BoxCoordinates = z.infer<typeof boxCoordinatesSchema>;

/**
 * Location of what a `Box` question describes.
 *
 * `confidence` is the certainty from `0` to `1`, or `undefined` when the
 * provider does not report it.
 */
export type BoxAnswer = z.infer<typeof boxAnswerSchema>;

/** A discriminated union of answers returned by decision models. */
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
  /** All answers keyed by their original question IDs. */
  answers: Record<string, unknown>;
  /**
   * Token usage, or omitted when not reported. A missing count is treated as
   * `0`, and `total_tokens` defaults to their sum.
   */
  usage_metadata?: Partial<UsageMetadata> | null;
  /** Provider request ID, useful when diagnosing a request with provider support. */
  requestId?: string | null;
}

/**
 * Typed answers and metadata returned from one classification request.
 *
 * Read every answer from `answers`, or use `nouls`, `choices`, `scores`, and
 * `boxes` for views filtered by answer type. Each map preserves the question
 * IDs supplied in `ClassifierRequest.questions`. The views are non-enumerable
 * so they are not duplicated into traces or `JSON.stringify` output.
 */
export interface ClassifierResponse {
  /** Model that answered the request. */
  model: string;
  /** All answers keyed by their original question IDs. */
  answers: Record<string, Answer>;
  /**
   * Token usage reported for the request, if any. A missing count is treated
   * as `0`, and `total_tokens` defaults to their sum.
   */
  usage_metadata?: UsageMetadata;
  /** Provider request ID, useful when diagnosing a request with provider support. */
  requestId?: string;
  /** Binary answers keyed by their original question IDs. */
  readonly nouls: Record<string, NoulAnswer>;
  /** Categorical answers keyed by their original question IDs. */
  readonly choices: Record<string, ChoiceAnswer>;
  /** Ordinal answers keyed by their original question IDs. */
  readonly scores: Record<string, ScoreAnswer>;
  /** Localization answers keyed by their original question IDs. */
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
