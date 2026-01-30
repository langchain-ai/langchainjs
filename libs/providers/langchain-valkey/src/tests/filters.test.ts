import { describe, test, expect } from "vitest";
import { ValkeyVectorStore, SchemaFieldTypes } from "../vectorstores.js";
import { SyntheticEmbeddings } from "@langchain/core/utils/testing";
import type { GlideClient } from "@valkey/valkey-glide";

type ValkeyVectorStoreWithPrivate = ValkeyVectorStore & {
  buildCustomQuery: (...args: unknown[]) => [string, unknown];
  validateMetadata: (metadata: Record<string, unknown>) => void;
};

describe("Filter Building Logic", () => {
  test("builds TAG filter with single value", () => {
    const store = new ValkeyVectorStore(new SyntheticEmbeddings(), {
      valkeyClient: {} as GlideClient,
      indexName: "test",
      customSchema: {
        category: { type: SchemaFieldTypes.TAG },
      },
    });

    const [query] = (store as ValkeyVectorStoreWithPrivate).buildCustomQuery(
      [0.1, 0.2],
      5,
      {
        category: "tech",
      }
    );

    expect(query).toContain("@metadata.category:{tech}");
  });

  test("builds TAG filter with array values", () => {
    const store = new ValkeyVectorStore(new SyntheticEmbeddings(), {
      valkeyClient: {} as GlideClient,
      indexName: "test",
      customSchema: {
        category: { type: SchemaFieldTypes.TAG },
      },
    });

    const [query] = (store as ValkeyVectorStoreWithPrivate).buildCustomQuery(
      [0.1, 0.2],
      5,
      {
        category: ["tech", "science"],
      }
    );

    expect(query).toContain("@metadata.category:({tech}|{science})");
  });

  test("builds NUMERIC filter with exact value", () => {
    const store = new ValkeyVectorStore(new SyntheticEmbeddings(), {
      valkeyClient: {} as GlideClient,
      indexName: "test",
      customSchema: {
        price: { type: SchemaFieldTypes.NUMERIC },
      },
    });

    const [query] = (store as ValkeyVectorStoreWithPrivate).buildCustomQuery(
      [0.1, 0.2],
      5,
      {
        price: 100,
      }
    );

    expect(query).toContain("@metadata.price:[100 100]");
  });

  test("builds NUMERIC filter with min only", () => {
    const store = new ValkeyVectorStore(new SyntheticEmbeddings(), {
      valkeyClient: {} as GlideClient,
      indexName: "test",
      customSchema: {
        price: { type: SchemaFieldTypes.NUMERIC },
      },
    });

    const [query] = (store as ValkeyVectorStoreWithPrivate).buildCustomQuery(
      [0.1, 0.2],
      5,
      {
        price: { min: 100 },
      }
    );

    expect(query).toContain("@metadata.price:[100 +inf]");
  });

  test("builds NUMERIC filter with max only", () => {
    const store = new ValkeyVectorStore(new SyntheticEmbeddings(), {
      valkeyClient: {} as GlideClient,
      indexName: "test",
      customSchema: {
        price: { type: SchemaFieldTypes.NUMERIC },
      },
    });

    const [query] = (store as ValkeyVectorStoreWithPrivate).buildCustomQuery(
      [0.1, 0.2],
      5,
      {
        price: { max: 500 },
      }
    );

    expect(query).toContain("@metadata.price:[-inf 500]");
  });

  test("builds NUMERIC filter with min and max", () => {
    const store = new ValkeyVectorStore(new SyntheticEmbeddings(), {
      valkeyClient: {} as GlideClient,
      indexName: "test",
      customSchema: {
        price: { type: SchemaFieldTypes.NUMERIC },
      },
    });

    const [query] = (store as ValkeyVectorStoreWithPrivate).buildCustomQuery(
      [0.1, 0.2],
      5,
      {
        price: { min: 100, max: 500 },
      }
    );

    expect(query).toContain("@metadata.price:[100 500]");
  });

  test("builds combined filters", () => {
    const store = new ValkeyVectorStore(new SyntheticEmbeddings(), {
      valkeyClient: {} as GlideClient,
      indexName: "test",
      customSchema: {
        category: { type: SchemaFieldTypes.TAG },
        price: { type: SchemaFieldTypes.NUMERIC },
      },
    });

    const [query] = (store as ValkeyVectorStoreWithPrivate).buildCustomQuery(
      [0.1, 0.2],
      5,
      {
        category: "tech",
        price: { min: 100 },
      }
    );

    expect(query).toContain("@metadata.category:{tech}");
    expect(query).toContain("@metadata.price:[100 +inf]");
  });

  test("ignores filters for non-schema fields", () => {
    const store = new ValkeyVectorStore(new SyntheticEmbeddings(), {
      valkeyClient: {} as GlideClient,
      indexName: "test",
      customSchema: {
        category: { type: SchemaFieldTypes.TAG },
      },
    });

    const [query] = (store as ValkeyVectorStoreWithPrivate).buildCustomQuery(
      [0.1, 0.2],
      5,
      {
        category: "tech",
        nonExistent: "value",
      }
    );

    expect(query).toContain("@metadata.category:{tech}");
    expect(query).not.toContain("nonExistent");
  });

  test("returns wildcard when no filters provided", () => {
    const store = new ValkeyVectorStore(new SyntheticEmbeddings(), {
      valkeyClient: {} as GlideClient,
      indexName: "test",
      customSchema: {
        category: { type: SchemaFieldTypes.TAG },
      },
    });

    const [query] = (store as ValkeyVectorStoreWithPrivate).buildCustomQuery(
      [0.1, 0.2],
      5,
      {}
    );

    expect(query).toContain("* =>");
  });

  test("validates metadata before adding documents", () => {
    const store = new ValkeyVectorStore(new SyntheticEmbeddings(), {
      valkeyClient: {} as GlideClient,
      indexName: "test",
      customSchema: {
        price: { type: SchemaFieldTypes.NUMERIC, required: true },
      },
    });

    expect(() =>
      (store as ValkeyVectorStoreWithPrivate).validateMetadata({})
    ).toThrow("Required metadata field 'price' is missing");
  });

  test("validates numeric field type", () => {
    const store = new ValkeyVectorStore(new SyntheticEmbeddings(), {
      valkeyClient: {} as GlideClient,
      indexName: "test",
      customSchema: {
        price: { type: SchemaFieldTypes.NUMERIC },
      },
    });

    expect(() =>
      (store as ValkeyVectorStoreWithPrivate).validateMetadata({
        price: "not-a-number",
      })
    ).toThrow("Metadata field 'price' must be a number");
  });

  test("validates TAG field type", () => {
    const store = new ValkeyVectorStore(new SyntheticEmbeddings(), {
      valkeyClient: {} as GlideClient,
      indexName: "test",
      customSchema: {
        category: { type: SchemaFieldTypes.TAG },
      },
    });

    expect(() =>
      (store as ValkeyVectorStoreWithPrivate).validateMetadata({
        category: 123,
      })
    ).toThrow("Metadata field 'category' must be a string or array");
  });
});
