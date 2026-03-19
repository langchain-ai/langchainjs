import { test, expect } from "vitest";
import { AIMessage } from "@langchain/core/messages";
import { NoOpOutputParser } from "../noop.js";

test("NoOpOutputParser returns text from ContentBlock[] messages", async () => {
  const parser = new NoOpOutputParser();
  const message = new AIMessage({
    content: [
      {
        type: "reasoning",
        reasoning: "internal reasoning",
      },
      {
        type: "text",
        text: "visible output",
      },
    ],
  });

  await expect(parser.invoke(message)).resolves.toBe("visible output");
});
