import { describe, it, vi, expect } from "vitest";
import { z } from "zod";
import { HumanMessage } from "@langchain/core/messages";

import { FakeToolCallingModel } from "./utils.js";
import { createReactAgent } from "../index.js";

describe("llm", () => {
  it("should be able to use a function as a model", async () => {
    const contextSchema = z.object({
      capital: z.string(),
    });
    const llm = vi.fn().mockReturnValue(new FakeToolCallingModel());
    const agent = createReactAgent({
      llm,
      contextSchema,
      tools: [],
    });

    const message = new HumanMessage("What is the capital of France?");
    await agent.invoke(
      {
        messages: [message],
      },
      {
        context: {
          capital: "Paris",
        },
      }
    );

    expect(llm).toHaveBeenCalledTimes(1);
    const [state, config] = llm.mock.calls[0];
    expect(state).toEqual(
      expect.objectContaining({
        messages: [message],
      })
    );
    expect(config).toEqual(
      expect.objectContaining({
        context: { capital: "Paris" },
      })
    );
  });
});
