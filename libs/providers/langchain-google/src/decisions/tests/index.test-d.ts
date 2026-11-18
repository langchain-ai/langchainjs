import { describe, expectTypeOf, test } from "vitest";
import type {
  ChoiceAnswer,
  NoulAnswer,
  ScoreAnswer,
} from "@langchain/core/decisions";
import {
  GoogleClassifier,
  type GoogleClassifierParams,
  type GoogleDecisions,
} from "../../index.js";
import {
  GoogleClassifier as GoogleClassifierNode,
  type GoogleClassifierParams as GoogleClassifierNodeParams,
  type GoogleDecisions as GoogleDecisionsNode,
} from "../../node.js";
import type { Gemini } from "../../chat_models/types.js";

describe("GoogleClassifier type narrowing", () => {
  test("narrows nouls, choices (with literal option keys), and scores on invoke()", async () => {
    const classifier = new GoogleClassifier("gemini-decision-1", {
      apiKey: "test-key",
    });

    if (false as boolean) {
      // @ts-expect-error model is required when constructing GoogleClassifier
      new GoogleClassifier({ apiKey: "test-key" });
      // @ts-expect-error model or params object is required
      new GoogleClassifier();

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

      const contentBlocksResponse = await classifier.invoke({
        state: [
          { type: "text", text: "Inspect this return image:" },
          { type: "image", mimeType: "image/png", data: "iVBOR..." },
        ],
        questions: {
          is_damaged: {
            type: "noul",
            instructions: "Is the item damaged?",
          },
        },
      });
      expectTypeOf(
        contentBlocksResponse.nouls.is_damaged
      ).toEqualTypeOf<NoulAnswer>();
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

  test("exports narrowed DecisionInputContent and text-only DecisionInstructionContent on GoogleDecisions", () => {
    expectTypeOf<GoogleDecisions.DecisionInputContent>().toEqualTypeOf<
      | Gemini.Interactions.AudioContent
      | Gemini.Interactions.DocumentContent
      | Gemini.Interactions.ImageContent
      | Gemini.Interactions.TextContent
      | Gemini.Interactions.VideoContent
    >();
    expectTypeOf<GoogleDecisions.DecisionInstructionContent>().toEqualTypeOf<Gemini.Interactions.TextContent>();
    expectTypeOf<GoogleDecisionsNode.DecisionInstructionContent>().toEqualTypeOf<Gemini.Interactions.TextContent>();
    expectTypeOf<
      GoogleDecisions.CreateDecisionRequest["input"]
    >().toEqualTypeOf<
      | GoogleDecisions.DecisionInputContent
      | Array<GoogleDecisions.DecisionInputContent>
      | string
    >();
    expectTypeOf<
      GoogleDecisions.ChoiceQuestion["instructions"]
    >().toEqualTypeOf<
      | GoogleDecisions.DecisionInstructionContent
      | Array<GoogleDecisions.DecisionInstructionContent>
      | string
    >();
  });
});
