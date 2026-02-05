import { expect, it, describe } from "vitest";
import { AIMessage, HumanMessage } from "@langchain/core/messages";

import { ChatAnthropic } from "../../chat_models.js";
import { computer_20250124 } from "../computer.js";

const createModel = () =>
  new ChatAnthropic({
    model: "claude-sonnet-4-5",
    temperature: 0,
    clientOptions: {
      defaultHeaders: {
        "anthropic-beta": "computer-use-2025-01-24",
      },
    },
  });

describe("Anthropic Computer Use Tool Integration Tests", () => {
  it("computer tool can be bound to ChatAnthropic", async () => {
    const llm = createModel();

    const computer = computer_20250124({
      displayWidthPx: 1024,
      displayHeightPx: 768,
      displayNumber: 1,
      execute: async () => {
        return "Action executed";
      },
    });

    const llmWithComputer = llm.bindTools([computer]);

    const response = await llmWithComputer.invoke([
      new HumanMessage("Take a screenshot of the current screen"),
    ]);

    expect(response).toBeInstanceOf(AIMessage);
    expect(Array.isArray(response.content)).toBe(true);

    // Claude should request to take a screenshot
    expect(response.tool_calls).toBeDefined();
    expect(response.tool_calls?.length).toBe(1);
    expect(response.tool_calls?.[0]).toEqual(
      expect.objectContaining({
        name: "computer",
        type: "tool_call",
        args: expect.objectContaining({
          action: "screenshot",
        }),
      })
    );
  }, 60000);
});
