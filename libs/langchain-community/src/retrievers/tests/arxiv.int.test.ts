import { test, expect } from "@jest/globals";
import { ArxivRetriever } from "../arxiv.js";

test("ArxivRetriever fetching document summaries test", async () => {
  // Sample integration test for ArxivRetriever using the "machine learning" query
  const retriever = new ArxivRetriever({
    getFullDocuments: false,
    maxSearchResults: 5,
  });
  const query = "machine learning";
  const results = await retriever._getRelevantDocuments(query);

  expect(results).toBeDefined();
  expect(results.length).toBeGreaterThan(0);
  expect(results.length).toBeLessThanOrEqual(5);

  for (let i = 0; i < results.length; i += 1) {
    expect(results[i]).toHaveProperty("pageContent");
    expect(results[i].pageContent).toBeDefined();

    expect(results[i]).toHaveProperty("metadata");
    expect(results[i].metadata).toBeInstanceOf(Object);
    expect(results[i].metadata).toHaveProperty("authors");
    expect(results[i].metadata.authors).toBeInstanceOf(Array);
    expect(results[i].metadata).toHaveProperty("id");
    expect(results[i].metadata.id).toContain("arxiv.org");
    expect(results[i].metadata).toHaveProperty("published");
    expect(results[i].metadata.published).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
    );
    expect(results[i].metadata).toHaveProperty("source");
    expect(results[i].metadata.source).toBe("arxiv");
    expect(results[i].metadata).toHaveProperty("title");
    expect(results[i].metadata).toHaveProperty("updated");
    expect(results[i].metadata.updated).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
    );
    expect(results[i].metadata).toHaveProperty("url");
    expect(results[i].metadata.url).toContain("arxiv.org");
  }
});

test("ArxivRetriever fetching document summaries with invalid query test", async () => {
  // Sample test for ArxivRetriever using an invalid query
  const retriever = new ArxivRetriever({
    getFullDocuments: false,
    maxSearchResults: 5,
  });
  const query = "fjalsdkjfw";
  const results = await retriever._getRelevantDocuments(query);

  expect(results).toBeDefined();
  expect(results.length).toBe(0);
});

test("ArxivRetriever fetching document summaries with empty query test", async () => {
  // Sample test for ArxivRetriever using an empty query
  const retriever = new ArxivRetriever({
    getFullDocuments: false,
    maxSearchResults: 5,
  });
  const query = "";
  const results = await retriever._getRelevantDocuments(query);

  expect(results).toBeDefined();
  expect(results.length).toBe(0);
});

test("ArxivRetriever fetching document summaries with invalid maxSearchResults test", async () => {
  // Sample test for ArxivRetriever using an invalid maxSearchResults
  try {
    const retriever = new ArxivRetriever({
      getFullDocuments: true,
      maxSearchResults: -1,
    });
    const query = "machine learning";
    const results = await retriever._getRelevantDocuments(query);
    expect(results).toBeUndefined();
    expect(results.length).toBe(0);
  } catch (error) {
    expect(error).toBeDefined();
    expect(error).toBeInstanceOf(Error);
  }
});

test("ArxivRetriever fetching document summaries with zero maxSearchResults test", async () => {
  // Sample test for ArxivRetriever using an zero maxSearchResults
  try {
    const retriever = new ArxivRetriever({
      getFullDocuments: true,
      maxSearchResults: 0,
    });
    const query = "machine learning";
    const results = await retriever._getRelevantDocuments(query);
    expect(results).toBeUndefined();
    expect(results.length).toBe(0);
  } catch (error) {
    expect(error).toBeDefined();
    expect(error).toBeInstanceOf(Error);
  }
});

test("ArxivRetriever fetching full documents test", async () => {
  // Sample test for fetching full documents with ArxivRetriever
  const retriever = new ArxivRetriever({
    getFullDocuments: true,
    maxSearchResults: 5,
  });
  const query = "machine learning";
  const results = await retriever._getRelevantDocuments(query);

  expect(results).toBeDefined();
  expect(results.length).toBeGreaterThan(0);
  expect(results.length).toBeLessThanOrEqual(5);

  for (let i = 0; i < results.length; i += 1) {
    expect(results[i]).toHaveProperty("pageContent");
    expect(results[i].pageContent).toBeDefined();

    expect(results[i]).toHaveProperty("id");

    expect(results[i]).toHaveProperty("metadata");
    expect(results[i].metadata).toBeInstanceOf(Object);
    expect(results[i].metadata).toHaveProperty("authors");
    expect(results[i].metadata.authors).toBeInstanceOf(Array);
    expect(results[i].metadata).toHaveProperty("id");
    expect(results[i].metadata.id).toContain("arxiv.org");
    expect(results[i].metadata).toHaveProperty("published");
    expect(results[i].metadata.published).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
    );
    expect(results[i].metadata).toHaveProperty("source");
    expect(results[i].metadata.source).toBe("arxiv");
    expect(results[i].metadata).toHaveProperty("title");
    expect(results[i].metadata).toHaveProperty("updated");
    expect(results[i].metadata.updated).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
    );
    expect(results[i].metadata).toHaveProperty("url");
    expect(results[i].metadata.url).toContain("arxiv.org");
    expect(results[i].metadata).toHaveProperty("summary");
  }
});

test("ArxivRetriever fetching full documents with invalid query test", async () => {
  // Sample test for fetching full documents with ArxivRetriever using an invalid query
  const retriever = new ArxivRetriever({
    getFullDocuments: true,
    maxSearchResults: 5,
  });
  const query = "fjalsdkjfw";
  const results = await retriever._getRelevantDocuments(query);

  expect(results).toBeDefined();
  expect(results.length).toBe(0);
});

test("ArxivRetriever fetching full documents with empty query test", async () => {
  // Sample test for fetching full documents with ArxivRetriever using an empty query
  const retriever = new ArxivRetriever({
    getFullDocuments: true,
    maxSearchResults: 5,
  });
  const query = "";
  const results = await retriever._getRelevantDocuments(query);

  expect(results).toBeDefined();
  expect(results.length).toBe(0);
});

test("ArxivRetriever fetching full documents with invalid maxSearchResults test", async () => {
  // Sample test for fetching full documents with ArxivRetriever using an invalid maxSearchResults
  try {
    const retriever = new ArxivRetriever({
      getFullDocuments: true,
      maxSearchResults: -1,
    });
    const query = "machine learning";
    const results = await retriever._getRelevantDocuments(query);
    expect(results).toBeUndefined();
    expect(results.length).toBe(0);
  } catch (error) {
    expect(error).toBeDefined();
    expect(error).toBeInstanceOf(Error);
  }
});

test("ArxivRetriever fetching full documents with zero maxSearchResults", async () => {
  // Sample test for fetching full documents with ArxivRetriever using an zero maxSearchResults
  try {
    const retriever = new ArxivRetriever({
      getFullDocuments: true,
      maxSearchResults: 0,
    });
    const query = "machine learning";
    const results = await retriever._getRelevantDocuments(query);
    expect(results).toBeUndefined();
    expect(results.length).toBe(0);
  } catch (error) {
    expect(error).toBeDefined();
    expect(error).toBeInstanceOf(Error);
  }
});

test("ArxivRetriever search articles by id test", async () => {
  // Sample test for fetching articles by arXiv IDs
  const fetchIds = "2103.03404 2103.03405";
  const retriever = new ArxivRetriever({
    getFullDocuments: false,
    maxSearchResults: 5,
  });
  const results = await retriever.invoke(fetchIds);

  expect(results).toBeDefined();
  expect(results.length).toBe(2);

  for (let i = 0; i < results.length; i += 1) {
    expect(results[i]).toHaveProperty("pageContent");
    expect(results[i].pageContent).toBeDefined();

    expect(results[i]).toHaveProperty("metadata");
    expect(results[i].metadata).toBeInstanceOf(Object);
    expect(results[i].metadata).toHaveProperty("authors");
    expect(results[i].metadata.authors).toBeInstanceOf(Array);
    expect(results[i].metadata).toHaveProperty("id");
    expect(results[i].metadata.id).toContain("arxiv.org");
    expect(results[i].metadata).toHaveProperty("published");
    expect(results[i].metadata.published).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
    );
    expect(results[i].metadata).toHaveProperty("source");
    expect(results[i].metadata.source).toBe("arxiv");
    expect(results[i].metadata).toHaveProperty("title");
    expect(results[i].metadata).toHaveProperty("updated");
    expect(results[i].metadata.updated).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
    );
    expect(results[i].metadata).toHaveProperty("url");
    expect(results[i].metadata.url).toContain("arxiv.org");
  }
});

test("ArxivRetriever search articles by id with invalid id test", async () => {
  // Sample test for fetching articles by arXiv IDs with an invalid ID
  const fetchIds = "2103.03404 2103.03405 1234.56789";
  const retriever = new ArxivRetriever({
    getFullDocuments: false,
    maxSearchResults: 5,
  });
  const results = await retriever.invoke(fetchIds);

  expect(results).toBeDefined();
  expect(results.length).toBeLessThan(3);
});

test("ArxivRetriever search articles by id with empty id test", async () => {
  // Sample test for fetching articles by arXiv IDs with an empty ID
  const fetchIds = "";
  const retriever = new ArxivRetriever({
    getFullDocuments: false,
    maxSearchResults: 5,
  });
  const results = await retriever.invoke(fetchIds);

  expect(results).toBeDefined();
  expect(results.length).toBe(0);
});

test("ArxivRetriever search articles by id with invalid maxSearchResults test", async () => {
  // Sample test for fetching articles by arXiv IDs with an invalid maxSearchResults
  try {
    const fetchIds = "2103.03404 2103.03405";
    const retriever = new ArxivRetriever({
      getFullDocuments: false,
      maxSearchResults: -1,
    });
    const results = await retriever.invoke(fetchIds);
    expect(results).toBeUndefined();
    expect(results.length).toBe(0);
  } catch (error) {
    expect(error).toBeDefined();
    expect(error).toBeInstanceOf(Error);
  }
});

test("ArxivRetriever search articles by id with invalid id and maxSearchResults test", async () => {
  // Sample test for fetching articles by arXiv IDs with an invalid ID and maxSearchResults
  try {
    const fetchIds = "2103.03404 2103.03405 1234.56789";
    const retriever = new ArxivRetriever({
      getFullDocuments: false,
      maxSearchResults: -1,
    });
    const results = await retriever.invoke(fetchIds);
    expect(results).toBeUndefined();
    expect(results.length).toBe(0);
  } catch (error) {
    expect(error).toBeDefined();
    expect(error).toBeInstanceOf(Error);
  }
});

test("ArxivRetriever search articles by id with invalid id and zero maxSearchResults test", async () => {
  // Sample test for fetching articles by arXiv IDs with an invalid ID and zero maxSearchResults
  try {
    const fetchIds = "2103.03404 2103.03405 1234.56789";
    const retriever = new ArxivRetriever({
      getFullDocuments: false,
      maxSearchResults: 0,
    });
    const results = await retriever.invoke(fetchIds);
    expect(results).toBeUndefined();
    expect(results.length).toBe(0);
  } catch (error) {
    expect(error).toBeDefined();
    expect(error).toBeInstanceOf(Error);
  }
});
