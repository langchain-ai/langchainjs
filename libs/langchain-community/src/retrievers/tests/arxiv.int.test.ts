import { test, expect } from "@jest/globals";
import { ArxivRetriever } from "../arxiv.js";

test("ArxivRetriever integration test", async () => {
    // Sample integration test for ArxivRetriever using the "machine learning" query
    const retriever = new ArxivRetriever(
        {
            getFullDocuments: false,
            maxSearchResults: 5
        }
    );
    const query = "machine learning";
    const results = await retriever._getRelevantDocuments(query);

    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(5);

    for (let i = 0; i < results.length; i += 1) {
        expect(results[i]).toHaveProperty("pageContent");
        expect(results[i].pageContent).toBeDefined();

        expect(results[i]).toHaveProperty("id");
        expect(results[i].id).toBeUndefined();

        expect(results[i]).toHaveProperty("metadata");
        expect(results[i].metadata).toBeInstanceOf(Object);
        expect(results[i].metadata).toHaveProperty("authors");
        expect(results[i].metadata.authors).toBeInstanceOf(Array);
        expect(results[i].metadata).toHaveProperty("id");
        expect(results[i].metadata.id).toContain("arxiv.org");
        expect(results[i].metadata).toHaveProperty("published");
        expect(results[i].metadata.published).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
        expect(results[i].metadata).toHaveProperty("source");
        expect(results[i].metadata.source).toBe("arxiv");
        expect(results[i].metadata).toHaveProperty("title");
        expect(results[i].metadata).toHaveProperty("updated");
        expect(results[i].metadata.updated).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
        expect(results[i].metadata).toHaveProperty("url");
        expect(results[i].metadata.url).toContain("arxiv.org");
    }
});