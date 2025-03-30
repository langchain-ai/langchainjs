/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, jest, describe } from "@jest/globals";
import {
  BigQuery,
  type Table,
  InsertRowsOptions,
} from "@google-cloud/bigquery";
import { Document } from "@langchain/core/documents";
import { FakeEmbeddings } from "@langchain/core/utils/testing";
import { GoogleBigQueryVectorSearch } from "../googlebigquery.js";

const embeddings = new FakeEmbeddings();
const textKey = "text";
const embeddingKey = "embedding_v1";
const documentKey = "my_key";

function createTable() {
  return new BigQuery().dataset("dataset").table("table");
}

describe("GoogleBigQueryVectorSearch", () => {
  let table: Table;
  beforeEach(() => {
    table = createTable();
  });

  test("should create big query search instance successfully", () => {
    const googleBigQuerySearch = new GoogleBigQueryVectorSearch(embeddings, {
      table,
      textKey,
      embeddingKey,
    });
    expect(googleBigQuerySearch).toBeDefined();
  });

  test("should throw error if fractionListsToSearch < 0.0", () => {
    const throwError = () =>
      new GoogleBigQueryVectorSearch(embeddings, {
        table,
        textKey,
        embeddingKey,
        fractionListsToSearch: -1,
      });
    expect(throwError).toThrow(
      "fractionListsToSearch must be between 0.0 and 1.0"
    );
  });

  test("should throw error if fractionListsToSearch > 1.0", () => {
    const throwError = () =>
      new GoogleBigQueryVectorSearch(embeddings, {
        table,
        textKey,
        embeddingKey,
        fractionListsToSearch: 1.00001,
      });
    expect(throwError).toThrow(
      "fractionListsToSearch must be between 0.0 and 1.0"
    );
  });

  describe("GoogleBigQueryVectorSearch.addVectors", () => {
    const mockInsertFn = jest.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolve({});
        })
    );
    beforeEach(() => {
      mockInsertFn.mockClear();
      (<any>table.insert) = mockInsertFn;
    });

    test("should call table.insert() correctly", async () => {
      const text = "test";
      const price = 123;
      const vectors = [0.1, 0.2, 0.3, 0.4];

      const googleBigQuerySearch = new GoogleBigQueryVectorSearch(embeddings, {
        table,
        textKey,
        embeddingKey,
      });
      const d = new Document({ pageContent: text, metadata: { price } });
      await googleBigQuerySearch.addVectors([vectors], [d]);
      expect(mockInsertFn).toHaveBeenCalledTimes(1);
      expect(mockInsertFn).toHaveBeenCalledWith(
        [
          {
            [embeddingKey]: vectors,
            price,
            [textKey]: text,
          },
        ],
        undefined
      );
    });

    test("should call table.insert() correctly with insert row options", async () => {
      const text = "test";
      const price = 123;
      const vectors = [0.1, 0.2, 0.3, 0.4];
      const insertRowsOptions: InsertRowsOptions = {
        createInsertId: true,
      };

      const googleBigQuerySearch = new GoogleBigQueryVectorSearch(embeddings, {
        table,
        textKey,
        embeddingKey,
      });
      const d = new Document({ pageContent: text, metadata: { price } });
      await googleBigQuerySearch.addVectors([vectors], [d], insertRowsOptions);
      expect(mockInsertFn).toHaveBeenCalledTimes(1);
      expect(mockInsertFn).toHaveBeenCalledWith(
        [
          {
            [embeddingKey]: vectors,
            price,
            [textKey]: text,
          },
        ],
        insertRowsOptions
      );
    });

    test("should call table.insert() correctly if documentKey configured", async () => {
      const text = "test";
      const price = 123;
      const id = "unique";
      const vectors = [0.1, 0.2, 0.3, 0.4];

      const googleBigQuerySearch = new GoogleBigQueryVectorSearch(embeddings, {
        table,
        textKey,
        embeddingKey,
        documentKey,
      });
      const d = new Document({ pageContent: text, metadata: { price }, id });
      await googleBigQuerySearch.addVectors([vectors], [d]);
      expect(mockInsertFn).toHaveBeenCalledTimes(1);
      expect(mockInsertFn).toHaveBeenCalledWith(
        [
          {
            [embeddingKey]: vectors,
            price,
            [textKey]: text,
            [documentKey]: id,
          },
        ],
        undefined
      );
    });
  });

  describe("GoogleBigQueryVectorSearch.addDocuments", () => {
    const mockInsertFn = jest.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolve({});
        })
    );
    beforeEach(() => {
      mockInsertFn.mockClear();
      (<any>table.insert) = mockInsertFn;
    });
    test("should call table.insert() correctly", async () => {
      const text = "test";
      const price = 123;

      const googleBigQuerySearch = new GoogleBigQueryVectorSearch(embeddings, {
        table,
        textKey,
        embeddingKey,
      });
      const d = new Document({ pageContent: text, metadata: { price } });
      await googleBigQuerySearch.addDocuments([d]);
      expect(mockInsertFn).toHaveBeenCalledTimes(1);
      expect(mockInsertFn).toHaveBeenCalledWith(
        [
          {
            [embeddingKey]: [0.1, 0.2, 0.3, 0.4],
            price,
            [textKey]: text,
          },
        ],
        undefined
      );
    });
  });

  describe("GoogleBigQueryVectorSearch.similaritySearchVectorWithScore", () => {
    const mockResult: any[] = [];
    let mockQueryFn = jest.fn();
    beforeEach(() => {
      mockQueryFn.mockClear();
      mockQueryFn = mockQueryFn.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolve([mockResult]);
          })
      );
      (<any>table.query) = mockQueryFn;
    });

    test("should call table.query() correctly", async () => {
      const googleBigQuerySearch = new GoogleBigQueryVectorSearch(embeddings, {
        table,
        textKey,
        embeddingKey,
      });

      const k = 2;
      const query = [0.1, 0.2, 0.3];
      await googleBigQuerySearch.similaritySearchVectorWithScore(query, k);
      expect(mockQueryFn).toHaveBeenCalledTimes(1);
      expect(mockQueryFn.mock.calls[0][0]).toBe(`
      SELECT
        base.*, distance AS _vector_search_distance
      FROM VECTOR_SEARCH(
        TABLE dataset.table,
        '${embeddingKey}',
        (SELECT [${query}] AS ${embeddingKey}),
        distance_type => 'EUCLIDEAN',
        top_k => ${k}
      )
      WHERE TRUE
      LIMIT ${k}
    `);
    });

    test("should return data correctly", async () => {
      const fakeDoc = {
        [textKey]: "fake text",
        [embeddingKey]: [0.1, 0.2, 0.3],
        field1: 123,
        field2: "test",
        _vector_search_distance: 0.12345,
      };
      const {
        _vector_search_distance,
        [textKey]: pageContent,
        ...metadata
      } = fakeDoc;
      mockQueryFn = mockQueryFn.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolve([[fakeDoc]]);
          })
      );
      const googleBigQuerySearch = new GoogleBigQueryVectorSearch(embeddings, {
        table,
        textKey,
        embeddingKey,
      });

      const k = 2;
      const query = [0.1, 0.2, 0.3];
      const result = await googleBigQuerySearch.similaritySearchVectorWithScore(
        query,
        k
      );
      expect(result).toEqual([
        [
          new Document({
            pageContent,
            metadata,
          }),
          _vector_search_distance,
        ],
      ]);
    });

    test("should call table.query() correctly if fractionListsToSearch configured", async () => {
      const fractionListsToSearch = 0.005;
      const googleBigQuerySearch = new GoogleBigQueryVectorSearch(embeddings, {
        table,
        textKey,
        embeddingKey,
        fractionListsToSearch,
      });

      const k = 2;
      const query = [0.1, 0.2, 0.3];
      await googleBigQuerySearch.similaritySearchVectorWithScore(query, k);
      expect(mockQueryFn).toHaveBeenCalledTimes(1);
      expect(mockQueryFn.mock.calls[0][0]).toBe(`
      SELECT
        base.*, distance AS _vector_search_distance
      FROM VECTOR_SEARCH(
        TABLE dataset.table,
        '${embeddingKey}',
        (SELECT [${query}] AS ${embeddingKey}),
        distance_type => 'EUCLIDEAN',
        top_k => ${k},options => '{"fraction_lists_to_search":${fractionListsToSearch}}'
      )
      WHERE TRUE
      LIMIT ${k}
    `);
    });

    test("should call table.query() correctly if useBruteForce configured", async () => {
      const googleBigQuerySearch = new GoogleBigQueryVectorSearch(embeddings, {
        table,
        textKey,
        embeddingKey,
        useBruteForce: true,
      });

      const k = 2;
      const query = [0.1, 0.2, 0.3];
      await googleBigQuerySearch.similaritySearchVectorWithScore(query, k);
      expect(mockQueryFn).toHaveBeenCalledTimes(1);
      expect(mockQueryFn.mock.calls[0][0]).toBe(`
      SELECT
        base.*, distance AS _vector_search_distance
      FROM VECTOR_SEARCH(
        TABLE dataset.table,
        '${embeddingKey}',
        (SELECT [${query}] AS ${embeddingKey}),
        distance_type => 'EUCLIDEAN',
        top_k => ${k},options => '{"use_brute_force":true}'
      )
      WHERE TRUE
      LIMIT ${k}
    `);
    });

    test("should call table.query() correctly if distanceType configured", async () => {
      const distanceType = "COSINE";
      const googleBigQuerySearch = new GoogleBigQueryVectorSearch(embeddings, {
        table,
        textKey,
        embeddingKey,
        distanceType,
      });

      const k = 2;
      const query = [0.1, 0.2, 0.3];

      await googleBigQuerySearch.similaritySearchVectorWithScore(query, k);
      expect(mockQueryFn).toHaveBeenCalledTimes(1);
      expect(mockQueryFn.mock.calls[0][0]).toBe(`
      SELECT
        base.*, distance AS _vector_search_distance
      FROM VECTOR_SEARCH(
        TABLE dataset.table,
        '${embeddingKey}',
        (SELECT [${query}] AS ${embeddingKey}),
        distance_type => '${distanceType}',
        top_k => ${k}
      )
      WHERE TRUE
      LIMIT ${k}
    `);
    });

    test("should call table.query() correctly along with object filter", async () => {
      const googleBigQuerySearch = new GoogleBigQueryVectorSearch(embeddings, {
        table,
        textKey,
        embeddingKey,
      });

      const k = 2;
      const query = [0.1, 0.2, 0.3];

      await googleBigQuerySearch.similaritySearchVectorWithScore(query, k, {
        field1: 123,
        field2: "test",
        field3: [1, 2, 3],
      });
      expect(mockQueryFn).toHaveBeenCalledTimes(1);
      expect(mockQueryFn.mock.calls[0][0]).toBe(`
      SELECT
        base.*, distance AS _vector_search_distance
      FROM VECTOR_SEARCH(
        TABLE dataset.table,
        '${embeddingKey}',
        (SELECT [${query}] AS ${embeddingKey}),
        distance_type => 'EUCLIDEAN',
        top_k => ${k}
      )
      WHERE base.field1=123 AND base.field2='test' AND base.field3 IN (1,2,3)
      LIMIT ${k}
    `);
    });
  });

  describe("GoogleBigQueryVectorSearch.similaritySearchWithScore", () => {
    const mockResult: any[] = [];
    let mockQueryFn = jest.fn();
    beforeEach(() => {
      mockQueryFn.mockClear();
      mockQueryFn = mockQueryFn.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolve([mockResult]);
          })
      );
      (<any>table.query) = mockQueryFn;
    });

    test("should call table.query() correctly", async () => {
      const googleBigQuerySearch = new GoogleBigQueryVectorSearch(embeddings, {
        table,
        textKey,
        embeddingKey,
      });

      const k = 2;
      const query = "testquery";
      await googleBigQuerySearch.similaritySearchWithScore(query, k);
      expect(mockQueryFn).toHaveBeenCalledTimes(1);
      expect(mockQueryFn.mock.calls[0][0]).toBe(`
      SELECT
        base.*, distance AS _vector_search_distance
      FROM VECTOR_SEARCH(
        TABLE dataset.table,
        '${embeddingKey}',
        (SELECT [0.1,0.2,0.3,0.4] AS ${embeddingKey}),
        distance_type => 'EUCLIDEAN',
        top_k => ${k}
      )
      WHERE TRUE
      LIMIT ${k}
    `);
    });
  });
});
