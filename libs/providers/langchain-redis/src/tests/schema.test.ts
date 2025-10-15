/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from "vitest";
import { SchemaFieldTypes } from "redis";
import { Document } from "@langchain/core/documents";
import {
  buildMetadataSchema,
  serializeMetadataField,
  deserializeMetadataField,
  inferMetadataSchema,
  checkForSchemaMismatch,
  MetadataFieldSchema,
  DEFAULT_TAG_SEPARATOR,
} from "../schema.js";

describe("buildMetadataSchema", () => {
  test("builds schema for tag field with default options", () => {
    const metadataSchema: MetadataFieldSchema[] = [
      { name: "category", type: "tag" },
    ];
    const schema: any = {};

    const result = buildMetadataSchema(metadataSchema, schema);

    expect(result.category).toEqual({
      type: SchemaFieldTypes.TAG,
      SEPARATOR: DEFAULT_TAG_SEPARATOR,
    });
  });

  test("builds schema for tag field with custom separator", () => {
    const metadataSchema: MetadataFieldSchema[] = [
      { name: "category", type: "tag", options: { separator: "," } },
    ];
    const schema: any = {};

    const result = buildMetadataSchema(metadataSchema, schema);

    expect(result.category).toEqual({
      type: SchemaFieldTypes.TAG,
      SEPARATOR: ",",
    });
  });

  test("builds schema for tag field with case sensitive option", () => {
    const metadataSchema: MetadataFieldSchema[] = [
      { name: "category", type: "tag", options: { caseSensitive: true } },
    ];
    const schema: any = {};

    const result = buildMetadataSchema(metadataSchema, schema);

    expect(result.category).toEqual({
      type: SchemaFieldTypes.TAG,
      SEPARATOR: DEFAULT_TAG_SEPARATOR,
      CASESENSITIVE: true,
    });
  });

  test("builds schema for tag field with noindex option", () => {
    const metadataSchema: MetadataFieldSchema[] = [
      { name: "category", type: "tag", options: { noindex: true } },
    ];
    const schema: any = {};

    const result = buildMetadataSchema(metadataSchema, schema);

    expect(result.category).toEqual({
      type: SchemaFieldTypes.TAG,
      SEPARATOR: DEFAULT_TAG_SEPARATOR,
      NOINDEX: true,
    });
  });

  test("builds schema for text field with default options", () => {
    const metadataSchema: MetadataFieldSchema[] = [
      { name: "description", type: "text" },
    ];
    const schema: any = {};

    const result = buildMetadataSchema(metadataSchema, schema);

    expect(result.description).toEqual({
      type: SchemaFieldTypes.TEXT,
    });
  });

  test("builds schema for text field with weight option", () => {
    const metadataSchema: MetadataFieldSchema[] = [
      { name: "description", type: "text", options: { weight: 2.0 } },
    ];
    const schema: any = {};

    const result = buildMetadataSchema(metadataSchema, schema);

    expect(result.description).toEqual({
      type: SchemaFieldTypes.TEXT,
      WEIGHT: 2.0,
    });
  });

  test("builds schema for text field with noStem option", () => {
    const metadataSchema: MetadataFieldSchema[] = [
      { name: "description", type: "text", options: { noStem: true } },
    ];
    const schema: any = {};

    const result = buildMetadataSchema(metadataSchema, schema);

    expect(result.description).toEqual({
      type: SchemaFieldTypes.TEXT,
      NOSTEM: true,
    });
  });

  test("builds schema for text field with noindex option", () => {
    const metadataSchema: MetadataFieldSchema[] = [
      { name: "description", type: "text", options: { noindex: true } },
    ];
    const schema: any = {};

    const result = buildMetadataSchema(metadataSchema, schema);

    expect(result.description).toEqual({
      type: SchemaFieldTypes.TEXT,
      NOINDEX: true,
    });
  });

  test("builds schema for numeric field with default options", () => {
    const metadataSchema: MetadataFieldSchema[] = [
      { name: "price", type: "numeric" },
    ];
    const schema: any = {};

    const result = buildMetadataSchema(metadataSchema, schema);

    expect(result.price).toEqual({
      type: SchemaFieldTypes.NUMERIC,
    });
  });

  test("builds schema for numeric field with sortable option", () => {
    const metadataSchema: MetadataFieldSchema[] = [
      { name: "price", type: "numeric", options: { sortable: true } },
    ];
    const schema: any = {};

    const result = buildMetadataSchema(metadataSchema, schema);

    expect(result.price).toEqual({
      type: SchemaFieldTypes.NUMERIC,
      SORTABLE: true,
    });
  });

  test("builds schema for numeric field with noindex option", () => {
    const metadataSchema: MetadataFieldSchema[] = [
      { name: "price", type: "numeric", options: { noindex: true } },
    ];
    const schema: any = {};

    const result = buildMetadataSchema(metadataSchema, schema);

    expect(result.price).toEqual({
      type: SchemaFieldTypes.NUMERIC,
      NOINDEX: true,
    });
  });

  test("builds schema for geo field", () => {
    const metadataSchema: MetadataFieldSchema[] = [
      { name: "location", type: "geo" },
    ];
    const schema: any = {};

    const result = buildMetadataSchema(metadataSchema, schema);

    expect(result.location).toEqual({
      type: SchemaFieldTypes.GEO,
    });
  });

  test("builds schema for geo field with noindex option", () => {
    const metadataSchema: MetadataFieldSchema[] = [
      { name: "location", type: "geo", options: { noindex: true } },
    ];
    const schema: any = {};

    const result = buildMetadataSchema(metadataSchema, schema);

    expect(result.location).toEqual({
      type: SchemaFieldTypes.GEO,
      NOINDEX: true,
    });
  });

  test("builds schema for multiple fields", () => {
    const metadataSchema: MetadataFieldSchema[] = [
      { name: "category", type: "tag" },
      { name: "price", type: "numeric", options: { sortable: true } },
      { name: "description", type: "text", options: { weight: 2.0 } },
      { name: "location", type: "geo" },
    ];
    const schema: any = {};

    const result = buildMetadataSchema(metadataSchema, schema);

    expect(result.category).toBeDefined();
    expect(result.price).toBeDefined();
    expect(result.description).toBeDefined();
    expect(result.location).toBeDefined();
    expect(Object.keys(result)).toHaveLength(4);
  });

  test("handles unknown field type by defaulting to text", () => {
    const metadataSchema: MetadataFieldSchema[] = [
      { name: "unknown", type: "unknown" as any },
    ];
    const schema: any = {};

    const result = buildMetadataSchema(metadataSchema, schema);

    expect(result.unknown).toEqual({
      type: SchemaFieldTypes.TEXT,
    });
  });

  test("preserves existing schema fields", () => {
    const metadataSchema: MetadataFieldSchema[] = [
      { name: "category", type: "tag" },
    ];
    const schema: any = {
      existingField: { type: SchemaFieldTypes.TEXT },
    };

    const result = buildMetadataSchema(metadataSchema, schema);

    expect(result.existingField).toBeDefined();
    expect(result.category).toBeDefined();
    expect(Object.keys(result)).toHaveLength(2);
  });
});

describe("serializeMetadataField", () => {
  test("serializes tag field with string value", () => {
    const schema: MetadataFieldSchema = { name: "category", type: "tag" };
    const result = serializeMetadataField(schema, "electronics");
    expect(result).toBe("electronics");
  });

  test("serializes tag field with array value using default separator", () => {
    const schema: MetadataFieldSchema = { name: "category", type: "tag" };
    const result = serializeMetadataField(schema, ["electronics", "gadgets"]);
    expect(result).toBe("electronics,gadgets");
  });

  test("serializes tag field with array value using custom separator", () => {
    const schema: MetadataFieldSchema = {
      name: "category",
      type: "tag",
      options: { separator: "|" },
    };
    const result = serializeMetadataField(schema, ["electronics", "gadgets"]);
    expect(result).toBe("electronics|gadgets");
  });

  test("serializes text field", () => {
    const schema: MetadataFieldSchema = { name: "description", type: "text" };
    const result = serializeMetadataField(schema, "A great product");
    expect(result).toBe("A great product");
  });

  test("serializes numeric field with number", () => {
    const schema: MetadataFieldSchema = { name: "price", type: "numeric" };
    const result = serializeMetadataField(schema, 99.99);
    expect(result).toBe(99.99);
  });

  test("serializes numeric field with Date object", () => {
    const schema: MetadataFieldSchema = { name: "created_at", type: "numeric" };
    const date = new Date("2023-01-01T00:00:00Z");
    const result = serializeMetadataField(schema, date);
    expect(result).toBe(Math.floor(date.getTime() / 1000));
  });

  test("serializes geo field with array", () => {
    const schema: MetadataFieldSchema = { name: "location", type: "geo" };
    const result = serializeMetadataField(schema, [-122.4194, 37.7749]);
    expect(result).toBe("-122.4194,37.7749");
  });

  test("serializes geo field with string", () => {
    const schema: MetadataFieldSchema = { name: "location", type: "geo" };
    const result = serializeMetadataField(schema, "-122.4194,37.7749");
    expect(result).toBe("-122.4194,37.7749");
  });

  test("serializes unknown type as string", () => {
    const schema: MetadataFieldSchema = {
      name: "unknown",
      type: "unknown" as any,
    };
    const result = serializeMetadataField(schema, "some value");
    expect(result).toBe("some value");
  });
});

describe("deserializeMetadataField", () => {
  test("deserializes tag field with simple string", () => {
    const schema: MetadataFieldSchema = { name: "category", type: "tag" };
    const result = deserializeMetadataField(schema, "electronics");
    expect(result).toBe("electronics");
  });

  test("deserializes tag field with separator-delimited string using default separator", () => {
    const schema: MetadataFieldSchema = { name: "category", type: "tag" };
    const result = deserializeMetadataField(schema, "electronics,gadgets");
    expect(result).toEqual(["electronics", "gadgets"]);
  });

  test("deserializes tag field with separator-delimited string using custom separator", () => {
    const schema: MetadataFieldSchema = {
      name: "category",
      type: "tag",
      options: { separator: "|" },
    };
    const result = deserializeMetadataField(schema, "electronics|gadgets");
    expect(result).toEqual(["electronics", "gadgets"]);
  });

  test("deserializes tag field without separator as-is", () => {
    const schema: MetadataFieldSchema = { name: "category", type: "tag" };
    const result = deserializeMetadataField(schema, "electronics");
    expect(result).toBe("electronics");
  });

  test("deserializes text field", () => {
    const schema: MetadataFieldSchema = { name: "description", type: "text" };
    const result = deserializeMetadataField(schema, "A great product");
    expect(result).toBe("A great product");
  });

  test("deserializes numeric field from string", () => {
    const schema: MetadataFieldSchema = { name: "price", type: "numeric" };
    const result = deserializeMetadataField(schema, "99.99");
    expect(result).toBe(99.99);
  });

  test("deserializes numeric field from number", () => {
    const schema: MetadataFieldSchema = { name: "price", type: "numeric" };
    const result = deserializeMetadataField(schema, 99.99);
    expect(result).toBe(99.99);
  });

  test("deserializes numeric field (timestamp) as number, not Date", () => {
    const schema: MetadataFieldSchema = { name: "created_at", type: "numeric" };
    const epoch = 1672531200;
    const result = deserializeMetadataField(schema, epoch.toString());
    expect(result).toBe(epoch);
    expect(typeof result).toBe("number");
  });

  test("deserializes geo field from string to array", () => {
    const schema: MetadataFieldSchema = { name: "location", type: "geo" };
    const result = deserializeMetadataField(schema, "-122.4194,37.7749");
    expect(result).toEqual([-122.4194, 37.7749]);
  });

  test("deserializes geo field without comma as-is", () => {
    const schema: MetadataFieldSchema = { name: "location", type: "geo" };
    const result = deserializeMetadataField(schema, "invalid");
    expect(result).toBe("invalid");
  });

  test("handles undefined value", () => {
    const schema: MetadataFieldSchema = { name: "category", type: "tag" };
    const result = deserializeMetadataField(schema, undefined);
    expect(result).toBeUndefined();
  });

  test("handles null value", () => {
    const schema: MetadataFieldSchema = { name: "category", type: "tag" };
    const result = deserializeMetadataField(schema, null);
    expect(result).toBeNull();
  });

  test("deserializes unknown type as-is", () => {
    const schema: MetadataFieldSchema = {
      name: "unknown",
      type: "unknown" as any,
    };
    const result = deserializeMetadataField(schema, "some value");
    expect(result).toBe("some value");
  });
});

describe("Serialization and Deserialization Round-trip", () => {
  test("tag field round-trip with array", () => {
    const schema: MetadataFieldSchema = { name: "category", type: "tag" };
    const original = ["electronics", "gadgets"];
    const serialized = serializeMetadataField(schema, original);
    const deserialized = deserializeMetadataField(schema, serialized);
    expect(deserialized).toEqual(original);
  });

  test("tag field round-trip with custom separator", () => {
    const schema: MetadataFieldSchema = {
      name: "category",
      type: "tag",
      options: { separator: "|" },
    };
    const original = ["electronics", "gadgets", "tech"];
    const serialized = serializeMetadataField(schema, original);
    const deserialized = deserializeMetadataField(schema, serialized);
    expect(deserialized).toEqual(original);
  });

  test("numeric field round-trip with Date", () => {
    const schema: MetadataFieldSchema = { name: "created_at", type: "numeric" };
    const originalDate = new Date("2023-01-01T00:00:00Z");
    const serialized = serializeMetadataField(schema, originalDate);
    const deserialized = deserializeMetadataField(schema, serialized);

    // Deserialized value is a number (epoch timestamp)
    expect(typeof deserialized).toBe("number");
    expect(deserialized).toBe(Math.floor(originalDate.getTime() / 1000));

    // Can be converted back to Date
    const reconstructedDate = new Date((deserialized as number) * 1000);
    expect(reconstructedDate.getTime()).toBe(originalDate.getTime());
  });

  test("geo field round-trip with array", () => {
    const schema: MetadataFieldSchema = { name: "location", type: "geo" };
    const original = [-122.4194, 37.7749];
    const serialized = serializeMetadataField(schema, original);
    const deserialized = deserializeMetadataField(schema, serialized);
    expect(deserialized).toEqual(original);
  });

  test("text field round-trip", () => {
    const schema: MetadataFieldSchema = { name: "description", type: "text" };
    const original = "A great product with amazing features";
    const serialized = serializeMetadataField(schema, original);
    const deserialized = deserializeMetadataField(schema, serialized);
    expect(deserialized).toBe(original);
  });

  test("numeric field round-trip with number", () => {
    const schema: MetadataFieldSchema = { name: "price", type: "numeric" };
    const original = 99.99;
    const serialized = serializeMetadataField(schema, original);
    const deserialized = deserializeMetadataField(schema, serialized);
    expect(deserialized).toBe(original);
  });
});

describe("Edge Cases", () => {
  test("handles empty array for tag field", () => {
    const schema: MetadataFieldSchema = { name: "category", type: "tag" };
    const serialized = serializeMetadataField(schema, []);
    expect(serialized).toBe("");
  });

  test("handles single-element array for tag field", () => {
    const schema: MetadataFieldSchema = { name: "category", type: "tag" };
    const serialized = serializeMetadataField(schema, ["electronics"]);
    expect(serialized).toBe("electronics");
  });

  test("handles zero for numeric field", () => {
    const schema: MetadataFieldSchema = { name: "price", type: "numeric" };
    const serialized = serializeMetadataField(schema, 0);
    expect(serialized).toBe(0);
    const deserialized = deserializeMetadataField(schema, serialized);
    expect(deserialized).toBe(0);
  });

  test("handles negative numbers for numeric field", () => {
    const schema: MetadataFieldSchema = {
      name: "temperature",
      type: "numeric",
    };
    const serialized = serializeMetadataField(schema, -10.5);
    expect(serialized).toBe(-10.5);
  });

  test("handles negative coordinates for geo field", () => {
    const schema: MetadataFieldSchema = { name: "location", type: "geo" };
    const serialized = serializeMetadataField(schema, [-122.4194, -37.7749]);
    expect(serialized).toBe("-122.4194,-37.7749");
    const deserialized = deserializeMetadataField(schema, serialized);
    expect(deserialized).toEqual([-122.4194, -37.7749]);
  });

  test("handles empty string for text field", () => {
    const schema: MetadataFieldSchema = { name: "description", type: "text" };
    const serialized = serializeMetadataField(schema, "");
    expect(serialized).toBe("");
  });
});

describe("inferMetadataSchema", () => {
  test("infers numeric type for number fields", () => {
    const documents = [
      new Document({ pageContent: "doc1", metadata: { price: 99 } }),
      new Document({ pageContent: "doc2", metadata: { price: 150 } }),
      new Document({ pageContent: "doc3", metadata: { price: 75 } }),
    ];

    const schema = inferMetadataSchema(documents);

    expect(schema).toHaveLength(1);
    expect(schema[0]).toEqual({ name: "price", type: "numeric" });
  });

  test("infers tag type for short categorical strings", () => {
    const documents = [
      new Document({ pageContent: "doc1", metadata: { category: ["tech"] } }),
      new Document({ pageContent: "doc2", metadata: { category: ["books"] } }),
      new Document({ pageContent: "doc3", metadata: { category: ["tech"] } }),
      new Document({ pageContent: "doc4", metadata: { category: ["books"] } }),
      new Document({ pageContent: "doc5", metadata: { category: ["tech"] } }),
      new Document({
        pageContent: "doc6",
        metadata: { category: ["books", "tech"] },
      }),
    ];

    const schema = inferMetadataSchema(documents);

    expect(schema).toHaveLength(1);
    expect(schema[0]).toEqual({ name: "category", type: "tag" });
  });

  test("infers text type for long strings", () => {
    const documents = [
      new Document({
        pageContent: "doc1",
        metadata: {
          description:
            "This is a very long description that should be indexed as text for full-text search",
        },
      }),
      new Document({
        pageContent: "doc2",
        metadata: {
          description:
            "Another long description with different content for testing purposes",
        },
      }),
    ];

    const schema = inferMetadataSchema(documents);

    expect(schema).toHaveLength(1);
    expect(schema[0]).toEqual({ name: "description", type: "text" });
  });

  test("infers geo type for coordinate arrays", () => {
    const documents = [
      new Document({
        pageContent: "doc1",
        metadata: { location: "-122.4194, 37.7749" },
      }),
      new Document({
        pageContent: "doc2",
        metadata: { location: "-118.2437, 34.0522" },
      }),
    ];

    const schema = inferMetadataSchema(documents);

    expect(schema).toHaveLength(1);
    expect(schema[0]).toEqual({ name: "location", type: "geo" });
  });

  test("infers geo type for coordinate strings", () => {
    const documents = [
      new Document({
        pageContent: "doc1",
        metadata: { location: "-122.4194,37.7749" },
      }),
      new Document({
        pageContent: "doc2",
        metadata: { location: "-118.2437,34.0522" },
      }),
    ];

    const schema = inferMetadataSchema(documents);

    expect(schema).toHaveLength(1);
    expect(schema[0]).toEqual({ name: "location", type: "geo" });
  });

  test("infers numeric type for Date objects", () => {
    const documents = [
      new Document({
        pageContent: "doc1",
        metadata: { created_at: new Date("2023-01-01") },
      }),
      new Document({
        pageContent: "doc2",
        metadata: { created_at: new Date("2023-06-15") },
      }),
    ];

    const schema = inferMetadataSchema(documents);

    expect(schema).toHaveLength(1);
    expect(schema[0]).toEqual({ name: "created_at", type: "numeric" });
  });

  test("infers schema for multiple fields", () => {
    const documents = [
      new Document({
        pageContent: "doc1",
        metadata: {
          category: ["tech"],
          price: 99,
          description: "A great product with many features",
          location: "-122.4194, 37.7749",
        },
      }),
      new Document({
        pageContent: "doc2",
        metadata: {
          category: ["books"],
          price: 15,
          description: "An interesting book about technology",
          location: "-118.2437, 34.0522",
        },
      }),
      new Document({
        pageContent: "doc3",
        metadata: {
          category: ["tech"],
          price: 50,
          description: "Another tech product for testing",
          location: "-73.935242, 40.730610",
        },
      }),
      new Document({
        pageContent: "doc4",
        metadata: {
          category: ["books"],
          price: 25,
          description: "A comprehensive guide to programming",
          location: "-0.127758, 51.507351]",
        },
      }),
    ];

    const schema = inferMetadataSchema(documents);

    expect(schema).toHaveLength(4);
    expect(schema).toContainEqual({ name: "category", type: "tag" });
    expect(schema).toContainEqual({ name: "price", type: "numeric" });
    expect(schema).toContainEqual({ name: "description", type: "text" });
    expect(schema).toContainEqual({ name: "location", type: "geo" });
  });

  test("handles empty documents array", () => {
    const schema = inferMetadataSchema([]);
    expect(schema).toEqual([]);
  });

  test("handles documents with no metadata", () => {
    const documents = [
      new Document({ pageContent: "doc1" }),
      new Document({ pageContent: "doc2" }),
    ];

    const schema = inferMetadataSchema(documents);
    expect(schema).toEqual([]);
  });

  test("handles documents with null/undefined metadata values", () => {
    const documents = [
      new Document({ pageContent: "doc1", metadata: { status: null } }),
      new Document({ pageContent: "doc2", metadata: { status: undefined } }),
      new Document({ pageContent: "doc3", metadata: { status: "new" } }),
      new Document({ pageContent: "doc4", metadata: { status: "new" } }),
      new Document({ pageContent: "doc5", metadata: { status: "old" } }),
      new Document({ pageContent: "doc6", metadata: { status: "new" } }),
    ];

    const schema = inferMetadataSchema(documents);

    expect(schema).toHaveLength(1);
    expect(schema[0]).toEqual({ name: "status", type: "text" });
  });
});

describe("checkForSchemaMismatch", () => {
  test("returns false when schemas match exactly", () => {
    const customSchema: MetadataFieldSchema[] = [
      { name: "category", type: "tag" },
      { name: "price", type: "numeric" },
    ];

    const inferredSchema: MetadataFieldSchema[] = [
      { name: "category", type: "tag" },
      { name: "price", type: "numeric" },
    ];

    const result = checkForSchemaMismatch(customSchema, inferredSchema);
    expect(result).toBe(false);
  });

  test("returns false when schemas match in different order", () => {
    const customSchema: MetadataFieldSchema[] = [
      { name: "price", type: "numeric" },
      { name: "category", type: "tag" },
    ];

    const inferredSchema: MetadataFieldSchema[] = [
      { name: "category", type: "tag" },
      { name: "price", type: "numeric" },
    ];

    const result = checkForSchemaMismatch(customSchema, inferredSchema);
    expect(result).toBe(false);
  });

  test("returns true when field types differ", () => {
    const customSchema: MetadataFieldSchema[] = [
      { name: "category", type: "text" }, // Different type
      { name: "price", type: "numeric" },
    ];

    const inferredSchema: MetadataFieldSchema[] = [
      { name: "category", type: "tag" },
      { name: "price", type: "numeric" },
    ];

    const result = checkForSchemaMismatch(customSchema, inferredSchema);
    expect(result).toBe(true);
  });

  test("returns true when custom schema has extra fields", () => {
    const customSchema: MetadataFieldSchema[] = [
      { name: "category", type: "tag" },
      { name: "price", type: "numeric" },
      { name: "extra", type: "text" }, // Extra field
    ];

    const inferredSchema: MetadataFieldSchema[] = [
      { name: "category", type: "tag" },
      { name: "price", type: "numeric" },
    ];

    const result = checkForSchemaMismatch(customSchema, inferredSchema);
    expect(result).toBe(true);
  });

  test("returns true when custom schema is missing fields", () => {
    const customSchema: MetadataFieldSchema[] = [
      { name: "category", type: "tag" },
      // Missing price field
    ];

    const inferredSchema: MetadataFieldSchema[] = [
      { name: "category", type: "tag" },
      { name: "price", type: "numeric" },
    ];

    const result = checkForSchemaMismatch(customSchema, inferredSchema);
    expect(result).toBe(true);
  });

  test("ignores optional properties when comparing schemas", () => {
    const customSchema: MetadataFieldSchema[] = [
      {
        name: "category",
        type: "tag",
        options: { separator: "|", caseSensitive: true },
      },
      { name: "price", type: "numeric", options: { sortable: true } },
    ];

    const inferredSchema: MetadataFieldSchema[] = [
      { name: "category", type: "tag" },
      { name: "price", type: "numeric" },
    ];

    const result = checkForSchemaMismatch(customSchema, inferredSchema);
    expect(result).toBe(false);
  });

  test("handles empty schemas", () => {
    const customSchema: MetadataFieldSchema[] = [];
    const inferredSchema: MetadataFieldSchema[] = [];

    const result = checkForSchemaMismatch(customSchema, inferredSchema);
    expect(result).toBe(false);
  });

  test("returns true when field names differ", () => {
    const customSchema: MetadataFieldSchema[] = [
      { name: "category", type: "tag" },
      { name: "price", type: "numeric" },
    ];

    const inferredSchema: MetadataFieldSchema[] = [
      { name: "category", type: "tag" },
      { name: "cost", type: "numeric" }, // Different name
    ];

    const result = checkForSchemaMismatch(customSchema, inferredSchema);
    expect(result).toBe(true);
  });

  test("handles schemas with all field types", () => {
    const customSchema: MetadataFieldSchema[] = [
      { name: "category", type: "tag" },
      { name: "description", type: "text" },
      { name: "price", type: "numeric" },
      { name: "location", type: "geo" },
    ];

    const inferredSchema: MetadataFieldSchema[] = [
      { name: "category", type: "tag" },
      { name: "description", type: "text" },
      { name: "price", type: "numeric" },
      { name: "location", type: "geo" },
    ];

    const result = checkForSchemaMismatch(customSchema, inferredSchema);
    expect(result).toBe(false);
  });
});
