/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest, expect } from "@jest/globals";
import { Client } from "@elastic/elasticsearch";

import * as uuid from "uuid";

import { ElasticSearchStore } from "../elasticsearch.js";
import { FakeEmbeddings } from "../../embeddings/fake.js";
import { Document } from "../../document.js";

// eslint-disable-next-line no-unused-expressions
uuid;

jest.mock("uuid", () => ({
  v4: jest.fn(() => "some-uuid"),
}));

let clientMock: jest.Mocked<Client>;
let store: ElasticSearchStore;

describe("ElasticSearchStore", () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.resetAllMocks();

    // Mock the client object
    clientMock = {
      indices: {
        exists: jest.fn(),
        create: jest.fn(),
      },
      search: jest.fn(),
      bulk: jest.fn(),
    } as any;

    // Create a new ElasticSearchStore instance with the mocked client
    store = new ElasticSearchStore(new FakeEmbeddings(), {
      client: clientMock,
      indexName: "index-name",
    });
  });

  it("should add vectors", async () => {
    // Arrange
    const embeddings = [
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
    ];
    const documents = [
      { pageContent: "content1", metadata: { prop1: "metadata1" } },
      { pageContent: "content2", metadata: { prop1: "metadata2" } },
    ];

    // Mock the response of client.indices.exists
    clientMock.indices.exists.mockResolvedValueOnce(false);

    // Act
    await store.addVectors(embeddings, documents);

    // Assert
    expect(clientMock.indices.exists).toHaveBeenCalledWith({
      index: "index-name",
    });
    expect(clientMock.indices.create).toHaveBeenCalled();
    expect(clientMock.bulk).toHaveBeenCalled();
  });
  it("should perform a similarity search with vector and score", async () => {
    // Arrange
    const query = [0.1, 0.2, 0.3];
    const k = 5;
    const filter = { key1: "value1", key2: "value2" };

    // Mock the response of client.search
    clientMock.search.mockResolvedValueOnce({
      hits: {
        hits: [
          {
            _index: "index-name",
            _id: "id1",
            _source: { text: "content1", metadata: { key1: "value1" } },
            _score: 0.8,
          },
          {
            _index: "index-name",
            _id: "id2",
            _source: { text: "content2", metadata: { key2: "value2" } },
            _score: 0.7,
          },
        ],
      },
      took: 0,
      timed_out: false,
      _shards: { total: 1, successful: 1, skipped: 0, failed: 0 },
    });

    // Act
    const result = await store.similaritySearchVectorWithScore(
      query,
      k,
      filter
    );

    // Assert
    expect(clientMock.search).toHaveBeenCalled();
    expect(result).toEqual([
      [
        new Document({ pageContent: "content1", metadata: { key1: "value1" } }),
        0.8,
      ],
      [
        new Document({ pageContent: "content2", metadata: { key2: "value2" } }),
        0.7,
      ],
    ]);
  });
});
