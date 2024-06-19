/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect, test } from "@jest/globals";
import { z } from "zod";
import { zodToGeminiParameters } from "../utils/zod_to_gemini_parameters.js";
import {MediaBlob, SimpleWebBlobStore} from "../utils/media_core.js";

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

describe("MediaBlob and BlobStore", () => {

  test("MediaBlob plain", async () => {
    const blob = new Blob(["This is a test"], {type: "text/plain"});
    const mblob = new MediaBlob({
      data: blob
    });
    expect(mblob.dataType).toEqual("text/plain");
    expect(mblob.mimetype).toEqual("text/plain");
    expect(mblob.encoding).toEqual("utf-8");
  })

  test("MediaBlob charset", async () => {
    const blob = new Blob(["This is a test"], {type: "text/plain; charset=US-ASCII"});
    const mblob = new MediaBlob({
      data: blob
    });
    expect(mblob.dataType).toEqual("text/plain; charset=us-ascii");
    expect(mblob.mimetype).toEqual("text/plain");
    expect(mblob.encoding).toEqual("us-ascii");
  })

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
  })

})
