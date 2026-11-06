import { afterEach, describe, expect, expectTypeOf, test, vi } from "vitest";
import { AIMessageChunk, HumanMessage } from "@langchain/core/messages";
import { InMemoryCache } from "@langchain/core/caches";
import type { ChatModelStreamEvent } from "@langchain/core/language_models/event";
import { ApiClient } from "../../clients/index.js";
import { RequestError } from "../../utils/errors.js";
import { withTimeoutSignal } from "../../utils/misc.js";
import { convertGoogleGeminiStream } from "../../converters/generate_content/stream_events.js";
import {
  ChatGoogle,
  type ChatGoogleCallOptions,
  type ChatGoogleParams,
} from "../index.js";
import type {
  BaseChatGoogleCallOptions,
  BaseChatGoogleFields,
  BaseChatGoogleParams,
  Gemini,
  GenerateContentApiHandlerParams,
  GenerateContentSpecificFields,
} from "../types.js";

type GenerateContentResponse = Gemini.GenContent.GenerateContentResponse;

/** A JSON reply, a list of SSE chunks, or a raw Response (e.g. an error). */
type MockReply = GenerateContentResponse | GenerateContentResponse[] | Response;

class MockLongDecodeApiClient extends ApiClient {
  bodies: Gemini.GenContent.GenerateContentRequest[] = [];

  constructor(private readonly replies: MockReply[]) {
    super();
  }

  async fetch(request: Request): Promise<Response> {
    this.bodies.push(await request.json());
    const reply = this.replies.shift();
    if (reply === undefined) {
      throw new Error("Unexpected request: no mock reply left");
    }
    if (reply instanceof Response) {
      return reply;
    }
    if (Array.isArray(reply)) {
      const sse = reply.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`);
      return new Response(sse.join(""), {
        headers: { "Content-Type": "text/event-stream" },
      });
    }
    return new Response(JSON.stringify(reply), {
      headers: { "Content-Type": "application/json" },
    });
  }

  hasApiKey(): boolean {
    return true;
  }
}

/** Never responds; rejects only when the request's signal aborts. */
class HangingApiClient extends ApiClient {
  calls = 0;

  async fetch(request: Request): Promise<Response> {
    this.calls += 1;
    return new Promise((_, reject) => {
      request.signal.addEventListener(
        "abort",
        () => reject(request.signal.reason),
        { once: true }
      );
    });
  }

  hasApiKey(): boolean {
    return true;
  }
}

function hop(
  text: string,
  finishReason: string,
  continuationToken?: string
): GenerateContentResponse {
  return {
    candidates: [
      {
        content: { role: "model", parts: [{ text }] },
        finishReason,
        ...(continuationToken ? { continuationToken } : {}),
      },
    ],
    usageMetadata: {
      promptTokenCount: 10,
      candidatesTokenCount: 5,
      totalTokenCount: 15,
    },
  };
}

function argon(
  replies: MockReply[],
  fields: Partial<ChatGoogleParams> = {}
): { model: ChatGoogle; client: MockLongDecodeApiClient } {
  const client = new MockLongDecodeApiClient(replies);
  const model = new ChatGoogle({
    model: "gemini-4-argon",
    apiClient: client,
    maxOutputTokens: 262_144,
    thinkingLevel: "high",
    ...fields,
  });
  return { model, client };
}

const prompt = [new HumanMessage("Write a very long report.")];

function concatChunks(chunks: AIMessageChunk[]): AIMessageChunk {
  return chunks.reduce((acc, chunk) => acc.concat(chunk));
}

describe("Long Decode: non-streaming", () => {
  test("a normal response has no continuation token", async () => {
    const { model, client } = argon([hop("Done.", "STOP")]);
    const result = await model.invoke(prompt);

    expect(result.text).toBe("Done.");
    expect(result.response_metadata.finishReason).toBe("STOP");
    expect(result.response_metadata).not.toHaveProperty("continuationToken");
    expect(client.bodies[0]).not.toHaveProperty("continuationToken");
  });

  test("exposes the token and CONTINUATION finish reason", async () => {
    const { model } = argon([hop("Part one", "CONTINUATION", "tok-1")]);
    const result = await model.invoke(prompt);

    expect(result.text).toBe("Part one");
    expect(result.response_metadata.finishReason).toBe("CONTINUATION");
    expect(result.response_metadata.continuationToken).toBe("tok-1");
  });

  test("exposes a token returned with MAX_TOKENS", async () => {
    const { model } = argon([hop("Cut off", "MAX_TOKENS", "tok-max")]);
    const result = await model.invoke(prompt);

    expect(result.response_metadata.finishReason).toBe("MAX_TOKENS");
    expect(result.response_metadata.continuationToken).toBe("tok-max");
  });

  test("handles a thinking-only hop with empty visible text", async () => {
    // Shape taken from Google's Long Decode documentation.
    const { model } = argon([
      {
        candidates: [
          {
            content: { role: "model", parts: [{ text: "" }] },
            finishReason: "CONTINUATION",
            continuationToken: "CiQ4ZmQ3",
          },
        ],
        usageMetadata: {
          promptTokenCount: 142,
          candidatesTokenCount: 0,
          thoughtsTokenCount: 32768,
          totalTokenCount: 32910,
        },
      },
    ]);
    const result = await model.invoke(prompt);

    expect(result.text).toBe("");
    expect(result.response_metadata.continuationToken).toBe("CiQ4ZmQ3");
    expect(result.usage_metadata?.output_token_details?.reasoning).toBe(32768);
  });

  test("handles a hop whose only output is a thought part", async () => {
    const { model } = argon([
      {
        candidates: [
          {
            content: {
              role: "model",
              parts: [{ text: "Planning the outline", thought: true }],
            },
            finishReason: "CONTINUATION",
            continuationToken: "tok-thought",
          },
        ],
      },
    ]);
    const result = await model.invoke(prompt);

    expect(result.text).toBe("");
    expect(result.response_metadata.continuationToken).toBe("tok-thought");
  });

  test("sends the token at the top level of an otherwise identical request", async () => {
    const { model, client } = argon([
      hop("Part one", "CONTINUATION", "tok-1"),
      hop(" part two", "STOP"),
    ]);
    const first = await model.invoke(prompt);
    await model.invoke(prompt, {
      continuationToken: first.response_metadata.continuationToken as string,
    });

    const [initial, resumed] = client.bodies;
    expect(resumed.continuationToken).toBe("tok-1");
    expect(resumed.generationConfig).not.toHaveProperty("continuationToken");
    const { continuationToken: _token, ...rest } = resumed;
    expect(rest).toEqual(initial);
  });

  test("supports several caller-managed hops", async () => {
    const { model, client } = argon([
      hop("A", "CONTINUATION", "tok-1"),
      hop("B", "CONTINUATION", "tok-2"),
      hop("C", "STOP"),
    ]);

    const parts: string[] = [];
    let token: string | undefined;
    for (;;) {
      const result = await model.invoke(prompt, { continuationToken: token });
      parts.push(result.text);
      token = result.response_metadata.continuationToken as string | undefined;
      if (result.response_metadata.finishReason !== "CONTINUATION") break;
    }

    expect(parts.join("")).toBe("ABC");
    expect(client.bodies.map((body) => body.continuationToken)).toEqual([
      undefined,
      "tok-1",
      "tok-2",
    ]);
    for (const body of client.bodies) {
      expect(body.contents).toEqual(client.bodies[0].contents);
    }
  });

  test("never continues automatically", async () => {
    const { model, client } = argon([
      hop("Part one", "CONTINUATION", "tok-1"),
      hop("unexpected", "STOP"),
    ]);
    await model.invoke(prompt);

    expect(client.bodies).toHaveLength(1);
  });

  test("cache entries are keyed by continuation token", async () => {
    const { model, client } = argon(
      [hop("A", "CONTINUATION", "tok-1"), hop("B", "STOP")],
      { cache: new InMemoryCache() }
    );

    const first = await model.invoke(prompt);
    const second = await model.invoke(prompt, { continuationToken: "tok-1" });
    const repeated = await model.invoke(prompt, { continuationToken: "tok-1" });

    expect(first.text).toBe("A");
    expect(second.text).toBe("B");
    expect(repeated.text).toBe("B");
    expect(client.bodies).toHaveLength(2);
  });

  test("redacts the token from traces but sends it to Google", async () => {
    const traced: Record<string, unknown>[] = [];
    const { model, client } = argon([hop("B", "STOP")], {
      callbacks: [
        {
          handleChatModelStart(_llm, _messages, _runId, _parentRunId, extra) {
            if (extra) traced.push(extra);
          },
        },
      ],
    });
    await model.invoke(prompt, { continuationToken: "secret-state" });

    expect(client.bodies[0].continuationToken).toBe("secret-state");
    expect(traced).toHaveLength(1);
    expect(traced[0]).toMatchObject({
      options: { continuationToken: "**REDACTED**" },
    });
    expect(traced[0].invocation_params).not.toHaveProperty("continuationToken");
    expect(JSON.stringify(traced)).not.toContain("secret-state");
  });

  test("surfaces API errors for a rejected token without retrying", async () => {
    const { model, client } = argon([
      new Response(
        JSON.stringify({
          error: {
            code: 400,
            message: "Continuation token has already used output tokens",
            status: "INVALID_ARGUMENT",
          },
        }),
        { status: 400, statusText: "Bad Request" }
      ),
    ]);

    await expect(
      model.invoke(prompt, { continuationToken: "stale" })
    ).rejects.toBeInstanceOf(RequestError);
    expect(client.bodies).toHaveLength(1);
  });
});

describe("Long Decode: request configuration", () => {
  test("continuationToken is a Generate Content field and call option", () => {
    expectTypeOf<GenerateContentSpecificFields>().toHaveProperty(
      "continuationToken"
    );
    expectTypeOf<BaseChatGoogleFields>().not.toHaveProperty(
      "continuationToken"
    );
    expectTypeOf<
      BaseChatGoogleCallOptions["continuationToken"]
    >().toEqualTypeOf<string | undefined>();
    expectTypeOf<ChatGoogleCallOptions["continuationToken"]>().toEqualTypeOf<
      string | undefined
    >();
  });

  test("continuationToken is not a constructor option", () => {
    expectTypeOf<BaseChatGoogleParams>().not.toHaveProperty(
      "continuationToken"
    );
    expectTypeOf<ChatGoogleParams>().not.toHaveProperty("continuationToken");
    expectTypeOf<GenerateContentApiHandlerParams>().not.toHaveProperty(
      "continuationToken"
    );

    new ChatGoogle({
      model: "gemini-4-argon",
      apiClient: new HangingApiClient(),
      // @ts-expect-error continuationToken is accepted only per call
      continuationToken: "tok",
    });
  });

  test("forwards maxOutputTokens above the per-hop limit without clamping", async () => {
    const { model, client } = argon([hop("A", "STOP"), hop("B", "STOP")]);
    await model.invoke(prompt);
    await model.invoke(prompt, { maxOutputTokens: 1_048_576 });

    expect(client.bodies[0].generationConfig?.maxOutputTokens).toBe(262_144);
    expect(client.bodies[1].generationConfig?.maxOutputTokens).toBe(1_048_576);
  });

  test("keeps Argon thinking configuration on resumed requests", async () => {
    const { model, client } = argon([hop("A", "STOP")]);
    await model.invoke(prompt, { continuationToken: "tok-1" });

    expect(client.bodies[0].generationConfig?.thinkingConfig).toEqual({
      includeThoughts: true,
      thinkingLevel: "HIGH",
    });
  });

  test("still downgrades minimal thinking for Argon", async () => {
    const { model, client } = argon([hop("A", "STOP")], {
      thinkingLevel: "minimal",
    });
    await model.invoke(prompt);

    expect(client.bodies[0].generationConfig?.thinkingConfig).toEqual({
      includeThoughts: false,
      thinkingLevel: "LOW",
    });
  });

  test("ordinary models send unchanged requests", async () => {
    const client = new MockLongDecodeApiClient([hop("Hi", "STOP")]);
    const model = new ChatGoogle({
      model: "gemini-2.5-flash",
      apiClient: client,
    });
    const result = await model.invoke(prompt);

    expect(client.bodies[0]).not.toHaveProperty("continuationToken");
    expect(client.bodies[0].generationConfig).not.toHaveProperty(
      "thinkingConfig"
    );
    expect(result.response_metadata).not.toHaveProperty("continuationToken");
  });
});

describe("Long Decode: streaming", () => {
  // Long Decode streams send checkpoint tokens every few thousand tokens.
  const checkpointChunks: GenerateContentResponse[] = [
    {
      candidates: [
        {
          content: { role: "model", parts: [{ text: "Part A " }] },
          continuationToken: "ckpt-1",
        },
      ],
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 5,
        totalTokenCount: 15,
      },
    },
    {
      candidates: [
        {
          content: { role: "model", parts: [{ text: "Part B" }] },
          finishReason: "CONTINUATION",
          continuationToken: "ckpt-2",
        },
      ],
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 9,
        totalTokenCount: 19,
      },
    },
  ];

  test("aggregated chunks carry only the latest token", async () => {
    const { model } = argon([checkpointChunks]);
    const chunks: AIMessageChunk[] = [];
    for await (const chunk of await model.stream(prompt)) chunks.push(chunk);
    const message = concatChunks(chunks);

    expect(message.content).toBe("Part A Part B");
    expect(message.response_metadata.continuationToken).toBe("ckpt-2");
    expect(message.response_metadata.finishReason).toBe("CONTINUATION");
  });

  test("preserves streaming usage alongside the token", async () => {
    const { model } = argon([checkpointChunks]);
    const chunks: AIMessageChunk[] = [];
    for await (const chunk of await model.stream(prompt)) chunks.push(chunk);

    expect(concatChunks(chunks).usage_metadata).toMatchObject({
      input_tokens: 10,
      output_tokens: 9,
      total_tokens: 19,
    });
  });

  test("streaming: true invoke keeps the latest token", async () => {
    const { model } = argon([checkpointChunks], { streaming: true });
    const result = await model.invoke(prompt);

    expect(result.text).toBe("Part A Part B");
    expect(result.response_metadata.continuationToken).toBe("ckpt-2");
  });

  test("sends the token on a resumed stream", async () => {
    const { model, client } = argon([[hop("Rest", "STOP")]]);
    for await (const _ of await model.stream(prompt, {
      continuationToken: "ckpt-2",
    })) {
      // drain
    }

    expect(client.bodies[0].continuationToken).toBe("ckpt-2");
  });

  test("streams without a token emit no extra chunk", async () => {
    const { model } = argon([[hop("Hello", "STOP")]]);
    const chunks: AIMessageChunk[] = [];
    for await (const chunk of await model.stream(prompt)) chunks.push(chunk);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].response_metadata).not.toHaveProperty("continuationToken");
  });
});

describe("Long Decode: stream events", () => {
  async function finishEvent(chunks: GenerateContentResponse[]) {
    async function* source() {
      yield* chunks;
    }
    const events: ChatModelStreamEvent[] = [];
    for await (const event of convertGoogleGeminiStream(source())) {
      events.push(event);
    }
    return events.find((event) => event.event === "message-finish");
  }

  test("reports CONTINUATION as length with the latest token", async () => {
    const finish = await finishEvent([
      hop("A", "", "ckpt-1"),
      hop("B", "CONTINUATION", "ckpt-2"),
    ]);

    expect(finish).toMatchObject({
      reason: "length",
      responseMetadata: {
        continuationToken: "ckpt-2",
        finishReason: "CONTINUATION",
      },
    });
  });

  test("leaves ordinary responses unchanged", async () => {
    const finish = await finishEvent([hop("Hello", "STOP")]);

    expect(finish).toMatchObject({ reason: "stop" });
    expect(finish).toHaveProperty("responseMetadata", {
      model_provider: "google",
    });
  });
});

describe("Long Decode: timeouts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Timeouts the handler applied to requests, in milliseconds. */
  function spyOnTimeouts() {
    return vi.spyOn(AbortSignal, "timeout");
  }

  test("ordinary requests keep fetch's default behavior", async () => {
    const timeouts = spyOnTimeouts();
    const { model } = argon([hop("Hi", "STOP"), [hop("Hi", "STOP")]], {
      model: "gemini-2.5-flash",
      maxOutputTokens: 64_000,
      thinkingLevel: undefined,
    });

    await model.invoke(prompt);
    for await (const _ of await model.stream(prompt)) {
      // drain
    }
    expect(timeouts).not.toHaveBeenCalled();
  });

  test("Long Decode requests default to 20 minutes", async () => {
    const timeouts = spyOnTimeouts();
    const { model } = argon([hop("A", "STOP"), [hop("B", "STOP")]]);

    await model.invoke(prompt);
    for await (const _ of await model.stream(prompt)) {
      // drain
    }
    expect(timeouts.mock.calls).toEqual([[20 * 60 * 1000], [20 * 60 * 1000]]);
  });

  test("an explicit timeout overrides the Long Decode default", async () => {
    const timeouts = spyOnTimeouts();
    await argon([hop("A", "STOP")], { timeout: 5_000 }).model.invoke(prompt);
    expect(timeouts.mock.calls).toEqual([[5_000]]);

    timeouts.mockClear();
    await argon([hop("A", "STOP")], { timeout: 0 }).model.invoke(prompt);
    expect(timeouts).not.toHaveBeenCalled();
  });

  test("an explicit timeout applies to ordinary requests", async () => {
    const timeouts = spyOnTimeouts();
    const { model } = argon([hop("Hi", "STOP")], {
      model: "gemini-2.5-flash",
      maxOutputTokens: undefined,
      thinkingLevel: undefined,
      timeout: 5_000,
    });

    await model.invoke(prompt);
    expect(timeouts.mock.calls).toEqual([[5_000]]);
  });

  test("a per-call maxOutputTokens above 64,000 gets the Long Decode default on every request path", async () => {
    const timeouts = spyOnTimeouts();
    const { model } = argon(
      [hop("A", "STOP"), [hop("B", "STOP")], [hop("C", "STOP")]],
      { maxOutputTokens: undefined }
    );
    const options = { maxOutputTokens: 262_144 };

    await model.invoke(prompt, options);
    for await (const _ of await model.stream(prompt, options)) {
      // drain
    }
    for await (const _ of model.streamEvents(prompt, options)) {
      // drain
    }
    expect(timeouts.mock.calls).toEqual([
      [20 * 60 * 1000],
      [20 * 60 * 1000],
      [20 * 60 * 1000],
    ]);
  });

  test.each([
    ["constructor", 64_000, []],
    ["constructor", 64_001, [[20 * 60 * 1000]]],
    ["per-call", 64_000, []],
    ["per-call", 64_001, [[20 * 60 * 1000]]],
  ])(
    "%s maxOutputTokens of %i is compared against 64,000",
    async (where, maxOutputTokens, expected) => {
      const timeouts = spyOnTimeouts();
      const { model } = argon([hop("A", "STOP")], {
        maxOutputTokens: where === "constructor" ? maxOutputTokens : undefined,
      });

      await model.invoke(
        prompt,
        where === "per-call" ? { maxOutputTokens } : undefined
      );
      expect(timeouts.mock.calls).toEqual(expected);
    }
  );

  test("a per-call maxOutputTokens overrides the constructor's", async () => {
    const timeouts = spyOnTimeouts();
    const { model } = argon([hop("A", "STOP")]);

    await model.invoke(prompt, { maxOutputTokens: 1_000 });
    expect(timeouts).not.toHaveBeenCalled();
  });

  test("an explicit timeout overrides a per-call Long Decode request", async () => {
    const timeouts = spyOnTimeouts();
    const options = { maxOutputTokens: 262_144 };
    await argon([hop("A", "STOP")], {
      maxOutputTokens: undefined,
      timeout: 5_000,
    }).model.invoke(prompt, options);
    expect(timeouts.mock.calls).toEqual([[5_000]]);

    timeouts.mockClear();
    await argon([hop("A", "STOP")], {
      maxOutputTokens: undefined,
      timeout: 0,
    }).model.invoke(prompt, options);
    expect(timeouts).not.toHaveBeenCalled();
  });

  test("rejects invalid timeouts", () => {
    const apiClient = new HangingApiClient();
    expect(
      () => new ChatGoogle({ model: "gemini-4-argon", apiClient, timeout: -1 })
    ).toThrow(/timeout/);
    expect(
      () =>
        new ChatGoogle({
          model: "gemini-4-argon",
          apiClient,
          timeout: Number.NaN,
        })
    ).toThrow(/timeout/);
  });

  test("aborts a request that exceeds the configured timeout", async () => {
    const apiClient = new HangingApiClient();
    const model = new ChatGoogle({
      model: "gemini-4-argon",
      apiClient,
      timeout: 50,
      maxRetries: 2,
    });

    await expect(model.invoke(prompt)).rejects.toMatchObject({
      name: "TimeoutError",
    });
    expect(apiClient.calls).toBe(1);
  });

  test("aborts a stream that exceeds the configured timeout", async () => {
    const model = new ChatGoogle({
      model: "gemini-4-argon",
      apiClient: new HangingApiClient(),
      timeout: 50,
    });

    await expect(async () => {
      for await (const _ of await model.stream(prompt)) {
        // drain
      }
    }).rejects.toMatchObject({ name: "TimeoutError" });
  });

  test("a per-call timeout shorter than the Long Decode default still applies", async () => {
    const model = new ChatGoogle({
      model: "gemini-4-argon",
      apiClient: new HangingApiClient(),
      maxOutputTokens: 262_144,
    });

    await expect(model.invoke(prompt, { timeout: 50 })).rejects.toMatchObject({
      name: "TimeoutError",
    });
  });

  test.each([
    ["an explicit timeout", { timeout: 60_000 }, {}],
    ["the Long Decode default", { maxOutputTokens: 262_144 }, {}],
    ["a per-call Long Decode request", {}, { maxOutputTokens: 262_144 }],
    ["no timeout", {}, {}],
  ])(
    "caller cancellation still works with %s",
    async (_, fields, callOptions) => {
      const model = new ChatGoogle({
        model: "gemini-4-argon",
        apiClient: new HangingApiClient(),
        ...fields,
      });
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 20);

      await expect(
        model.invoke(prompt, { ...callOptions, signal: controller.signal })
      ).rejects.toMatchObject({ name: "AbortError" });
    }
  );

  test("caller cancellation stops a per-call Long Decode stream", async () => {
    const model = new ChatGoogle({
      model: "gemini-4-argon",
      apiClient: new HangingApiClient(),
    });
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 20);

    await expect(async () => {
      for await (const _ of await model.stream(prompt, {
        maxOutputTokens: 262_144,
        signal: controller.signal,
      })) {
        // drain
      }
    }).rejects.toMatchObject({ name: "AbortError" });
  });

  test("withTimeoutSignal combines or passes through signals", async () => {
    const controller = new AbortController();
    expect(withTimeoutSignal(undefined, 0)).toBeUndefined();
    expect(withTimeoutSignal(controller.signal, 0)).toBe(controller.signal);
    expect(withTimeoutSignal(undefined, 1_000)?.aborted).toBe(false);

    const combined = withTimeoutSignal(controller.signal, 60_000);
    controller.abort();
    expect(combined?.aborted).toBe(true);
  });
});
