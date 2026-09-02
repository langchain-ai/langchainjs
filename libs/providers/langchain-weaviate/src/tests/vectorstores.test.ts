import { test, expect, vi } from "vitest";
import { FakeEmbeddings } from "@langchain/core/utils/testing";
import type { FilterValue, WeaviateClient } from "weaviate-client";

import { flattenObjectForWeaviate, WeaviateStore } from "../vectorstores.js";

type MockCollections = Pick<
  WeaviateClient["collections"],
  "createFromJson" | "create" | "exists" | "get"
>;

function mockWeaviateClient(collections: MockCollections): WeaviateClient {
  return { collections } as unknown as WeaviateClient;
}

function equalFilter(value: string): FilterValue {
  return {
    operator: "Equal",
    value,
  };
}

function makeMockClient({
  collectionExists = false,
}: { collectionExists?: boolean } = {}) {
  const createFromJson = vi.fn().mockResolvedValue(undefined);
  const create = vi.fn().mockResolvedValue(undefined);
  const exists = vi.fn().mockResolvedValue(collectionExists);
  const get = vi.fn().mockReturnValue({});

  return {
    client: mockWeaviateClient({ createFromJson, create, exists, get }),
    spies: { createFromJson, create, exists },
  };
}

function makeSearchMockClient() {
  const hybrid = vi.fn().mockResolvedValue({ objects: [] });
  const generateHybrid = vi.fn().mockResolvedValue({ objects: [] });
  const collection = {
    query: { hybrid },
    generate: { hybrid: generateHybrid },
  };
  const get = vi.fn().mockReturnValue(collection);

  return {
    client: mockWeaviateClient({
      get,
      exists: vi.fn().mockResolvedValue(true),
      create: vi.fn(),
      createFromJson: vi.fn(),
    }),
    spies: { hybrid, generateHybrid },
  };
}

/** Let the fire-and-forget header registration settle before asserting. */
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

test("registers the X-Weaviate-Client-Integration header via getConnectionDetails", async () => {
  const headers: Record<string, string> = {};
  const client = {
    collections: {},
    getConnectionDetails: vi
      .fn()
      .mockResolvedValue({ host: "localhost", headers }),
  } as unknown as WeaviateClient;

  const store = new WeaviateStore(new FakeEmbeddings(), { client });
  await flushMicrotasks();

  expect(store).toBeInstanceOf(WeaviateStore);
  // Mutates the live headers object by reference, so subsequent client requests
  // carry the telemetry header on both transports.
  expect(headers["X-Weaviate-Client-Integration"]).toBe(
    `langchain-typescript/${__PKG_VERSION__}`
  );
});

test("integration header registration never throws when unsupported", async () => {
  const client = { collections: {} } as unknown as WeaviateClient;

  const store = new WeaviateStore(new FakeEmbeddings(), { client });
  await flushMicrotasks();

  expect(store).toBeInstanceOf(WeaviateStore);
});

test("integration header registration leaves array-form headers untouched", async () => {
  const headers: [string, string][] = [["X-Existing", "1"]];
  const client = {
    collections: {},
    getConnectionDetails: vi.fn().mockResolvedValue({ headers }),
  } as unknown as WeaviateClient;

  const store = new WeaviateStore(new FakeEmbeddings(), { client });
  await flushMicrotasks();

  expect(store).toBeInstanceOf(WeaviateStore);
  expect(headers).toEqual([["X-Existing", "1"]]);
});

test("initialize with jsonSchema calls createFromJson", async () => {
  const { client, spies } = makeMockClient();
  const jsonSchema = { class: "MyCollection", properties: [] };

  await WeaviateStore.initialize(new FakeEmbeddings(), { client, jsonSchema });

  expect(spies.createFromJson).toHaveBeenCalledOnce();
  expect(spies.createFromJson).toHaveBeenCalledWith(jsonSchema);
  expect(spies.create).not.toHaveBeenCalled();
});

test("initialize with schema calls create", async () => {
  const { client, spies } = makeMockClient();
  const schema = { name: "MyCollection", properties: [] };

  await WeaviateStore.initialize(new FakeEmbeddings(), { client, schema });

  expect(spies.create).toHaveBeenCalledOnce();
  expect(spies.create).toHaveBeenCalledWith(schema);
  expect(spies.createFromJson).not.toHaveBeenCalled();
});

test("initialize with both jsonSchema and schema prefers jsonSchema", async () => {
  const { client, spies } = makeMockClient();
  const jsonSchema = { class: "MyCollection", properties: [] };
  const schema = { name: "MyCollection", properties: [] };

  await WeaviateStore.initialize(new FakeEmbeddings(), {
    client,
    jsonSchema,
    schema,
  });

  expect(spies.createFromJson).toHaveBeenCalledOnce();
  expect(spies.createFromJson).toHaveBeenCalledWith(jsonSchema);
  expect(spies.create).not.toHaveBeenCalled();
});

test("initialize skips creation when collection already exists", async () => {
  const { client, spies } = makeMockClient({ collectionExists: true });
  const jsonSchema = { class: "MyCollection", properties: [] };

  await WeaviateStore.initialize(new FakeEmbeddings(), { client, jsonSchema });

  expect(spies.createFromJson).not.toHaveBeenCalled();
  expect(spies.create).not.toHaveBeenCalled();
});

test("hybridSearch forwards filters when provided", async () => {
  const { client, spies } = makeSearchMockClient();
  const store = await WeaviateStore.initialize(new FakeEmbeddings(), {
    client,
    indexName: "MyCollection",
  });

  const filters = equalFilter("bar");
  await store.hybridSearch("q", { filters, vector: [0.1, 0.2] });

  expect(spies.hybrid).toHaveBeenCalledOnce();
  const [, options] = spies.hybrid.mock.calls[0];
  expect(options.filters).toBe(filters);
});

test("hybridSearch maps filter (singular) to filters and keeps both keys", async () => {
  const { client, spies } = makeSearchMockClient();
  const store = await WeaviateStore.initialize(new FakeEmbeddings(), {
    client,
    indexName: "MyCollection",
  });

  const filter = equalFilter("bar");
  await store.hybridSearch("q", { filter, vector: [0.1, 0.2] });

  expect(spies.hybrid).toHaveBeenCalledOnce();
  const [, options] = spies.hybrid.mock.calls[0];
  expect(options.filters).toBe(filter);
  expect(options.filter).toBe(filter);
});

test("hybridSearch prefers filters over filter when both are provided", async () => {
  const { client, spies } = makeSearchMockClient();
  const store = await WeaviateStore.initialize(new FakeEmbeddings(), {
    client,
    indexName: "MyCollection",
  });

  const filters = equalFilter("1");
  const filter = equalFilter("2");
  await store.hybridSearch("q", {
    filters,
    filter,
    vector: [0.1, 0.2],
  });

  expect(spies.hybrid).toHaveBeenCalledOnce();
  const [, options] = spies.hybrid.mock.calls[0];
  expect(options.filters).toBe(filters);
});

test("generate forwards filters when provided", async () => {
  const { client, spies } = makeSearchMockClient();
  const store = await WeaviateStore.initialize(new FakeEmbeddings(), {
    client,
    indexName: "MyCollection",
  });

  const filters = equalFilter("bar");
  await store.generate(
    "q",
    { singlePrompt: "summarize" },
    { filters, vector: [0.1, 0.2] }
  );

  expect(spies.generateHybrid).toHaveBeenCalledOnce();
  const [, , options] = spies.generateHybrid.mock.calls[0];
  expect(options.filters).toBe(filters);
});

test("generate maps filter (singular) to filters and keeps both keys", async () => {
  const { client, spies } = makeSearchMockClient();
  const store = await WeaviateStore.initialize(new FakeEmbeddings(), {
    client,
    indexName: "MyCollection",
  });

  const filter = equalFilter("bar");
  await store.generate(
    "q",
    { singlePrompt: "summarize" },
    {
      filter,
      vector: [0.1, 0.2],
    }
  );

  expect(spies.generateHybrid).toHaveBeenCalledOnce();
  const [, , options] = spies.generateHybrid.mock.calls[0];
  expect(options.filters).toBe(filter);
  expect(options.filter).toBe(filter);
});

test("generate prefers filters over filter when both are provided", async () => {
  const { client, spies } = makeSearchMockClient();
  const store = await WeaviateStore.initialize(new FakeEmbeddings(), {
    client,
    indexName: "MyCollection",
  });

  const filters = equalFilter("1");
  const filter = equalFilter("2");
  await store.generate(
    "q",
    { singlePrompt: "summarize" },
    {
      filters,
      filter,
      vector: [0.1, 0.2],
    }
  );

  expect(spies.generateHybrid).toHaveBeenCalledOnce();
  const [, , options] = spies.generateHybrid.mock.calls[0];
  expect(options.filters).toBe(filters);
});

test("flattenObjectForWeaviate", () => {
  expect(
    flattenObjectForWeaviate({
      array2: [{}, "a"],
      "some:colon": "key only should:be:replaced with some_colon",
      "some;crazy;keys": "test",
      "more*crazy*keys": "test",
      deep: {
        string: "deep string",
        array: ["1", 2],
        array3: [1, 3],
        "duda:colon:test": "test",
        "caret^test": "test",
        deepdeep: {
          string: "even a deeper string",
        },
      },
      emptyArray: [],
    })
  ).toMatchInlineSnapshot(`
    {
      "deep_array3": [
        1,
        3,
      ],
      "deep_caret_test": "test",
      "deep_deepdeep_string": "even a deeper string",
      "deep_duda_colon_test": "test",
      "deep_string": "deep string",
      "emptyArray": [],
      "more_crazy_keys": "test",
      "some_colon": "key only should:be:replaced with some_colon",
      "some_crazy_keys": "test",
    }
  `);
});
