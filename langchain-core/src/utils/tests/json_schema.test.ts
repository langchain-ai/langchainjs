import { describe, it, expect } from "@jest/globals";
import { z as z4 } from "zod/v4";
import { toJsonSchema } from "../json_schema.js";

describe("toJsonSchema", () => {
  describe("with zod v4 schemas", () => {
    // https://github.com/langchain-ai/langchainjs/issues/8367
    it("should allow transformed v4 zod schemas", () => {
      const schema = z4
        .object({
          name: z4.string(),
          age: z4.number(),
        })
        .transform((data) => ({
          ...data,
          upperName: data.name.toUpperCase(),
          doubledAge: data.age * 2,
        }))
        .describe("Object description");
      const jsonSchema = toJsonSchema(schema);
      expect(jsonSchema).toEqual({
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        description: "Object description",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
        required: ["name", "age"],
        additionalProperties: false,
      });
    });
    it("should allow v4 zod schemas with inner transforms", () => {
      const userSchema = z4.object({
        name: z4.string().transform((name) => Math.random() * name.length),
        age: z4.number(),
      });
      const schema = z4
        .object({
          users: z4.array(userSchema).transform((users) => users.length),
          count: z4.number().transform((count) => String(count * 2)),
        })
        .transform((data) => JSON.stringify(data));
      const jsonSchema = toJsonSchema(schema);
      expect(jsonSchema).toEqual({
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        properties: {
          users: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: { name: { type: "string" }, age: { type: "number" } },
              required: ["name", "age"],
            },
          },
          count: { type: "number" },
        },
        required: ["users", "count"],
        additionalProperties: false,
      });
    });
  });
});
