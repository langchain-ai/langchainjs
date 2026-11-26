import { describe, it, expect, vi } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { ModelRefusalError } from "@langchain/core/errors";
import { OpenAIClassifier } from "../index.js";

function setup(body: unknown) {
  const fetch = vi.fn(
    async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(body), {
        headers: {
          "content-type": "application/json",
          "x-request-id": "req-123",
        },
      })
  );
  const classifier = new OpenAIClassifier({
    model: "decision-model",
    apiKey: "test-key",
    configuration: { fetch, maxRetries: 0 },
  });
  const sent = () => JSON.parse(String(fetch.mock.calls[0][1]?.body));
  return { fetch, classifier, sent };
}

const usage = {
  input_tokens: 10,
  input_tokens_details: { cached_tokens: 4, cache_write_tokens: 0 },
  output_tokens: 0,
  output_tokens_details: { reasoning_tokens: 0 },
  total_tokens: 10,
};

const questions = {
  urgent: {
    type: "noul",
    instructions: "Urgent?",
    criteria: { true: "Production is down", false: "Anything else" },
  },
  team: {
    type: "choice",
    instructions: "Team?",
    criteria: { billing: "Payments", technical: null },
  },
  severity: {
    type: "score",
    instructions: "Severity?",
    criteria: ["Low", "High"],
  },
} as const;

const body = {
  model: "decision-model-1",
  answers: [
    { name: "urgent", type: "predicate", probability: 0.9 },
    {
      name: "team",
      type: "choice",
      choice: "billing",
      confidence: 0.8,
      probabilities: [
        { value: "billing", probability: 0.9 },
        { value: "technical", probability: 0.1 },
      ],
    },
    {
      name: "severity",
      type: "score",
      score: 0.8,
      confidence: 0.7,
      probabilities: [
        { value: 0, label: "Low", probability: 0.2 },
        { value: 1, label: "High", probability: 0.8 },
      ],
    },
  ],
  usage,
};

describe("OpenAIClassifier", () => {
  it("sends questions in the Decisions format and returns decision model answers", async () => {
    const { classifier, sent, fetch } = setup(body);
    const response = await classifier.invoke({ state: "help", questions });

    expect(String(fetch.mock.calls[0][0])).toMatch(/\/decisions$/);
    expect(sent()).toEqual({
      model: "decision-model",
      input: "help",
      questions: [
        {
          type: "predicate",
          name: "urgent",
          instructions:
            "Urgent?\n\nAnswer true if: Production is down\nAnswer false if: Anything else",
        },
        {
          type: "choice",
          name: "team",
          instructions: "Team?",
          choices: [
            { value: "billing", description: "Payments" },
            { value: "technical" },
          ],
        },
        {
          type: "score",
          name: "severity",
          instructions: "Severity?",
          levels: [{ label: "Low" }, { label: "High" }],
        },
      ],
    });
    expect(response.nouls.urgent).toEqual({ type: "noul", noul: 0.9 });
    expect(response.choices.team).toEqual({
      type: "choice",
      choice: "billing",
      confidence: 0.8,
      probabilities: { billing: 0.9, technical: 0.1 },
    });
    expect(response.scores.severity).toEqual({
      type: "score",
      score: 0.8,
      confidence: 0.7,
      legend: { "0": "Low", "1": "High" },
      probabilities: { "0": 0.2, "1": 0.8 },
    });
    expect(response.model).toBe("decision-model-1");
    expect(response.requestId).toBe("req-123");
    expect(response.usage_metadata).toMatchObject({
      input_tokens: 10,
      output_tokens: 0,
      total_tokens: 10,
      input_token_details: { cache_read: 4 },
    });
  });

  it("sends messages as a native conversation", async () => {
    const { classifier, sent } = setup({
      model: "m",
      answers: [{ name: "q", type: "predicate", probability: 0.5 }],
      usage,
    });
    await classifier.invoke({
      state: [new HumanMessage("Where is my refund?")],
      questions: { q: { type: "noul", instructions: "Refund?" } },
    });
    expect(sent().input).toEqual([
      { role: "user", content: "Where is my refund?" },
    ]);
  });

  it("sends JSON and image instructions as input parts", async () => {
    const { classifier, sent } = setup({
      model: "m",
      answers: [
        { name: "json", type: "predicate", probability: 0.5 },
        { name: "image", type: "predicate", probability: 0.5 },
      ],
      usage,
    });
    await classifier.invoke({
      state: "state",
      questions: {
        json: { type: "noul", instructions: { rule: "No refunds" } },
        image: {
          type: "noul",
          instructions: [
            { type: "text", text: "Does this match?" },
            { type: "image", url: "https://example.com/a.png" },
          ],
        },
      },
    });
    expect(
      sent().questions.map((q: { instructions: unknown }) => q.instructions)
    ).toEqual([
      [{ type: "input_json", data: { rule: "No refunds" } }],
      [
        { type: "input_text", text: "Does this match?" },
        { type: "input_image", image_url: "https://example.com/a.png" },
      ],
    ]);
  });

  it("rejects questions the Decisions API cannot ask before sending a request", async () => {
    const { classifier, fetch } = setup(body);
    await expect(
      classifier.invoke({
        state: "s",
        questions: { where: { type: "box", instructions: "Find it" } },
      })
    ).rejects.toThrow(/does not support box questions/);
    await expect(
      classifier.invoke({
        state: "s",
        questions: {
          team: {
            type: "choice",
            instructions: "Team?",
            criteria: { a: null },
          },
        },
      })
    ).rejects.toThrow(/at least two choice labels/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("throws ModelRefusalError when the API refuses a question", async () => {
    const { classifier } = setup({
      model: "m",
      answers: [{ name: "q", type: "refusal", refusal: "Cannot help" }],
      usage,
    });
    const result = classifier.invoke({
      state: "s",
      questions: { q: { type: "noul", instructions: "Q?" } },
    });
    await expect(result).rejects.toBeInstanceOf(ModelRefusalError);
    await expect(result).rejects.toThrow(/refused to answer: q/);
  });

  it("throws when a question is left unanswered", async () => {
    const { classifier } = setup({ model: "m", answers: [], usage });
    await expect(
      classifier.invoke({
        state: "s",
        questions: { q: { type: "noul", instructions: "Q?" } },
      })
    ).rejects.toThrow(/no answer for question "q"/);
  });

  it("keeps the API key out of serialized fields", () => {
    const { classifier } = setup(body);
    expect(JSON.stringify(classifier.toJSON())).not.toContain("test-key");
  });
});
