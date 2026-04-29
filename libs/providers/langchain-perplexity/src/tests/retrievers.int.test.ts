import { describe, test, expect } from "vitest";
import { PerplexitySearchRetriever } from "../retrievers.js";

const hasKey =
  !!process.env.PERPLEXITY_API_KEY || !!process.env.PPLX_API_KEY;

describe.skipIf(!hasKey)("PerplexitySearchRetriever Integration", () => {
  test("returns documents from a real /search call", async () => {
    const retriever = new PerplexitySearchRetriever({ k: 3 });
    const docs = await retriever.invoke("What is the capital of India?");
    expect(docs.length).toBeGreaterThan(0);
    expect(docs.length).toBeLessThanOrEqual(3);
    for (const doc of docs) {
      expect(typeof doc.pageContent).toBe("string");
      expect(doc.metadata).toHaveProperty("title");
      expect(doc.metadata).toHaveProperty("url");
      expect(doc.metadata).toHaveProperty("date");
      expect(doc.metadata).toHaveProperty("last_updated");
    }
  });

  test("respects searchRecencyFilter and searchDomainFilter", async () => {
    const retriever = new PerplexitySearchRetriever({
      k: 2,
      searchRecencyFilter: "month",
      searchDomainFilter: ["wikipedia.org"],
    });
    const docs = await retriever.invoke("LangChain framework");
    expect(docs.length).toBeGreaterThan(0);
  });
});
