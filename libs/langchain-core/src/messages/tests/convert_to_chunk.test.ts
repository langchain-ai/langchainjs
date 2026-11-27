import { describe, expect, test } from "vitest";

import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
  HumanMessageChunk,
  SystemMessage,
  SystemMessageChunk,
  ToolMessage,
  ToolMessageChunk,
} from "../index.js";
import { convertToChunk } from "../utils.js";

describe("convertToChunk", () => {
  test("converts a tool message without throwing", () => {
    const chunk = convertToChunk(
      new ToolMessage({ content: "42", tool_call_id: "call_1", name: "lookup" })
    );

    expect(chunk).toBeInstanceOf(ToolMessageChunk);
    expect(chunk.content).toBe("42");
    expect((chunk as ToolMessageChunk).tool_call_id).toBe("call_1");
    expect(chunk.name).toBe("lookup");
  });

  test("keeps the message id and the artifact of a tool message", () => {
    const chunk = convertToChunk(
      new ToolMessage({
        content: "42",
        tool_call_id: "call_1",
        id: "msg_1",
        artifact: { rows: 1 },
        status: "success",
      })
    ) as ToolMessageChunk;

    expect(chunk.id).toBe("msg_1");
    expect(chunk.artifact).toEqual({ rows: 1 });
    expect(chunk.status).toBe("success");
  });

  test("still converts every message type that already had a chunk", () => {
    expect(convertToChunk(new HumanMessage("hi"))).toBeInstanceOf(
      HumanMessageChunk
    );
    expect(convertToChunk(new SystemMessage("hi"))).toBeInstanceOf(
      SystemMessageChunk
    );
    expect(convertToChunk(new AIMessage("hi"))).toBeInstanceOf(AIMessageChunk);
  });
});
