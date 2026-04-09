import { describe, expect, test } from "vitest";
import { TogetherAIEmbeddings } from "../embeddings.js";

const describeIfTogetherKey = process.env.TOGETHER_AI_API_KEY
  ? describe
  : describe.skip;

describeIfTogetherKey("TogetherAIEmbeddings integration", () => {
  test("embedQuery", async () => {
    const embeddings = new TogetherAIEmbeddings();
    const result = await embeddings.embedQuery("Hello world");

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(typeof result[0]).toBe("number");
  });
});
