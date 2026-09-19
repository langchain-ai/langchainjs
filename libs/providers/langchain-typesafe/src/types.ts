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

// Not `.strict()`: `parseQuestions` splices a zod issue's `message`
// into a thrown error, and `.strict()` would embed a caller's key name.
const noulQuestionSchema = z
  .object({
    type: z.literal("noul"),
    instructions: questionContentSchema.optional(),
    criteria: noulCriteriaSchema.optional(),
  })
  // Cardinality rule, not shape: a Noul with neither field is well-typed
  // but meaningless, so it belongs in the schema alongside the shape
  // checks rather than as a separate manual check after parsing.
  .refine(
    (noul) => noul.instructions !== undefined || noul.criteria !== undefined,
    {
      message: "Noul question must have criteria or instructions.",
    }
  );

const choiceQuestionSchema = z.object({
  type: z.literal("choice"),
  // At least one option: matches the server, which also requires one.
  //
  // Counted BEFORE the record parse, not with a `.refine` after it: zod's
  // `record` parser drops an own `__proto__` key, so counting the parsed
  // result would reject a Choice whose only option is labelled
  // `__proto__` — a label `parseQuestions` otherwise preserves all the way
  // to the wire, and a route name `parseChoices` preserves too.
  criteria: z
    .custom<Record<string, JsonValue>>(
      (criteria) =>
        typeof criteria === "object" &&
        criteria !== null &&
        !Array.isArray(criteria) &&
        Object.keys(criteria).length >= 1,
      { message: "Choice question must have at least 1 option." }
    )
    .pipe(z.record(z.string(), jsonValueSchema)),
  instructions: questionContentSchema.optional(),
});

const scoreQuestionSchema = z.object({
  type: z.literal("score"),
  // Stricter than the server, deliberately: the API accepts a one-level
  // Score and answers with a meaningless `confidence: 1.0` rather than
  // erroring.
  criteria: z
    .array(jsonValueSchema)
    .min(2, "Score question must have at least 2 ordered levels."),
  instructions: questionContentSchema.optional(),
});

/**
 * Validates the shape of a single question, mirroring the `Question` union
 * member-for-member, and enforces each variant's cardinality rule (Noul
 * needs criteria or instructions; Choice needs at least one option; Score
 * needs at least two ordered levels).
 *
 * Used by `parseQuestions` to catch a malformed or under-specified
 * `criteria`/`instructions` from untrusted input (e.g. parsed JSON/YAML)
 * with a clean, named error instead of a bare runtime `TypeError`.
 */
export const questionSchema = z.discriminatedUnion("type", [
  noulQuestionSchema,
  choiceQuestionSchema,
  scoreQuestionSchema,
]);

// Checks cardinality without rebuilding the map: `z.record` would
// reconstruct the object and drop an own `__proto__` key, which this
// package preserves. Each question is parsed individually against
// `questionSchema` by `parseQuestions`, the only place that may produce
// this brand.
const questionsMapSchema = z
  .custom<Record<string, Question>>()
  .refine((questions) => Object.keys(questions).length >= 1, {
    message: "TypeSafe requires at least one question.",
  })
  .brand<"ValidatedQuestions">();

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
 * A questions map that has been through `parseQuestions`: every entry
 * matches `questionSchema` — cardinality rules included — and the map has
 * at least one entry. Branded so a plain, unparsed `Record<string,
 * Question>` cannot be assigned where this type is required; only
 * `parseQuestions` can produce one.
 */
export type ValidatedQuestions = z.infer<typeof questionsMapSchema>;

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
 * Parses a questions map, returning it branded as `ValidatedQuestions`.
 *
 * Each question goes through `questionSchema`, so malformed or
 * under-specified input — e.g. from parsed JSON/YAML rather than a
 * hand-written literal — fails with an error naming the question id
 * instead of a bare `TypeError` at request time.
 */
export function parseQuestions(
  questions: Record<string, Question>
): ValidatedQuestions {
  for (const id of Object.keys(questions)) {
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
    // `shape.data` is deliberately unused. `questionSchema` has no
    // transform or default, so it differs from the input only where zod
    // loses something — its `record` parser drops a key named
    // `__proto__`, which would delete a Choice option so labelled.
  }
  // Brands the caller's own map. Nothing is copied, so every key survives,
  // and the brand comes from a parse rather than a cast.
  const map = questionsMapSchema.safeParse(questions);
  if (!map.success) {
    throw new Error(map.error.issues[0].message);
  }
  return map.data;
}
