import { describe, it, expect } from "vitest";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { OpenAIDecisions } from "../index.js";

const questions = {
  department: {
    type: "choice",
    instructions: "Which department should handle this complaint?",
    choices: {
      billing: "Payments, invoices, and refunds.",
      technical: "Problems using the product.",
      other: null,
    },
  },
  urgent: {
    type: "predicate",
    instructions: "Does the customer need urgent help?",
  },
  severity: {
    type: "score",
    instructions: "How severe is this issue?",
    levels: ["Cosmetic", "Workaround available", "Fully blocked"],
  },
} as const;

describe("OpenAIDecisions", () => {
  const decisions = new OpenAIDecisions("gpt-6-luna");

  it("answers every question type", async () => {
    const result = await decisions.invoke({
      input: "I was charged twice for my order.",
      questions,
    });
    const { department, urgent, severity } = result.answers;
    expect(department).toMatchObject({ type: "choice", choice: "billing" });
    expect(
      urgent.type === "predicate" && urgent.probability
    ).toBeGreaterThanOrEqual(0);
    expect(severity.type === "score" && severity.score).toBeLessThanOrEqual(2);
    expect(result.usage_metadata.input_tokens).toBeGreaterThan(0);
    expect(result.requestId).toBeTruthy();
  });

  it("answers about a conversation", async () => {
    const { answers } = await decisions.invoke({
      input: [
        new SystemMessage("You are reviewing a support conversation."),
        new HumanMessage("Production is down and we are losing money."),
        new AIMessage("I'm escalating this now."),
      ],
      questions: { urgent: questions.urgent },
    });
    expect(answers.urgent).toMatchObject({ type: "predicate" });
    expect(
      answers.urgent.type === "predicate" && answers.urgent.probability
    ).toBeGreaterThan(0.5);
  });

  it("answers about JSON state", async () => {
    const { answers } = await decisions.invoke({
      input: { ticket: { subject: "Refund", body: "I was charged twice." } },
      questions: { department: questions.department },
    });
    expect(answers.department).toMatchObject({ choice: "billing" });
  });
});
