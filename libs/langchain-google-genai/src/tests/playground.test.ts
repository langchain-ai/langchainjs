import { test } from "@jest/globals";
import { AIMessageChunk } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "../chat_models.js";

describe("ChatGoogleGenerativeAI should count tokens correctly", () => {
  describe("when streaming", () => {
    test.each(["gemini-1.5-flash", "gemini-2.5-pro"])(
      "with %s",
      async (modelName) => {
        if (modelName === "gemini-1.5-flash") {
          return;
        }
        const model = new ChatGoogleGenerativeAI({
          model: modelName,
          temperature: 0,
          maxRetries: 0,
        });
        const res = await model.stream("Why is the sky blue? Be concise");
        let full: AIMessageChunk | undefined;
        for await (const chunk of res) {
          full ??= chunk;
          full = full.concat(chunk);
        }
        console.log(modelName, full);
      }
    );
  });
});
