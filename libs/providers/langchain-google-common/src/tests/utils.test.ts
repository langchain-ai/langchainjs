/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, expect, test } from "@jest/globals";
import { InMemoryStore } from "@langchain/core/stores";
import { SerializedConstructor } from "@langchain/core/load/serializable";
import { load } from "@langchain/core/load";
import { z } from "zod/v3";
import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { concat } from "@langchain/core/utils/stream";
import { ChatGenerationChunk } from "@langchain/core/outputs";
import { schemaToGeminiParameters } from "../utils/zod_to_gemini_parameters.js";
import { getGeminiAPI } from "../utils/gemini.js";
import { getAnthropicAPI } from "../utils/anthropic.js";
import {
  GeminiPartFileData,
  GeminiPartInlineData,
  GeminiRequest,
} from "../types.js";
import {
  BackedBlobStore,
  BlobStore,
  MediaBlob,
  MediaManager,
  ReadThroughBlobStore,
  SimpleWebBlobStore,
} from "../experimental/utils/media_core.js";
import {
  ReadableJsonStream,
  ReadableSseJsonStream,
  ReadableSseStream,
} from "../utils/stream.js";

describe("anthropic formatting", () => {
  test("keeps existing tool_use content and does not duplicate when tool_calls are also present", async () => {
    const anthropic = getAnthropicAPI();
    const input = [
      new HumanMessage("Use a tool."),
      new AIMessage({
        content: [
          { type: "text", text: "I will call a tool." },
          {
            type: "tool_use",
            id: "toolu_123",
            name: "lookup_weather",
            input: { city: "SF" },
          } as any,
        ],
        tool_calls: [
          {
            id: "toolu_123",
            name: "lookup_weather",
            args: { city: "SF" },
            type: "tool_call",
          },
        ],
      }),
      new ToolMessage({
        tool_call_id: "toolu_123",
        content: [{ type: "text", text: "72 and sunny" }],
      }),
    ];

    const request = (await anthropic.formatData(input, {
      model: "claude-sonnet-4",
      maxOutputTokens: 256,
    } as any)) as any;

    const assistant = request.messages.find((m: any) => m.role === "assistant");
    const toolUseBlocks = assistant.content.filter(
      (block: any) => block.type === "tool_use"
    );

    expect(toolUseBlocks).toHaveLength(1);
    expect(toolUseBlocks[0]).toMatchObject({
      id: "toolu_123",
      name: "lookup_weather",
      input: { city: "SF" },
    });
  });

  test("formats tool messages as tool_result content", async () => {
    const anthropic = getAnthropicAPI();
    const input = [
      new HumanMessage("Use a tool."),
      new AIMessage({
        content: [
          {
            type: "tool_use",
            id: "toolu_abc",
            name: "lookup_weather",
            input: { city: "Paris" },
          } as any,
        ],
      }),
      new ToolMessage({
        tool_call_id: "toolu_abc",
        content: [{ type: "text", text: "18C" }],
      }),
    ];

    const request = (await anthropic.formatData(input, {
      model: "claude-sonnet-4",
      maxOutputTokens: 256,
    } as any)) as any;

    const userToolResult = request.messages.find(
      (m: any) =>
        m.role === "user" &&
        m.content?.[0]?.type === "tool_result" &&
        m.content?.[0]?.tool_use_id === "toolu_abc"
    );

    expect(userToolResult).toBeDefined();
    expect(userToolResult.content[0].content[0]).toMatchObject({
      type: "text",
      text: "18C",
    });
  });

  test("accumulated streaming chunks produce no empty text blocks on re-format", async () => {
    const anthropic = getAnthropicAPI();

    const streamingEvents = [
      { data: { type: "message_start", message: { content: [] } } },
      {
        data: {
          type: "content_block_start",
          index: 0,
          content_block: { type: "text", text: "" },
        },
      },
      {
        data: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "Hello" },
        },
      },
      {
        data: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: " world" },
        },
      },
      { data: { type: "content_block_stop", index: 0 } },
      {
        data: {
          type: "message_delta",
          delta: { stop_reason: "end_turn" },
          usage: { output_tokens: 5 },
        },
      },
      { data: { type: "message_stop" } },
    ];

    let accumulated: ChatGenerationChunk | null = null;
    for (const event of streamingEvents) {
      const chunk = anthropic.responseToChatGeneration(event as any);
      if (chunk) {
        accumulated = accumulated ? concat(accumulated, chunk) : chunk;
      }
    }

    expect(accumulated).not.toBeNull();
    const aiMessage = accumulated!.message as AIMessageChunk;
    expect(
      typeof aiMessage.content === "string" || Array.isArray(aiMessage.content)
    ).toBe(true);

    if (Array.isArray(aiMessage.content)) {
      const emptyTextBlocks = aiMessage.content.filter(
        (block: any) => block.type === "text" && block.text === ""
      );
      expect(emptyTextBlocks).toHaveLength(0);
    }

    const request = (await anthropic.formatData(
      [
        new HumanMessage("Hi"),
        new AIMessage({ content: aiMessage.content }),
        new HumanMessage("Follow up"),
      ],
      { model: "claude-sonnet-4", maxOutputTokens: 256 } as any
    )) as any;

    const assistant = request.messages.find((m: any) => m.role === "assistant");
    expect(assistant).toBeDefined();

    const textBlocks = assistant.content.filter(
      (block: any) => block.type === "text"
    );
    for (const block of textBlocks) {
      expect(block.text).toBeTruthy();
    }

    const allText = textBlocks.map((b: any) => b.text).join("");
    expect(allText).toContain("Hello world");
  });

  test("strips internal fields like index from text content blocks on re-format", async () => {
    const anthropic = getAnthropicAPI();
    const input = [
      new HumanMessage("Hi"),
      new AIMessage({
        content: [{ type: "text", text: "Hello world", index: 0 } as any],
      }),
      new HumanMessage("Follow up"),
    ];

    const request = (await anthropic.formatData(input, {
      model: "claude-sonnet-4",
      maxOutputTokens: 256,
    } as any)) as any;

    const assistant = request.messages.find((m: any) => m.role === "assistant");
    expect(assistant.content).toHaveLength(1);
    expect(assistant.content[0]).toEqual({
      type: "text",
      text: "Hello world",
    });
    expect(assistant.content[0]).not.toHaveProperty("index");
  });

  test("streaming round-trip strips index from accumulated content before sending to API", async () => {
    const anthropic = getAnthropicAPI();

    const streamingEvents = [
      { data: { type: "message_start", message: { content: [] } } },
      {
        data: {
          type: "content_block_start",
          index: 0,
          content_block: { type: "text", text: "" },
        },
      },
      {
        data: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "Hello" },
        },
      },
      {
        data: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: " world" },
        },
      },
      { data: { type: "content_block_stop", index: 0 } },
      {
        data: {
          type: "message_delta",
          delta: { stop_reason: "end_turn" },
          usage: { output_tokens: 5 },
        },
      },
      { data: { type: "message_stop" } },
    ];

    let accumulated: ChatGenerationChunk | null = null;
    for (const event of streamingEvents) {
      const chunk = anthropic.responseToChatGeneration(event as any);
      if (chunk) {
        accumulated = accumulated ? concat(accumulated, chunk) : chunk;
      }
    }

    const aiMessage = accumulated!.message as AIMessageChunk;

    const request = (await anthropic.formatData(
      [
        new HumanMessage("Hi"),
        new AIMessage({ content: aiMessage.content }),
        new HumanMessage("Follow up"),
      ],
      { model: "claude-sonnet-4", maxOutputTokens: 256 } as any
    )) as any;

    const assistant = request.messages.find((m: any) => m.role === "assistant");
    for (const block of assistant.content) {
      expect(block).not.toHaveProperty("index");
      if (block.type === "text") {
        expect(Object.keys(block).sort()).toEqual(["text", "type"]);
      }
    }
  });

  test("filters empty text blocks from AI messages during formatting", async () => {
    const anthropic = getAnthropicAPI();
    const input = [
      new HumanMessage("Hi"),
      new AIMessage({
        content: [
          { type: "text", text: "" },
          { type: "text", text: "Hello world" },
        ],
      }),
      new HumanMessage("Follow up"),
    ];

    const request = (await anthropic.formatData(input, {
      model: "claude-sonnet-4",
      maxOutputTokens: 256,
    } as any)) as any;

    const assistant = request.messages.find((m: any) => m.role === "assistant");
    expect(assistant.content).toHaveLength(1);
    expect(assistant.content[0]).toMatchObject({
      type: "text",
      text: "Hello world",
    });
  });
});

describe("schemaToGeminiParameters", () => {
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

    const convertedSchema = schemaToGeminiParameters(zodSchema);

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

    const convertedSchema = schemaToGeminiParameters(zodSchema);
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

  test("should throw error for union types", () => {
    const zodSchema = z.object({
      unionField: z.union([z.string(), z.number()]),
    });

    expect(() => schemaToGeminiParameters(zodSchema)).toThrow(
      "zod_to_gemini_parameters: Gemini cannot handle union types"
    );
  });

  test("converts positive() to minimum constraint", () => {
    const zodSchema = z.object({
      price: z.number().positive().describe("Product price"),
    });

    const convertedSchema = schemaToGeminiParameters(zodSchema);
    expect(convertedSchema.properties?.price?.minimum).toBe(0.01);
    expect(convertedSchema.properties?.price?.exclusiveMinimum).toBeUndefined();
  });
});

describe("media core", () => {
  test("MediaBlob plain", async () => {
    const blob = new Blob(["This is a test"], { type: "text/plain" });
    const mblob = await MediaBlob.fromBlob(blob);
    expect(mblob.dataType).toEqual("text/plain");
    expect(mblob.mimetype).toEqual("text/plain");
    expect(mblob.encoding).toEqual("utf-8");
    expect(await mblob.asString()).toEqual("This is a test");
  });

  test("MediaBlob charset", async () => {
    const blob = new Blob(["This is a test"], {
      type: "text/plain; charset=US-ASCII",
    });
    const mblob = await MediaBlob.fromBlob(blob);
    expect(mblob.dataType).toEqual("text/plain; charset=us-ascii");
    expect(mblob.mimetype).toEqual("text/plain");
    expect(mblob.encoding).toEqual("us-ascii");
    expect(await mblob.asString()).toEqual("This is a test");
  });

  test("MediaBlob fromDataUrl", async () => {
    const blobData = "This is a test";
    const blobMimeType = "text/plain";
    const blobDataType = `${blobMimeType}; charset=US-ASCII`;
    const blob = new Blob([blobData], {
      type: blobDataType,
    });
    const mblob = await MediaBlob.fromBlob(blob);
    const dataUrl = await mblob.asDataUrl();
    const dblob = MediaBlob.fromDataUrl(dataUrl);
    expect(await dblob.asString()).toEqual(blobData);
    expect(dblob.mimetype).toEqual(blobMimeType);
  });

  test("MediaBlob serialize", async () => {
    const blob = new Blob(["This is a test"], { type: "text/plain" });
    const mblob = await MediaBlob.fromBlob(blob);
    const serialized = mblob.toJSON() as SerializedConstructor;
    expect(serialized.kwargs).toHaveProperty("data");
    expect(serialized.kwargs.data.value).toEqual("VGhpcyBpcyBhIHRlc3Q=");
  });

  test("MediaBlob deserialize", async () => {
    const serialized: SerializedConstructor = {
      lc: 1,
      type: "constructor",
      id: [
        "langchain",
        "google_common",
        "experimental",
        "utils",
        "media_core",
        "MediaBlob",
      ],
      kwargs: {
        data: {
          value: "VGhpcyBpcyBhIHRlc3Q=",
          type: "text/plain",
        },
      },
    };
    const mblob: MediaBlob = await load(JSON.stringify(serialized), {
      importMap: {
        google_common__experimental__utils__media_core:
          await import("../experimental/utils/media_core.js"),
      },
    });
    expect(mblob.dataType).toEqual("text/plain");
    expect(await mblob.asString()).toEqual("This is a test");
  });

  test("SimpleWebBlobStore fetch", async () => {
    const webStore = new SimpleWebBlobStore();
    const exampleBlob = await webStore.fetch("http://example.com/");
    expect(exampleBlob?.mimetype).toEqual("text/html");
    expect(exampleBlob?.encoding).toEqual("utf-8");
    expect(exampleBlob?.size).toBeGreaterThan(0);
    expect(exampleBlob?.metadata).toBeDefined();
    expect(exampleBlob?.metadata?.ok).toBeTruthy();
    expect(exampleBlob?.metadata?.status).toEqual(200);
  });

  describe("BackedBlobStore", () => {
    test("simple", async () => {
      const backingStore = new InMemoryStore<MediaBlob>();
      const store = new BackedBlobStore({
        backingStore,
      });
      const data = new Blob(["This is a test"], { type: "text/plain" });
      const path = "simple://foo";
      const blob = await MediaBlob.fromBlob(data, { path });
      const storedBlob = await store.store(blob);
      expect(storedBlob).toBeDefined();
      const fetchedBlob = await store.fetch(path);
      expect(fetchedBlob).toBeDefined();
    });

    test("missing undefined", async () => {
      const backingStore = new InMemoryStore<MediaBlob>();
      const store = new BackedBlobStore({
        backingStore,
      });
      const path = "simple://foo";
      const fetchedBlob = await store.fetch(path);
      expect(fetchedBlob).toBeUndefined();
    });

    test("missing emptyBlob defaultConfig", async () => {
      const backingStore = new InMemoryStore<MediaBlob>();
      const store = new BackedBlobStore({
        backingStore,
        defaultFetchOptions: {
          actionIfBlobMissing: "emptyBlob",
        },
      });
      const path = "simple://foo";
      const fetchedBlob = await store.fetch(path);
      expect(fetchedBlob).toBeDefined();
      expect(fetchedBlob?.size).toEqual(0);
      expect(fetchedBlob?.path).toEqual(path);
    });

    test("missing undefined fetch", async () => {
      const backingStore = new InMemoryStore<MediaBlob>();
      const store = new BackedBlobStore({
        backingStore,
        defaultFetchOptions: {
          actionIfBlobMissing: "emptyBlob",
        },
      });
      const path = "simple://foo";
      const fetchedBlob = await store.fetch(path, {
        actionIfBlobMissing: undefined,
      });
      expect(fetchedBlob).toBeUndefined();
    });

    test("invalid undefined", async () => {
      const backingStore = new InMemoryStore<MediaBlob>();
      const store = new BackedBlobStore({
        backingStore,
        defaultStoreOptions: {
          pathPrefix: "example://bar/",
        },
      });
      const path = "simple://foo";
      const data = new Blob(["This is a test"], { type: "text/plain" });
      const blob = await MediaBlob.fromBlob(data, { path });
      const storedBlob = await store.store(blob);
      expect(storedBlob).toBeUndefined();
    });

    test("invalid ignore", async () => {
      const backingStore = new InMemoryStore<MediaBlob>();
      const store = new BackedBlobStore({
        backingStore,
        defaultStoreOptions: {
          actionIfInvalid: "ignore",
          pathPrefix: "example://bar/",
        },
      });
      const path = "simple://foo";
      const data = new Blob(["This is a test"], { type: "text/plain" });
      const blob = await MediaBlob.fromBlob(data, { path });
      const storedBlob = await store.store(blob);
      expect(storedBlob).toBeDefined();
      expect(storedBlob?.path).toEqual(path);
      expect(storedBlob?.metadata).toBeUndefined();
    });

    test("invalid prefixPath", async () => {
      const backingStore = new InMemoryStore<MediaBlob>();
      const store = new BackedBlobStore({
        backingStore,
        defaultStoreOptions: {
          actionIfInvalid: "prefixPath",
          pathPrefix: "example://bar/",
        },
      });
      const path = "simple://foo";
      const data = new Blob(["This is a test"], { type: "text/plain" });
      const blob = await MediaBlob.fromBlob(data, { path });
      const storedBlob = await store.store(blob);
      expect(storedBlob?.path).toEqual("example://bar/foo");
      expect(await storedBlob?.asString()).toEqual("This is a test");
      expect(storedBlob?.metadata?.langchainOldPath).toEqual(path);
    });

    test("invalid prefixUuid", async () => {
      const backingStore = new InMemoryStore<MediaBlob>();
      const store = new BackedBlobStore({
        backingStore,
        defaultStoreOptions: {
          actionIfInvalid: "prefixUuid4",
          pathPrefix: "example://bar/",
        },
      });
      const path = "simple://foo";
      const data = new Blob(["This is a test"], { type: "text/plain" });
      const metadata = {
        alpha: "one",
        bravo: "two",
      };
      const blob = await MediaBlob.fromBlob(data, { path, metadata });
      const storedBlob = await store.store(blob);
      expect(storedBlob?.path).toMatch(
        /example:\/\/bar\/[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i
      );
      expect(storedBlob?.size).toEqual(14);
      expect(await storedBlob?.asString()).toEqual("This is a test");
      expect(storedBlob?.metadata?.alpha).toEqual("one");
      expect(storedBlob?.metadata?.langchainOldPath).toEqual(path);
    });
  });

  describe("MediaManager", () => {
    class MemStore extends InMemoryStore<MediaBlob> {
      get length() {
        return Object.keys(this.store).length;
      }
    }

    let mediaManager: MediaManager;
    let aliasMemory: MemStore;
    let canonicalMemory: MemStore;
    let resolverMemory: MemStore;

    async function store(
      blobStore: BlobStore,
      path: string,
      text: string
    ): Promise<void> {
      const data = new Blob([text], { type: "text/plain" });
      const blob = await MediaBlob.fromBlob(data, { path });
      await blobStore.store(blob);
    }

    beforeEach(async () => {
      aliasMemory = new MemStore();
      const aliasStore = new BackedBlobStore({
        backingStore: aliasMemory,
        defaultFetchOptions: {
          actionIfBlobMissing: undefined,
        },
      });
      canonicalMemory = new MemStore();
      const canonicalStore = new BackedBlobStore({
        backingStore: canonicalMemory,
        defaultStoreOptions: {
          pathPrefix: "canonical://store/",
          actionIfInvalid: "prefixPath",
        },
        defaultFetchOptions: {
          actionIfBlobMissing: undefined,
        },
      });
      resolverMemory = new MemStore();
      const resolver = new BackedBlobStore({
        backingStore: resolverMemory,
        defaultFetchOptions: {
          actionIfBlobMissing: "emptyBlob",
        },
      });
      const mediaStore = new ReadThroughBlobStore({
        baseStore: aliasStore,
        backingStore: canonicalStore,
      });
      mediaManager = new MediaManager({
        store: mediaStore,
        resolvers: [resolver],
      });
      await store(resolver, "resolve://host/foo", "fooing");
      await store(resolver, "resolve://host2/bar/baz", "barbazing");
    });

    test("environment", async () => {
      expect(resolverMemory.length).toEqual(2);
      const fooBlob =
        await mediaManager.resolvers?.[0]?.fetch("resolve://host/foo");
      expect(await fooBlob?.asString()).toEqual("fooing");
    });

    test("simple", async () => {
      const uri = "resolve://host/foo";
      const curi = "canonical://store/host/foo";
      const blob = await mediaManager.getMediaBlob(uri);
      expect(await blob?.asString()).toEqual("fooing");
      expect(blob?.path).toEqual(curi);

      // In the alias store,
      // we should be able to fetch it by the resolve uri, but the
      // path in the blob itself should be the canonical uri
      expect(aliasMemory.length).toEqual(1);
      const mediaStore: ReadThroughBlobStore =
        mediaManager.store as ReadThroughBlobStore;
      const aliasBlob = await mediaStore.baseStore.fetch(uri);
      expect(aliasBlob).toBeDefined();
      expect(aliasBlob?.path).toEqual(curi);
      expect(await aliasBlob?.asString()).toEqual("fooing");

      // For the canonical store,
      // fetching it by the resolve uri should fail
      // but fetching it by the canonical uri should succeed
      expect(canonicalMemory.length).toEqual(1);
      const canonicalBlobU = await mediaStore.backingStore.fetch(uri);
      expect(canonicalBlobU).toBeUndefined();
      const canonicalBlob = await mediaStore.backingStore.fetch(curi);
      expect(canonicalBlob).toBeDefined();
      expect(canonicalBlob?.path).toEqual(curi);
      expect(await canonicalBlob?.asString()).toEqual("fooing");
    });
  });
});

function toUint8Array(data: string): Uint8Array {
  return new TextEncoder().encode(data);
}

describe("streaming", () => {
  test("ReadableJsonStream can handle stream", async () => {
    const data = [
      toUint8Array("["),
      toUint8Array('{"i": 1}'),
      toUint8Array('{"i'),
      toUint8Array('": 2}'),
      toUint8Array("]"),
    ];

    const source = new ReadableStream({
      start(controller) {
        data.forEach((chunk) => controller.enqueue(chunk));
        controller.close();
      },
    });
    const stream = new ReadableJsonStream(source);
    expect(await stream.nextChunk()).toEqual({ i: 1 });
    expect(await stream.nextChunk()).toEqual({ i: 2 });
    expect(await stream.nextChunk()).toBeNull();
    expect(stream.streamDone).toEqual(true);
  });

  test("ReadableJsonStream can handle multibyte stream", async () => {
    const data = [
      toUint8Array("["),
      toUint8Array('{"i": 1, "msg":"hello👋"}'),
      toUint8Array('{"i": 2,'),
      toUint8Array('"msg":"こん'),
      new Uint8Array([0xe3]), // 1st byte of "に"
      new Uint8Array([0x81, 0xab]), // 2-3rd bytes of "に"
      toUint8Array("ちは"),
      new Uint8Array([0xf0, 0x9f]), // first half bytes of "👋"
      new Uint8Array([0x91, 0x8b]), // second half bytes of "👋"
      toUint8Array('"}'),
      toUint8Array("]"),
    ];

    const source = new ReadableStream({
      start(controller) {
        data.forEach((chunk) => controller.enqueue(chunk));
        controller.close();
      },
    });
    const stream = new ReadableJsonStream(source);
    expect(await stream.nextChunk()).toEqual({ i: 1, msg: "hello👋" });
    expect(await stream.nextChunk()).toEqual({ i: 2, msg: "こんにちは👋" });
    expect(await stream.nextChunk()).toBeNull();
    expect(stream.streamDone).toEqual(true);
  });

  const eventData: string[] = [
    "event: ping\n",
    'data: {"type": "ping"}\n',
    "\n",
    "event: pong\n",
    'data: {"type": "pong", "value": "ping-pong"}\n',
    "\n",
    "\n",
  ];

  test("SseStream", async () => {
    const source = new ReadableStream({
      start(controller) {
        eventData.forEach((chunk) => controller.enqueue(toUint8Array(chunk)));
        controller.close();
      },
    });

    let chunk;
    const stream = new ReadableSseStream(source);

    chunk = await stream.nextChunk();
    expect(chunk.event).toEqual("ping");
    expect(chunk.data).toEqual('{"type": "ping"}');

    chunk = await stream.nextChunk();
    expect(chunk.event).toEqual("pong");

    chunk = await stream.nextChunk();
    expect(chunk).toBeNull();

    expect(stream.streamDone).toEqual(true);
  });

  test("SseJsonStream", async () => {
    const source = new ReadableStream({
      start(controller) {
        eventData.forEach((chunk) => controller.enqueue(toUint8Array(chunk)));
        controller.close();
      },
    });

    let chunk;
    const stream = new ReadableSseJsonStream(source);

    chunk = await stream.nextChunk();
    expect(chunk.type).toEqual("ping");

    chunk = await stream.nextChunk();
    expect(chunk.type).toEqual("pong");
    expect(chunk.value).toEqual("ping-pong");

    chunk = await stream.nextChunk();
    expect(chunk).toBeNull();

    expect(stream.streamDone).toEqual(true);
  });
});

describe("gemini image URL handling", () => {
  test("handles image_url with external URL and infers MIME type", async () => {
    const api = getGeminiAPI();
    const message = new HumanMessage({
      content: [
        {
          type: "text",
          text: "What is in the picture?",
        },
        {
          type: "image_url",
          image_url: {
            url: "https://example.com/image.jpg",
          },
        },
      ],
    });

    const formatted = (await api.formatData([message], {})) as GeminiRequest;
    const imagePart = formatted.contents?.[0]?.parts?.[1] as GeminiPartFileData;

    expect(imagePart).toBeDefined();
    expect(imagePart).toHaveProperty("fileData");
    expect(imagePart?.fileData.mimeType).toBe("image/jpeg");
    expect(imagePart?.fileData.fileUri).toBe("https://example.com/image.jpg");
  });

  test("handles image_url with png extension", async () => {
    const api = getGeminiAPI();
    const message = new HumanMessage({
      content: [
        {
          type: "text",
          text: "What is in the picture?",
        },
        {
          type: "image_url",
          image_url: {
            url: "https://example.com/photo.png?size=large",
          },
        },
      ],
    });

    const formatted = (await api.formatData([message], {})) as GeminiRequest;
    const imagePart = formatted.contents?.[0]?.parts?.[1] as GeminiPartFileData;

    expect(imagePart).toBeDefined();
    expect(imagePart?.fileData.mimeType).toBe("image/png");
    expect(imagePart?.fileData.fileUri).toBe(
      "https://example.com/photo.png?size=large"
    );
  });

  test("handles image_url with data URL", async () => {
    const api = getGeminiAPI();
    const dataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
    const message = new HumanMessage({
      content: [
        {
          type: "text",
          text: "What is in the picture?",
        },
        {
          type: "image_url",
          image_url: {
            url: dataUrl,
          },
        },
      ],
    });

    const formatted = (await api.formatData([message], {})) as GeminiRequest;
    const imagePart = formatted.contents?.[0]
      ?.parts?.[1] as GeminiPartInlineData;

    expect(imagePart).toBeDefined();
    expect(imagePart?.inlineData.mimeType).toBe("image/png");
    expect(imagePart?.inlineData.data).toBeDefined();
  });

  test("handles image_url with unknown extension - uses default", async () => {
    const api = getGeminiAPI();
    const message = new HumanMessage({
      content: [
        {
          type: "text",
          text: "What is in the picture?",
        },
        {
          type: "image_url",
          image_url: {
            url: "https://example.com/image",
          },
        },
      ],
    });

    const formatted = (await api.formatData([message], {})) as GeminiRequest;
    const imagePart = formatted.contents?.[0]?.parts?.[1] as GeminiPartFileData;

    expect(imagePart).toBeDefined();
    expect(imagePart?.fileData.mimeType).toBe("image/png"); // default fallback
    expect(imagePart?.fileData.fileUri).toBe("https://example.com/image");
  });

  test("handles various image extensions correctly", async () => {
    const api = getGeminiAPI();
    const testCases = [
      { ext: "jpeg", mime: "image/jpeg" },
      { ext: "jpg", mime: "image/jpeg" },
      { ext: "png", mime: "image/png" },
      { ext: "gif", mime: "image/gif" },
      { ext: "webp", mime: "image/webp" },
      { ext: "bmp", mime: "image/bmp" },
      { ext: "svg", mime: "image/svg+xml" },
      { ext: "tiff", mime: "image/tiff" },
      { ext: "tif", mime: "image/tiff" },
    ];

    for (const { ext, mime } of testCases) {
      const message = new HumanMessage({
        content: [
          {
            type: "image_url",
            image_url: {
              url: `https://example.com/image.${ext}`,
            },
          },
        ],
      });

      const formatted = (await api.formatData([message], {})) as GeminiRequest;
      const imagePart = formatted.contents?.[0]
        ?.parts?.[0] as GeminiPartFileData;

      expect(imagePart).toBeDefined();
      expect(imagePart?.fileData.mimeType).toBe(mime);
    }
  });

  test("handles malformed URLs gracefully", async () => {
    const api = getGeminiAPI();
    const message = new HumanMessage({
      content: [
        {
          type: "image_url",
          image_url: {
            url: "not-a-valid-url.jpg",
          },
        },
      ],
    });

    const formatted = (await api.formatData([message], {})) as GeminiRequest;
    const imagePart = formatted.contents?.[0]?.parts?.[0] as GeminiPartFileData;

    expect(imagePart).toBeDefined();
    expect(imagePart?.fileData.mimeType).toBe("image/jpeg");
    expect(imagePart?.fileData.fileUri).toBe("not-a-valid-url.jpg");
  });
});
