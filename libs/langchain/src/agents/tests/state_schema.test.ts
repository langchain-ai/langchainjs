import { describe, test, expect } from "vitest";
import { StateSchema, ReducedValue } from "@langchain/langgraph";
import { z } from "zod";
import { createAgent } from "../index.js";
import { FakeToolCallingModel } from "./utils.js";

describe("StateSchema support", () => {
  test("should accept StateSchema as stateSchema", () => {
    const AgentState = new StateSchema({
      userId: z.string(),
      count: z.number().default(0),
    });

    const agent = createAgent({
      model: new FakeToolCallingModel({ toolCalls: [] }),
      tools: [],
      stateSchema: AgentState,
    });

    expect(agent).toBeDefined();
    expect(agent.options.stateSchema).toBe(AgentState);
  });

  test("should work with ReducedValue", () => {
    const AgentState = new StateSchema({
      history: new ReducedValue(
        z.array(z.string()).default(() => []),
        {
          inputSchema: z.string(),
          reducer: (current, next) => [...current, next],
        }
      ),
    });

    const agent = createAgent({
      model: new FakeToolCallingModel({ toolCalls: [] }),
      tools: [],
      stateSchema: AgentState,
    });

    expect(agent).toBeDefined();
  });

  test("should infer types correctly", async () => {
    const AgentState = new StateSchema({
      userId: z.string(),
      count: z.number().default(0),
    });

    const agent = createAgent({
      model: new FakeToolCallingModel({ 
        toolCalls: []
      }),
      tools: [],
      stateSchema: AgentState,
    });

    const result = await agent.invoke({
      messages: [{ role: "user", content: "test" }],
      userId: "user123",
      count: 5,
    });

    expect(result.messages).toBeDefined();
    expect(result.userId).toBe("user123");
    expect(result.count).toBe(5);
  });
});
