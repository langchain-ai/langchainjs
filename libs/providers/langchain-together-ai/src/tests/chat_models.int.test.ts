import { describe, expect, test } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { ChatTogetherAI } from "../chat_models.js";

const describeIfTogetherKey = process.env.TOGETHER_AI_API_KEY
  ? describe
  : describe.skip;

describeIfTogetherKey("ChatTogetherAI integration", () => {
  test("invoke", async () => {
    const chat = new ChatTogetherAI({
      model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
      maxRetries: 1,
    });
    const result = await chat.invoke([new HumanMessage("Hello!")]);

    expect(typeof result.content).toBe("string");
    expect(String(result.content).length).toBeGreaterThan(0);
  });
});
