import { describe, expect, it } from "vitest";
import { z } from "zod/v3";
import { ModelRefusalError } from "../../errors/index.js";
import { AIMessage } from "../../messages/ai.js";
import { ChatGeneration } from "../../outputs.js";
import { JsonOutputParser } from "../json.js";
import {
  JsonOutputKeyToolsParser,
  JsonOutputToolsParser,
} from "../openai_tools/json_output_tools_parsers.js";
import { StructuredOutputParser } from "../structured.js";

const REFUSED = new AIMessage({
  content: [],
  response_metadata: {
    model_provider: "anthropic",
    stop_reason: "refusal",
    stop_details: { category: "cyber", explanation: "Blocked." },
  },
});
const generation = (message: AIMessage): ChatGeneration => ({
  text: message.text,
  message,
});

describe("parsers raise ModelRefusalError on a refusal", () => {
  const parsers = {
    JsonOutputParser: new JsonOutputParser(),
    JsonOutputToolsParser: new JsonOutputToolsParser(),
    JsonOutputKeyToolsParser: new JsonOutputKeyToolsParser({
      keyName: "answer",
      returnSingle: true,
    }),
    StructuredOutputParser: StructuredOutputParser.fromZodSchema(
      z.object({ answer: z.string() })
    ),
  };

  it.each(Object.entries(parsers))("%s", async (_, parser) => {
    const error = await parser
      .parseResult([generation(REFUSED)])
      .catch((e: unknown) => e);
    expect(ModelRefusalError.isInstance(error)).toBe(true);
    expect((error as ModelRefusalError).message).toBe(
      "Model refused to produce the requested output (category='cyber'): Blocked."
    );
    expect((error as ModelRefusalError).rawMessage).toBe(REFUSED);
  });

  it("raises through invoke", async () => {
    await expect(new JsonOutputParser().invoke(REFUSED)).rejects.toThrow(
      ModelRefusalError
    );
  });

  it("does not throw on partial results", async () => {
    await expect(
      new JsonOutputParser().parsePartialResult([generation(REFUSED)])
    ).resolves.toBeNull();
    await expect(
      new JsonOutputToolsParser().parsePartialResult([generation(REFUSED)])
    ).resolves.toEqual([]);
  });

  it("ignores translator errors and parses as before", async () => {
    const message = new AIMessage('{"answer": "4"}');
    const result = generation(message);
    Object.defineProperty(message, "contentBlocks", {
      get() {
        throw new Error("translator failed");
      },
    });
    await expect(new JsonOutputParser().parseResult([result])).resolves.toEqual(
      {
        answer: "4",
      }
    );
  });

  it("still parses a normal message", async () => {
    const message = new AIMessage('{"answer": "4"}');
    await expect(
      new JsonOutputParser().parseResult([generation(message)])
    ).resolves.toEqual({ answer: "4" });
  });
});
