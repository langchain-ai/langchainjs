import { describe, it, expect, vi } from "vitest";
import { ZkStashRetriever } from "../retrievers.js";

vi.mock("@zkstash/sdk/rest", () => ({
  ZkStash: vi.fn().mockImplementation(() => ({
    searchMemories: vi.fn().mockResolvedValue({
      success: true,
      memories: [
        { metadata: { name: "Alice", value: "likes coffee" }, kind: "Preference" },
        { metadata: "Met Bob yesterday", kind: "Fact" },
      ]
    }),
  })),
}));

describe("ZkStashRetriever", () => {
  it("should search memories and return documents", async () => {
    const retriever = new ZkStashRetriever({
      apiKey: "test-key",
      filters: { agentId: "test-agent" },
    });

    const docs = await retriever.invoke("coffee");

    // Access the mocked client instance
    const mockClient = (retriever as any).client;
    expect(mockClient.searchMemories).toHaveBeenCalledWith({
      query: "coffee",
      filters: { agentId: "test-agent" },
      mode: "raw",
    });

    expect(docs).toHaveLength(2);
    expect(docs[0].pageContent).toBe(JSON.stringify({ name: "Alice", value: "likes coffee" }));
  });
});
