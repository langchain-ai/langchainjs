import { describe, expect, test } from "vitest";

import {
  parseClassifierResponse,
  parseQuestions,
  type Question,
} from "../index.js";

const asQuestion = (value: unknown) => value as Question;

describe("parseQuestions", () => {
  test.each([
    { type: "noul" },
    { type: "choice", criteria: { a: null } },
    { type: "score", criteria: ["low", "high"] },
    { type: "box" },
  ])("$type requires instructions", (question) => {
    expect(() => parseQuestions({ q: asQuestion(question) })).toThrow(
      'Invalid question "q": instructions'
    );
  });

  test("noul criteria reject unknown keys without naming them", () => {
    expect(() =>
      parseQuestions({
        q: asQuestion({
          type: "noul",
          instructions: "Is this urgent?",
          criteria: { maybe: "Unsure." },
        }),
      })
    ).toThrow('Invalid question "q": criteria: Unrecognized key.');
  });

  test.each([
    { type: "choice", criteria: {} },
    { type: "score", criteria: [] },
    { type: "score", criteria: ["only level"] },
    { type: "choice", criteria: { a: null }, extra: 1 },
    { type: "unknown" },
  ])("rejects invalid question %j", (question) => {
    expect(() =>
      parseQuestions({
        q: asQuestion({ instructions: "Classify.", ...question }),
      })
    ).toThrow('Invalid question "q"');
  });

  test("rejects an empty or array questions map", () => {
    expect(() => parseQuestions({})).toThrow("at least one question");
    expect(() =>
      parseQuestions([
        { type: "box", instructions: "Find it." },
      ] as unknown as Record<string, Question>)
    ).toThrow("at least one question");
  });

  test("accepts null noul criteria", () => {
    const questions = {
      q: asQuestion({ type: "noul", instructions: "Urgent?", criteria: null }),
    };

    expect(parseQuestions(questions)).toBe(questions);
  });

  test("accepts structured content and any JSON criteria", () => {
    const questions: Record<string, Question> = {
      route: {
        type: "choice",
        instructions: { task: "Route the request." },
        criteria: { billing: { examples: ["refund"] }, other: null },
      },
      urgent: {
        type: "noul",
        instructions: "Is this urgent?",
        criteria: { true: 1, false: 0 },
      },
      rate: {
        type: "score",
        instructions: "Rate it.",
        criteria: [0.0, { label: "high" }],
      },
      find: { type: "box", instructions: "Find the dog." },
    };

    expect(parseQuestions(questions)).toBe(questions);
  });

  test("keeps a choice label named __proto__", () => {
    const criteria = JSON.parse('{"__proto__": "Odd label.", "other": null}');
    const questions = {
      q: asQuestion({ type: "choice", instructions: "Pick.", criteria }),
    };

    const parsed = parseQuestions(questions);

    expect(Object.keys((parsed.q as { criteria: object }).criteria)).toEqual([
      "__proto__",
      "other",
    ]);
  });
});

describe("parseClassifierResponse", () => {
  test("views filter answers by type and are not enumerable", () => {
    const response = parseClassifierResponse({
      model: "fake-model",
      answers: {
        urgent: { type: "noul", noul: 0.9 },
        dept: {
          type: "choice",
          choice: "billing",
          probabilities: { billing: 1.0 },
          confidence: 1.0,
        },
        severity: {
          type: "score",
          score: 0.2,
          legend: { "0": "low", "1": { label: "high" } },
          probabilities: { "0": 0.8, "1": 0.2 },
          confidence: 0.5,
        },
        dog: {
          type: "box",
          box: { top: 0.1, bottom: 0.9, left: 0.2, right: 0.8 },
          confidence: null,
        },
      },
    });

    expect(Object.keys(response.nouls)).toEqual(["urgent"]);
    expect(Object.keys(response.choices)).toEqual(["dept"]);
    expect(response.scores.severity.legend[0]).toBe("low");
    expect(response.boxes.dog).toEqual({
      type: "box",
      box: { top: 0.1, bottom: 0.9, left: 0.2, right: 0.8 },
    });
    expect(Object.keys(response)).toEqual(["model", "answers"]);
  });

  test("keeps answers and labels named __proto__", () => {
    const response = parseClassifierResponse(
      JSON.parse(
        '{"model":"m","answers":{"__proto__":{"type":"choice","choice":"__proto__","probabilities":{"__proto__":0.7,"a":0.3},"confidence":0.4}}}'
      )
    );

    expect(Object.keys(response.answers)).toEqual(["__proto__"]);
    expect(Object.keys(response.choices)).toEqual(["__proto__"]);
    expect(
      Object.keys(
        (response.answers.__proto__ as { probabilities: object }).probabilities
      )
    ).toEqual(["__proto__", "a"]);
  });

  test("rejects unknown answer types", () => {
    expect(() =>
      parseClassifierResponse({
        model: "fake-model",
        answers: {
          urgent: { type: "noul", noul: 0.9 },
          future: { type: "UNKNOWN" },
        },
      })
    ).toThrow("Invalid decision model response: answers.future");
  });

  test("rejects out-of-range probabilities", () => {
    expect(() =>
      parseClassifierResponse({
        model: "fake-model",
        answers: { urgent: { type: "noul", noul: 1.5 } },
      })
    ).toThrow("answers.urgent.noul");
  });

  test("ignores unknown fields", () => {
    const response = parseClassifierResponse({
      model: "fake-model",
      answers: {},
      prompt_feedback: null,
    } as Parameters<typeof parseClassifierResponse>[0]);

    expect(response).toEqual({ model: "fake-model", answers: {} });
    expect(response.usage_metadata).toBeUndefined();
  });

  test("completes partial usage", () => {
    const response = parseClassifierResponse({
      model: "fake-model",
      answers: {},
      usage_metadata: { input_tokens: 12 },
    });

    expect(response.usage_metadata).toEqual({
      input_tokens: 12,
      output_tokens: 0,
      total_tokens: 12,
    });
  });

  test("treats null token counts as zero", () => {
    const response = parseClassifierResponse({
      model: "fake-model",
      answers: {},
      usage_metadata: JSON.parse(
        '{"input_tokens":5,"output_tokens":null,"total_tokens":null}'
      ),
    });

    expect(response.usage_metadata).toEqual({
      input_tokens: 5,
      output_tokens: 0,
      total_tokens: 5,
    });
  });

  test("keeps usage token details", () => {
    const response = parseClassifierResponse({
      model: "fake-model",
      answers: {},
      usage_metadata: {
        input_tokens: 12,
        output_tokens: 3,
        input_token_details: { cache_read: 8 },
      },
      requestId: "req_123",
    });

    expect(response.usage_metadata).toEqual({
      input_tokens: 12,
      output_tokens: 3,
      total_tokens: 15,
      input_token_details: { cache_read: 8 },
    });
    expect(response.requestId).toBe("req_123");
  });
});
