import { describe, it, expect } from "vitest";
import { OpenAIClassifier } from "../index.js";

describe("OpenAIClassifier", () => {
  const classifier = new OpenAIClassifier("gpt-6-luna");

  it("answers every supported question type", async () => {
    const response = await classifier.invoke({
      state: "I was charged twice for my order.",
      questions: {
        department: {
          type: "choice",
          instructions: "Which department should handle this complaint?",
          criteria: {
            billing: "Payments, invoices, and refunds.",
            technical: "Problems using the product.",
          },
        },
        urgent: {
          type: "noul",
          instructions: "Does the customer need urgent help?",
        },
        severity: {
          type: "score",
          instructions: "How severe is this issue?",
          criteria: ["Cosmetic", "Workaround available", "Fully blocked"],
        },
      },
    });
    expect(response.choices.department.choice).toBe("billing");
    expect(response.nouls.urgent.noul).toBeGreaterThanOrEqual(0);
    expect(response.nouls.urgent.noul).toBeLessThanOrEqual(1);
    expect(Object.keys(response.scores.severity.legend)).toEqual([
      "0",
      "1",
      "2",
    ]);
    expect(response.usage_metadata?.input_tokens).toBeGreaterThan(0);
  });
});
