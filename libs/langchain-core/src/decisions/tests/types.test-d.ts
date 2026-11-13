import { describe, expectTypeOf, it } from "vitest";

import {
  BaseDecisionModel,
  type Answer,
  type BoxAnswer,
  type ChoiceAnswer,
  type ClassifierResponse,
  type NoulAnswer,
  type Question,
  type ScoreAnswer,
} from "../index.js";

declare const model: BaseDecisionModel;

describe("BaseDecisionModel.invoke", () => {
  it("types answers from inline questions", async () => {
    const response = await model.invoke({
      state: "hello",
      questions: {
        urgent: { type: "noul", instructions: "Is this urgent?" },
        dept: {
          type: "choice",
          instructions: "Which team?",
          criteria: { billing: "Payments.", technical: null },
        },
        frustration: {
          type: "score",
          instructions: "How frustrated?",
          criteria: ["Calm.", "Angry."],
        },
        logo: { type: "box", instructions: "Find the logo." },
      },
    });

    expectTypeOf(response.answers.urgent).toEqualTypeOf<NoulAnswer>();
    expectTypeOf(response.answers.dept.choice).toEqualTypeOf<
      "billing" | "technical"
    >();
    expectTypeOf(response.answers.dept.probabilities).toEqualTypeOf<
      Record<"billing" | "technical", number>
    >();
    expectTypeOf(response.answers.frustration).toEqualTypeOf<ScoreAnswer>();
    expectTypeOf(response.answers.logo).toEqualTypeOf<BoxAnswer>();
  });

  it("limits each view to its own question IDs", async () => {
    const response = await model.invoke({
      state: "hello",
      questions: {
        urgent: { type: "noul", instructions: "Is this urgent?" },
        dept: {
          type: "choice",
          instructions: "Which team?",
          criteria: { billing: "Payments." },
        },
      },
    });

    expectTypeOf(response.nouls).toEqualTypeOf<{ urgent: NoulAnswer }>();
    expectTypeOf(response.choices).toEqualTypeOf<{
      dept: ChoiceAnswer<"billing">;
    }>();
    expectTypeOf(response.scores).toEqualTypeOf<{}>();
    expectTypeOf(response.boxes).toEqualTypeOf<{}>();
  });

  it("rejects unknown question IDs", async () => {
    const response = await model.invoke({
      state: "hello",
      questions: { urgent: { type: "noul", instructions: "Urgent?" } },
    });

    // @ts-expect-error not a question ID
    expectTypeOf(response.answers.missing).toBeUnknown();
    // @ts-expect-error not a choice question
    expectTypeOf(response.choices.urgent).toBeUnknown();
  });

  it("keeps the untyped shape for a broad questions map", async () => {
    const questions: Record<string, Question> = {};
    const response = await model.invoke({ state: "hello", questions });

    expectTypeOf(response).toEqualTypeOf<ClassifierResponse>();
    expectTypeOf(response.answers).toEqualTypeOf<Record<string, Answer>>();
    expectTypeOf(response.nouls).toEqualTypeOf<Record<string, NoulAnswer>>();
    expectTypeOf(response.choices).toEqualTypeOf<
      Record<string, ChoiceAnswer>
    >();
  });
});
