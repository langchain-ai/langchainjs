import { test, expect, describe } from "vitest";
import { z } from "zod/v4";

import { interopZodResponseFormat, inlineRefsWithSiblings } from "../output.js";

function findRefsWithSiblings(node: unknown, path = "#"): string[] {
  if (Array.isArray(node)) {
    return node.flatMap((item, i) =>
      findRefsWithSiblings(item, `${path}/${i}`)
    );
  }
  if (!node || typeof node !== "object") return [];
  const record = node as Record<string, unknown>;
  const violations: string[] = [];
  if (record.$ref !== undefined && Object.keys(record).length > 1) {
    violations.push(path);
  }
  for (const [key, value] of Object.entries(record)) {
    violations.push(...findRefsWithSiblings(value, `${path}/${key}`));
  }
  return violations;
}

function wireSchemaOf(
  responseFormat: ReturnType<typeof interopZodResponseFormat>
): Record<string, unknown> {
  return responseFormat.json_schema.schema as Record<string, unknown>;
}

describe("interopZodResponseFormat with zod v4", () => {
  test("a field chained .default().describe() produces no $ref with sibling keywords", () => {
    // Metadata on a wrapper type (ZodDefault) hoists the inner schema into
    // $defs and leaves default/description/title as $ref siblings, which
    // OpenAI strict rejects with 400: "$ref cannot have keywords {...}".
    const schema = z.object({
      query: z.string().default("all").describe("what to search for"),
    });

    const responseFormat = interopZodResponseFormat(schema, "search", {});
    const wireSchema = wireSchemaOf(responseFormat);

    expect(findRefsWithSiblings(wireSchema)).toEqual([]);

    const query = (wireSchema.properties as Record<string, unknown>)
      .query as Record<string, unknown>;
    expect(query.$ref).toBeUndefined();
    expect(query.type).toBe("string");
    expect(query.default).toBe("all");
    expect(query.description).toBe("what to search for");
  });

  test("keeps bare $refs and $defs for genuinely reused schemas", () => {
    const point = z.object({ x: z.number(), y: z.number() });
    const schema = z.object({ from: point, to: point });

    const responseFormat = interopZodResponseFormat(schema, "line", {});
    const wireSchema = wireSchemaOf(responseFormat);

    expect(findRefsWithSiblings(wireSchema)).toEqual([]);
    expect(wireSchema.$defs).toBeDefined();
    expect(JSON.stringify(wireSchema)).toContain("#/$defs/");
  });

  test("inlines only the annotated use of a reused schema", () => {
    const point = z.object({ x: z.number(), y: z.number() });
    const schema = z.object({
      from: point,
      to: point.describe("destination point"),
    });

    const responseFormat = interopZodResponseFormat(schema, "line", {});
    const wireSchema = wireSchemaOf(responseFormat);

    expect(findRefsWithSiblings(wireSchema)).toEqual([]);
    const properties = wireSchema.properties as Record<
      string,
      Record<string, unknown>
    >;
    expect(properties.to.description).toBe("destination point");
    expect(properties.to.$ref).toBeUndefined();
  });

  test("a definition absorbed into another leaves no dead copy behind", () => {
    // The wrapper metadata sits inside a reused (hoisted) schema, so the
    // $ref-with-siblings lives inside a $defs entry. After inlining, the
    // absorbed inner definition must not survive as an unreferenced copy
    // that ships with every request.
    const leaf = z.object({ x: z.string() });
    const mid = z.object({
      leaf: leaf.default({ x: "1" }).describe("annotated leaf"),
    });
    const schema = z.object({ first: mid, second: mid });

    const responseFormat = interopZodResponseFormat(schema, "nested", {});
    const wireSchema = wireSchemaOf(responseFormat);

    expect(findRefsWithSiblings(wireSchema)).toEqual([]);
    const defs = (wireSchema.$defs ?? {}) as Record<string, unknown>;
    const serialized = JSON.stringify(wireSchema);
    for (const name of Object.keys(defs)) {
      expect(serialized).toContain(`#/$defs/${name}`);
    }
  });

  test("does not loop on recursive schemas", () => {
    interface Category {
      name: string;
      subcategories: Category[];
    }
    const category: z.ZodType<Category> = z.lazy(() =>
      z.object({
        name: z.string(),
        subcategories: z.array(category),
      })
    ) as never;
    const schema = z.object({ root: category });

    const responseFormat = interopZodResponseFormat(schema, "tree", {});
    const wireSchema = wireSchemaOf(responseFormat);

    expect(findRefsWithSiblings(wireSchema)).toEqual([]);
    expect(JSON.stringify(wireSchema)).toContain("#/$defs/");
  });
});

describe("inlineRefsWithSiblings", () => {
  test("merges the referenced definition and drops the orphaned entry", () => {
    const schema = {
      type: "object",
      properties: {
        query: {
          default: "all",
          description: "what to search for",
          $ref: "#/$defs/__schema0",
        },
      },
      $defs: { __schema0: { type: "string" } },
    };

    const result = inlineRefsWithSiblings(schema);

    expect(result.$defs).toBeUndefined();
    expect((result.properties as Record<string, unknown>).query).toEqual({
      type: "string",
      default: "all",
      description: "what to search for",
    });
  });
});
