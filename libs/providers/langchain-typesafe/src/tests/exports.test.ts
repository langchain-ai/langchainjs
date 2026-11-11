import { expect, expectTypeOf, test } from "vitest";

import type {
  ClassificationResponse,
  ClassifierRequest,
  ClassifierResponse,
  Question,
} from "../index.js";

import * as pkg from "../index.js";

test("exports generic request and response types with compatible defaults", () => {
  type Questions = {
    urgent: { type: "noul"; instructions: "Urgent?" };
    department: {
      type: "choice";
      criteria: { billing: null; technical: null };
    };
    frustration: { type: "score"; criteria: ["calm", "angry"] };
  };
  expectTypeOf<ClassifierRequest["questions"]>().toEqualTypeOf<
    Record<string, Question>
  >();
  expectTypeOf<
    ClassifierRequest<Questions>["questions"]
  >().toEqualTypeOf<Questions>();
  expectTypeOf<ClassifierResponse>().toEqualTypeOf<ClassificationResponse>();
  expectTypeOf<
    ClassifierResponse<Questions>["answers"]["department"]["choice"]
  >().toEqualTypeOf<"billing" | "technical">();
  expectTypeOf<
    keyof ClassifierResponse<Questions>["nouls"]
  >().toEqualTypeOf<"urgent">();
  expectTypeOf<
    keyof ClassifierResponse<Questions>["choices"]
  >().toEqualTypeOf<"department">();
  expectTypeOf<
    keyof ClassifierResponse<Questions>["scores"]
  >().toEqualTypeOf<"frustration">();
});

test("exports the documented public surface", () => {
  expect(Object.keys(pkg).sort()).toEqual(
    [
      "TypeSafeAPIError",
      "TypeSafeAuthenticationError",
      "TypeSafeClassifier",
      "TypeSafeError",
      "TypeSafeRateLimitError",
    ].sort()
  );
});
