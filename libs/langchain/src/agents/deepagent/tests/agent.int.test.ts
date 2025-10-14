import { describe, it, expect } from "vitest";

import { createDeepAgent } from "../index.js";
import {
  researchInstructions,
  critiqueSubAgent,
  researchSubAgent,
  internetSearch,
} from "./fixtures.js";

describe("DeepAgent", () => {
  it("should run and return a result", async () => {
    const agent = createDeepAgent({
      model: "openai:gpt-4o-mini",
      instructions: researchInstructions,
      tools: [internetSearch],
      subagents: [critiqueSubAgent, researchSubAgent],
    });

    const result = await agent.invoke({
      messages: [{ role: "user", content: "What is langgraph?" }],
    });

    const lastMessage = result.messages.at(-1);
    expect(lastMessage?.content).toContain("LangGraph");
  });
});
