import { expect, test } from "@jest/globals";
import { z } from "zod";
import { StructuredOutputParser } from "../structured.js";

test("StructuredOutputParser handles valid JSON wrapped in triple backticks", async () => {
  const parser = StructuredOutputParser.fromZodSchema(
    z.object({
      name: z.string().describe("Human name"),
      age: z.number().describe("Human age"),
    })
  );
  const text = '```json\n{"name": "John Doe", "age": 30}```';

  const result = await parser.parse(text);

  expect(result).toHaveProperty("name", "John Doe");
  expect(result).toHaveProperty("age", 30);
});

test("StructuredOutputParser handles JSON without triple backticks", async () => {
  const parser = StructuredOutputParser.fromZodSchema(
    z.object({
      name: z.string().describe("Human name"),
      age: z.number().describe("Human age"),
    })
  );
  const text = '{"name": "John Doe", "age": 30}';

  const result = await parser.parse(text);

  expect(result).toHaveProperty("name", "John Doe");
  expect(result).toHaveProperty("age", 30);
});

test("StructuredOutputParser throws error for invalid JSON wrapped in triple backticks", async () => {
  const parser = StructuredOutputParser.fromZodSchema(
    z.object({
      name: z.string().describe("Human name"),
      age: z.number().describe("Human age"),
    })
  );
  // Invalid JSON
  const text = '```json\n{"name": "John Doe", "age": }```';

  await expect(parser.parse(text)).rejects.toThrow("Failed to parse");
});

test("StructuredOutputParser throws error for normal text without triple backticks", async () => {
  const parser = StructuredOutputParser.fromZodSchema(
    z.object({
      name: z.string().describe("Human name"),
      age: z.number().describe("Human age"),
    })
  );
  // Invalid JSON
  const text = "This is just a plain text without JSON.";

  await expect(parser.parse(text)).rejects.toThrow("Failed to parse");
});

test("StructuredOutputParser handles JSON with backticks inside text but not at the start", async () => {
  const parser = StructuredOutputParser.fromZodSchema(
    z.object({
      name: z.string().describe("Human name"),
      age: z.number().describe("Human age"),
    })
  );
  const text = 'Some random text ```json\n{"name": "John Doe", "age": 30}```';
  const result = await parser.parse(text);

  expect(result).toHaveProperty("name", "John Doe");
  expect(result).toHaveProperty("age", 30);
});

test("StructuredOutputParser handles JSON with backticks inside JSON", async () => {
  const parser = StructuredOutputParser.fromZodSchema(
    z.object({
      name: z.string().describe("Human name"),
      age: z.number().describe("Human age"),
    })
  );
  const text = '{"name": "John ```Doe```", "age": 30}';

  const result = await parser.parse(text);

  expect(result).toHaveProperty("name", "John ```Doe```");
  expect(result).toHaveProperty("age", 30);
});

test("StructuredOutputParser throws error for JSON with backticks both inside and outside the JSON", async () => {
  const parser = StructuredOutputParser.fromZodSchema(
    z.object({
      name: z.string().describe("Human name"),
      age: z.number().describe("Human age"),
    })
  );
  const text =
    'Some random text ```json\n{"name": "John ```Doe```", "age": 30}```';

  await expect(parser.parse(text)).rejects.toThrow("Failed to parse");
});
