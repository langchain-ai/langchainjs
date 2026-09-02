import { readFileSync } from "node:fs";
import { afterEach, describe, expect, test, vi } from "vitest";
import { get_encoding } from "@dqbd/tiktoken";
import { Tiktoken as JsTiktoken } from "js-tiktoken/lite";
import type { TiktokenEncoding } from "js-tiktoken/lite";
import cl100kRanks from "js-tiktoken/ranks/cl100k_base";

type FixtureRow = {
  encoding: string;
  category: string;
  input: string;
  canonicalLength: number;
};

type SpecialPolicy = {
  encoding: string;
  input: string;
  allowedAllLength: number;
};

type FixtureData = {
  representative: FixtureRow[];
  knownEdgeCases: FixtureRow[];
  specialPolicy: SpecialPolicy[];
};

const fixtures = JSON.parse(
  readFileSync(
    new URL("./fixtures/tiktoken-canonical-fixtures.json", import.meta.url),
    "utf8"
  )
) as FixtureData;
const originalFetch = globalThis.fetch;
const moduleSpecifiers = [
  "hypertok",
  "hypertok/tiktoken",
  "hypertok/vocab-resolve",
];

const encodingNames: Record<string, TiktokenEncoding> = {
  cl100k_base: "cl100k_base",
  o200k_base: "o200k_base",
  "r50k_base/gpt2": "r50k_base",
  p50k_base: "p50k_base",
};

function jsonFetch(response = cl100kRanks) {
  const fetchMock = vi.fn<typeof fetch>(async () =>
    Promise.resolve(
      new Response(JSON.stringify(response), {
        headers: { "content-type": "application/json" },
      })
    )
  );
  globalThis.fetch = fetchMock;
  return fetchMock;
}

function unavailableFetch() {
  const error = new Error("tokenizer endpoint unavailable");
  error.name = "AbortError";
  const fetchMock = vi.fn<typeof fetch>(async () => Promise.reject(error));
  globalThis.fetch = fetchMock;
  return fetchMock;
}

function mockFailingHypertok(message = "hypertok unavailable") {
  const loadVocab = vi.fn(async () => {
    throw new Error(message);
  });
  vi.doMock("hypertok", () => ({ fromBytes: vi.fn() }));
  vi.doMock("hypertok/tiktoken", () => ({
    createTiktokenShim: vi.fn(),
  }));
  vi.doMock("hypertok/vocab-resolve", () => ({ loadVocab }));
  return loadVocab;
}

function mockSuccessfulHypertok({ throwOnEncode = false } = {}) {
  const loadVocab = vi.fn(async () => new Uint8Array([1]));
  const fromBytes = vi.fn(async () => ({ runtime: true }));
  const encode = vi.fn((text: string) => {
    if (throwOnEncode) throw new Error("encode failed");
    return Uint32Array.of(text.length);
  });
  const decode = vi.fn(() => new TextEncoder().encode("decoded"));
  const createTiktokenShim = vi.fn(() => ({ encode, decode }));
  vi.doMock("hypertok", () => ({ fromBytes }));
  vi.doMock("hypertok/tiktoken", () => ({ createTiktokenShim }));
  vi.doMock("hypertok/vocab-resolve", () => ({ loadVocab }));
  return { loadVocab, fromBytes, createTiktokenShim, encode };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  for (const specifier of moduleSpecifiers) {
    vi.doUnmock(specifier);
  }
  vi.resetModules();
});

describe.sequential("tiktoken integration", () => {
  test("matches canonical counts for representative and known edge cases", async () => {
    const { getEncoding } = await import("../tiktoken.js");
    const fixturesByEncoding = [
      ...fixtures.representative,
      ...fixtures.knownEdgeCases,
    ];

    for (const [fixtureName, encodingName] of Object.entries(encodingNames)) {
      const rows = fixturesByEncoding.filter(
        (row) => row.encoding === fixtureName
      );
      const canonical = get_encoding(encodingName);
      const encoder = await getEncoding(encodingName);
      try {
        for (const row of rows) {
          expect(canonical.encode(row.input).length).toBe(row.canonicalLength);
          expect(encoder.encode(row.input).length).toBe(row.canonicalLength);
        }
      } finally {
        canonical.free();
      }
    }
  });

  test("preserves canonical special-token throw semantics", async () => {
    const { getEncoding } = await import("../tiktoken.js");

    for (const policy of fixtures.specialPolicy) {
      const encodingName = encodingNames[policy.encoding];
      const canonical = get_encoding(encodingName);
      const encoder = await getEncoding(encodingName);
      try {
        expect(() => canonical.encode(policy.input)).toThrow();
        expect(() => encoder.encode(policy.input)).toThrow();
        expect(canonical.encode(policy.input, "all").length).toBe(
          policy.allowedAllLength
        );
        expect(encoder.encode(policy.input, "all").length).toBe(
          policy.allowedAllLength
        );
      } finally {
        canonical.free();
      }
    }
  });

  test("warns and falls back to js-tiktoken when hypertok fails", async () => {
    mockFailingHypertok("local tokenizer unavailable");
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = jsonFetch();
    const { getEncoding } = await import("../tiktoken.js");

    const encoder = await getEncoding("cl100k_base");
    const expected = new JsTiktoken(cl100kRanks).encode("fallback");
    expect(encoder.encode("fallback")).toEqual(expected);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://tiktoken.pages.dev/js/cl100k_base.json"
    );
    expect(warning).toHaveBeenCalledOnce();
    expect(warning).toHaveBeenCalledWith(
      "Failed to initialize hypertok, falling back to js-tiktoken",
      expect.objectContaining({ message: "local tokenizer unavailable" })
    );
  });

  test("falls back after a vocabulary request times out", async () => {
    vi.useFakeTimers();
    const { createVocabLoader } = await vi.importActual<
      typeof import("hypertok/vocab-resolve")
    >("hypertok/vocab-resolve");
    const abortObserved = vi.fn();
    const hangingFetch = vi.fn(
      (_input: string, { signal }: { signal: AbortSignal }) =>
        new Promise<never>((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => {
              abortObserved();
              reject(new Error("aborted"));
            },
            { once: true }
          );
        })
    );
    const loader = createVocabLoader({
      readLocal: async () => {
        throw new Error("local vocab unavailable");
      },
      fetch: hangingFetch,
    });
    vi.doMock("hypertok", () => ({ fromBytes: vi.fn() }));
    vi.doMock("hypertok/tiktoken", () => ({
      createTiktokenShim: vi.fn(),
    }));
    vi.doMock("hypertok/vocab-resolve", () => ({
      loadVocab: (name: string, options?: { file?: string }) =>
        loader(name, { ...options, timeoutMs: 50 }),
    }));
    const fetchMock = jsonFetch();
    const { getEncoding } = await import("../tiktoken.js");

    const pending = getEncoding("cl100k_base");
    await vi.waitFor(() => expect(hangingFetch).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(51);
    const encoder = await pending;

    expect(abortObserved).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(encoder.encode("fallback").length).toBeGreaterThan(0);
  });

  test("shares encoder initialization across concurrent callers", async () => {
    const { loadVocab, fromBytes, createTiktokenShim } =
      mockSuccessfulHypertok();
    const { getEncoding } = await import("../tiktoken.js");

    const [first, concurrent] = await Promise.all([
      getEncoding("cl100k_base"),
      getEncoding("cl100k_base"),
    ]);
    const sequential = await getEncoding("cl100k_base");

    expect(first).toBe(concurrent);
    expect(first).toBe(sequential);
    expect(loadVocab).toHaveBeenCalledOnce();
    expect(fromBytes).toHaveBeenCalledOnce();
    expect(createTiktokenShim).toHaveBeenCalledOnce();
  });

  test("preserves caller fallback behavior", async () => {
    mockFailingHypertok();
    unavailableFetch();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const [{ calculateMaxTokens }, { FakeLLM }] = await Promise.all([
      import("../../language_models/base.js"),
      import("../testing/index.js"),
    ]);
    const model = new FakeLLM({});

    await expect(
      calculateMaxTokens({ prompt: "12345", modelName: "gpt-3.5-turbo" })
    ).resolves.toBe(4094);
    await expect(model.getNumTokens("12345")).resolves.toBe(2);
  });

  test("preserves per-call encode failure behavior", async () => {
    mockSuccessfulHypertok({ throwOnEncode: true });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const [{ getEncoding }, { calculateMaxTokens }] = await Promise.all([
      import("../tiktoken.js"),
      import("../../language_models/base.js"),
    ]);

    const encoder = await getEncoding("cl100k_base");
    expect(() => encoder.encode("12345")).toThrow("encode failed");
    await expect(
      calculateMaxTokens({ prompt: "12345", modelName: "gpt-3.5-turbo" })
    ).resolves.toBe(4094);
  });
});
