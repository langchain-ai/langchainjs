import { describe, it, expect, vi, beforeEach } from "vitest";
import { zkStashMemoryMiddleware } from "../memory.js";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";

vi.mock("@zkstash/sdk/rest", () => ({
  ZkStash: vi.fn().mockImplementation(() => ({
    searchMemories: vi.fn(),
    createMemory: vi.fn().mockResolvedValue({ success: true }),
  })),
  fromApiKey: (key: string) => ({
    apiKey: key,
    searchMemories: vi.fn().mockResolvedValue({
      success: true,
      memories: []
    }),
    createMemory: vi.fn().mockResolvedValue({ success: true }),
  })
}));

describe("ZkStashMemoryMiddleware", () => {
  let middleware: any;
  const mockOptions = {
    apiKey: "test-key",
    schemas: ["Preference"],
    filters: { agentId: "test-agent" },
    searchContextWindow: 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    middleware = zkStashMemoryMiddleware(mockOptions);
  });

  describe("beforeModel", () => {
    it("should skip retrieval if the last message is not a HumanMessage", async () => {
      const state = {
        messages: [new SystemMessage("system prompt")],
      };
      const result = await middleware.beforeModel(state);
      expect(result).toBeUndefined();
    });

    it("should perform contextual search and inject memories", async () => {
      // Mock search results as Documents
      const mockDocs = [
        { pageContent: "Alice likes coffee", metadata: { kind: "Preference" } }
      ];
      // @ts-ignore
      middleware.retriever.invoke = vi.fn().mockResolvedValue(mockDocs);

      const state = {
        messages: [
          new HumanMessage("What does Alice like?"),
        ],
      };

      const result = await middleware.beforeModel(state);

      expect(middleware.retriever.invoke).toHaveBeenCalledWith("User: What does Alice like?");
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toContain("Alice likes coffee");
      expect(result.messages[0].id).toBe("zkstash-context");
    });

    it("should deduplicate context messages using RemoveMessage", async () => {
       // Mock search results as Documents
       const mockDocs = [{ pageContent: "Memory B", metadata: { kind: "Preference" } }];
       // @ts-ignore
       middleware.retriever.invoke = vi.fn().mockResolvedValue(mockDocs);

       const existingContext = new HumanMessage({ content: "Memory A", id: "zkstash-context" });
       const state = {
         messages: [
           existingContext,
           new HumanMessage("Tell me more"),
         ],
       };

       const result = await middleware.beforeModel(state);

       expect(result.messages).toHaveLength(2);
       expect(result.messages[0].constructor.name).toBe("RemoveMessage");
       expect(result.messages[1].id).toBe("zkstash-context");
       expect(result.messages[1].content).toContain("Memory B");
    });

    it("should respect searchContextWindow", async () => {
       // @ts-ignore
       middleware.retriever.invoke = vi.fn().mockResolvedValue([]);

       const state = {
         messages: [
           new HumanMessage("Msg 1"),
           new AIMessage("Reply 1"),
           new HumanMessage("Msg 2"),
           new AIMessage("Reply 2"),
           new HumanMessage("Msg 3"),
         ],
       };

       await middleware.beforeModel(state);

       // window is 2, so last Human + previous AI
       expect(middleware.retriever.invoke).toHaveBeenCalledWith("Assistant: Reply 2\nUser: Msg 3");
    });
  });

  describe("afterModel", () => {
    it("should trigger createMemory on Human-AI pair", async () => {
      const state = {
        messages: [
          new HumanMessage("I love TypeScript"),
          new AIMessage("I noticed you mentioned a preference for TypeScript."),
        ],
      };

      await middleware.afterModel(state);

      const mockClient = middleware.client;
      expect(mockClient.createMemory).toHaveBeenCalledWith(expect.objectContaining({
        agentId: "test-agent",
        schemas: ["Preference"],
        conversation: [
          { role: "user", content: "I love TypeScript" },
          { role: "assistant", content: "I noticed you mentioned a preference for TypeScript." },
        ],
      }));
    });
  });
});
