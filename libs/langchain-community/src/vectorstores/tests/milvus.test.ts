/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest, test, expect, beforeEach } from "@jest/globals";
import { FakeEmbeddings } from "@langchain/core/utils/testing";
import { Document } from "@langchain/core/documents";
import { ErrorCode } from "@zilliz/milvus2-sdk-node";

import { Milvus } from "../milvus.js";

const fields = [
  {
    name: "id",
    is_primary_key: true,
    autoID: true,
    data_type: 21,
  },
  {
    name: "text",
    is_primary_key: false,
    autoID: false,
    data_type: 21,
  },
  {
    name: "vector",
    is_primary_key: false,
    autoID: false,
    data_type: 101,
  },
  {
    name: "custom_field",
    is_primary_key: false,
    autoID: false,
    data_type: 21,
  },
];

// Mock successful responses
const mockSuccessResponse = {
  status: { error_code: ErrorCode.SUCCESS },
};

// Mock the Milvus client
const mockMilvusClient = {
  describeCollection: jest.fn(),
  insert: jest.fn(),
  upsert: jest.fn(),
  flushSync: jest.fn(),
  createCollection: jest.fn(),
  hasCollection: jest.fn(),
  loadCollection: jest.fn(),
  createPartition: jest.fn(),
  hasPartition: jest.fn(),
  loadPartition: jest.fn(),
} as any;

jest.mock("@zilliz/milvus2-sdk-node", () => ({
  MilvusClient: jest.fn().mockImplementation(() => mockMilvusClient),
}));

beforeEach(() => {
  jest.resetAllMocks();
  mockMilvusClient.describeCollection.mockResolvedValue({});
  mockMilvusClient.insert.mockResolvedValue(mockSuccessResponse);
  mockMilvusClient.upsert.mockResolvedValue(mockSuccessResponse);
  mockMilvusClient.flushSync.mockResolvedValue(mockSuccessResponse);
  mockMilvusClient.hasCollection.mockResolvedValue(mockSuccessResponse);
  mockMilvusClient.loadCollection.mockResolvedValue(mockSuccessResponse);
  mockMilvusClient.createCollection.mockResolvedValue(mockSuccessResponse);
  mockMilvusClient.createPartition.mockResolvedValue(mockSuccessResponse);
  mockMilvusClient.hasPartition.mockResolvedValue(mockSuccessResponse);
  mockMilvusClient.loadPartition.mockResolvedValue(mockSuccessResponse);
});

// FIXME(hntrl): figure out why milvus client isn't being mocked
// (this is causing latent network issues in community tests)
describe.skip("Milvus", () => {
  test("Milvus upsert with autoId: false includes primary field from metadata", async () => {
    // Mock collection schema with autoID primary field
    const mockSchema = {
      schema: {
        fields,
      },
    };

    mockMilvusClient.describeCollection.mockResolvedValue(mockSchema);

    const embeddings = new FakeEmbeddings();
    const milvus = new Milvus(embeddings, {
      collectionName: "test_collection",
      autoId: false, // User wants to provide their own IDs for upsert
      primaryField: "id",
      textField: "text",
      vectorField: "vector",
      clientConfig: {
        address: "localhost:19530",
      },
    });

    // Replace the client with our mock after construction
    (milvus as any).client = mockMilvusClient;

    // Test document with primary field in metadata
    const documents = [
      new Document({
        pageContent: "Test content for upsert",
        metadata: {
          id: "test_id_123",
          custom_field: "custom_value",
        },
      }),
    ];

    await milvus.addDocuments(documents);

    // Verify upsert was called (not insert)
    expect(mockMilvusClient.upsert).toHaveBeenCalledTimes(1);
    expect(mockMilvusClient.insert).not.toHaveBeenCalled();

    // Verify the upsert call includes the primary field
    const upsertCall = mockMilvusClient.upsert.mock.calls[0][0];
    expect(upsertCall.collection_name).toBe("test_collection");
    expect(upsertCall.fields_data).toHaveLength(1);

    const upsertData = upsertCall.fields_data[0];
    expect(upsertData.id).toBe("test_id_123"); // Primary field should be included
    expect(upsertData.text).toBe("Test content for upsert");
    expect(upsertData.vector).toBeDefined();
    expect(upsertData.custom_field).toBe("custom_value");
  });

  test("Milvus upsert with autoId: false throws error when primary field missing from metadata", async () => {
    // Mock collection schema
    const mockSchema = {
      schema: {
        fields,
      },
    };

    mockMilvusClient.describeCollection.mockResolvedValue(mockSchema);

    const embeddings = new FakeEmbeddings();
    const milvus = new Milvus(embeddings, {
      collectionName: "test_collection",
      autoId: false,
      primaryField: "id",
      textField: "text",
      vectorField: "vector",
      clientConfig: {
        address: "localhost:19530",
      },
    });

    // Replace the client with our mock after construction
    (milvus as any).client = mockMilvusClient;

    // Test document WITHOUT primary field in metadata
    const documents = [
      new Document({
        pageContent: "Test content",
        metadata: {
          custom_field: "custom_value",
          // Missing 'id' field
        },
      }),
    ];

    await expect(milvus.addDocuments(documents)).rejects.toThrow(
      "The Collection's primaryField is configured with autoId=false, thus its value must be provided through metadata."
    );
  });

  test("Milvus insert with autoId: true excludes primary field from data", async () => {
    // Mock collection schema
    const mockSchema = {
      schema: {
        fields,
      },
    };

    mockMilvusClient.describeCollection.mockResolvedValue(mockSchema);

    const embeddings = new FakeEmbeddings();
    const milvus = new Milvus(embeddings, {
      collectionName: "test_collection",
      autoId: true, // Auto-generate IDs
      primaryField: "id",
      textField: "text",
      vectorField: "vector",
      clientConfig: {
        address: "localhost:19530",
      },
    });

    // Replace the client with our mock after construction
    (milvus as any).client = mockMilvusClient;

    const documents = [
      new Document({
        pageContent: "Test content for insert",
        metadata: {
          custom_field: "custom_value",
        },
      }),
    ];

    await milvus.addDocuments(documents);

    // Verify insert was called (not upsert)
    expect(mockMilvusClient.insert).toHaveBeenCalledTimes(1);
    expect(mockMilvusClient.upsert).not.toHaveBeenCalled();

    // Verify the insert call excludes the primary field (since autoId: true)
    const insertCall = mockMilvusClient.insert.mock.calls[0][0];
    const insertData = insertCall.fields_data[0];
    expect(insertData.id).toBeUndefined(); // Primary field should be excluded
    expect(insertData.text).toBe("Test content for insert");
    expect(insertData.vector).toBeDefined();
    expect(insertData.custom_field).toBe("custom_value");
  });

  test("Milvus upsert with provided IDs uses those IDs instead of metadata", async () => {
    // Mock collection schema
    const mockSchema = {
      schema: {
        fields,
      },
    };

    mockMilvusClient.describeCollection.mockResolvedValue(mockSchema);

    const embeddings = new FakeEmbeddings();
    const milvus = new Milvus(embeddings, {
      collectionName: "test_collection",
      autoId: false,
      primaryField: "id",
      textField: "text",
      vectorField: "vector",
      clientConfig: {
        address: "localhost:19530",
      },
    });

    // Replace the client with our mock after construction
    (milvus as any).client = mockMilvusClient;

    const documents = [
      new Document({
        pageContent: "Test content",
        metadata: {
          id: "metadata_id", // This should be ignored
          custom_field: "custom_value",
        },
      }),
    ];

    // Provide explicit IDs
    await milvus.addDocuments(documents, { ids: ["explicit_id"] });

    // Verify upsert was called with explicit ID
    const upsertCall = mockMilvusClient.upsert.mock.calls[0][0];
    const upsertData = upsertCall.fields_data[0];
    expect(upsertData.id).toBe("explicit_id"); // Should use explicit ID, not metadata ID
  });
});
