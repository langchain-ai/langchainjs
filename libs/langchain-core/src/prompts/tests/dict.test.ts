import { describe, it, expect } from "vitest";
import { DictPromptTemplate } from "../dict.js";
import { load } from "../../load/index.js";
import { MAX_PROMPT_TEMPLATE_DEPTH } from "../utils.js";

function createNestedTemplate(depth: number): Record<string, unknown> {
  let template: Record<string, unknown> = { text: "{text}" };
  for (let i = 0; i < depth; i += 1) {
    template = { nested: template };
  }
  return template;
}

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
    expect(JSON.stringify(prompt)).toEqual(
      JSON.stringify({
        lc: 1,
        type: "constructor",
        id: ["langchain_core", "prompts", "dict", "DictPromptTemplate"],
        kwargs: {
          input_variables: ["text1"],
          template: {
            type: "text",
            text: "{text1}",
            cache_control: { type: "ephemeral" },
            hello: 2,
            booleano: true,
          },
          template_format: "f-string",
        },
      })
    );
    const loadedPrompt = (await load(
      JSON.stringify(prompt)
    )) as DictPromptTemplate;
    await expect(
      loadedPrompt.format({
        text1: "important message",
        name1: "foo",
      })
    ).resolves.toEqual(
      await prompt.format({
        text1: "important message",
        name1: "foo",
      })
    );
  });

  it("should format dicts with mustache template values", async () => {
    const template = {
      type: "text",
      text: "{{text1}}",
      cache_control: { type: "ephemeral" },
      mimeType: "{{mimeType}}",
      hello: 2,
      booleano: true,
    };
    const prompt = new DictPromptTemplate({
      template,
      templateFormat: "mustache",
    });
    await expect(
      prompt.format({
        text1: "important message",
        name1: "foo",
        mimeType: "text/plain",
      })
    ).resolves.toEqual({
      type: "text",
      text: "important message",
      cache_control: { type: "ephemeral" },
      mimeType: "text/plain",
      hello: 2,
      booleano: true,
    });
    expect(JSON.stringify(prompt)).toEqual(
      JSON.stringify({
        lc: 1,
        type: "constructor",
        id: ["langchain_core", "prompts", "dict", "DictPromptTemplate"],
        kwargs: {
          input_variables: ["text1", "mimeType"],
          template: {
            type: "text",
            text: "{{text1}}",
            cache_control: { type: "ephemeral" },
            mimeType: "{{mimeType}}",
            hello: 2,
            booleano: true,
          },
          template_format: "mustache",
        },
      })
    );
    const loadedPrompt = (await load(
      JSON.stringify(prompt)
    )) as DictPromptTemplate;
    await expect(
      loadedPrompt.format({
        text1: "important message",
        name1: "foo",
        mimeType: "text/plain",
      })
    ).resolves.toEqual(
      await prompt.format({
        text1: "important message",
        name1: "foo",
        mimeType: "text/plain",
      })
    );
  });

  it("should reject deeply nested dict templates in constructor", () => {
    const template = createNestedTemplate(MAX_PROMPT_TEMPLATE_DEPTH + 1);

    try {
      new DictPromptTemplate({
        template,
        templateFormat: "f-string",
      });
      throw new Error("Expected constructor to fail for deep nesting.");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as { lc_error_code?: string }).lc_error_code).toBe(
        "INVALID_PROMPT_INPUT"
      );
      expect((error as Error).message).toContain(
        "Prompt template nesting exceeds maximum depth"
      );
    }
  });

  it("should reject deeply nested dict templates in format", async () => {
    const prompt = new DictPromptTemplate({
      template: { text: "{text}" },
      templateFormat: "f-string",
    });

    prompt.template = createNestedTemplate(MAX_PROMPT_TEMPLATE_DEPTH + 1);

    try {
      await prompt.format({ text: "important message" });
      throw new Error("Expected formatting to fail for deep nesting.");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as { lc_error_code?: string }).lc_error_code).toBe(
        "INVALID_PROMPT_INPUT"
      );
      expect((error as Error).message).toContain(
        "Prompt template nesting exceeds maximum depth"
      );
    }
  });
});
