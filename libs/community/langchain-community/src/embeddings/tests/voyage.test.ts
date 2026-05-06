import { test, vi, expect, beforeEach, afterEach } from "vitest";
import { VoyageEmbeddings } from "../voyage.js";

const FAKE_API_KEY = "voyage-test-key";

function makeFetchMock(
  body: unknown,
  status = 200
): typeof global.fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("embedDocuments surfaces Voyage API error with detail field (issue #10031)", async () => {
  global.fetch = makeFetchMock({ detail: "Provided API key is invalid." }, 401);

  const embeddings = new VoyageEmbeddings({ apiKey: FAKE_API_KEY });

  await expect(embeddings.embedDocuments(["Hello"])).rejects.toThrow(
    "Voyage AI API error (HTTP 401): Provided API key is invalid."
  );
});

test("embedQuery surfaces Voyage API error with detail field", async () => {
  global.fetch = makeFetchMock({ detail: "Provided API key is invalid." }, 401);

  const embeddings = new VoyageEmbeddings({ apiKey: FAKE_API_KEY });

  await expect(embeddings.embedQuery("Hello")).rejects.toThrow(
    "Voyage AI API error (HTTP 401): Provided API key is invalid."
  );
});

test("embedDocuments surfaces generic Voyage API error via error.message field", async () => {
  // 400 is in AsyncCaller's STATUS_NO_RETRY list, so it won't be retried.
  global.fetch = makeFetchMock(
    { error: { message: "Input exceeds maximum token length" } },
    400
  );

  const embeddings = new VoyageEmbeddings({ apiKey: FAKE_API_KEY });

  await expect(embeddings.embedDocuments(["Hello"])).rejects.toThrow(
    "Voyage AI API error (HTTP 400): Input exceeds maximum token length"
  );
});

test("embedDocuments succeeds on a valid 200 response", async () => {
  const fakeEmbedding = [0.1, 0.2, 0.3];
  global.fetch = makeFetchMock({
    data: [{ embedding: fakeEmbedding }],
    model: "voyage-01",
    usage: { total_tokens: 3 },
  });

  const embeddings = new VoyageEmbeddings({ apiKey: FAKE_API_KEY });
  const result = await embeddings.embedDocuments(["Hello"]);

  expect(result).toEqual([fakeEmbedding]);
});

test("embedDocuments falls back to JSON.stringify for unknown error payload shape", async () => {
  // Neither `detail` nor `error.message` are present: the thrown error should
  // still surface the raw payload instead of crashing or producing an opaque
  // "undefined" message.
  const unknownPayload = { unexpected: "shape", code: 42 };
  global.fetch = makeFetchMock(unknownPayload, 500);

  const embeddings = new VoyageEmbeddings({ apiKey: FAKE_API_KEY });

  await expect(embeddings.embedDocuments(["Hello"])).rejects.toThrow(
    `Voyage AI API error (HTTP 500): ${JSON.stringify(unknownPayload)}`
  );
});

test("embedDocuments does not retry on 4xx errors (STATUS_NO_RETRY)", async () => {
  // 401 is in AsyncCaller's STATUS_NO_RETRY list. With `.status` attached to
  // the thrown error, defaultFailedAttemptHandler must rethrow immediately so
  // fetch is called exactly once.
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ detail: "Provided API key is invalid." }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
  global.fetch = fetchMock;

  const embeddings = new VoyageEmbeddings({
    apiKey: FAKE_API_KEY,
    // Give retries plenty of room — the point is that *none* should happen.
    maxRetries: 5,
  });

  await expect(embeddings.embedDocuments(["Hello"])).rejects.toThrow(
    "Voyage AI API error (HTTP 401)"
  );

  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("embedDocuments does retry on 5xx errors", async () => {
  // 500 is NOT in STATUS_NO_RETRY, so the AsyncCaller should retry.
  // First call fails, second succeeds.
  const fakeEmbedding = [0.4, 0.5, 0.6];
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ detail: "Temporary server error" }),
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ embedding: fakeEmbedding }],
        model: "voyage-01",
        usage: { total_tokens: 3 },
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
  global.fetch = fetchMock;

  const embeddings = new VoyageEmbeddings({
    apiKey: FAKE_API_KEY,
    maxRetries: 2,
  });

  const result = await embeddings.embedDocuments(["Hello"]);

  expect(result).toEqual([fakeEmbedding]);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
