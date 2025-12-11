import { expect, it, describe } from "vitest";
import {
  HumanMessage,
  AIMessage,
  ContentBlock,
} from "@langchain/core/messages";

import { tools } from "../index.js";
import { ChatOpenAI } from "../../chat_models/index.js";

describe("OpenAI Web Search Tool Tests", () => {
  it(
    "webSearch creates a basic valid tool definition",
    async () => {
      const llm = new ChatOpenAI({ model: "gpt-4o-mini" });
      const llmWithWebSearch = llm.bindTools([
        tools.webSearch({
          userLocation: {
            type: "approximate",
            country: "US",
            city: "San Francisco",
            region: "California",
            timezone: "America/Los_Angeles",
          },
        }),
      ]);

      const response = await llmWithWebSearch.invoke([
        new HumanMessage("What is the current weather?"),
      ]);

      console.log(response.content);
      expect(response).toBeInstanceOf(AIMessage);
      expect(Array.isArray(response.content)).toBe(true);
      expect(
        (response.content as ContentBlock.Text[]).find(
          (block) =>
            block.type === "text" && block.text?.includes("San Francisco")
        )
      ).toBeTruthy();
    },
    {
      /**
       * for some reason the location not always is taken into account, so we retry a few times
       */
      retry: 5,
    }
  );
});
