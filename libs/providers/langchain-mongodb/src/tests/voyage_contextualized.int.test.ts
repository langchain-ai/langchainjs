import { beforeAll, afterAll, describe, expect, test, vi } from "vitest";
import { VoyageContextualizedEmbeddings } from "../voyage_contextualized.js";

// oxlint-disable-next-line no-process-env
const VOYAGE_API_KEY =
  // oxlint-disable-next-line no-process-env
  process.env.VOYAGE_API_KEY ?? process.env.VOYAGEAI_API_KEY;

const VOYAGE_MODEL = "voyage-context-4";

// Skip the entire suite if no Voyage API key is available
const describeIfKey = VOYAGE_API_KEY ? describe : describe.skip;

describeIfKey("VoyageContextualizedEmbeddings integration", () => {
  let embeddings: VoyageContextualizedEmbeddings;

  beforeAll(() => {
    embeddings = new VoyageContextualizedEmbeddings({
      modelName: VOYAGE_MODEL,
      apiKey: VOYAGE_API_KEY,
    });
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  test("embedQuery returns a numeric vector of the expected dimension", async () => {
    const result = await embeddings.embedQuery("What is MongoDB Atlas?");

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1024);
    expect(result.every((v) => typeof v === "number")).toBe(true);
  });

  test("embedQuery results for similar texts are closer than for dissimilar texts", async () => {
    const [a, b, c] = await Promise.all([
      embeddings.embedQuery("MongoDB Atlas vector search"),
      embeddings.embedQuery("Atlas vector similarity search"),
      embeddings.embedQuery("How to bake sourdough bread"),
    ]);

    const dot = (x: number[], y: number[]) =>
      x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const norm = (x: number[]) => Math.sqrt(dot(x, x));
    const cosine = (x: number[], y: number[]) =>
      dot(x, y) / (norm(x) * norm(y));

    expect(cosine(a, b)).toBeGreaterThan(cosine(a, c));
  });

  test("embedDocuments returns one embedding per input text", async () => {
    const texts = [
      "Vector search in MongoDB",
      "Atlas Search indexes",
      "LangChain integrations",
    ];

    const result = await embeddings.embedDocuments(texts);

    expect(result).toHaveLength(texts.length);
    result.forEach((vec) => {
      expect(Array.isArray(vec)).toBe(true);
      expect(vec.length).toBe(1024);
      expect(vec.every((v) => typeof v === "number")).toBe(true);
    });
  });

  test("embedDocumentChunks returns one embedding per chunk, grouped per document", async () => {
    const documents = [
      [
        "MongoDB Atlas is a fully managed cloud database.",
        "It supports vector search for semantic retrieval.",
      ],
      ["LangChain provides integrations for many providers."],
    ];

    const result = await embeddings.embedDocumentChunks(documents);

    expect(result).toHaveLength(documents.length);
    result.forEach((doc, i) => {
      expect(doc).toHaveLength(documents[i].length);
      doc.forEach((vec) => {
        expect(Array.isArray(vec)).toBe(true);
        expect(vec.length).toBe(1024);
        expect(vec.every((v) => typeof v === "number")).toBe(true);
      });
    });
  });

  test("outputDimension produces embeddings of the requested size", async () => {
    const smallEmbeddings = new VoyageContextualizedEmbeddings({
      modelName: VOYAGE_MODEL,
      apiKey: VOYAGE_API_KEY,
      outputDimension: 256,
    });

    const result = await smallEmbeddings.embedQuery("MongoDB Atlas");

    expect(result.length).toBe(256);
  });
});
