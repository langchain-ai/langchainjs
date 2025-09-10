import { test, expect, describe } from "@jest/globals";
import { FakeEmbeddings } from "@langchain/core/utils/testing";
import { NeonPostgres } from "../neon.js";

describe("NeonPostgres schemaName handling", () => {
  const fakeEmbeddings = new FakeEmbeddings();

  const baseConfig = {
    connectionString: "postgres://user:pass@localhost:5432/db",
    tableName: "vector_store",
  };

  test("uses only tableName when schemaName is not provided", () => {
    const store = new NeonPostgres(fakeEmbeddings, {
      ...baseConfig,
    });

    expect(store.schemaName).toBeUndefined();
    expect(store.computedTableName).toBe("vector_store");
  });

  test("uses schemaName and tableName when schemaName is provided", () => {
    const store = new NeonPostgres(fakeEmbeddings, {
      ...baseConfig,
      schemaName: "custom_schema",
    });

    expect(store.schemaName).toBe("custom_schema");
    expect(store.computedTableName).toBe('"custom_schema"."vector_store"');
  });
});
