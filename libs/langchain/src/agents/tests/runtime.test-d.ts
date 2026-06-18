import { describe, it, expectTypeOf } from "vitest";
import { createAgent } from "../index.js";

describe("runtime", () => {
  it("should support subgraph streaming", async () => {
    const agent = createAgent({
      model: "openai:gpt-4",
    });

    for await (const [namespace, chunk] of await agent.stream(
      { messages: [{ role: "user", content: "Plan my vacation" }] },
      { streamMode: "updates", subgraphs: true }
    )) {
      expectTypeOf(namespace).toEqualTypeOf<string[]>();
      expectTypeOf(chunk).toExtend<Record<string, unknown>>();
    }
  });
});
