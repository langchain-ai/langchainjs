import { describe, expect, test } from "vitest";
import { PromptTemplate } from "@langchain/core/prompts";
import { TogetherAI } from "../llms.js";

const describeIfTogetherKey = process.env.TOGETHER_AI_API_KEY
  ? describe
  : describe.skip;

describeIfTogetherKey("TogetherAI integration", () => {
  test("invoke", async () => {
    const model = new TogetherAI({
      model: "togethercomputer/StripedHyena-Nous-7B",
    });
    const prompt = PromptTemplate.fromTemplate("Answer briefly: {input}");
    const result = await prompt.pipe(model).invoke({ input: "Tell me a joke" });

    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
