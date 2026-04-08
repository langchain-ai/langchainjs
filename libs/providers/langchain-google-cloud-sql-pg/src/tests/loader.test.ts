import { PostgresLoader, PostgresLoaderOptions } from "../loader.js";
import PostgresEngine from "../engine.js";

/**
 * Unit tests for PostgresLoader error handling.
 * These tests verify that non-string errors thrown by the database
 * are properly propagated instead of being silently swallowed.
 */

function createMockEngine(rawFn: (...args: unknown[]) => unknown) {
  return {
    pool: {
      raw: rawFn,
    },
  } as unknown as PostgresEngine;
}

describe("PostgresLoader error propagation", () => {
  test("initialize() should re-throw non-string Error objects from pool.raw", async () => {
    const dbError = new Error("connection refused");
    const engine = createMockEngine(() => {
      throw dbError;
    });

    const options: PostgresLoaderOptions = {
      query: "SELECT * FROM some_table",
    };

    await expect(PostgresLoader.initialize(engine, options)).rejects.toThrow(
      "connection refused"
    );
  });

  test("initialize() should re-throw string errors from pool.raw", async () => {
    const engine = createMockEngine(() => {
      throw "string error message";
    });

    const options: PostgresLoaderOptions = {
      query: "SELECT * FROM some_table",
    };

    await expect(PostgresLoader.initialize(engine, options)).rejects.toThrow(
      "string error message"
    );
  });

  test("lazyLoad() should re-throw non-string Error objects from pool.raw", async () => {
    const dbError = new TypeError("query syntax error");
    const engine = createMockEngine(() => {
      throw dbError;
    });

    // Construct a loader directly to test lazyLoad without going through initialize
    const loader = new PostgresLoader(engine, {
      query: "SELECT * FROM some_table",
      contentColumns: ["col1"],
      metadataColumns: [],
    });

    const generator = loader.lazyLoad();
    await expect(generator.next()).rejects.toThrow("query syntax error");
  });

  test("lazyLoad() should re-throw string errors from pool.raw", async () => {
    const engine = createMockEngine(() => {
      throw "a string error";
    });

    const loader = new PostgresLoader(engine, {
      query: "SELECT * FROM some_table",
      contentColumns: ["col1"],
      metadataColumns: [],
    });

    const generator = loader.lazyLoad();
    await expect(generator.next()).rejects.toThrow("a string error");
  });
});
