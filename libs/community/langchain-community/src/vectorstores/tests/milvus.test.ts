/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, test, expect, beforeEach } from "vitest";
import { FakeEmbeddings } from "@langchain/core/utils/testing";
import { Document } from "@langchain/core/documents";

const { mockMilvusClient } = vi.hoisted(() => {
  const fields = [
    {
      name: "id",
      is_primary_key: true,
      is_function_output: false,
      autoID: true,
      data_type: 21,
    },
    {
      name: "text",
      is_primary_key: false,
      is_function_output: false,
      autoID: false,
      data_type: 21,
    },
    {
      name: "vector",
      is_primary_key: false,
      is_function_output: false,
      autoID: false,
      data_type: 101,
    },
    {
      name: "custom_field",
      is_primary_key: false,
      is_function_output: false,
      autoID: false,
      data_type: 21,
    },
    {
      name: "vector_calculated",
      is_primary_key: false,
      is_function_output: true,
      autoID: false,
      data_type: 104,
    },
  ];

  const mockSchema = {
    schema: {
      fields,
    },
  };

  const mockSuccessResponse = {
    status: { error_code: "Success" },
  };

  const mockCreateSuccessResponse = {
    error_code: "Success",
  };

  const client = {
    describeCollection: vi.fn(() => Promise.resolve(mockSchema)),
    insert: vi.fn(() => Promise.resolve(mockSuccessResponse)),
    upsert: vi.fn(() => Promise.resolve(mockSuccessResponse)),
    flushSync: vi.fn(() => Promise.resolve(mockSuccessResponse)),
    createCollection: vi.fn(() => Promise.resolve(mockCreateSuccessResponse)),
    hasCollection: vi.fn(() =>
      Promise.resolve({
        ...mockSuccessResponse,
        value: true,
      })
    ),
    loadCollection: vi.fn(() => Promise.resolve(mockSuccessResponse)),
    createPartition: vi.fn(() => Promise.resolve(mockSuccessResponse)),
    hasPartition: vi.fn(() => Promise.resolve(mockSuccessResponse)),
    loadPartition: vi.fn(() => Promise.resolve(mockSuccessResponse)),
    createIndex: vi.fn(() => Promise.resolve(mockCreateSuccessResponse)),
    alterCollectionProperties: vi.fn(() =>
      Promise.resolve(mockSuccessResponse)
    ),
  } as any;

  return { mockMilvusClient: client };
});

vi.mock("@zilliz/milvus2-sdk-node", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@zilliz/milvus2-sdk-node")>();
  return {
    ...actual,
    MilvusClient: vi.fn().mockImplementation(() => mockMilvusClient),
  };
});

const { DataType, DataTypeMap, ErrorCode } =
  await import("@zilliz/milvus2-sdk-node");

beforeEach(async () => {
  vi.clearAllMocks();
});

// Milvus is dynamically imported because ES modules are evaluated before
// Jest mocks are applied. Static imports won't observe the mocking behaviour.

describe("Milvus", () => {
  test("Milvus upsert with autoId: false includes primary field from metadata", async () => {
    const { Milvus } = await import("../milvus.js");

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
    const { Milvus } = await import("../milvus.js");

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
    const { Milvus } = await import("../milvus.js");

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
    const { Milvus } = await import("../milvus.js");

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

  test("Milvus setProperties calls client.alterCollectionProperties", async () => {
    const { Milvus } = await import("../milvus.js");

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

    const propertiesToSet = {
      "collections.ttl.seconds": 24 * 60 * 60,
      "test-property-1": "test-value",
    };
    await milvus.setProperties({
      ...propertiesToSet,
      "test-property-2": null,
    });

    expect(mockMilvusClient.alterCollectionProperties).toHaveBeenCalledTimes(1);
    const alterCall =
      mockMilvusClient.alterCollectionProperties.mock.calls[0][0];

    expect(alterCall.properties).toEqual(propertiesToSet);
    expect(alterCall.delete_keys).toEqual(["test-property-2"]);
  });

  test("Milvus createCollection properties as passed down to the client", async () => {
    const { Milvus } = await import("../milvus.js");

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
    const vectors = await embeddings.embedDocuments(
      documents.map(({ pageContent }) => pageContent)
    );
    const properties = {
      "collections.ttl.seconds": 24 * 60 * 60,
      "test-property-1": "test-value",
    };

    await milvus.createCollection(vectors, documents, properties);
    const createCollectionCall =
      mockMilvusClient.createCollection.mock.calls[0][0];

    expect(createCollectionCall.properties).toEqual(properties);
  });

  test("Milvus createCollection uses default metadataTextFieldMaxLength for metadata VarChar fields", async () => {
    const { Milvus } = await import("../milvus.js");

    // Simulate collection not existing so createCollection is called
    mockMilvusClient.hasCollection.mockResolvedValueOnce({
      status: { error_code: ErrorCode.SUCCESS },
      value: false,
    });

    const embeddings = new FakeEmbeddings();
    const milvus = new Milvus(embeddings, {
      collectionName: "test_collection",
      autoId: true,
      primaryField: "id",
      textField: "text",
      vectorField: "vector",
      clientConfig: {
        address: "localhost:19530",
      },
    });

    // Short metadata value — previously this would set max_length to
    // only the byte length of "short", causing longer values to fail.
    const documents = [
      new Document({
        pageContent: "Test content",
        metadata: {
          description: "short",
        },
      }),
    ];

    await milvus.addDocuments(documents);

    const createCollectionCall =
      mockMilvusClient.createCollection.mock.calls[0][0];
    const descriptionField = createCollectionCall.fields.find(
      (f: any) => f.name === "description"
    );
    expect(descriptionField).toBeDefined();
    // Default metadataTextFieldMaxLength is 65535, which is larger than "short" (5 bytes)
    expect(Number(descriptionField.type_params.max_length)).toBe(65535);
  });

  test("Milvus createCollection respects custom metadataTextFieldMaxLength", async () => {
    const { Milvus } = await import("../milvus.js");

    mockMilvusClient.hasCollection.mockResolvedValueOnce({
      status: { error_code: ErrorCode.SUCCESS },
      value: false,
    });

    const embeddings = new FakeEmbeddings();
    const milvus = new Milvus(embeddings, {
      collectionName: "test_collection",
      autoId: true,
      primaryField: "id",
      textField: "text",
      vectorField: "vector",
      metadataTextFieldMaxLength: 1024,
      clientConfig: {
        address: "localhost:19530",
      },
    });

    const documents = [
      new Document({
        pageContent: "Test content",
        metadata: {
          description: "short",
        },
      }),
    ];

    await milvus.addDocuments(documents);

    const createCollectionCall =
      mockMilvusClient.createCollection.mock.calls[0][0];
    const descriptionField = createCollectionCall.fields.find(
      (f: any) => f.name === "description"
    );
    expect(descriptionField).toBeDefined();
    expect(Number(descriptionField.type_params.max_length)).toBe(1024);
  });

  test("Milvus createCollection uses actual length when metadata value exceeds default max", async () => {
    const { Milvus } = await import("../milvus.js");

    mockMilvusClient.hasCollection.mockResolvedValueOnce({
      status: { error_code: ErrorCode.SUCCESS },
      value: false,
    });

    const embeddings = new FakeEmbeddings();
    const milvus = new Milvus(embeddings, {
      collectionName: "test_collection",
      autoId: true,
      primaryField: "id",
      textField: "text",
      vectorField: "vector",
      metadataTextFieldMaxLength: 10, // intentionally small
      clientConfig: {
        address: "localhost:19530",
      },
    });

    const longValue = "a".repeat(50);
    const documents = [
      new Document({
        pageContent: "Test content",
        metadata: {
          description: longValue,
        },
      }),
    ];

    await milvus.addDocuments(documents);

    const createCollectionCall =
      mockMilvusClient.createCollection.mock.calls[0][0];
    const descriptionField = createCollectionCall.fields.find(
      (f: any) => f.name === "description"
    );
    expect(descriptionField).toBeDefined();
    // Actual data length (50) exceeds configured max (10), so actual length should be used
    expect(Number(descriptionField.type_params.max_length)).toBe(50);
  });

  test("Milvus createCollection applies metadataTextFieldMaxLength to JSON metadata fields", async () => {
    const { Milvus } = await import("../milvus.js");

    mockMilvusClient.hasCollection.mockResolvedValueOnce({
      status: { error_code: ErrorCode.SUCCESS },
      value: false,
    });

    const embeddings = new FakeEmbeddings();
    const milvus = new Milvus(embeddings, {
      collectionName: "test_collection",
      autoId: true,
      primaryField: "id",
      textField: "text",
      vectorField: "vector",
      clientConfig: {
        address: "localhost:19530",
      },
    });

    const documents = [
      new Document({
        pageContent: "Test content",
        metadata: {
          tags: { category: "ai" }, // object metadata → JSON VarChar
        },
      }),
    ];

    await milvus.addDocuments(documents);

    const createCollectionCall =
      mockMilvusClient.createCollection.mock.calls[0][0];
    const tagsField = createCollectionCall.fields.find(
      (f: any) => f.name === "tags"
    );
    expect(tagsField).toBeDefined();
    // JSON serialized {"category":"ai"} is 17 bytes, but default max is 65535
    expect(Number(tagsField.type_params.max_length)).toBe(65535);
  });
});
