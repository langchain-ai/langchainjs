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
 * A Score as a caller writes it, accepting a `readonly` rubric. The
 * classifier's `const` type parameter makes an inline rubric a `readonly`
 * tuple, which `Score["criteria"]` rejects. A type-level widening only:
 * at runtime it is an ordinary array, validated unchanged.
 */
export type ScoreInput = Omit<Score, "criteria"> & {
  criteria: readonly JsonValue[];
};

/** A question as a caller writes it. See `ScoreInput`. */
export type QuestionInput = Noul | Choice | ScoreInput;

/** A questions map as a caller writes it. See `ScoreInput`. */
export type QuestionsInput = Record<string, QuestionInput>;

/**
 * A questions map that has been through `parseQuestions`: every entry
 * matches `questionSchema` — cardinality rules included — and the map has
 * at least one entry. Branded so a plain, unparsed `Record<string,
 * Question>` cannot be assigned where this type is required; only
 * `parseQuestions` can produce one.
 *
 * `QS` carries the caller's own map through unchanged. Intersected with
 * zod's brand rather than inferred from `questionsMapSchema`, whose
 * `Record<string, Question>` index signature would widen every entry back
 * to the full union and undo the narrowing.
 */
export type ValidatedQuestions<QS extends QuestionsInput = QuestionsInput> =
  QS & z.core.$brand<"ValidatedQuestions">;

/**
 * A Noul answer: a bare probability, with no `confidence` and no
 * `probabilities`. For a binary question the probability IS the
 * confidence, and a value near 0.5 is the uncertainty signal.
 */
export type NoulAnswer = z.infer<typeof noulAnswerSchema>;

/**
 * Swaps selected members of `T` for those in `R`, keeping a FLAT object
 * type, so the answer types below can take a parameter and stay derived
 * from their schema. Flatness is not cosmetic: `Omit<T, "k"> & { k: V }`
 * has the same members but is not IDENTICAL to a plain object type, and
 * identity is what keeps an unparameterized `ChoiceAnswer` unchanged.
 */
type Replace<T, R> = { [K in keyof T]: K extends keyof R ? R[K] : T[K] };

/**
 * A Choice answer. `probabilities` is keyed by option label.
 *
 * `L` is the set of labels the question defined, narrowed by `AnswerFor`
 * when the map is statically known. Defaults to `string`, reproducing the
 * schema's own inference.
 */
export type ChoiceAnswer<L extends string = string> = Replace<
  z.infer<typeof choiceAnswerSchema>,
  { choice: L; probabilities: Record<L, number> }
>;

/**
 * The level keys a rubric produces: `"0" | "1" | "2"` when its length is
 * known, `string` when it is not. Strings, not numbers, because JSON keys
 * are strings. `legend[0]` still works: TypeScript accepts a numeric index
 * against `"0"`.
 */
type LevelsOf<C extends readonly JsonValue[]> = number extends C["length"]
  ? string
  : Extract<keyof C, `${number}`>;

/** The rubric echoed back level by level, when the levels are known. */
type LegendOf<C extends readonly JsonValue[]> = number extends C["length"]
  ? Record<string, JsonValue>
  : { [K in Extract<keyof C, `${number}`>]: C[K] };

/**
 * A Score answer. `legend` and `probabilities` are keyed by level index.
 *
 * `C` is the rubric the question defined. Defaults to an open-ended array,
 * whose unknown length collapses both fields back to the `Record<string,
 * ...>` the schema infers. When the length IS known, the keys narrow to
 * its indices and `legend` echoes each description.
 *
 * `score` stays `number`, deliberately: it is probability-weighted and may
 * land BETWEEN levels, so a three-level rubric can answer 1.3.
 */
export type ScoreAnswer<C extends readonly JsonValue[] = readonly JsonValue[]> =
  Replace<
    z.infer<typeof scoreAnswerSchema>,
    { legend: LegendOf<C>; probabilities: Record<LevelsOf<C>, number> }
  >;

export type Answer = z.infer<typeof answerSchema>;

/**
 * The answer a single question produces, selected by its `type`. Choice
 * and Score carry their `criteria` into the answer. Distributes over a
 * union, so `AnswerFor<Question>` is `Answer`.
 */
export type AnswerFor<Q extends QuestionInput> = Q extends { type: "noul" }
  ? NoulAnswer
  : Q extends { type: "choice"; criteria: infer C }
    ? ChoiceAnswer<Extract<keyof C, string>>
    : Q extends {
          type: "score";
          criteria: infer C extends readonly JsonValue[];
        }
      ? ScoreAnswer<C>
      : never;

/**
 * The `answers` map a given questions map produces, id by id.
 *
 * `-readonly` is load-bearing: the `const` type parameter marks every key
 * of the caller's literal `readonly`, and a mapped type would inherit it
 * and return a frozen `answers`. The input being a literal says nothing
 * about a server response, so the modifier is stripped.
 */
export type AnswersFor<QS extends QuestionsInput> = {
  -readonly [K in keyof QS]: AnswerFor<QS[K]>;
};

/**
 * The answers of one variant, keyed by the ids of the questions that asked
 * for it: the type-level form of the `nouls`/`choices`/`scores`
 * accessors.
 *
 * `[Extract<...>] extends [never]` rather than `QS[K] extends { type: T }`:
 * an indexed access does not distribute, so against a map whose values are
 * the whole union the direct form answers `false` for every variant and
 * drops every id. The tuple also stops the `never` distributing.
 */
type AnswersOfType<QS extends QuestionsInput, T extends Question["type"]> = {
  -readonly [
    K in keyof QS as [Extract<QS[K], { type: T }>] extends [never] ? never : K
  ]: AnswerFor<Extract<QS[K], { type: T }>>;
};

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
export type ParsedResponse<QS extends QuestionsInput = QuestionsInput> = Omit<
  z.infer<typeof classificationResponseSchema>,
  "answers"
> & {
  /** One entry per question, typed by that question's variant. */
  answers: AnswersFor<QS>;
  /** From the `x-typesafe-request-id` response header, when present. */
  requestId?: string;
};

/**
 * A parsed response, typed against the questions that produced it.
 *
 * `QS` defaults to its own constraint, collapsing everything below back to
 * what it meant before the parameter existed. The default is the
 * constraint and not the narrower `Record<string, Question>` on purpose: a
 * Score written inline is a `readonly` tuple, not assignable to
 * `Question`, so a narrower default would make a narrowed response
 * unassignable to a bare one.
 *
 * The runtime guarantee is unchanged: `classificationResponseSchema`
 * validates every answer against its own `type` discriminant.
 */
export type ClassificationResponse<QS extends QuestionsInput = QuestionsInput> =
  ParsedResponse<QS> & {
    /** Noul answers only, keyed by question id. Non-enumerable. */
    readonly nouls: AnswersOfType<QS, "noul">;
    /** Choice answers only, keyed by question id. Non-enumerable. */
    readonly choices: AnswersOfType<QS, "choice">;
    /** Score answers only, keyed by question id. Non-enumerable. */
    readonly scores: AnswersOfType<QS, "score">;
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
export function withAnswerAccessors<QS extends QuestionsInput = QuestionsInput>(
  response: ParsedResponse<QS>
): ClassificationResponse<QS> {
  // The body works on the erased view: partitioning is by the runtime
  // `type` discriminant, which is what `AnswersOfType` mirrors statically.
  const erased = response as ParsedResponse;
  const define = <T extends Answer>(name: string, type: T["type"]) => {
    Object.defineProperty(erased, name, {
      enumerable: false,
      configurable: true,
      get(): Record<string, T> {
        const out: Record<string, T> = {};
        for (const [id, answer] of Object.entries(erased.answers)) {
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
  return response as ClassificationResponse<QS>;
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
export function serializeQuestion(
  question: QuestionInput
): Record<string, unknown> {
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
 *
 * Generic so the caller's literal map survives the parse: what goes in is
 * what comes back, branded.
 */
export function parseQuestions<QS extends QuestionsInput>(
  questions: QS
): ValidatedQuestions<QS> {
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
  // `map.data` IS `questions`: `questionsMapSchema` is a `z.custom` with
  // only a refinement, so it validates in place and rebuilds nothing. The
  // assertion re-attaches the element types its index signature erases.
  return map.data as ValidatedQuestions<QS>;
}
