import { beforeEach, afterEach, describe, expect, test, vi } from "vitest";
import Exa from "exa-js";
import {
  ExaAgent,
  ExaAnswer,
  ExaContents,
  ExaFindSimilarResults,
  ExaSearchResults,
} from "../tools.js";

describe("Exa tools", () => {
  beforeEach(() => {
    vi.spyOn(Exa.prototype, "search").mockResolvedValue({
      results: [],
    } as never);
    vi.spyOn(Exa.prototype, "findSimilarAndContents").mockResolvedValue({
      results: [],
    } as never);
    vi.spyOn(Exa.prototype, "getContents").mockResolvedValue({
      results: [],
      statuses: [],
    } as never);
    vi.spyOn(Exa.prototype, "answer").mockResolvedValue({
      answer: "yes",
      citations: [],
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  test("uses the environment API key when no client is provided", async () => {
    vi.stubEnv("EXA_API_KEY", "test-key");
    const tool = new ExaSearchResults();

    await tool.invoke("test query");

    expect(Exa.prototype.search).toHaveBeenCalledWith(
      "test query",
      expect.objectContaining({
        type: "auto",
        contents: { text: true },
      })
    );
  });

  test("accepts structured search input and forwards filters", async () => {
    const client = new Exa("test-key");
    const tool = new ExaSearchResults({ client });

    await tool.invoke({
      query: "test query",
      numResults: 3,
      includeDomains: ["example.com"],
      excludeDomains: ["bad.example"],
    });

    expect(Exa.prototype.search).toHaveBeenCalledWith(
      "test query",
      expect.objectContaining({
        type: "auto",
        contents: { text: true },
        numResults: 3,
        includeDomains: ["example.com"],
        excludeDomains: ["bad.example"],
      })
    );
  });

  test("keeps string input for find similar", async () => {
    const tool = new ExaFindSimilarResults({ client: new Exa("test-key") });

    await tool.invoke("https://example.com");

    expect(Exa.prototype.findSimilarAndContents).toHaveBeenCalledWith(
      "https://example.com",
      expect.objectContaining({
        text: true,
      })
    );
  });

  test("flattens search-style contents options for find similar", async () => {
    const tool = new ExaFindSimilarResults({
      client: new Exa("test-key"),
      searchArgs: { contents: { highlights: true } } as never,
    });

    await tool.invoke("https://example.com");

    expect(Exa.prototype.findSimilarAndContents).toHaveBeenCalledWith(
      "https://example.com",
      expect.objectContaining({ highlights: true })
    );
  });

  test("extracts contents from URLs", async () => {
    const tool = new ExaContents({ client: new Exa("test-key") });

    await tool.invoke({ urls: ["https://example.com"], text: true });

    expect(Exa.prototype.getContents).toHaveBeenCalledWith(
      ["https://example.com"],
      { text: true }
    );
  });

  test("defaults to text when no content option is requested", async () => {
    const tool = new ExaContents({ client: new Exa("test-key") });

    await tool.invoke({ urls: ["https://example.com"] });

    expect(Exa.prototype.getContents).toHaveBeenCalledWith(
      ["https://example.com"],
      { text: true }
    );
  });

  test("forwards independent content options without dropping any", async () => {
    const tool = new ExaContents({ client: new Exa("test-key") });

    await tool.invoke({
      urls: ["https://example.com"],
      text: true,
      highlights: true,
      summary: true,
    });

    expect(Exa.prototype.getContents).toHaveBeenCalledWith(
      ["https://example.com"],
      { text: true, highlights: true, summary: true }
    );
  });

  test("requests only highlights when only highlights are asked for", async () => {
    const tool = new ExaContents({ client: new Exa("test-key") });

    await tool.invoke({ urls: ["https://example.com"], highlights: true });

    expect(Exa.prototype.getContents).toHaveBeenCalledWith(
      ["https://example.com"],
      { highlights: true }
    );
  });

  test("returns a grounded answer with citations", async () => {
    const tool = new ExaAnswer({ client: new Exa("test-key") });

    await tool.invoke({ query: "What is Exa?" });

    expect(Exa.prototype.answer).toHaveBeenCalledWith("What is Exa?", {});
  });

  test("polls the Agent API to a terminal run", async () => {
    const client = new Exa("test-key");
    Object.defineProperty(client, "agent", {
      value: {
        runs: {
          create: vi.fn().mockResolvedValue({ id: "run-1" }),
          pollUntilFinished: vi
            .fn()
            .mockResolvedValue({ id: "run-1", status: "completed" }),
        },
      },
    });
    const tool = new ExaAgent({ client });

    await tool.invoke({ query: "Find the latest Exa updates" });

    expect(client.agent.runs.create).toHaveBeenCalledWith({
      query: "Find the latest Exa updates",
    });
    expect(client.agent.runs.pollUntilFinished).toHaveBeenCalledWith("run-1", {
      timeoutMs: 3_600_000,
      pollInterval: 1_000,
    });
  });
});
