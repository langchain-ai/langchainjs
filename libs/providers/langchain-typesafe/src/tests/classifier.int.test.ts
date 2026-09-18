import { describe, expect, test } from "vitest";

import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";

import { TypeSafeClassifier } from "../classifier.js";
import type { Question } from "../types.js";

const QUESTIONS: Record<string, Question> = {
  department: {
    type: "choice",
    criteria: { billing: "Payment issues", technical: "Technical issues" },
    instructions: "Which team should handle this?",
  },
  urgent: {
    type: "noul",
    instructions: "Does this need an immediate response?",
  },
  frustration: {
    type: "score",
    criteria: ["calm", "frustrated", "angry"],
    instructions: "How frustrated does the customer sound?",
  },
};

describe.skipIf(!process.env.TYPESAFE_API_KEY)(
  "TypeSafeClassifier against the live API",
  () => {
    test("classifies all three question types from a single invoke", async () => {
      const classifier = new TypeSafeClassifier({
        questions: QUESTIONS,
        apiKey: process.env.TYPESAFE_API_KEY,
        baseUrl: process.env.TYPESAFE_BASE_URL,
      });

      const result = await classifier.invoke(
        "My payments keep failing and I've been waiting for hours. This is infuriating."
      );

      // The live API returns the versioned model id, never the alias we sent.
      expect(result.model).toMatch(/^jev-/);
      expect(result.requestId).toBeTruthy();
      expect(typeof result.usage.inputTokens).toBe("number");

      const department = result.answers.department;
      if (department.type !== "choice") {
        throw new Error("expected a choice answer");
      }
      const criteriaKeys = Object.keys(
        (QUESTIONS.department as { criteria: Record<string, unknown> }).criteria
      ).sort();
      expect(criteriaKeys).toContain(department.choice);
      // Never assume probability key order — the live API shuffles it.
      expect(Object.keys(department.probabilities).sort()).toEqual(
        criteriaKeys
      );

      const urgent = result.answers.urgent;
      if (urgent.type !== "noul") {
        throw new Error("expected a noul answer");
      }
      expect(urgent.noul).toBeGreaterThanOrEqual(0);
      expect(urgent.noul).toBeLessThanOrEqual(1);
      expect(urgent).not.toHaveProperty("confidence");
      expect(urgent).not.toHaveProperty("probabilities");

      const frustration = result.answers.frustration;
      if (frustration.type !== "score") {
        throw new Error("expected a score answer");
      }
      expect(Object.keys(frustration.legend).sort()).toEqual(["0", "1", "2"]);
      expect(frustration.legend[0]).toBe("calm");
    });

    test("a tool call's arguments survive rendering and drive the answer", async () => {
      // This is the pin for why `renderMessage` keeps tool arguments. The
      // only place the refund amount appears is inside the tool call's
      // args, so if the rendering drops them the model cannot answer — and
      // critically it does not error, it answers confidently WRONG.
      //
      // Deliberately NOT pinning exact probabilities. The degraded number
      // is a function of how much of the call survives the rendering (two
      // independent runs measured 0.13 and 0.35 for different degraded
      // renderings), so an exact pin would encode one particular rendering
      // and break the moment anyone adjusts it. The RELATIONSHIP is the
      // invariant worth defending.
      const classifier = new TypeSafeClassifier({
        questions: {
          over_100: {
            type: "noul",
            instructions: "Was the refund issued for more than 100 dollars?",
          },
        },
        apiKey: process.env.TYPESAFE_API_KEY,
        baseUrl: process.env.TYPESAFE_BASE_URL,
      });

      const conversation = [
        new HumanMessage("I want my money back for the broken laptop stand."),
        new AIMessage({
          content: "",
          tool_calls: [
            {
              name: "issue_refund",
              args: { amount: 250, currency: "USD" },
              id: "call_1",
            },
          ],
        }),
        new ToolMessage({ content: "Refund issued.", tool_call_id: "call_1" }),
      ];

      const withArgs = await classifier.invoke(conversation);
      expect(withArgs.answers.over_100.type).toBe("noul");
      const withArgsProb = (withArgs.answers.over_100 as { noul: number }).noul;

      // Control: the same conversation with the arguments stripped out.
      const withoutArgs = await classifier.invoke([
        "user: I want my money back for the broken laptop stand.",
        "assistant: [called issue_refund]",
        "tool: Refund issued.",
      ]);
      const withoutArgsProb = (withoutArgs.answers.over_100 as { noul: number })
        .noul;

      expect(withArgsProb).toBeGreaterThan(0.9);
      expect(withoutArgsProb).toBeLessThan(0.5);
    });

    test("retries a 500 and stamps the retry-count header on the second attempt", async () => {
      // The retry path is unit-tested with mocks, but the header is only
      // worth sending if the real API accepts a request carrying it. One
      // injected 500, then the genuine endpoint.
      const realFetch = globalThis.fetch;
      const retryCounts: (string | null)[] = [];
      const classifier = new TypeSafeClassifier({
        questions: QUESTIONS,
        apiKey: process.env.TYPESAFE_API_KEY,
        baseUrl: process.env.TYPESAFE_BASE_URL,
        maxRetries: 2,
        fetch: async (input, init) => {
          retryCounts.push(
            new Headers(init?.headers).get("x-typesafe-retry-count")
          );
          if (retryCounts.length === 1) {
            return new Response(JSON.stringify({ detail: "transient" }), {
              status: 500,
              headers: { "content-type": "application/json" },
            });
          }
          return realFetch(input, init);
        },
      });

      const result = await classifier.invoke(
        "My payments keep failing and nobody has replied."
      );

      expect(result.model).toMatch(/^jev-/);
      // Omitted on the first attempt, present on the retry.
      expect(retryCounts).toEqual([null, "1"]);
    });

    test("accepts structured, non-string instructions", async () => {
      // `QuestionContent` allows an object or array, which the compact HTTP
      // reference does not show. Pinned live so the wider type is not
      // narrowed back to `string` on the assumption it was speculative.
      const classifier = new TypeSafeClassifier({
        questions: {
          angry: {
            type: "noul",
            instructions: {
              goal: "decide whether the customer is angry",
              signals: ["profanity", "repeated punctuation", "all caps"],
            },
          },
          listed: {
            type: "noul",
            instructions: ["is the customer angry?", "weigh the punctuation"],
          },
        },
        apiKey: process.env.TYPESAFE_API_KEY,
        baseUrl: process.env.TYPESAFE_BASE_URL,
      });

      const result = await classifier.invoke(
        "THIS IS THE THIRD TIME you have charged me twice!!!"
      );

      expect(result.answers.angry.type).toBe("noul");
      expect(result.answers.listed.type).toBe("noul");
      expect((result.answers.angry as { noul: number }).noul).toBeGreaterThan(
        0.5
      );
      expect((result.answers.listed as { noul: number }).noul).toBeGreaterThan(
        0.5
      );
    });
  }
);
