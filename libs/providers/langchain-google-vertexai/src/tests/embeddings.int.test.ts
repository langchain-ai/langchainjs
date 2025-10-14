import { test, expect } from "@jest/globals";
import { VertexAIEmbeddings } from "../embeddings.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onFailedAttempt(err: any): any {
  throw err;
}

const testModels = [
  {
    model: "text-embedding-005",
    location: "us-central1",
    defaultOutputDimensions: 768,
  },
  {
    model: "text-embedding-005",
    location: "europe-west9",
    defaultOutputDimensions: 768,
  },
  {
    model: "text-multilingual-embedding-002",
    location: "us-central1",
    defaultOutputDimensions: 768,
  },
  {
    model: "text-multilingual-embedding-002",
    location: "europe-west9",
    defaultOutputDimensions: 768,
  },
  {
    model: "gemini-embedding-001",
    location: "us-central1",
    defaultOutputDimensions: 3072,
  },
];

describe.each(testModels)(
  `Vertex Embeddings ($model) ($location)`,
  ({ model, location, defaultOutputDimensions }) => {
    test("embedQuery", async () => {
      const embeddings = new VertexAIEmbeddings({
        model,
        location,
      });
      const res = await embeddings.embedQuery("Hello world");
      expect(typeof res[0]).toBe("number");
      expect(res.length).toEqual(defaultOutputDimensions);
    });

    test("embedDocuments", async () => {
      const embeddings = new VertexAIEmbeddings({
        model,
        location,
        onFailedAttempt,
      });

      const res = await embeddings.embedDocuments([
        "Hello world",
        "Bye bye",
        "we need",
        "at least",
        "six documents",
        "to test pagination",
      ]);
      // console.log(res);
      expect(res).toHaveLength(6);
      res.forEach((r) => {
        expect(typeof r[0]).toBe("number");
        expect(r.length).toEqual(defaultOutputDimensions);
      });
    });

    test("dimensions", async () => {
      const testDimensions: number = 512;
      const embeddings = new VertexAIEmbeddings({
        model,
        location,
        onFailedAttempt,
        dimensions: testDimensions,
      });
      const res = await embeddings.embedQuery("Hello world");
      expect(typeof res[0]).toBe("number");
      expect(res.length).toEqual(testDimensions);
    });
  }
);
