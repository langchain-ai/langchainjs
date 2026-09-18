import { describe, expect, test } from "vitest";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { modelRouterMiddleware } from "../modelRouter.js";

/**
 * A `fetch` stub, not a classifier stub: questions are fixed at construction
 * (see Step 7), so the middleware builds its own classifier and the only
 * injection point is transport. A FRESH Response per call is required — a
 * body can be read once, and a shared instance fails the second attempt with
 * "body already used", which is non-retryable and would make a test pass for
 * the wrong reason.
 */
function stubFetch(
  answers: Record<string, unknown>,
  capture?: (body: unknown) => void
): typeof fetch {
  return (async (_url: unknown, init?: { body?: string }) => {
    if (capture && typeof init?.body === "string") capture(JSON.parse(init.body));
    return new Response(
      JSON.stringify({
        model: "jev-1.13.0",
        answers,
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }) as unknown as typeof fetch;
}

function choiceAnswer(choice: string) {
  return { type: "choice", choice, probabilities: { [choice]: 1 }, confidence: 1 };
}

const OPTS = { apiKey: "test-key" } as const;

const CHOICES = {
  fast: { model: "openai:gpt-5-mini", criteria: "Simple, well-scoped tasks." },
  powerful: { model: "openai:gpt-5", criteria: "Complex tasks requiring deeper reasoning." },
};

describe("modelRouterMiddleware", () => {
  test("stores the complete ChoiceAnswer under modelRoute", async () => {
    const mw = modelRouterMiddleware({
      choices: CHOICES,
      instructions: "Choose the least costly model suited to the task.",
      classifierOptions: { ...OPTS, fetch: stubFetch({ model_route: choiceAnswer("powerful") }) },
    });
    const update = await mw.beforeAgent!(
      { messages: [new HumanMessage("Design a consensus protocol.")] } as never,
      {} as never
    );
    expect(update).toEqual({
      modelRoute: { type: "choice", choice: "powerful", probabilities: { powerful: 1 }, confidence: 1 },
    });
  });

  test("classifies the LATEST human message, not the first", async () => {
    let body: { state?: unknown } = {};
    const mw = modelRouterMiddleware({
      choices: CHOICES, instructions: "Pick.",
      classifierOptions: {
        ...OPTS,
        fetch: stubFetch({ model_route: choiceAnswer("fast") }, (b) => { body = b as typeof body; }),
      },
    });
    await mw.beforeAgent!(
      { messages: [new HumanMessage("first"), new AIMessage("reply"), new HumanMessage("second")] } as never,
      {} as never
    );
    // The rendered state must carry the latest human turn and not the first.
    expect(JSON.stringify(body.state)).toContain("second");
    expect(JSON.stringify(body.state)).not.toContain("first");
  });

  test("sends the choices as the Choice criteria under the model_route id", async () => {
    let body: { questions?: Record<string, { criteria?: Record<string, unknown> }> } = {};
    const mw = modelRouterMiddleware({
      choices: CHOICES, instructions: "Choose the least costly model suited to the task.",
      classifierOptions: {
        ...OPTS,
        fetch: stubFetch({ model_route: choiceAnswer("fast") }, (b) => { body = b as typeof body; }),
      },
    });
    await mw.beforeAgent!({ messages: [new HumanMessage("hi")] } as never, {} as never);
    expect(Object.keys(body.questions ?? {})).toEqual(["model_route"]);
    expect(body.questions!.model_route.criteria).toEqual({
      fast: "Simple, well-scoped tasks.",
      powerful: "Complex tasks requiring deeper reasoning.",
    });
  });

  test("throws a named error when state has no human message", async () => {
    const mw = modelRouterMiddleware({
      choices: CHOICES, instructions: "Pick.",
      classifierOptions: { ...OPTS, fetch: stubFetch({ model_route: choiceAnswer("fast") }) },
    });
    await expect(
      mw.beforeAgent!({ messages: [new AIMessage("only ai")] } as never, {} as never)
    ).rejects.toThrow(/modelRouterMiddleware.*no human message/i);
  });

  test("rejects an empty choices map", () => {
    expect(() =>
      modelRouterMiddleware({ choices: {}, instructions: "Pick.", classifierOptions: OPTS })
    ).toThrow(/at least one/i);
  });

  test("a classifier failure propagates rather than defaulting", async () => {
    const boom = (async () => { throw new Error("transport down"); }) as unknown as typeof fetch;
    const mw = modelRouterMiddleware({
      choices: CHOICES, instructions: "Pick.",
      classifierOptions: { ...OPTS, fetch: boom, maxRetries: 0 },
    });
    await expect(
      mw.beforeAgent!({ messages: [new HumanMessage("hi")] } as never, {} as never)
    ).rejects.toThrow();
  });
});
