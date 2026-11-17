import { describe, expect, test } from "vitest";

import {
  serializeQuestion,
  type Box,
  type Choice,
  type Noul,
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

  test("sends a box question's type and instructions", () => {
    const box: Box = { type: "box", instructions: "The dog." };
    expect(serializeQuestion(box)).toEqual({
      type: "box",
      instructions: "The dog.",
    });
  });

  test("omits null noul criteria", () => {
    const noul: Noul = { type: "noul", instructions: "x", criteria: null };
    expect(serializeQuestion(noul)).toEqual({
      type: "noul",
      instructions: "x",
    });
  });
});
