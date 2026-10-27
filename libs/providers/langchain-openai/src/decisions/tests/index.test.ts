import { describe, it, expect, expectTypeOf, vi } from "vitest";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import {
  OpenAIDecisions,
  type ChoiceAnswer,
  type PredicateAnswer,
  type RefusalAnswer,
} from "../index.js";
import { toDecisionInput } from "../input.js";

const image = "data:image/png;base64,AA==";

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
  const decisions = new OpenAIDecisions({
    model: "decision-model",
    apiKey: "test-key",
    configuration: { fetch, maxRetries: 0 },
  });
  const sent = () => JSON.parse(String(fetch.mock.calls[0][1]?.body));
  return { fetch, decisions, sent };
}

const questions = {
  urgent: { type: "predicate", instructions: "Urgent?" },
  team: {
    type: "choice",
    instructions: "Team?",
    choices: { billing: "Payments", technical: null },
  },
  severity: {
    type: "score",
    instructions: "Severity?",
    levels: ["Low", { label: "High", description: "Outage" }],
  },
} as const;

const choice = {
  type: "choice",
  choice: "billing",
  confidence: 0.8,
  probabilities: [
    { value: "billing", probability: 0.9 },
    { value: "technical", probability: 0.1 },
  ],
};
const score = {
  type: "score",
  score: 0.8,
  confidence: 0.7,
  probabilities: [
    { value: 0, label: "Low", probability: 0.2 },
    { value: 1, label: "High", probability: 0.8 },
  ],
};
const body = {
  model: "decision-model-1",
  answers: [
    { name: "urgent", type: "predicate", probability: 0.9 },
    { name: "team", ...choice },
    { name: "severity", ...score },
  ],
  usage: {
    input_tokens: 10,
    input_tokens_details: { cached_tokens: 4, cache_write_tokens: 0 },
    output_tokens: 2,
    output_tokens_details: { reasoning_tokens: 0 },
    total_tokens: 12,
  },
};

describe("OpenAIDecisions", () => {
  it("sends named questions and returns typed answers", async () => {
    const { decisions, sent } = setup(body);
    const result = await decisions.invoke({ input: "help", questions });
    expect(result).toEqual({
      model: "decision-model-1",
      requestId: "req-123",
      usage_metadata: {
        input_tokens: 10,
        output_tokens: 2,
        total_tokens: 12,
        input_token_details: { cache_read: 4, cache_creation: 0 },
        output_token_details: { reasoning: 0 },
      },
      answers: {
        urgent: { type: "predicate", probability: 0.9 },
        team: choice,
        severity: score,
      },
    });
    expectTypeOf(result.answers.team).toEqualTypeOf<
      ChoiceAnswer<"billing" | "technical"> | RefusalAnswer
    >();
    expect(sent()).toEqual({
      model: "decision-model",
      input: "help",
      questions: [
        { type: "predicate", name: "urgent", instructions: "Urgent?" },
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
          levels: [{ label: "Low" }, { label: "High", description: "Outage" }],
        },
      ],
    });
  });

  it("returns refusals and rejects missing answers", async () => {
    const urgent = { urgent: questions.urgent };
    const refused = setup({
      ...body,
      answers: [{ name: "urgent", type: "refusal" }],
    });
    const { answers } = await refused.decisions.invoke({
      input: "x",
      questions: urgent,
    });
    expectTypeOf(answers.urgent).toEqualTypeOf<
      PredicateAnswer | RefusalAnswer
    >();
    expect(answers.urgent).toEqual({ type: "refusal" });
    const missing = setup({ ...body, answers: [] });
    await expect(
      missing.decisions.invoke({ input: "x", questions: urgent })
    ).rejects.toThrow('no answer for question "urgent"');
    await expect(
      missing.decisions.invoke({ input: "x", questions: {} })
    ).rejects.toThrow("at least one question");
  });

  it("accepts a model string like ChatOpenAI", () => {
    const decisions = new OpenAIDecisions("gpt-6-luna", { apiKey: "k" });
    expect(decisions.model).toBe("gpt-6-luna");
    expect(new OpenAIDecisions({ model: "m", apiKey: "k" }).model).toBe("m");
    expect(() => new OpenAIDecisions("", { apiKey: "k" })).toThrow();
  });

  it("supports batch and composition", async () => {
    const { decisions } = setup(body);
    const request = { input: "a", questions };
    expect(await decisions.batch([request, request])).toHaveLength(2);
    expect(
      await decisions.pipe(({ answers }) => answers.urgent.type).invoke(request)
    ).toBe("predicate");
  });

  it("traces an LLM run whose output carries usage_metadata", async () => {
    const { decisions } = setup(body);
    const start = vi.fn();
    const end = vi.fn();
    await decisions.invoke(
      { input: "a", questions },
      { callbacks: [{ handleChainStart: start, handleChainEnd: end }] }
    );
    expect(start.mock.calls[0][6]).toBe("llm");
    expect(start.mock.calls[0][5]).toMatchObject({
      ls_provider: "openai",
      ls_model_name: "decision-model",
    });
    expect(end.mock.calls[0][0].usage_metadata.total_tokens).toBe(12);
    expect(JSON.stringify(decisions.toJSON())).not.toContain("test-key");
  });

  it("does not send a request once aborted", async () => {
    const { fetch, decisions } = setup(body);
    const controller = new AbortController();
    controller.abort();
    await expect(
      decisions.invoke({ input: "a", questions }, { signal: controller.signal })
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("toDecisionInput", () => {
  it("sends messages as a native conversation", () => {
    expect(
      toDecisionInput([
        new SystemMessage("Be careful."),
        new HumanMessage({
          content: [
            { type: "text", text: "see" },
            { type: "image_url", image_url: { url: image } },
            {
              type: "file",
              source_type: "base64",
              mime_type: "application/pdf",
              data: "AAAA",
            },
          ],
        }),
        new AIMessage({
          content: "Reading it.",
          tool_calls: [{ id: "c", name: "read", args: { path: "a" } }],
        }),
        new ToolMessage({ content: "ok", tool_call_id: "c" }),
      ])
    ).toEqual([
      { role: "system", content: "Be careful." },
      {
        role: "user",
        content: [
          { type: "input_text", text: "see" },
          { type: "input_image", image_url: image },
          { type: "input_text", text: "[input_file omitted]" },
        ],
      },
      { role: "assistant", content: "Reading it." },
      {
        type: "function_call",
        call_id: "c",
        name: "read",
        arguments: '{"path":"a"}',
      },
      { type: "function_call_output", call_id: "c", output: "ok" },
    ]);
  });

  it("sends JSON as an input_json part", () => {
    expect(toDecisionInput({ account: { tier: "pro" } })).toEqual([
      {
        role: "user",
        content: [{ type: "input_json", data: { account: { tier: "pro" } } }],
      },
    ]);
    expect(
      toDecisionInput({
        messages: [new HumanMessage("delete it")],
        tool_call: { name: "delete" },
      })
    ).toEqual([
      {
        role: "user",
        content: [
          {
            type: "input_json",
            data: {
              messages: [{ role: "user", content: "delete it" }],
              tool_call: { name: "delete" },
            },
          },
        ],
      },
    ]);
  });
});
