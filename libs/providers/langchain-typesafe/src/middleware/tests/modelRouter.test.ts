import { describe, expect, test, vi } from "vitest";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { fakeModel } from "@langchain/core/testing";
import { createAgent, MiddlewareError } from "langchain";

import {
  createModelResolver,
  latestHumanMessage,
  modelRouterMiddleware,
  parseChoices,
} from "../modelRouter.js";
import { TypeSafeError } from "../../index.js";

function stubFetch(answers: Record<string, unknown>) {
  return vi.fn(
    async (_url: unknown, _init?: { body?: string }) =>
      new Response(
        JSON.stringify({
          model: "jev-1.13.0",
          answers,
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
  );
}

/** The classifier request body of the Nth call. */
function sentBody(fetchMock: ReturnType<typeof stubFetch>, call = 0) {
  const init = fetchMock.mock.calls[call]?.[1];
  if (typeof init?.body !== "string") {
    throw new Error("no classifier request body was captured");
  }
  return JSON.parse(init.body) as { state?: unknown; questions?: unknown };
}

/** `fetch` is typed loosely by the classifier option; cast at the seam. */
function asFetch(fetchMock: ReturnType<typeof stubFetch>): typeof fetch {
  return fetchMock as unknown as typeof fetch;
}

function choiceAnswer(choice: string) {
  return {
    type: "choice",
    choice,
    probabilities: { [choice]: 1 },
    confidence: 1,
  };
}

const OPTS = { apiKey: "test-key" } as const;

describe("modelRouterMiddleware", () => {
  test("stores the complete ChoiceAnswer under modelRoute, and wrapModelCall resolves that route's own model", async () => {
    const fastModel = fakeModel();
    const powerfulModel = fakeModel().respond(new AIMessage("powerful reply"));
    const mw = modelRouterMiddleware({
      choices: {
        fast: { model: fastModel, criteria: "Simple, well-scoped tasks." },
        powerful: {
          model: powerfulModel,
          criteria: "Complex tasks requiring deeper reasoning.",
        },
      },
      instructions: "Choose the least costly model suited to the task.",
      classifierOptions: {
        ...OPTS,
        fetch: asFetch(stubFetch({ model_route: choiceAnswer("powerful") })),
      },
    });
    const agent = createAgent({
      // Never actually called: wrapModelCall always overrides `request.model`.
      model: fakeModel(),
      tools: [],
      middleware: [mw],
    });
    const result = await agent.invoke({
      messages: [new HumanMessage("Design a consensus protocol.")],
    });
    expect(result.modelRoute).toEqual({
      type: "choice",
      choice: "powerful",
      probabilities: { powerful: 1 },
      confidence: 1,
    });
    // Proves wrapModelCall actually resolved and ran the "powerful" model
    // instance — not merely that `modelRoute` holds the winning label.
    expect(powerfulModel.callCount).toBe(1);
    expect(fastModel.callCount).toBe(0);
  });

  test("classifies the LATEST human message, not the first", async () => {
    const fetchMock = stubFetch({ model_route: choiceAnswer("fast") });
    const mw = modelRouterMiddleware({
      choices: {
        fast: {
          model: fakeModel().respond(new AIMessage("ok")),
          criteria: "x",
        },
        powerful: { model: fakeModel(), criteria: "y" },
      },
      instructions: "Pick.",
      classifierOptions: {
        ...OPTS,
        fetch: asFetch(fetchMock),
      },
    });
    const agent = createAgent({
      model: fakeModel(),
      tools: [],
      middleware: [mw],
    });
    await agent.invoke({
      messages: [
        new HumanMessage("first"),
        new AIMessage("reply"),
        new HumanMessage("second"),
      ],
    });
    // The rendered state must carry the latest human turn and not the first.
    const body = sentBody(fetchMock);
    expect(JSON.stringify(body.state)).toContain("second");
    expect(JSON.stringify(body.state)).not.toContain("first");
  });

  test("sends the choices as the Choice criteria under the model_route id", async () => {
    const fetchMock = stubFetch({ model_route: choiceAnswer("fast") });
    const mw = modelRouterMiddleware({
      choices: {
        fast: {
          model: fakeModel().respond(new AIMessage("ok")),
          criteria: "Simple, well-scoped tasks.",
        },
        powerful: {
          model: fakeModel(),
          criteria: "Complex tasks requiring deeper reasoning.",
        },
      },
      instructions: "Choose the least costly model suited to the task.",
      classifierOptions: {
        ...OPTS,
        fetch: asFetch(fetchMock),
      },
    });
    const agent = createAgent({
      model: fakeModel(),
      tools: [],
      middleware: [mw],
    });
    await agent.invoke({ messages: [new HumanMessage("hi")] });
    const { questions } = sentBody(fetchMock) as {
      questions: Record<string, { criteria: unknown }>;
    };
    expect(Object.keys(questions)).toEqual(["model_route"]);
    expect(questions.model_route.criteria).toEqual({
      fast: "Simple, well-scoped tasks.",
      powerful: "Complex tasks requiring deeper reasoning.",
    });
  });

  test("throws a named error when state has no human message", async () => {
    const mw = modelRouterMiddleware({
      choices: { fast: { model: fakeModel(), criteria: "x" } },
      instructions: "Pick.",
      classifierOptions: {
        ...OPTS,
        fetch: asFetch(stubFetch({ model_route: choiceAnswer("fast") })),
      },
    });
    const agent = createAgent({
      model: fakeModel(),
      tools: [],
      middleware: [mw],
    });
    await expect(
      agent.invoke({ messages: [new AIMessage("only ai")] })
    ).rejects.toThrow(/modelRouterMiddleware.*no human message/i);
  });

  test("rejects an empty choices map", () => {
    expect(() =>
      modelRouterMiddleware({
        choices: {},
        instructions: "Pick.",
        classifierOptions: OPTS,
      })
    ).toThrow(/at least one/i);
  });

  test("a classifier failure propagates rather than defaulting, UNWRAPPED (unlike wrapToolCall)", async () => {
    const boom = (async () => {
      throw new Error("transport down");
    }) as unknown as typeof fetch;
    const mw = modelRouterMiddleware({
      choices: { fast: { model: fakeModel(), criteria: "x" } },
      instructions: "Pick.",
      classifierOptions: { ...OPTS, fetch: boom, maxRetries: 0 },
    });
    const agent = createAgent({
      model: fakeModel(),
      tools: [],
      middleware: [mw],
    });
    const error = await agent
      .invoke({ messages: [new HumanMessage("hi")] })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    // The asymmetry documented on `modelRouterMiddleware`: beforeAgent is
    // NOT wrapped, so this package's own error type survives unwrapped —
    // unlike a `wrapToolCall` failure (see autoMode.test.ts).
    expect(MiddlewareError.isInstance(error)).toBe(false);
    expect(TypeSafeError.isInstance(error)).toBe(true);
  });
});

describe("parseChoices", () => {
  test("rejects an empty map", () => {
    expect(() => parseChoices({})).toThrow(
      "modelRouterMiddleware requires at least one entry in `choices`."
    );
  });

  test("rejects a non-string, non-object model, naming the route", () => {
    expect(() =>
      parseChoices({ badRoute: { model: 42, criteria: "x" } } as never)
    ).toThrow('modelRouterMiddleware: choice "badRoute": Invalid input');
  });

  test("rejects an empty model name", () => {
    expect(() =>
      parseChoices({ badRoute: { model: "", criteria: "x" } })
    ).toThrow(
      'modelRouterMiddleware: choice "badRoute": `model` must be a non-empty model name.'
    );
  });

  test("rejects a choice missing criteria, naming the route", () => {
    expect(() => parseChoices({ badRoute: { model: "gpt" } } as never)).toThrow(
      'modelRouterMiddleware: choice "badRoute": Invalid input'
    );
  });

  test("accepts a live model instance and PRESERVES its identity", () => {
    const instance = fakeModel();
    const parsed = parseChoices({ x: { model: instance, criteria: "c" } });
    expect(parsed.x.model).toBe(instance);
  });

  test("preserves an own __proto__ route name", () => {
    // An object LITERAL `{ __proto__: ... }` sets the prototype instead of
    // creating an own key. `JSON.parse` creates a real own key, which is the
    // case `parseChoices` exists to preserve (`z.record` would drop it).
    const choices = JSON.parse(
      '{"__proto__": {"model": "gpt", "criteria": "x"}}'
    );
    const parsed = parseChoices(choices);
    expect(Object.keys(parsed)).toEqual(["__proto__"]);
    expect(parsed.__proto__).toEqual({ model: "gpt", criteria: "x" });
  });
});

describe("createModelResolver", () => {
  test("memoises: a string route calls initChatModel only once", async () => {
    const resolver = createModelResolver({
      fast: { model: "openai:gpt-4o-mini", criteria: "x" },
    });
    const first = await resolver("fast");
    const second = await resolver("fast");
    // `initChatModel` returns a NEW instance on every independent call
    // (verified directly against it), so this identity proves the second
    // `resolver` call hit the cache instead of re-resolving.
    expect(second).toBe(first);
  });

  test("a live model instance keeps its identity across calls", async () => {
    const instance = fakeModel();
    const resolver = createModelResolver({
      x: { model: instance, criteria: "c" },
    });
    expect(await resolver("x")).toBe(instance);
    expect(await resolver("x")).toBe(instance);
  });

  test("concurrent calls on one route share a single resolution", async () => {
    // The cache holds the PROMISE, not the model. A value cache would let
    // both of these get past the cache check before either finished, so
    // each would call `initChatModel` and receive its own new instance —
    // which is what makes this identity check discriminating rather than
    // just restating the sequential memoisation test above.
    const resolver = createModelResolver({
      fast: { model: "openai:gpt-4o-mini", criteria: "x" },
    });
    const [a, b] = await Promise.all([resolver("fast"), resolver("fast")]);
    expect(a).toBe(b);
  });

  test("does not cache a failure: a later call retries", async () => {
    // A rejected promise left in the cache would make one transient
    // `initChatModel` failure permanent for the life of the middleware.
    const choices: Record<string, { model: string; criteria: string }> = {
      x: { model: "definitely-not-a-provider:nope", criteria: "c" },
    };
    const resolver = createModelResolver(choices);
    await expect(resolver("x")).rejects.toThrow();
    // Repair the config; the resolver must not serve the cached rejection.
    choices.x.model = "openai:gpt-4o-mini";
    await expect(resolver("x")).resolves.toBeDefined();
  });

  test("throws a named error for a route absent from choices", async () => {
    const resolver = createModelResolver({
      x: { model: fakeModel(), criteria: "c" },
    });
    await expect(resolver("missing")).rejects.toThrow(
      'modelRouterMiddleware: TypeSafe selected route "missing", which is not in `choices`.'
    );
  });
});

describe("latestHumanMessage", () => {
  test("returns the LAST human message, skipping AI messages", () => {
    const messages = [
      new HumanMessage("first"),
      new AIMessage("reply"),
      new HumanMessage("second"),
    ];
    expect(latestHumanMessage(messages)).toBe(messages[2]);
  });

  test("returns undefined when there is no human message", () => {
    expect(latestHumanMessage([new AIMessage("only ai")])).toBeUndefined();
  });
});
