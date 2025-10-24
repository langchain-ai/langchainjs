import { test, expect } from "@jest/globals";
import { GooglePlatformType } from "@langchain/google-common";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { GoogleEmbeddings, GoogleEmbeddingsInput } from "../embeddings.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onFailedAttempt(err: any): any {
  console.error(err);
  throw err;
}

const testModels = [
  {
    modelName: "text-embedding-005",
    platformType: "gcp",
    location: "us-central1",
    defaultOutputDimensions: 768,
  },
  {
    modelName: "text-embedding-005",
    platformType: "gcp",
    location: "europe-west9",
    defaultOutputDimensions: 768,
  },
  {
    modelName: "text-multilingual-embedding-002",
    platformType: "gcp",
    location: "us-central1",
    defaultOutputDimensions: 768,
  },
  {
    modelName: "text-multilingual-embedding-002",
    platformType: "gcp",
    location: "europe-west9",
    defaultOutputDimensions: 768,
  },
  {
    modelName: "gemini-embedding-001",
    platformType: "gcp",
    location: "us-central1",
    defaultOutputDimensions: 3072,
  },
  {
    modelName: "gemini-embedding-001",
    platformType: "gai",
    defaultOutputDimensions: 3072,
  },
];

describe.each(testModels)(
  `Webauth Embeddings ($modelName) ($location)`,
  ({ modelName, platformType, location, defaultOutputDimensions }) => {
    function newModel(
      fields?: Omit<GoogleEmbeddingsInput, "model">
    ): GoogleEmbeddings {
      const apiKey =
        platformType === "gai"
          ? getEnvironmentVariable("TEST_API_KEY")
          : undefined;

      return new GoogleEmbeddings({
        model: modelName,
        platformType: platformType as GooglePlatformType,
        apiKey,
        location,
        onFailedAttempt,
        ...(fields ?? {}),
      });
    }

    test("embedQuery", async () => {
      const embeddings = newModel();
      const res = await embeddings.embedQuery("Hello world");
      expect(typeof res[0]).toBe("number");
      expect(res.length).toEqual(defaultOutputDimensions);
    });

    test("embedDocuments", async () => {
      const embeddings = newModel();

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
      res.forEach((r: number[]) => {
        expect(typeof r[0]).toBe("number");
        expect(r.length).toEqual(defaultOutputDimensions);
      });
    });

    test("dimensions", async () => {
      const testDimensions: number = 512;
      const embeddings = newModel({
        dimensions: testDimensions,
      });
      const res = await embeddings.embedQuery("Hello world");
      expect(typeof res[0]).toBe("number");
      expect(res.length).toEqual(testDimensions);
    });
  }
);
