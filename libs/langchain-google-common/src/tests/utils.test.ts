/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect, test } from "@jest/globals";
import { InMemoryStore } from "@langchain/core/stores";
import { z } from "zod";
import { zodToGeminiParameters } from "../utils/zod_to_gemini_parameters.js";
import {
  BackedBlobStore,
  MediaBlob,
  SimpleWebBlobStore,
} from "../utils/media_core.js";

describe("zodToGeminiParameters", () => {
  test("can convert zod schema to gemini schema", () => {
    const zodSchema = z
      .object({
        operation: z
          .enum(["add", "subtract", "multiply", "divide"])
          .describe("The type of operation to execute"),
        number1: z.number().describe("The first number to operate on."),
        number2: z.number().describe("The second number to operate on."),
        childObject: z.object({}),
      })
      .describe("A simple calculator tool");

    const convertedSchema = zodToGeminiParameters(zodSchema);

    expect(convertedSchema.type).toBe("object");
    expect(convertedSchema.description).toBe("A simple calculator tool");
    expect((convertedSchema as any).additionalProperties).toBeUndefined();
    expect(convertedSchema.properties).toEqual({
      operation: {
        type: "string",
        enum: ["add", "subtract", "multiply", "divide"],
        description: "The type of operation to execute",
      },
      number1: {
        type: "number",
        description: "The first number to operate on.",
      },
      number2: {
        type: "number",
        description: "The second number to operate on.",
      },
      childObject: {
        type: "object",
        properties: {},
      },
    });
    expect(convertedSchema.required).toEqual([
      "operation",
      "number1",
      "number2",
      "childObject",
    ]);
  });

  test("removes additional properties from arrays", () => {
    const zodSchema = z
      .object({
        people: z
          .object({
            name: z.string().describe("The name of a person"),
          })
          .array()
          .describe("person elements"),
      })
      .describe("A list of people");

    const convertedSchema = zodToGeminiParameters(zodSchema);
    expect(convertedSchema.type).toBe("object");
    expect(convertedSchema.description).toBe("A list of people");
    expect((convertedSchema as any).additionalProperties).toBeUndefined();

    const peopleSchema = convertedSchema?.properties?.people;
    expect(peopleSchema).not.toBeUndefined();

    if (peopleSchema !== undefined) {
      expect(peopleSchema.type).toBe("array");
      expect((peopleSchema as any).additionalProperties).toBeUndefined();
      expect(peopleSchema.description).toBe("person elements");
    }

    const arrayItemsSchema = peopleSchema?.items;
    expect(arrayItemsSchema).not.toBeUndefined();
    if (arrayItemsSchema !== undefined) {
      expect(arrayItemsSchema.type).toBe("object");
      expect((arrayItemsSchema as any).additionalProperties).toBeUndefined();
    }
  });
})

describe("media core", () => {
  test("MediaBlob plain", async () => {
    const blob = new Blob(["This is a test"], { type: "text/plain" });
    const mblob = new MediaBlob({
      data: blob,
    });
    expect(mblob.dataType).toEqual("text/plain");
    expect(mblob.mimetype).toEqual("text/plain");
    expect(mblob.encoding).toEqual("utf-8");
    expect(await mblob.asString()).toEqual("This is a test");
  });

  test("MediaBlob charset", async () => {
    const blob = new Blob(["This is a test"], {
      type: "text/plain; charset=US-ASCII",
    });
    const mblob = new MediaBlob({
      data: blob,
    });
    expect(mblob.dataType).toEqual("text/plain; charset=us-ascii");
    expect(mblob.mimetype).toEqual("text/plain");
    expect(mblob.encoding).toEqual("us-ascii");
    expect(await mblob.asString()).toEqual("This is a test");
  });

  test("MediaBlob serialize", async () => {
    const blob = new Blob(["This is a test"], { type: "text/plain" });
    const mblob = new MediaBlob({
      data: blob,
    });
    console.log(mblob.toJSON());
  });

  test("SimpleWebBlobStore fetch", async () => {
    const webStore = new SimpleWebBlobStore();
    const exampleBlob = await webStore.fetch("http://example.com/");
    console.log(exampleBlob);
    expect(exampleBlob?.mimetype).toEqual("text/html");
    expect(exampleBlob?.encoding).toEqual("utf-8");
    expect(exampleBlob?.data?.size).toBeGreaterThan(0);
    expect(exampleBlob?.metadata).toBeDefined();
    expect(exampleBlob?.metadata?.ok).toBeTruthy();
    expect(exampleBlob?.metadata?.status).toEqual(200);
  });

  describe("BackedBlobStore", () => {

    test("simple", async () => {
      const backingStore = new InMemoryStore<MediaBlob>();
      const store = new BackedBlobStore({
        backingStore
      });
      const data = new Blob(["This is a test"], {type:"text/plain"});
      const path = "simple://foo"
      const blob = new MediaBlob({
        data,
        path,
      })
      const storedBlob = await store.store(blob);
      expect(storedBlob).toBeDefined();
      const fetchedBlob = await store.fetch(path);
      expect(fetchedBlob).toBeDefined();
    })

    test("missing undefined", async () => {
      const backingStore = new InMemoryStore<MediaBlob>();
      const store = new BackedBlobStore({
        backingStore
      });
      const path = "simple://foo"
      const fetchedBlob = await store.fetch(path);
      expect(fetchedBlob).toBeUndefined();
    })

    test("missing emptyBlob defaultConfig", async () => {
      const backingStore = new InMemoryStore<MediaBlob>();
      const store = new BackedBlobStore({
        backingStore,
        defaultFetchOptions: {
          handleMissingBlobMethod: "emptyBlob",
        }
      });
      const path = "simple://foo"
      const fetchedBlob = await store.fetch(path);
      expect(fetchedBlob).toBeDefined();
      expect(fetchedBlob?.size).toEqual(0);
      expect(fetchedBlob?.path).toEqual(path);
    })

    test("missing undefined fetch", async () => {
      const backingStore = new InMemoryStore<MediaBlob>();
      const store = new BackedBlobStore({
        backingStore,
        defaultFetchOptions: {
          handleMissingBlobMethod: "emptyBlob",
        }
      });
      const path = "simple://foo"
      const fetchedBlob = await store.fetch(path, {
        handleMissingBlobMethod: "",
      });
      expect(fetchedBlob).toBeUndefined();
    })

    test("check prefixPath", async () => {
      const backingStore = new InMemoryStore<MediaBlob>();
      const store = new BackedBlobStore({
        backingStore,
        defaultStoreOptions: {
          replacePathMethod: "prefixPath",
          replacePathPrefix: "example://bar/"
        }
      });
      const path = "simple://foo"
      const data = new Blob(["This is a test"], {type:"text/plain"});
      const blob = new MediaBlob({
        data,
        path,
      })
      const storedBlob = await store.store(blob);
      expect(storedBlob.path).toEqual("example://bar/foo");
      expect(await storedBlob.asString()).toEqual("This is a test");
      expect(storedBlob.metadata?.langchainOldPath).toEqual(path);
    })

    test("check prefixUuid", async () => {
      const backingStore = new InMemoryStore<MediaBlob>();
      const store = new BackedBlobStore({
        backingStore,
        defaultStoreOptions: {
          replacePathMethod: "prefixUuid",
          replacePathPrefix: "example://bar/"
        }
      });
      const path = "simple://foo"
      const data = new Blob(["This is a test"], {type:"text/plain"});
      const metadata = {
        alpha: "one",
        bravo: "two",
      }
      const blob = new MediaBlob({
        data,
        path,
        metadata,
      })
      const storedBlob = await store.store(blob);
      expect(storedBlob.path).toMatch(/example:\/\/bar\/[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i);
      expect(storedBlob.size).toEqual(14);
      expect(await storedBlob.asString()).toEqual("This is a test");
      expect(storedBlob.metadata?.alpha).toEqual("one");
      expect(storedBlob.metadata?.langchainOldPath).toEqual(path);
    })


  })
});
