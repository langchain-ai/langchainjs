import * as z from "zod/v4";

const jsonValueSchema = z.json();

const questionContentSchema = z.union([
  z.string(),
  z.record(z.string(), jsonValueSchema),
  z.array(jsonValueSchema),
]);

const noulCriteriaSchema = z.object({
  true: jsonValueSchema.optional(),
  false: jsonValueSchema.optional(),
});

// Not `.strict()`: `validateQuestions` splices a zod issue's `message`
// into a thrown error, and `.strict()` would embed a caller's key name.
const noulQuestionSchema = z.object({
  type: z.literal("noul"),
  instructions: questionContentSchema.optional(),
  criteria: noulCriteriaSchema.optional(),
});

const choiceQuestionSchema = z.object({
  type: z.literal("choice"),
  criteria: z.record(z.string(), jsonValueSchema),
  instructions: questionContentSchema.optional(),
});

const scoreQuestionSchema = z.object({
  type: z.literal("score"),
  criteria: z.array(jsonValueSchema),
  instructions: questionContentSchema.optional(),
});

/**
 * Validates the shape of a single question, mirroring the `Question` union
 * member-for-member.
 *
 * Used by `validateQuestions` to catch a malformed `criteria`/`instructions`
 * from untrusted input (e.g. parsed JSON/YAML) with a clean, named error
 * instead of a bare runtime `TypeError` from the cardinality checks that
 * follow.
 */
export const questionSchema = z.discriminatedUnion("type", [
  noulQuestionSchema,
  choiceQuestionSchema,
  scoreQuestionSchema,
]);

const noulAnswerSchema = z.object({
  type: z.literal("noul"),
  noul: z.number(),
});

const choiceAnswerSchema = z.object({
  type: z.literal("choice"),
  choice: z.string(),
  probabilities: z.record(z.string(), z.number()),
  confidence: z.number(),
});

const scoreAnswerSchema = z.object({
  type: z.literal("score"),
  score: z.number(),
  legend: z.record(z.string(), jsonValueSchema),
  probabilities: z.record(z.string(), z.number()),
  confidence: z.number(),
});

const answerSchema = z.discriminatedUnion("type", [
  noulAnswerSchema,
  choiceAnswerSchema,
  scoreAnswerSchema,
]);

/**
 * Parses a `POST /v1/systemone` success body.
 *
 * Renames the wire's snake_case usage fields to camelCase; the wire format
 * itself stays snake_case.
 */
export const classificationResponseSchema = z
  .object({
    model: z.string(),
    answers: z.record(z.string(), answerSchema),
    usage: z
      .object({
        input_tokens: z.number().optional(),
        output_tokens: z.number().optional(),
      })
      .optional(),
  })
  .transform((raw) => ({
    model: raw.model,
    answers: raw.answers as Record<string, Answer>,
    usage: {
      ...(raw.usage?.input_tokens === undefined
        ? {}
        : { inputTokens: raw.usage.input_tokens }),
      ...(raw.usage?.output_tokens === undefined
        ? {}
        : { outputTokens: raw.usage.output_tokens }),
    } satisfies Usage,
  }));

// Every type below is inferred from the schema above it, so the two
// cannot drift. The aliases exist to give the schemas names and docs.

/** Any value expressible in JSON. */
export type JsonValue = z.infer<typeof jsonValueSchema>;

/**
 * Content accepted for a question's `instructions` or `criteria`. Not
 * narrowed to `string`: the API accepts structured instructions, verified
 * live, though the compact HTTP reference shows only strings.
 */
export type QuestionContent = z.infer<typeof questionContentSchema>;

/**
 * Descriptions for a Noul's two outcomes.
 *
 * The keys are literally `true` and `false`, not `yes`/`no`.
 */
export type NoulCriteria = z.infer<typeof noulCriteriaSchema>;

/** A yes/no question. Must carry `instructions`, `criteria`, or both. */
export type Noul = z.infer<typeof noulQuestionSchema>;

/** A pick-one-of-N question. `criteria` maps each label to a description. */
export type Choice = z.infer<typeof choiceQuestionSchema>;

/** An ordered-rubric question. `criteria` is low-to-high; index = level. */
export type Score = z.infer<typeof scoreQuestionSchema>;

export type Question = z.infer<typeof questionSchema>;

/**
 * A Noul answer: a bare probability, with no `confidence` and no
 * `probabilities`. For a binary question the probability IS the
 * confidence, and a value near 0.5 is the uncertainty signal.
 */
export type NoulAnswer = z.infer<typeof noulAnswerSchema>;

/** A Choice answer. `probabilities` is keyed by option label. */
export type ChoiceAnswer = z.infer<typeof choiceAnswerSchema>;

/**
 * A Score answer. `legend` and `probabilities` are keyed by level index,
 * typed `Record<string, ...>` because JSON keys are strings —
 * `answer.legend[0]` still works. Do not "fix" them to `Record<number>`:
 * `Object.keys` yields strings regardless, so that would be fiction.
 */
export type ScoreAnswer = z.infer<typeof scoreAnswerSchema>;

export type Answer = z.infer<typeof answerSchema>;

/**
 * Token usage. Output tokens are billed at zero by TypeSafe.
 *
 * Not inferred: this is the camelCase form the schema's transform
 * produces, not the snake_case shape the wire sends.
 */
export interface Usage {
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * A parsed `POST /v1/systemone` response.
 *
 * The parsed fields are inferred from `classificationResponseSchema`; the
 * three accessors are attached afterwards by `withAnswerAccessors` and so
 * are not part of the schema.
 */
export type ParsedResponse = z.infer<typeof classificationResponseSchema> & {
  /** From the `x-typesafe-request-id` response header, when present. */
  requestId?: string;
};

export type ClassificationResponse = ParsedResponse & {
  /** Noul answers only, keyed by question id. Non-enumerable. */
  readonly nouls: Record<string, NoulAnswer>;
  /** Choice answers only, keyed by question id. Non-enumerable. */
  readonly choices: Record<string, ChoiceAnswer>;
  /** Score answers only, keyed by question id. Non-enumerable. */
  readonly scores: Record<string, ScoreAnswer>;
};

/**
 * Attaches the type-partitioned answer accessors to a parsed response.
 *
 * `nouls`, `choices` and `scores` filter `answers` by variant, preserving
 * question ids — mirroring the Python package's properties of the same
 * names, which the experimental agent middlewares consume.
 *
 * The accessors are NON-ENUMERABLE deliberately: `answers` already holds
 * the data, so enumerable copies would be duplicated into every
 * `JSON.stringify` and every LangSmith trace.
 *
 * Call this LAST, after any spread. `{...response}` copies only own
 * enumerable properties and would silently drop these.
 */
export function withAnswerAccessors(
  response: ParsedResponse
): ClassificationResponse {
  const define = <T extends Answer>(name: string, type: T["type"]) => {
    Object.defineProperty(response, name, {
      enumerable: false,
      configurable: true,
      get(): Record<string, T> {
        const out: Record<string, T> = {};
        for (const [id, answer] of Object.entries(response.answers)) {
          if (answer.type === type) {
            out[id] = answer as T;
          }
        }
        return out;
      },
    });
  };
  define<NoulAnswer>("nouls", "noul");
  define<ChoiceAnswer>("choices", "choice");
  define<ScoreAnswer>("scores", "score");
  return response as ClassificationResponse;
}

/**
 * Converts a question to its wire form.
 *
 * Two behaviors are load-bearing and pinned by tests:
 *
 * 1. Field order, matching the Python package's wire output: `type,
 *    instructions, criteria` for Noul and `type, criteria, instructions`
 *    for Choice and Score. This is a PARITY choice, not a correctness
 *    requirement — an earlier version of this comment claimed the API is
 *    order-sensitive, which overstated it. Measured live with a control
 *    for run-to-run noise (n=6): repeating the same order moved a
 *    borderline Noul by 0.005 on average, changing the order moved it by
 *    0.015. So order does shift answers slightly, by one or two points on
 *    a 0-1 scale — real, far below any decision threshold, and not a
 *    reason to reorder casually.
 * 2. Absent vs null. An absent optional *field* is omitted (left
 *    `undefined`, which `JSON.stringify` drops); a `null` *value* inside
 *    `criteria` is preserved. Never add a null-stripping pass.
 */
export function serializeQuestion(question: Question): Record<string, unknown> {
  if (question.type === "noul") {
    const wire: Record<string, unknown> = { type: "noul" };
    if (question.instructions !== undefined) {
      wire.instructions = question.instructions;
    }
    if (question.criteria !== undefined) {
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

  const wire: Record<string, unknown> = {
    type: question.type,
    criteria: question.criteria,
  };
  if (question.instructions !== undefined) {
    wire.instructions = question.instructions;
  }
  return wire;
}

/**
 * Validates a questions map before it reaches the network.
 *
 * Each question's shape is checked against `questionSchema` first, so
 * malformed input (e.g. from parsed JSON/YAML rather than a hand-written TS
 * literal) fails with a clean, named error instead of a bare runtime
 * `TypeError` from the cardinality checks below.
 *
 * The Score lower bound is stricter than the server, deliberately: the API
 * accepts a one-level Score and answers with a meaningless `confidence: 1.0`
 * rather than erroring. Choice matches the server (at least one option).
 */
export function validateQuestions(questions: Record<string, Question>): void {
  const ids = Object.keys(questions);
  if (ids.length === 0) {
    throw new Error("TypeSafe requires at least one question.");
  }
  for (const id of ids) {
    const question = questions[id];
    let shape: ReturnType<typeof questionSchema.safeParse>;
    try {
      shape = questionSchema.safeParse(question);
    } catch {
      // zod walks the value recursively, so a cycle or a pathological depth
      // overflows the stack rather than producing an issue. A YAML anchor
      // (`&a { self: *a }`) materializes a real cycle, and this function
      // exists precisely to turn that class of input into a named error —
      // so a bare RangeError here would break its own contract. Names the
      // question id only: no value, no content.
      throw new Error(
        `Invalid TypeSafe question "${id}": criteria or instructions are ` +
          `too deeply nested, or contain a circular reference.`
      );
    }
    if (!shape.success) {
      // zod's default messages for this schema family describe the
      // *expected* shape, never the caller's actual value, and the path
      // names developer-authored question fields — both safe to surface.
      const issue = shape.error.issues[0];
      // An empty path means the question itself was the wrong type, so there
      // is no field to name — skip the prefix rather than render ": : ".
      const path = issue.path.join(".");
      const prefix = path.length > 0 ? `${path}: ` : "";
      throw new Error(
        `Invalid TypeSafe question "${id}": ${prefix}${issue.message}`
      );
    }
    if (question.type === "noul") {
      if (
        question.instructions === undefined &&
        question.criteria === undefined
      ) {
        throw new Error(
          `Noul question must have criteria or instructions: ${id}`
        );
      }
      continue;
    }
    if (question.type === "choice") {
      if (Object.keys(question.criteria).length < 1) {
        throw new Error(`Choice question "${id}" must have at least 1 option.`);
      }
      continue;
    }
    if (question.criteria.length < 2) {
      throw new Error(
        `Score question "${id}" must have at least 2 ordered levels.`
      );
    }
  }
}
