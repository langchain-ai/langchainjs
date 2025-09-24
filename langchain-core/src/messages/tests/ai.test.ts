import { describe, it, expect } from "@jest/globals";
import { AIMessageChunk } from "../ai.js";

describe("AIMessageChunk", () => {
  it("should properly merge tool call chunks that have matching indices and ids", () => {
    const chunk1 = new AIMessageChunk({
      content: "",
      tool_call_chunks: [
        {
          name: "add_new_task",
          args: '{"tasks":["buy tomatoes","help child with math"]}',
          type: "tool_call_chunk",
          index: 0,
          id: "9fb5c937-6944-4173-84be-ad1caee1cedd",
        },
      ],
    });
    const chunk2 = new AIMessageChunk({
      content: "",
      tool_call_chunks: [
        {
          name: "add_ideas",
          args: '{"ideas":["read about Angular 19 updates"]}',
          type: "tool_call_chunk",
          index: 0,
          id: "5abf542e-87f3-4899-87c6-8f7d9cb6a28d",
        },
      ],
    });

    const merged = chunk1.concat(chunk2);
    expect(merged.tool_call_chunks).toHaveLength(2);

    const firstCall = merged.tool_call_chunks?.[0];
    expect(firstCall?.name).toBe("add_new_task");
    expect(firstCall?.args).toBe(
      '{"tasks":["buy tomatoes","help child with math"]}'
    );
    expect(firstCall?.id).toBe("9fb5c937-6944-4173-84be-ad1caee1cedd");

    const secondCall = merged.tool_call_chunks?.[1];
    expect(secondCall?.name).toBe("add_ideas");
    expect(secondCall?.args).toBe(
      '{"ideas":["read about Angular 19 updates"]}'
    );
    expect(secondCall?.id).toBe("5abf542e-87f3-4899-87c6-8f7d9cb6a28d");
  });

  it("should properly merge tool call chunks that have matching indices and at least one id is blank", () => {
    const chunk1 = new AIMessageChunk({
      content: "",
      tool_call_chunks: [
        {
          name: "add_new_task",
          type: "tool_call_chunk",
          index: 0,
          id: "9fb5c937-6944-4173-84be-ad1caee1cedd",
        },
      ],
    });
    const chunk2 = new AIMessageChunk({
      content: "",
      tool_call_chunks: [
        {
          args: '{"tasks":["buy tomatoes","help child with math"]}',
          type: "tool_call_chunk",
          index: 0,
        },
      ],
    });

    const merged = chunk1.concat(chunk2);
    expect(merged.tool_call_chunks).toHaveLength(1);

    const firstCall = merged.tool_call_chunks?.[0];
    expect(firstCall?.name).toBe("add_new_task");
    expect(firstCall?.args).toBe(
      '{"tasks":["buy tomatoes","help child with math"]}'
    );
    expect(firstCall?.id).toBe("9fb5c937-6944-4173-84be-ad1caee1cedd");
  });

  it("should properly merge tool call chunks that have matching indices no IDs at all", () => {
    const chunk1 = new AIMessageChunk({
      content: "",
      tool_call_chunks: [
        {
          name: "add_new_task",
          type: "tool_call_chunk",
          index: 0,
        },
      ],
    });
    const chunk2 = new AIMessageChunk({
      content: "",
      tool_call_chunks: [
        {
          args: '{"tasks":["buy tomatoes","help child with math"]}',
          type: "tool_call_chunk",
          index: 0,
        },
      ],
    });

    const merged = chunk1.concat(chunk2);
    expect(merged.tool_call_chunks).toHaveLength(1);

    const firstCall = merged.tool_call_chunks?.[0];
    expect(firstCall?.name).toBe("add_new_task");
    expect(firstCall?.args).toBe(
      '{"tasks":["buy tomatoes","help child with math"]}'
    );
    expect(firstCall?.id).toBeUndefined();
  });
});
