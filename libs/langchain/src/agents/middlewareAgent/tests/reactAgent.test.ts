import { createAgent } from "../index.js";

describe("ReactAgent", () => {
  it("should proxy to access graph properties", () => {
    const agent = createAgent({
      model: "openai:gpt-4o-mini",
    });

    // @ts-expect-error accessing LangGraph graph properties
    expect(agent.getGraphAsync).toBeDefined();
  });
});
