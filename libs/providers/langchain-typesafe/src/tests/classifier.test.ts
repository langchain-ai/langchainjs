import { inspect } from "node:util";

import {
  HumanMessage,
  SystemMessage,
  AIMessage,
} from "@langchain/core/messages";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { TypeSafeClassifier } from "../classifier.js";
import {
  TypeSafeAPIConnectionError,
  TypeSafeAPITimeoutError,
  TypeSafeAuthenticationError,
  TypeSafeRateLimitError,
} from "../utils/errors.js";
import type { Question } from "../types.js";

const API_KEY = "test-api-key";

const QUESTIONS: Record<string, Question> = {
  department: {
    type: "choice",
    criteria: { billing: "Payment issues", technical: null },
    instructions: "Which team?",
  },
  urgent: { type: "noul", instructions: "Urgent?" },
  frustration: {
    type: "score",
    criteria: ["calm", "frustrated", "angry"],
    instructions: "How frustrated?",
  },
};

const RESPONSE_BODY = {
  model: "jev-1.13.0",
  answers: {
    department: {
      type: "choice",
      choice: "technical",
      probabilities: { billing: 0.1, technical: 0.9 },
      confidence: 0.8,
    },
    urgent: { type: "noul", noul: 0.95 },
    frustration: {
      type: "score",
      score: 1.25,
      legend: { "0": "calm", "1": "frustrated", "2": "angry" },
      probabilities: { "0": 0.1, "1": 0.55, "2": 0.35 },
      confidence: 0.7,
    },
  },
  usage: { input_tokens: 42, output_tokens: 12 },
};

const okResponse = () =>
  new Response(JSON.stringify(RESPONSE_BODY), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "x-typesafe-request-id": "req_test",
    },
  });

let originalKey: string | undefined;
let originalBaseUrl: string | undefined;

beforeEach(() => {
  originalKey = process.env.TYPESAFE_API_KEY;
  originalBaseUrl = process.env.TYPESAFE_BASE_URL;
  delete process.env.TYPESAFE_API_KEY;
  delete process.env.TYPESAFE_BASE_URL;
});

afterEach(() => {
  vi.restoreAllMocks();
  if (originalKey === undefined) delete process.env.TYPESAFE_API_KEY;
  else process.env.TYPESAFE_API_KEY = originalKey;
  if (originalBaseUrl === undefined) delete process.env.TYPESAFE_BASE_URL;
  else process.env.TYPESAFE_BASE_URL = originalBaseUrl;
});

describe("construction", () => {
  test("requires an API key", () => {
    expect(() => new TypeSafeClassifier({ questions: QUESTIONS })).toThrow(
      /TypeSafe API key is required/
    );
  });

  test("reads the API key and base URL from the environment", () => {
    process.env.TYPESAFE_API_KEY = "env-key";
    process.env.TYPESAFE_BASE_URL = "https://env.example.test";
    const classifier = new TypeSafeClassifier({ questions: QUESTIONS });
    expect(classifier.baseUrl).toBe("https://env.example.test");
  });

  test("an explicit base URL beats the environment, and trailing slashes are stripped", () => {
    process.env.TYPESAFE_BASE_URL = "https://env.example.test";
    const classifier = new TypeSafeClassifier({
      questions: QUESTIONS,
      apiKey: API_KEY,
      baseUrl: "https://explicit.example.test///",
    });
    expect(classifier.baseUrl).toBe("https://explicit.example.test");
  });

  test("rejects an empty questions map and a blank model", () => {
    expect(
      () => new TypeSafeClassifier({ questions: {}, apiKey: API_KEY })
    ).toThrow(/at least one question/i);
    expect(
      () =>
        new TypeSafeClassifier({
          questions: QUESTIONS,
          apiKey: API_KEY,
          model: "   ",
        })
    ).toThrow(/must not be empty/i);
  });

  test("defaults model to jev-latest and timeout to 30000ms", () => {
    const classifier = new TypeSafeClassifier({
      questions: QUESTIONS,
      apiKey: API_KEY,
    });
    expect(classifier.model).toBe("jev-latest");
    expect(classifier.timeout).toBe(30_000);
  });
});

describe("invoke", () => {
  test("sends the exact wire body and headers, and parses the response", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(okResponse());

    const classifier = new TypeSafeClassifier({
      questions: QUESTIONS,
      apiKey: API_KEY,
    });
    const result = await classifier.invoke({ message: "help" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.typesafe.ai/v1/systemone");
    expect(init.method).toBe("POST");

    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe(`Bearer ${API_KEY}`);
    expect(headers.get("accept")).toBe("application/json");

    expect(JSON.parse(init.body as string)).toEqual({
      state: { message: "help" },
      model: "jev-latest",
      questions: {
        department: {
          type: "choice",
          criteria: { billing: "Payment issues", technical: null },
          instructions: "Which team?",
        },
        urgent: { type: "noul", instructions: "Urgent?" },
        frustration: {
          type: "score",
          criteria: ["calm", "frustrated", "angry"],
          instructions: "How frustrated?",
        },
      },
    });
    // The explicit null inside choice criteria must survive.
    expect(init.body as string).toContain('"technical":null');

    expect(result.requestId).toBe("req_test");
    expect(result.usage).toEqual({ inputTokens: 42, outputTokens: 12 });
    const score = result.answers.frustration;
    if (score.type !== "score") throw new Error("expected score");
    expect(score.legend[1]).toBe("frustrated");
  });

  test("serializes a single message and a conversation as state", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(okResponse());
    const classifier = new TypeSafeClassifier({
      questions: QUESTIONS,
      apiKey: API_KEY,
    });

    await classifier.invoke(new HumanMessage("hello"));
    let body = JSON.parse(
      (fetchSpy.mock.calls[0][1] as RequestInit).body as string
    );
    expect(body.state).toBe("user: hello");

    fetchSpy.mockResolvedValue(okResponse());
    await classifier.invoke([
      new SystemMessage("sys"),
      new HumanMessage("usr"),
      new AIMessage("ai"),
    ]);
    body = JSON.parse(
      (fetchSpy.mock.calls[1][1] as RequestInit).body as string
    );
    expect(body.state).toEqual(["system: sys", "user: usr", "assistant: ai"]);
  });

  test("a body that stalls past the timeout raises the typed timeout error", async () => {
    // `fetch` resolves when headers arrive, not when the body finishes, so
    // a server that sends headers and then stalls fails inside
    // `response.text()`. If parsing sits outside the guarded block the
    // caller gets a raw AbortError instead of this package's typed error.
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const signal = (init as RequestInit).signal as AbortSignal;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          // Headers are "sent"; the body never completes.
          signal.addEventListener(
            "abort",
            () => controller.error(signal.reason),
            { once: true }
          );
        },
      });
      return new Response(body, {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const classifier = new TypeSafeClassifier({
      questions: QUESTIONS,
      apiKey: API_KEY,
      timeout: 40,
      maxRetries: 0,
    });

    await expect(classifier.invoke("hi")).rejects.toThrow(
      TypeSafeAPITimeoutError
    );
  });

  test("a __proto__ question id is still sent, not swallowed by the prototype setter", async () => {
    // Assigning `__proto__` onto an ordinary `{}` invokes the inherited
    // setter rather than creating a property, so the question would vanish
    // from the request body with no error and the caller would get an
    // answer set that silently omits it.
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(okResponse());
    const questions = JSON.parse(
      '{"__proto__": {"type": "noul", "instructions": "is it urgent?"}}'
    ) as Record<string, Question>;
    expect(Object.keys(questions)).toEqual(["__proto__"]);

    const classifier = new TypeSafeClassifier({ questions, apiKey: API_KEY });
    await classifier.invoke("hi");

    const body = JSON.parse(
      (fetchSpy.mock.calls[0][1] as RequestInit).body as string
    );
    expect(Object.keys(body.questions)).toEqual(["__proto__"]);
  });

  test("a __proto__ state key is still sent, not swallowed by the prototype setter", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(okResponse());
    const classifier = new TypeSafeClassifier({
      questions: QUESTIONS,
      apiKey: API_KEY,
    });

    await classifier.invoke(
      JSON.parse('{"__proto__": "SENTINEL", "keep": "yes"}')
    );

    const body = JSON.parse(
      (fetchSpy.mock.calls[0][1] as RequestInit).body as string
    );
    expect(Object.keys(body.state).sort()).toEqual(["__proto__", "keep"]);
  });

  test("uses an injected fetch instead of the global one", async () => {
    const globalSpy = vi.spyOn(globalThis, "fetch");
    const injected = vi.fn(async () => okResponse());
    const classifier = new TypeSafeClassifier({
      questions: QUESTIONS,
      apiKey: API_KEY,
      fetch: injected as unknown as typeof fetch,
    });
    await classifier.invoke("hi");
    expect(injected).toHaveBeenCalledTimes(1);
    expect(globalSpy).not.toHaveBeenCalled();
  });
});

describe("errors", () => {
  test("maps a 401 and never leaks the response body", async () => {
    // `detail` here is array-shaped (the FastAPI validation-error shape),
    // which is the actual leak vector `safeDetail` guards against — it
    // echoes caller-supplied state. A plain string `detail` is treated as
    // a curated server message and is surfaced verbatim by design (see
    // `src/utils/tests/errors.test.ts`), so it would not exercise this.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: [
            {
              loc: ["body", "state"],
              msg: "secret diagnostic",
              type: "value_error",
            },
          ],
        }),
        {
          status: 401,
          headers: {
            "content-type": "application/json",
            "x-typesafe-request-id": "req_401",
          },
        }
      )
    );
    const classifier = new TypeSafeClassifier({
      questions: QUESTIONS,
      apiKey: API_KEY,
      maxRetries: 0,
    });
    const error = await classifier
      .invoke("hi")
      .then(() => null)
      .catch((e: unknown) => e);

    if (!TypeSafeAuthenticationError.isInstance(error)) {
      throw new Error("wrong error type");
    }
    expect(error.status).toBe(401);
    expect(error.requestId).toBe("req_401");
    expect(String(error)).not.toContain("secret diagnostic");
  });

  test("translates a transport failure without exposing its detail", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("sensitive transport detail")
    );
    const classifier = new TypeSafeClassifier({
      questions: QUESTIONS,
      apiKey: API_KEY,
      maxRetries: 0,
    });
    const error = await classifier
      .invoke("hi")
      .then(() => null)
      .catch((e: unknown) => e);

    if (!TypeSafeAPIConnectionError.isInstance(error)) {
      throw new Error("wrong error type");
    }
    expect(error.message).toBe("Unable to connect to the TypeSafe API.");
    expect(error.message).not.toContain("sensitive");
  });

  // NOTE: the header here MUST be the seconds-form `retry-after`, not
  // `retry-after-ms`. Core's `_getRetryAfterHeader`
  // (langchain-core/src/utils/async_caller.ts:100) reads only `retry-after`;
  // a 429 it cannot classify becomes {action:"capacity"} and is NOT retried,
  // regardless of `stampRetryable(err, true)`. Verified — see
  // task7-assumptions-RESOLVED.md in the SDD workspace.
  test("retries a 429 and sends a retry-count header on the retry", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: "slow down" }), {
          status: 429,
          headers: {
            "content-type": "application/json",
            "retry-after": "1",
          },
        })
      )
      .mockResolvedValueOnce(okResponse());

    const classifier = new TypeSafeClassifier({
      questions: QUESTIONS,
      apiKey: API_KEY,
      maxRetries: 2,
    });
    const result = await classifier.invoke("hi");

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.model).toBe("jev-1.13.0");
    const retryHeaders = new Headers(
      (fetchSpy.mock.calls[1][1] as RequestInit).headers
    );
    expect(retryHeaders.get("x-typesafe-retry-count")).toBe("1");
  });

  test("caps retries at 2 by default, matching the vendor SDK", async () => {
    // Core's AsyncCaller defaults to 6. Against a 70-500ms model that means
    // seconds of backoff before the caller sees an error, and every attempt
    // re-sends the full conversation state, so we adopt the vendor's cap of 2.
    // Pinned because it is a deliberate divergence from the core default.
    // A fresh Response per call: a body can only be read once, so a shared
    // mockResolvedValue would fail the second attempt on "body already used"
    // — a non-retryable error that would end the loop early and make this
    // test pass for the wrong reason.
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(JSON.stringify({ detail: "boom" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        })
    );
    const classifier = new TypeSafeClassifier({
      questions: QUESTIONS,
      apiKey: API_KEY,
    });
    await expect(classifier.invoke("hi")).rejects.toThrow();
    // 1 initial attempt + 2 retries.
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    // An explicit `undefined` must fall back to our 2, not core's 6: a
    // spread copies own keys whose value is undefined, so the order the
    // options are merged in is load-bearing here.
    fetchSpy.mockClear();
    const passthrough = new TypeSafeClassifier({
      questions: QUESTIONS,
      apiKey: API_KEY,
      maxRetries: undefined,
    });
    await expect(passthrough.invoke("hi")).rejects.toThrow();
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  test("does not retry a 429 carrying only retry-after-ms", async () => {
    // Core's classifier cannot see `retry-after-ms`, so this 429 is treated as
    // headerless and not retried. This test pins that known limitation so a
    // future reader does not "fix" the client to chase it.
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "slow down" }), {
        status: 429,
        headers: {
          "content-type": "application/json",
          "retry-after-ms": "1",
        },
      })
    );
    const classifier = new TypeSafeClassifier({
      questions: QUESTIONS,
      apiKey: API_KEY,
      maxRetries: 3,
    });
    await expect(classifier.invoke("hi")).rejects.toThrow();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test("does not retry a non-retryable status", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "bad" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      })
    );
    const classifier = new TypeSafeClassifier({
      questions: QUESTIONS,
      apiKey: API_KEY,
      maxRetries: 3,
    });
    await expect(classifier.invoke("hi")).rejects.toThrow();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test("attaches retryAfterMs to a surfaced rate limit error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", {
        status: 429,
        headers: {
          "content-type": "application/json",
          "retry-after-ms": "250",
        },
      })
    );
    const classifier = new TypeSafeClassifier({
      questions: QUESTIONS,
      apiKey: API_KEY,
      maxRetries: 0,
    });
    const error = await classifier
      .invoke("hi")
      .then(() => null)
      .catch((e: unknown) => e);
    if (!TypeSafeRateLimitError.isInstance(error)) {
      throw new Error("wrong error type");
    }
    expect(error.retryAfterMs).toBe(250);
  });
});

describe("serialization and tracing", () => {
  test("serializes with a redacted api key", () => {
    const classifier = new TypeSafeClassifier({
      questions: QUESTIONS,
      apiKey: "super-secret",
    });
    const serialized = JSON.stringify(classifier.toJSON());
    expect(serialized).not.toContain("super-secret");
    expect(serialized).toContain("TYPESAFE_API_KEY");
    expect(serialized).toContain("TypeSafeClassifier");
  });

  test("never prints the api key via util.inspect/console.log", () => {
    const classifier = new TypeSafeClassifier({
      questions: QUESTIONS,
      apiKey: "sk-SUPER-SECRET-12345",
    });
    expect(inspect(classifier)).not.toContain("sk-SUPER-SECRET-12345");
    expect(inspect(classifier, { depth: 5 })).not.toContain(
      "sk-SUPER-SECRET-12345"
    );
  });

  test("declares the expected namespace and name", () => {
    const classifier = new TypeSafeClassifier({
      questions: QUESTIONS,
      apiKey: API_KEY,
    });
    expect(classifier.lc_namespace).toEqual([
      "langchain",
      "classifiers",
      "typesafe",
    ]);
    expect(classifier.getName()).toBe("TypeSafeClassifier");
  });

  test("fires exactly one chain start and one chain end", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse());
    const starts: string[] = [];
    const ends: string[] = [];
    const classifier = new TypeSafeClassifier({
      questions: QUESTIONS,
      apiKey: API_KEY,
    });

    await classifier.invoke("hi", {
      callbacks: [
        {
          handleChainStart: async () => {
            starts.push("start");
          },
          handleChainEnd: async () => {
            ends.push("end");
          },
        },
      ],
    });

    expect(starts).toHaveLength(1);
    expect(ends).toHaveLength(1);
  });

  test("stream yields exactly one chunk", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse());
    const classifier = new TypeSafeClassifier({
      questions: QUESTIONS,
      apiKey: API_KEY,
    });
    const chunks = [];
    for await (const chunk of await classifier.stream("hi")) {
      chunks.push(chunk);
    }
    expect(chunks).toHaveLength(1);
    expect(chunks[0].model).toBe("jev-1.13.0");
  });
});

describe("browser guard", () => {
  test("allows browser use by default", () => {
    expect(
      () => new TypeSafeClassifier({ questions: QUESTIONS, apiKey: API_KEY })
    ).not.toThrow();
  });

  test("dangerouslyAllowBrowser false is accepted outside a browser", () => {
    expect(
      () =>
        new TypeSafeClassifier({
          questions: QUESTIONS,
          apiKey: API_KEY,
          dangerouslyAllowBrowser: false,
        })
    ).not.toThrow();
  });
});
