import { describe, it, expect, vi } from "vitest";
import { ZkStashStore } from "../storage.js";

vi.mock("@zkstash/sdk/rest", () => ({
  ZkStash: vi.fn().mockImplementation(() => ({
    searchMemories: vi.fn().mockResolvedValue({
      success: true,
      memories: [{ metadata: { fact: "mocked" }, kind: "facts" }],
    }),
    createMemory: vi.fn().mockResolvedValue({ success: true }),
    storeMemories: vi.fn().mockResolvedValue({ success: true }),
  })),
}));

describe("ZkStashStore", () => {
  it("should search memories semantically", async () => {
    const store = new ZkStashStore({ apiKey: "test-key", agentId: "agent-1" });

    // @ts-ignore
    const mockClient = store.client;

    const results = await store.search("hello", { kind: "facts" });

    expect(mockClient.searchMemories).toHaveBeenCalledWith({
      query: "hello",
      filters: { agentId: "agent-1", kind: "facts", threadId: undefined },
      mode: "raw",
    });
    expect(results).toHaveLength(1);
  });

  it("mget should map keys to kinds", async () => {
    const store = new ZkStashStore({ apiKey: "test-key", agentId: "agent-1" });

    await store.mget(["facts"]);

    // @ts-ignore
    const mockClient = store.client;
    expect(mockClient.searchMemories).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({ kind: "facts" }),
      })
    );
  });

  it("mset should map keys to schemas using storeMemories", async () => {
    const store = new ZkStashStore({ apiKey: "test-key", agentId: "agent-1" });

    await store.mset([["facts", { fact: "test" }]]);

    // @ts-ignore
    const mockClient = store.client;
    expect(mockClient.storeMemories).toHaveBeenCalledWith(
      "agent-1",
      expect.arrayContaining([
        {
          kind: "facts",
          data: { fact: "test" },
        },
      ]),
      expect.objectContaining({ threadId: undefined })
    );
  });
});
