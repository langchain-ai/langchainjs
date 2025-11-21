import { describe, it, expect } from "vitest";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";

import {
  openAIModerationMiddleware,
  OpenAIModerationError,
} from "../moderation.js";
import { createAgent } from "../../../../index.js";

describe("openAIModerationMiddleware", () => {
  it("should moderate user input", async () => {
    const model = new ChatOpenAI({ model: "gpt-4o-mini" });
    const middleware = openAIModerationMiddleware({
      model,
      checkInput: true,
      exitBehavior: "error",
    });

    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    const state = {
      messages: [new HumanMessage("I want to harm myself")],
    };

    await expect(agent.invoke(state)).rejects.toThrow(OpenAIModerationError);
  });
});
