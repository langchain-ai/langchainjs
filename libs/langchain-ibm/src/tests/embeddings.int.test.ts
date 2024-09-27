/* eslint-disable no-process-env */
import { test } from "@jest/globals";
import { WatsonxEmbeddings } from "../embeddings.js";

describe("Test embeddings", () => {
  test("embedQuery method", async () => {
    const embeddings = new WatsonxEmbeddings({
      version: "2024-05-31",
      serviceUrl: process.env.API_URL as string,
      projectId: process.env.PROJECT_ID,
    });
    const res = await embeddings.embedQuery("Hello world");
    expect(typeof res[0]).toBe("number");
  });

  test("embedDocuments", async () => {
    const embeddings = new WatsonxEmbeddings({
      version: "2024-05-31",
      serviceUrl: process.env.API_URL as string,
      projectId: process.env.PROJECT_ID,
    });
    const res = await embeddings.embedDocuments(["Hello world", "Bye world"]);
    expect(res).toHaveLength(2);
    expect(typeof res[0][0]).toBe("number");
    expect(typeof res[1][0]).toBe("number");
  });

  test("Concurrency", async () => {
    const embeddings = new WatsonxEmbeddings({
      version: "2024-05-31",
      serviceUrl: process.env.API_URL as string,
      projectId: process.env.PROJECT_ID,
      maxConcurrency: 4,
    });
    const res = await embeddings.embedDocuments([
      "Hello world",
      "Bye world",
      "Hello world",
      "Bye world",
      "Hello world",
      "Bye world",
      "Hello world",
      "Bye world",
    ]);
    expect(res).toHaveLength(8);
    expect(res.find((embedding) => typeof embedding[0] !== "number")).toBe(
      undefined
    );
  });

  test("List models", async () => {
    const embeddings = new WatsonxEmbeddings({
      version: "2024-05-31",
      serviceUrl: process.env.API_URL as string,
      projectId: process.env.PROJECT_ID,
      maxConcurrency: 4,
    });
    const res = await embeddings.listModels();
    expect(res?.length).toBeGreaterThan(0);
    if (res) expect(typeof res[0]).toBe("string");
  });
});
