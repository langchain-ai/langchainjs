import { describe, expect, test } from "vitest";

import type { ClassificationResponse } from "../types.js";
import { withAnswerAccessors } from "../types.js";
import { parseResponse } from "../utils/client.js";

const MIXED_ANSWERS = {
  department: {
    type: "choice" as const,
    choice: "technical",
    probabilities: { billing: 0.1, technical: 0.9 },
    confidence: 0.8,
  },
  urgent: { type: "noul" as const, noul: 0.95 },
  frustration: {
    type: "score" as const,
    score: 1.25,
    legend: { "0": "calm", "1": "frustrated", "2": "angry" },
    probabilities: { "0": 0.1, "1": 0.55, "2": 0.35 },
    confidence: 0.7,
  },
};

function mixedResponse(): ClassificationResponse {
  return withAnswerAccessors({
    model: "jev-1.13.0",
    answers: { ...MIXED_ANSWERS },
    usage: {},
  });
}

describe("withAnswerAccessors", () => {
  test("partitions a mixed response by variant, preserving question ids", () => {
    const response = mixedResponse();
    expect(Object.keys(response.nouls)).toEqual(["urgent"]);
    expect(Object.keys(response.choices)).toEqual(["department"]);
    expect(Object.keys(response.scores)).toEqual(["frustration"]);
    expect(response.nouls.urgent).toEqual(MIXED_ANSWERS.urgent);
    expect(response.choices.department).toEqual(MIXED_ANSWERS.department);
    expect(response.scores.frustration).toEqual(MIXED_ANSWERS.frustration);
  });

  test("is an empty object when no answer of that variant is present", () => {
    const response = withAnswerAccessors({
      model: "jev-1.13.0",
      answers: { urgent: MIXED_ANSWERS.urgent },
      usage: {},
    });
    expect(response.choices).toEqual({});
    expect(response.scores).toEqual({});
  });

  test("survive parseResponse", async () => {
    const response = new Response(
      JSON.stringify({
        model: "jev-1.13.0",
        answers: MIXED_ANSWERS,
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
    const parsed = await parseResponse(response, "POST /v1/systemone");
    expect(Object.keys(parsed.nouls)).toEqual(["urgent"]);
    expect(Object.keys(parsed.choices)).toEqual(["department"]);
    expect(Object.keys(parsed.scores)).toEqual(["frustration"]);
  });

  test("do not appear in JSON.stringify or Object.keys", () => {
    const response = mixedResponse();
    expect(Object.keys(response)).toEqual(
      expect.not.arrayContaining(["nouls", "choices", "scores"])
    );
    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain("nouls");
    expect(serialized).not.toContain("choices");
    expect(serialized).not.toContain("scores");
  });

  test("reflects answers at access time, not a parse-time snapshot", () => {
    const response = mixedResponse();
    expect(Object.keys(response.nouls)).toEqual(["urgent"]);
    response.answers.another = { type: "noul", noul: 0.1 };
    expect(Object.keys(response.nouls).sort()).toEqual(["another", "urgent"]);
  });
});
