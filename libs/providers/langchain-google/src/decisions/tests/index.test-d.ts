import { describe, expectTypeOf, test } from "vitest";
import type {
  ChoiceAnswer,
  NoulAnswer,
  ScoreAnswer,
} from "@langchain/core/decisions";
import { GoogleClassifier, type GoogleClassifierParams } from "../../index.js";
import {
  GoogleClassifier as GoogleClassifierNode,
  type GoogleClassifierParams as GoogleClassifierNodeParams,
} from "../../node.js";

describe("GoogleClassifier type narrowing", () => {
  test("narrows nouls, choices (with literal option keys), and scores on invoke()", async () => {
    const classifier = new GoogleClassifier({ apiKey: "test-key" });

    if (false as boolean) {
      const response = await classifier.invoke({
        state: "Order #99 arrived shattered.",
        questions: {
          is_damaged: {
            type: "noul",
            instructions: "Did the item arrive damaged?",
          },
          department: {
            type: "choice",
            instructions: "Which team should handle this ticket?",
            criteria: {
              shipping: "Delivery or transit damage.",
              billing: "Payment or invoice questions.",
              sales: "New product inquiries.",
            },
          },
          severity: {
            type: "score",
            instructions: "How urgent is this issue?",
            criteria: [
              "Low urgency routine question.",
              "Moderate customer impact.",
              "Immediate replacement required.",
            ],
          },
        },
      });

      expectTypeOf(response.nouls.is_damaged).toEqualTypeOf<NoulAnswer>();
      expectTypeOf(response.choices.department).toEqualTypeOf<
        ChoiceAnswer<"shipping" | "billing" | "sales">
      >();
      expectTypeOf(response.choices.department.choice).toEqualTypeOf<
        "shipping" | "billing" | "sales"
      >();
      expectTypeOf(response.scores.severity).toEqualTypeOf<ScoreAnswer>();
      expectTypeOf(response.answers.is_damaged).toEqualTypeOf<NoulAnswer>();
    }
  });

  test("distinguishes web vs node GoogleClassifierParams for googleAuthOptions", () => {
    expectTypeOf<
      GoogleClassifierParams["googleAuthOptions"]
    >().toEqualTypeOf<undefined>();
    expectTypeOf<
      NonNullable<GoogleClassifierNodeParams["googleAuthOptions"]>
    >().toBeObject();

    const nodeClassifier = new GoogleClassifierNode("gemini-decision-1", {
      vertexai: true,
      googleAuthOptions: {
        projectId: "my-gcp-project",
      },
    });
    expectTypeOf(nodeClassifier).toEqualTypeOf<GoogleClassifierNode>();
  });
});
