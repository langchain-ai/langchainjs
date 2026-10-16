import { describe, test, expect } from "vitest";
import { z as z4 } from "zod/v4";
import { interopZodResponseFormat } from "../output.js";

function getV4Schema(responseFormat: unknown): Record<string, unknown> {
  return (responseFormat as Record<string, unknown>).json_schema as Record<
    string,
    unknown
  >;
}

describe("interopZodResponseFormat (zod v4)", () => {
  test("inlines $ref siblings for a field chained .default().describe()", () => {
    const schema = z4.object({
      query: z4.string().default("all").describe("what to search for"),
    });

    const fmt = interopZodResponseFormat(schema, "search", {});
    const jsonSchema = getV4Schema(fmt) as {
      schema: Record<string, unknown>;
    };
    const query = (
      jsonSchema.schema.properties as Record<string, unknown>
    ).query as Record<string, unknown>;

    expect(query.$ref).toBeUndefined();
    expect(query).toEqual({
      default: "all",
      description: "what to search for",
      type: "string",
      title: "search",
    });
  });

  test("keeps the reversed chain .describe().default() inline unchanged", () => {
    const schema = z4.object({
      query: z4.string().describe("what to search for").default("all"),
    });

    const fmt = interopZodResponseFormat(schema, "search", {});
    const jsonSchema = getV4Schema(fmt) as {
      schema: Record<string, unknown>;
    };
    const query = (
      jsonSchema.schema.properties as Record<string, unknown>
    ).query as Record<string, unknown>;

    expect(query).toEqual({
      default: "all",
      description: "what to search for",
      type: "string",
      title: "search",
    });
  });

  test("inlines nested $ref siblings inside objects and arrays", () => {
    const schema = z4.object({
      items: z4.array(
        z4.object({
          value: z4.number().default(0).describe("a number"),
        })
      ),
    });

    const fmt = interopZodResponseFormat(schema, "search", {});
    const jsonSchema = getV4Schema(fmt) as {
      schema: Record<string, unknown>;
    };
    const items = (
      jsonSchema.schema.properties as Record<string, unknown>
    ).items as Record<string, unknown>;
    const itemProps = items.items as Record<string, unknown>;
    const value = (
      itemProps.properties as Record<string, unknown>
    ).value as Record<string, unknown>;

    expect(value.$ref).toBeUndefined();
    expect(value).toEqual({
      default: 0,
      description: "a number",
      type: "number",
      title: "search",
    });
  });

  test("leaves a bare $ref without siblings untouched", () => {
    // A self-recursive schema produces a bare $ref; it must not throw and
    // the $ref survives (strict mode accepts a bare $ref).
    let categorySchema: ReturnType<typeof z4.object> = null as never;
    const category = z4.lazy(() => categorySchema);
    categorySchema = z4.object({
      name: z4.string(),
      subcategories: z4.array(category),
    });

    const fmt = interopZodResponseFormat(categorySchema, "search", {});
    const jsonSchema = getV4Schema(fmt) as {
      schema: Record<string, unknown>;
    };
    const subcategories = (
      (
        jsonSchema.schema.properties as Record<string, unknown>
      ).subcategories as Record<string, unknown>
    ).items as Record<string, unknown>;

    expect(typeof subcategories.$ref).toBe("string");
    expect(Object.keys(subcategories).length).toBe(1);
  });

  test("marks strict true and carries the name through", () => {
    const schema = z4.object({ query: z4.string().default("all") });

    const fmt = interopZodResponseFormat(schema, "search", {});
    const jsonSchema = getV4Schema(fmt) as {
      name: string;
      strict: boolean;
    };

    expect(jsonSchema.name).toBe("search");
    expect(jsonSchema.strict).toBe(true);
  });
});
