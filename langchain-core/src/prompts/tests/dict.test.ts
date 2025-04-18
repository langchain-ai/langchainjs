import { describe, it, expect } from "@jest/globals";
import { DictPromptTemplate } from "../dict.js";

describe("DictPromptTemplate", () => {
  it("should format dicts with f-string template values", async () => {
    const template = {
      type: "text",
      text: "{text1}",
      cache_control: { type: "ephemeral" },
      hello: 2,
      booleano: true,
    };
    const prompt = new DictPromptTemplate({
      template,
      templateFormat: "f-string",
    });
    await expect(
      prompt.format({
        text1: "important message",
        name1: "foo",
      })
    ).resolves.toEqual({
      type: "text",
      text: "important message",
      cache_control: { type: "ephemeral" },
      hello: 2,
      booleano: true,
    });
  });
});
