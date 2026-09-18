import { describe, expect, test } from "vitest";

import {
  classificationResponseSchema,
  serializeQuestion,
  validateQuestions,
  type Choice,
  type Noul,
  type Question,
  type Score,
} from "../types.js";

describe("serializeQuestion", () => {
  test("omits an absent noul criteria but keeps explicit nulls in criteria", () => {
    const noul: Noul = { type: "noul", instructions: "urgent?" };
    expect(serializeQuestion(noul)).toEqual({
      type: "noul",
      instructions: "urgent?",
    });
    expect("criteria" in serializeQuestion(noul)).toBe(false);

    const choice: Choice = {
      type: "choice",
      criteria: { billing: "Payment issues", technical: null },
      instructions: "Which team?",
    };
    const wire = serializeQuestion(choice);
    expect(wire).toEqual({
      type: "choice",
      criteria: { billing: "Payment issues", technical: null },
      instructions: "Which team?",
    });
    expect(JSON.stringify(wire)).toContain('"technical":null');
  });

  test("emits fields in the declaration order the API expects", () => {
    const noul: Noul = {
      type: "noul",
      instructions: "x",
      criteria: { true: "yes", false: "no" },
    };
    expect(Object.keys(serializeQuestion(noul))).toEqual([
      "type",
      "instructions",
      "criteria",
    ]);

    const score: Score = {
      type: "score",
      criteria: ["a", "b"],
      instructions: "y",
    };
    expect(Object.keys(serializeQuestion(score))).toEqual([
      "type",
      "criteria",
      "instructions",
    ]);
  });

  test("drops an undefined nested criteria field but keeps a null one", () => {
    const noul: Noul = {
      type: "noul",
      instructions: "x",
      criteria: { true: "yes" },
    };
    expect(serializeQuestion(noul)).toEqual({
      type: "noul",
      instructions: "x",
      criteria: { true: "yes" },
    });
  });
});

describe("validateQuestions", () => {
  test("rejects an empty questions map", () => {
    expect(() => validateQuestions({})).toThrow(/at least one question/i);
  });

  test("rejects a score with fewer than two levels", () => {
    expect(() =>
      validateQuestions({ q: { type: "score", criteria: ["only"] } })
    ).toThrow(/at least 2/i);
  });

  test("rejects a choice with no options", () => {
    expect(() =>
      validateQuestions({ q: { type: "choice", criteria: {} } })
    ).toThrow(/at least 1/i);
  });

  test("rejects a noul with neither instructions nor criteria", () => {
    expect(() => validateQuestions({ q: { type: "noul" } })).toThrow(
      /criteria or instructions/i
    );
  });

  test("accepts a noul with only criteria, and choice/score without instructions", () => {
    expect(() =>
      validateQuestions({
        a: { type: "noul", criteria: { true: "yes" } },
        b: { type: "choice", criteria: { x: null } },
        c: { type: "score", criteria: ["low", "high"] },
      })
    ).not.toThrow();
  });

  test("rejects a noul whose criteria is not an object, naming the question", () => {
    const questions = {
      billing: { type: "noul", criteria: "MARKER_NOUL_CRITERIA_VALUE" },
    } as unknown as Record<string, Question>;
    let thrown: unknown;
    try {
      validateQuestions(questions);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    const message = (thrown as Error).message;
    expect(message).toContain('"billing"');
  });

  test("rejects a choice whose criteria is an array instead of a record, naming the question", () => {
    const questions = {
      billing: {
        type: "choice",
        criteria: ["MARKER_CHOICE_CRITERIA_VALUE"],
      },
    } as unknown as Record<string, Question>;
    let thrown: unknown;
    try {
      validateQuestions(questions);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    const message = (thrown as Error).message;
    expect(message).toContain('"billing"');
  });

  test("rejects a score whose criteria is a string instead of an array, naming the question", () => {
    const questions = {
      billing: { type: "score", criteria: "MARKER_SCORE_CRITERIA_VALUE" },
    } as unknown as Record<string, Question>;
    let thrown: unknown;
    try {
      validateQuestions(questions);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    const message = (thrown as Error).message;
    expect(message).toContain('"billing"');
  });

  test("a cyclic criteria fails with a named error, not a stack overflow", () => {
    // A YAML anchor (`&a { self: *a }`) materializes a genuine cycle, and
    // this function's whole contract is turning parsed-config input into a
    // clean named error. zod walks recursively, so without a guard this is
    // a bare RangeError. The marker pins that the offending key never
    // reaches the message.
    const MARKER = "MARKER_CYCLIC_CRITERIA_KEY";
    const cyclic: Record<string, unknown> = { billing: "Payment issues" };
    cyclic[MARKER] = cyclic;
    const questions = {
      department: { type: "choice", criteria: cyclic },
    } as unknown as Record<string, Question>;

    let thrown: unknown;
    try {
      validateQuestions(questions);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).not.toBeInstanceOf(RangeError);
    const message = (thrown as Error).message;
    expect(message).toContain('"department"');
    expect(message).toMatch(/circular reference/);
  });

  test("a cyclic instructions value also fails with a named error", () => {
    const MARKER = "MARKER_CYCLIC_INSTRUCTIONS_KEY";
    const cyclic: Record<string, unknown> = { text: "hi" };
    cyclic[MARKER] = cyclic;
    const questions = {
      urgent: { type: "noul", instructions: cyclic },
    } as unknown as Record<string, Question>;

    let thrown: unknown;
    try {
      validateQuestions(questions);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).not.toBeInstanceOf(RangeError);
    expect((thrown as Error).message).toContain('"urgent"');
  });

  test("reports the question id, field path, and zod message on a malformed element", () => {
    const questions = {
      billing: { type: "score", criteria: [() => "oops", "b"] },
    } as unknown as Record<string, Question>;
    expect(() => validateQuestions(questions)).toThrow(
      'Invalid TypeSafe question "billing": criteria.0: Invalid input'
    );
  });

  test("joins a Choice question's caller-chosen criteria label verbatim (LOW risk: a developer-authored identifier)", () => {
    // criteria is `Record<string, JsonValue>` for Choice: the key is a
    // label the caller chose (e.g. an option name). Per this project's
    // risk tiering that's LOW risk — a developer-authored identifier,
    // not per-request end-user content — so the zod issue path is no longer
    // redacts it; it's joined into the path like any other segment.
    const LABEL = "customer_named_alice_smith";
    const questions = {
      billing: {
        type: "choice",
        criteria: { [LABEL]: () => "not json-able" },
      },
    } as unknown as Record<string, Question>;
    expect(() => validateQuestions(questions)).toThrow(
      `Invalid TypeSafe question "billing": criteria.${LABEL}: Invalid input`
    );
  });

  test("still pins a Score question's array index in the path", () => {
    const questions = {
      frustration: { type: "score", criteria: ["calm", () => "bad"] },
    } as unknown as Record<string, Question>;
    expect(() => validateQuestions(questions)).toThrow(
      'Invalid TypeSafe question "frustration": criteria.1: Invalid input'
    );
  });

  test("never echoes an unrecognized question type's value, only that the field is invalid", () => {
    const MARKER = "MARKER_UNRECOGNIZED_TYPE_VALUE";
    const questions = {
      billing: { type: MARKER },
    } as unknown as Record<string, Question>;
    let thrown: unknown;
    try {
      validateQuestions(questions);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    const message = (thrown as Error).message;
    expect(message).toContain('Invalid TypeSafe question "billing": type:');
  });

  test("still accepts a well-formed question of each type", () => {
    expect(() =>
      validateQuestions({
        urgent: { type: "noul", instructions: "Is this urgent?" },
        department: {
          type: "choice",
          criteria: { billing: "Billing", technical: "Technical" },
        },
        frustration: {
          type: "score",
          criteria: ["calm", "annoyed", "furious"],
        },
      })
    ).not.toThrow();
  });
});

describe("classificationResponseSchema", () => {
  test("parses all three answer shapes with string-keyed score maps", () => {
    const parsed = classificationResponseSchema.parse({
      model: "jev-1.13.0",
      answers: {
        department: {
          type: "choice",
          choice: "technical",
          probabilities: { billing: 0.1, technical: 0.9 },
          confidence: 0.8,
        },
        urgent: { type: "noul", noul: 0.95 },
        frustration: {
          type: "score",
          score: 1.25,
          legend: { "0": "calm", "1": "frustrated", "2": "angry" },
          probabilities: { "0": 0.1, "1": 0.55, "2": 0.35 },
          confidence: 0.7,
        },
      },
      usage: { input_tokens: 42, output_tokens: 12 },
    });

    expect(parsed.model).toBe("jev-1.13.0");
    expect(parsed.usage).toEqual({ inputTokens: 42, outputTokens: 12 });

    const score = parsed.answers.frustration;
    if (score.type !== "score") throw new Error("expected score");
    expect(score.legend[0]).toBe("calm");
    expect(score.probabilities[1]).toBe(0.55);
    expect(Object.keys(score.legend)).toEqual(["0", "1", "2"]);

    const noul = parsed.answers.urgent;
    if (noul.type !== "noul") throw new Error("expected noul");
    expect(noul).toEqual({ type: "noul", noul: 0.95 });
    expect("confidence" in noul).toBe(false);
  });

  test("defaults usage to an empty object when absent", () => {
    const parsed = classificationResponseSchema.parse({
      model: "jev-1.13.0",
      answers: { a: { type: "noul", noul: 0.5 } },
    });
    expect(parsed.usage).toEqual({});
  });

  test("rejects a response whose answers are not an object", () => {
    expect(() =>
      classificationResponseSchema.parse({ model: "jev", answers: [] })
    ).toThrow();
  });
});
