import { test, expect, describe } from "vitest";
import {
  removeLuceneChars,
  isVersionLessThan,
  constructMetadataFilter,
} from "../neo4j_vector.js";

describe("removeLuceneChars", () => {
  test("should return null for null input", () => {
    expect(removeLuceneChars(null)).toBeNull();
  });

  test("should return null for undefined input", () => {
    expect(removeLuceneChars(undefined as unknown as null)).toBeNull();
  });

  test("should return trimmed text when no special chars", () => {
    expect(removeLuceneChars("hello world")).toBe("hello world");
  });

  test("should remove plus and minus signs", () => {
    expect(removeLuceneChars("hello+world-test")).toBe("hello world test");
  });

  test("should remove brackets and parentheses", () => {
    expect(removeLuceneChars("test(foo)[bar]{baz}")).toBe(
      "test foo  bar  baz"
    );
  });

  test("should remove wildcards and question marks", () => {
    expect(removeLuceneChars("test*foo?bar")).toBe("test foo bar");
  });

  test("should remove tildes and carets", () => {
    expect(removeLuceneChars("test~foo^bar")).toBe("test foo bar");
  });

  test("should remove colons and backslashes", () => {
    expect(removeLuceneChars("field:value\\escaped")).toBe(
      "field value escaped"
    );
  });

  test("should remove quotes", () => {
    expect(removeLuceneChars('"quoted text"')).toBe("quoted text");
  });

  test("should remove logical operator characters", () => {
    expect(removeLuceneChars("a&b|c!d")).toBe("a b c d");
  });

  test("should handle empty string", () => {
    expect(removeLuceneChars("")).toBe("");
  });

  test("should handle string with only special chars", () => {
    const result = removeLuceneChars("+-&|!(){}[]^\"~*?:\\");
    expect(result).toBe("");
  });
});

describe("isVersionLessThan", () => {
  test("should return true when first version is less", () => {
    expect(isVersionLessThan([5, 10, 0], [5, 11, 0])).toBe(true);
  });

  test("should return false when versions are equal", () => {
    expect(isVersionLessThan([5, 11, 0], [5, 11, 0])).toBe(false);
  });

  test("should return false when first version is greater", () => {
    expect(isVersionLessThan([5, 12, 0], [5, 11, 0])).toBe(false);
  });

  test("should compare major versions first", () => {
    expect(isVersionLessThan([4, 99, 99], [5, 0, 0])).toBe(true);
  });

  test("should compare patch versions", () => {
    expect(isVersionLessThan([5, 11, 0], [5, 11, 1])).toBe(true);
  });

  test("should handle shorter version arrays", () => {
    expect(isVersionLessThan([5, 11], [5, 11, 0])).toBe(true);
  });

  test("should handle equal length arrays", () => {
    expect(isVersionLessThan([5, 18, 0], [5, 18, 0])).toBe(false);
  });

  test("should handle single element arrays", () => {
    expect(isVersionLessThan([4], [5])).toBe(true);
    expect(isVersionLessThan([5], [4])).toBe(false);
  });
});

describe("constructMetadataFilter", () => {
  test("should handle simple equality filter", () => {
    const [query, params] = constructMetadataFilter({ name: "Alice" });
    expect(query).toBe("n.name = $param_1");
    expect(params).toEqual({ param_1: "Alice" });
  });

  test("should handle $eq operator", () => {
    const [query, params] = constructMetadataFilter({
      name: { $eq: "Bob" },
    });
    expect(query).toBe("n.name = $param_1");
    expect(params).toEqual({ param_1: "Bob" });
  });

  test("should handle $ne operator", () => {
    const [query, params] = constructMetadataFilter({
      name: { $ne: "Charlie" },
    });
    expect(query).toBe("n.name <> $param_1");
    expect(params).toEqual({ param_1: "Charlie" });
  });

  test("should handle $lt operator", () => {
    const [query, params] = constructMetadataFilter({ age: { $lt: 30 } });
    expect(query).toBe("n.age < $param_1");
    expect(params).toEqual({ param_1: 30 });
  });

  test("should handle $lte operator", () => {
    const [query, params] = constructMetadataFilter({ age: { $lte: 30 } });
    expect(query).toBe("n.age <= $param_1");
    expect(params).toEqual({ param_1: 30 });
  });

  test("should handle $gt operator", () => {
    const [query, params] = constructMetadataFilter({ age: { $gt: 18 } });
    expect(query).toBe("n.age > $param_1");
    expect(params).toEqual({ param_1: 18 });
  });

  test("should handle $gte operator", () => {
    const [query, params] = constructMetadataFilter({ age: { $gte: 18 } });
    expect(query).toBe("n.age >= $param_1");
    expect(params).toEqual({ param_1: 18 });
  });

  test("should handle $in operator", () => {
    const [query, params] = constructMetadataFilter({
      status: { $in: ["active", "pending"] },
    });
    expect(query).toBe("n.status IN $param_1");
    expect(params).toEqual({ param_1: ["active", "pending"] });
  });

  test("should handle $nin operator", () => {
    const [query, params] = constructMetadataFilter({
      status: { $nin: ["deleted"] },
    });
    expect(query).toBe("n.status NOT IN $param_1");
    expect(params).toEqual({ param_1: ["deleted"] });
  });

  test("should handle $like operator", () => {
    const [query, params] = constructMetadataFilter({
      name: { $like: "Ali%" },
    });
    expect(query).toBe("n.name CONTAINS $param_1");
    expect(params).toEqual({ param_1: "Ali" });
  });

  test("should handle $ilike operator", () => {
    const [query, params] = constructMetadataFilter({
      name: { $ilike: "ali%" },
    });
    expect(query).toBe("toLower(n.name) CONTAINS $param_1");
    expect(params).toEqual({ param_1: "ali" });
  });

  test("should handle $between operator", () => {
    const [query, params] = constructMetadataFilter({
      age: { $between: [18, 65] },
    });
    expect(query).toBe("$param_1_low <= n.age <= $param_1_high");
    expect(params).toEqual({ param_1_low: 18, param_1_high: 65 });
  });

  test("should handle $and logical operator", () => {
    const [query, params] = constructMetadataFilter({
      $and: [{ name: "Alice" }, { age: { $gt: 18 } }],
    });
    expect(query).toContain("AND");
    expect(query).toContain("n.name =");
    expect(query).toContain("n.age >");
  });

  test("should handle $or logical operator", () => {
    const [query, params] = constructMetadataFilter({
      $or: [{ name: "Alice" }, { name: "Bob" }],
    });
    expect(query).toContain("OR");
    expect(Object.keys(params).length).toBeGreaterThan(0);
  });

  test("should handle multiple fields (implicit AND)", () => {
    const [query, params] = constructMetadataFilter({
      name: "Alice",
      age: 30,
    });
    expect(query).toContain("n.name = $param_1");
    expect(query).toContain("AND");
    expect(query).toContain("n.age = $param_2");
    expect(params).toEqual({ param_1: "Alice", param_2: 30 });
  });

  test("should throw on invalid filter type", () => {
    expect(() => constructMetadataFilter(null as unknown as Record<string, unknown>)).toThrow(
      "Expected a dictionary"
    );
  });

  test("should throw on empty filter", () => {
    expect(() => constructMetadataFilter({})).toThrow(
      "Filter condition contains no entries"
    );
  });

  test("should throw on invalid operator", () => {
    expect(() =>
      constructMetadataFilter({ name: { $invalid: "test" } })
    ).toThrow("Invalid operator");
  });

  test("should throw on field starting with $", () => {
    expect(() =>
      constructMetadataFilter({ $field: "value", other: "value" })
    ).toThrow("Expected a field but got an operator");
  });

  test("should throw on invalid field name", () => {
    expect(() => constructMetadataFilter({ "field-name": "value" })).toThrow(
      "Invalid field name"
    );
  });

  test("should throw when $in has unsupported value types", () => {
    expect(() =>
      constructMetadataFilter({
        tags: { $in: [{ nested: "object" }] },
      })
    ).toThrow("Unsupported type");
  });

  test("should throw on invalid logical operator", () => {
    expect(() =>
      constructMetadataFilter({ $not: [{ name: "Alice" }] })
    ).toThrow("Expected $and or $or");
  });

  test("should throw when logical operator value is not array", () => {
    expect(() =>
      constructMetadataFilter({ $and: "not-an-array" as unknown as Record<string, unknown>[] })
    ).toThrow("Expected an array");
  });

  test("should throw when filter value has multiple operators", () => {
    expect(() =>
      constructMetadataFilter({ name: { $eq: "A", $ne: "B" } })
    ).toThrow("Expected a value which is a dictionary");
  });
});
