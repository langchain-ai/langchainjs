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
