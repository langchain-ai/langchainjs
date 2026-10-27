import { describe, it, expect, expectTypeOf, vi } from "vitest";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import {
  OpenAIDecisions,
  type ChoiceAnswer,
  type RefusalAnswer,
} from "../index.js";
import { toDecisionInput } from "../input.js";

const image = "data:image/png;base64,AA==";

function decisions(body: unknown) {
  const fetch = vi.fn(
    async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(body), {
        headers: {
          "content-type": "application/json",
          "x-request-id": "req-123",
        },
      })
  );
  const triage = new OpenAIDecisions({
    model: "decision-model",
    apiKey: "test-key",
    configuration: { fetch, maxRetries: 0 },
    questions: {
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
    },
  });
  return { fetch, triage };
}

const answers = [
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
      { value: 1, label: "High", probability: 0.8 },
      { value: 0, label: "Low", probability: 0.2 },
    ],
  },
  { name: "extra", type: "future" },
];

describe("OpenAIDecisions", () => {
  it("sends named questions and returns typed answers", async () => {
    const { fetch, triage } = decisions({
      model: "decision-model-1",
      answers,
      usage: { input_tokens: 10, output_tokens: 2 },
    });
    const result = await triage.invoke("help");
    expect(result).toEqual({
      model: "decision-model-1",
      requestId: "req-123",
      usage_metadata: { input_tokens: 10, output_tokens: 2, total_tokens: 12 },
      answers: {
        urgent: { type: "predicate", probability: 0.9 },
        team: {
          type: "choice",
          choice: "billing",
          confidence: 0.8,
          probabilities: { billing: 0.9, technical: 0.1 },
        },
        severity: {
          type: "score",
          score: 0.8,
          confidence: 0.7,
          levels: [
            { label: "Low", probability: 0.2 },
            { label: "High", probability: 0.8 },
          ],
        },
      },
    });
    expectTypeOf(result.answers.team).toEqualTypeOf<
      ChoiceAnswer<"billing" | "technical"> | RefusalAnswer
    >();
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({
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

  it("accepts refusals and rejects missing or invalid answers", async () => {
    const respond = (body: unknown) =>
      new OpenAIDecisions({
        model: "m",
        apiKey: "k",
        questions: { urgent: { type: "predicate", instructions: "Urgent?" } },
        configuration: {
          maxRetries: 0,
          fetch: async () =>
            new Response(JSON.stringify(body), {
              headers: { "content-type": "application/json" },
            }),
        },
      }).invoke("x");
    await expect(
      respond({
        model: "m",
        answers: [{ name: "urgent", type: "refusal", reason: "policy" }],
      })
    ).resolves.toMatchObject({
      answers: { urgent: { type: "refusal", reason: "policy" } },
    });
    await expect(respond({ model: "m", answers: [] })).rejects.toThrow(
      'question "urgent"'
    );
    await expect(
      respond({
        model: "m",
        answers: [{ name: "urgent", type: "predicate", probability: 2 }],
      })
    ).rejects.toThrow('question "urgent"');
    await expect(
      respond({
        model: "m",
        answers: [{ name: "urgent", type: "score", score: 1 }],
      })
    ).rejects.toThrow('question "urgent"');
  });

  it("validates questions at construction", () => {
    const build = (questions: never) =>
      new OpenAIDecisions({ model: "m", apiKey: "k", questions });
    expect(() =>
      build({
        s: { type: "score", instructions: "Rate", levels: ["One"] },
      } as never)
    ).toThrow('question "s": levels: Score requires at least two levels.');
    expect(() =>
      build({
        c: { type: "choice", instructions: "Pick", choices: {} },
      } as never)
    ).toThrow("at least one option");
    expect(() =>
      build({ p: { type: "predicate", instructions: " " } } as never)
    ).toThrow("instructions must not be empty");
    expect(() => new OpenAIDecisions({ model: "", apiKey: "k" })).toThrow();
  });

  it("withQuestions reuses configuration and requires questions", async () => {
    const { fetch, triage } = decisions({
      model: "m",
      answers: [{ name: "spam", type: "predicate", probability: 0.1 }],
    });
    const spam = triage.withQuestions({
      spam: { type: "predicate", instructions: "Spam?" },
    });
    const { answers: result } = await spam.invoke("hi");
    expectTypeOf(result).toEqualTypeOf<{
      spam: import("../index.js").PredicateAnswer | RefusalAnswer;
    }>();
    expect(result.spam).toEqual({ type: "predicate", probability: 0.1 });
    expect(fetch).toHaveBeenCalledOnce();
    await expect(
      new OpenAIDecisions({ model: "m", apiKey: "k" }).invoke("hi")
    ).rejects.toThrow("no questions");
  });

  it("supports batch and composition", async () => {
    const { triage } = decisions({ model: "m", answers });
    expect(await triage.batch(["a", "b"])).toHaveLength(2);
    expect(
      await triage.pipe(({ answers }) => answers.urgent.type).invoke("a")
    ).toBe("predicate");
  });

  it("traces an LLM run with provider metadata and usage", async () => {
    const { triage } = decisions({
      model: "m",
      answers,
      usage: { input_tokens: 3 },
    });
    const start = vi.fn();
    const end = vi.fn();
    await triage.invoke("a", {
      callbacks: [{ handleChainStart: start, handleChainEnd: end }],
    });
    expect(start.mock.calls[0][6]).toBe("llm");
    expect(start.mock.calls[0][5]).toMatchObject({
      ls_provider: "openai",
      ls_model_name: "decision-model",
    });
    expect(start.mock.calls[0][1]).toEqual({ input: "a" });
    expect(end.mock.calls[0][0].usage_metadata.total_tokens).toBe(3);
    expect(JSON.stringify(triage.toJSON())).not.toContain("test-key");
  });

  it("does not send a request once aborted", async () => {
    const { fetch, triage } = decisions({ model: "m", answers });
    const controller = new AbortController();
    controller.abort();
    await expect(
      triage.invoke("a", { signal: controller.signal })
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("toDecisionInput", () => {
  it("sends human messages natively", () => {
    expect(
      toDecisionInput(
        new HumanMessage({
          content: [
            { type: "text", text: "see" },
            { type: "image_url", image_url: { url: image } },
          ],
        })
      )
    ).toEqual([
      {
        role: "user",
        content: [
          { type: "input_text", text: "see" },
          { type: "input_image", image_url: image },
        ],
      },
    ]);
  });

  it("encodes other input as JSON with images in place", () => {
    const input = toDecisionInput({
      messages: [
        new HumanMessage("hi"),
        new AIMessage({
          content: [{ type: "image_url", image_url: { url: image } }],
          tool_calls: [{ id: "c", name: "read", args: {} }],
        }),
        new ToolMessage({ content: "ok", tool_call_id: "c" }),
      ],
      at: new Date(0),
    });
    expect(input).toHaveLength(1);
    const [{ content }] = input as { content: Record<string, string>[] }[];
    expect(content.map((part) => part.type)).toEqual([
      "input_text",
      "input_image",
      "input_text",
    ]);
    const text = content[0].text + content[2].text;
    expect(text).toContain('{"messages":[{"role":"user","content":"hi"}');
    expect(text).toContain('"tool_call_id":"c"');
    expect(text).toContain('"at":"1970-01-01T00:00:00.000Z"');
  });

  it("falls back to JSON for hosted images and omits other media", () => {
    const [{ content }] = toDecisionInput(
      new HumanMessage({
        content: [
          { type: "image_url", image_url: "https://example.com/a.png" },
          { type: "audio", mimeType: "audio/wav", data: "AAAA" },
        ],
      })
    ) as { content: { text: string }[] }[];
    expect(content[0].text).toContain("https://example.com/a.png");
    expect(content[0].text).not.toContain("AAAA");
  });

  it("rejects values that are not JSON and cycles", () => {
    expect(() => toDecisionInput({ bad: new Map() } as never)).toThrow("Map");
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => toDecisionInput(cyclic as never)).toThrow("cycle");
  });
});
