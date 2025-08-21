import { describe, it, expect } from "vitest";
import { z } from "zod";

import { FakeToolCallingChatModel } from "./utils.js";
import { createAgent } from "../index.js";
import { HumanMessage } from "@langchain/core/messages";

describe("prepareCall hook", () => {
  it("should populate proper state and runtime context", async () => {
    expect.assertions(8);

    const context = z.object({
      model: z.enum(["gpt-4o", "gpt-4o-mini"]).optional(),
    });

    const model = new FakeToolCallingChatModel({});
    const agent = createAgent({
      llm: model,
      tools: [],
      prepareCall: (state, runtime) => {
        expect(runtime).toBeDefined();
        expect(runtime.context).toBeDefined();
        expect(runtime.context?.model).toBe("gpt-4o-mini");

        expect(state.stepNumber).toBe(0);
        expect(state.toolCalls).toHaveLength(0);
        expect(state.model).toBe(model);
        expect(state.messages).toMatchObject([
          expect.objectContaining({
            content: "Hello, how are you?",
          }),
        ]);
        expect(state.state).toMatchObject({
          messages: [
            expect.objectContaining({
              content: "Hello, how are you?",
            }),
          ],
        });

        return {};
      },
      contextSchema: context,
    });

    await agent.invoke(
      {
        messages: [new HumanMessage("Hello, how are you?")],
      },
      {
        configurable: {
          model: "gpt-4o-mini",
        },
      }
    );
  });
});
