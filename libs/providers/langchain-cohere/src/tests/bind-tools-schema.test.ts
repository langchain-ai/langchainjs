import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import { ChatCohere } from "../chat_models.js";

const schema = z.object({ content: z.string(), filename: z.string() });

function makeTool() {
  return new DynamicStructuredTool({
    name: "write_file",
    description: "Write a file",
    schema,
    func: async () => "ok",
  });
}

describe("ChatCohere.bindTools", () => {
  it("does not mutate the JSON schema it converts", () => {
    const tool = makeTool();
    const before = toJsonSchema(tool.schema);

    const model = new ChatCohere({ apiKey: "test", model: "command-r" });
    model.bindTools([tool]);

    // `toJsonSchema` caches per Zod object, so the second call returns the very
    // object the converter just touched.
    const after = toJsonSchema(tool.schema);
    expect(after).toEqual(before);
    for (const property of Object.values(
      after.properties as Record<string, unknown>
    )) {
      expect(property).not.toHaveProperty("required");
    }
  });

  it("stays idempotent across repeated binds", () => {
    const tool = makeTool();
    const model = new ChatCohere({ apiKey: "test", model: "command-r" });
    model.bindTools([tool]);
    model.bindTools([tool]);

    const after = toJsonSchema(tool.schema) as {
      properties: Record<string, Record<string, unknown>>;
      required: string[];
    };
    expect(after.required).toEqual(["content", "filename"]);
    expect(after.properties.content).toEqual({ type: "string" });
    expect(after.properties.filename).toEqual({ type: "string" });
  });
});
