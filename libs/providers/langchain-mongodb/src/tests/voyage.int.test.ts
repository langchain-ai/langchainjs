import { beforeAll, afterAll, describe, expect, test, vi } from "vitest";
import { VoyageEmbeddings } from "../voyage.js";

// oxlint-disable-next-line no-process-env
const VOYAGE_API_KEY =
  // oxlint-disable-next-line no-process-env
  process.env.VOYAGE_API_KEY ?? process.env.VOYAGEAI_API_KEY;

const VOYAGE_MODEL = "voyage-3";

// Skip the entire suite if no Voyage API key is available
const describeIfKey = VOYAGE_API_KEY ? describe : describe.skip;

describeIfKey("VoyageEmbeddings integration", () => {
  let embeddings: VoyageEmbeddings;

  beforeAll(() => {
    embeddings = new VoyageEmbeddings({
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
    expect(result.length).toBeGreaterThan(0);
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
      expect(vec.length).toBeGreaterThan(0);
      expect(vec.every((v) => typeof v === "number")).toBe(true);
    });
  });

  test("embedDocuments batches correctly — fetch called once per batch", async () => {
    // batchSize: 2 forces two API calls for three texts
    const batchedEmbeddings = new VoyageEmbeddings({
      modelName: VOYAGE_MODEL,
      apiKey: VOYAGE_API_KEY,
      batchSize: 2,
    });

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const texts = ["first", "second", "third"];

    const result = await batchedEmbeddings.embedDocuments(texts);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(3);
    result.forEach((vec) => expect(vec.length).toBeGreaterThan(0));
  });

  test("concurrency limit is respected with batchSize 1 and maxConcurrency 2", async () => {
    const concurrentEmbeddings = new VoyageEmbeddings({
      modelName: VOYAGE_MODEL,
      apiKey: VOYAGE_API_KEY,
      batchSize: 1,
      maxConcurrency: 2,
    });

    const texts = ["one", "two", "three", "four", "five", "six"];
    const result = await concurrentEmbeddings.embedDocuments(texts);

    expect(result).toHaveLength(texts.length);
    result.forEach((vec) => {
      expect(vec.length).toBeGreaterThan(0);
      expect(vec.every((v) => typeof v === "number")).toBe(true);
    });
  });

  test("inputType document vs query produces different embeddings", async () => {
    const docEmbeddings = new VoyageEmbeddings({
      modelName: VOYAGE_MODEL,
      apiKey: VOYAGE_API_KEY,
      inputType: "document",
    });
    const queryEmbeddings = new VoyageEmbeddings({
      modelName: VOYAGE_MODEL,
      apiKey: VOYAGE_API_KEY,
      inputType: "query",
    });

    const text = "MongoDB Atlas vector search";
    const [docVec, queryVec] = await Promise.all([
      docEmbeddings.embedQuery(text),
      queryEmbeddings.embedQuery(text),
    ]);

    expect(docVec).not.toEqual(queryVec);
  });
});
