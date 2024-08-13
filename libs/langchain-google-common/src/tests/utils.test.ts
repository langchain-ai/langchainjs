/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect, test } from "@jest/globals";
import { z } from "zod";
import { zodToGeminiParameters } from "../utils/zod_to_gemini_parameters.js";
import { ReadableJsonStream } from "../utils/stream.js";

test("zodToGeminiParameters can convert zod schema to gemini schema", () => {
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

test("zodToGeminiParameters removes additional properties from arrays", () => {
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

function toUint8Array(data: string): Uint8Array {
  return new TextEncoder().encode(data);
}

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
