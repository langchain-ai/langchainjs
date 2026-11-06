import { describe, expect, test } from "vitest";
import { z } from "zod/v3";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import { ChatCohere } from "../chat_models.js";

const model = () =>
  new ChatCohere({
    apiKey: "test-api-key",
    model: "command-a-reasoning-08-2025",
  });

describe("ChatCohere tool binding does not mutate the tool schema", () => {
  test("a reused Zod tool schema keeps no property-level `required`", () => {
    // `toJsonSchema` caches per Zod object, so a shared schema is shared with every later caller.
    const schema = z.object({ content: z.string(), filename: z.string() });
    const tool = new DynamicStructuredTool({
      name: "generate_file",
      description: "Generate a file",
      schema,
      func: async () => "ok",
    });

    model().bindTools([tool]);

    const { properties } = toJsonSchema(schema) as {
      properties: Record<string, Record<string, unknown>>;
    };
    expect(properties.content).not.toHaveProperty("required");
    expect(properties.filename).not.toHaveProperty("required");
  });

  test("an OpenAI-format tool's parameters are left untouched", () => {
    const parameters = {
      type: "object",
      properties: { city: { type: "string" }, unit: { type: "string" } },
      required: ["city"],
    };
    const snapshot = structuredClone(parameters);

    model().bindTools([
      {
        type: "function",
        function: { name: "weather", description: "Weather", parameters },
      },
    ]);

    expect(parameters).toEqual(snapshot);
  });
});
