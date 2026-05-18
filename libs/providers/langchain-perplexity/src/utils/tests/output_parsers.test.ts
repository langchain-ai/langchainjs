import { describe, expect, test } from "vitest";
import { z } from "zod/v3";
import { OutputParserException } from "@langchain/core/output_parsers";
import {
  ReasoningStructuredOutputParser,
  ReasoningJsonOutputParser,
} from "../output_parsers.js";

describe("ReasoningStructuredOutputParser", () => {
  test("strips think tags and parses structured output", async () => {
    const schema = z.object({
      answer: z.string().describe("The answer to the question"),
      reasoning: z.string().describe("The reasoning process"),
    });

    const parser = new ReasoningStructuredOutputParser(schema);

    const input = [
      "<think>",
      "Let me think about this step by step.",
      "First, I need to understand the question.",
      "Then I'll provide a logical answer.",
      "</think>",
      "",
      "```json",
      "{",
      '  "answer": "The answer is 42",',
      '  "reasoning": "I calculated this based on the given parameters"',
      "}",
      "```",
    ].join("\n");

    const result = await parser.parse(input);

    expect(result).toEqual({
      answer: "The answer is 42",
      reasoning: "I calculated this based on the given parameters",
    });
  });

  test("handles input without think tags", async () => {
    const schema = z.object({
      answer: z.string().describe("The answer to the question"),
    });

    const parser = new ReasoningStructuredOutputParser(schema);

    const input = [
      "```json",
      "{",
      '  "answer": "Simple answer without thinking"',
      "}",
      "```",
    ].join("\n");

    const result = await parser.parse(input);

    expect(result).toEqual({
      answer: "Simple answer without thinking",
    });
  });

  test("handles multiple think tags", async () => {
    const schema = z.object({
      answer: z.string().describe("The final answer"),
    });

    const parser = new ReasoningStructuredOutputParser(schema);

    const input = [
      "<think>",
      "First thought process",
      "</think>",
      "Some text in between",
      "<think>",
      "Second thought process",
      "</think>",
      "",
      "```json",
      "{",
      '  "answer": "Final answer after multiple thoughts"',
      "}",
      "```",
    ].join("\n");

    const result = await parser.parse(input);

    expect(result).toEqual({
      answer: "Final answer after multiple thoughts",
    });
  });

  test("throws error for invalid JSON after stripping think tags", async () => {
    const schema = z.object({
      answer: z.string().describe("The answer"),
    });

    const parser = new ReasoningStructuredOutputParser(schema);

    const input = [
      "<think>",
      "Some thinking here",
      "</think>",
      "",
      "```json",
      "{",
      '  "answer": "Missing closing brace',
      "}",
      "```",
    ].join("\n");

    await expect(parser.parse(input)).rejects.toThrow(OutputParserException);
  });

  test("handles empty think tags", async () => {
    const schema = z.object({
      answer: z.string().describe("The answer"),
    });

    const parser = new ReasoningStructuredOutputParser(schema);

    const input = [
      "<think></think>",
      "",
      "```json",
      "{",
      '  "answer": "Answer after empty thinking"',
      "}",
      "```",
    ].join("\n");

    const result = await parser.parse(input);

    expect(result).toEqual({
      answer: "Answer after empty thinking",
    });
  });

  test("handles think tags with whitespace", async () => {
    const schema = z.object({
      answer: z.string().describe("The answer"),
    });

    const parser = new ReasoningStructuredOutputParser(schema);

    const input = [
      "<think>",
      "  ",
      "  Multiple lines",
      "  with whitespace",
      "  ",
      "</think>",
      "",
      "```json",
      "{",
      '  "answer": "Answer after whitespace"',
      "}",
      "```",
    ].join("\n");

    const result = await parser.parse(input);

    expect(result).toEqual({
      answer: "Answer after whitespace",
    });
  });

  test.skip("preserves unmatched opening think tags", async () => {
    const schema = z.object({
      answer: z.string().describe("The answer"),
    });

    const parser = new ReasoningStructuredOutputParser(schema);

    const input = [
      "<think>",
      "This tag is never closed",
      "```json",
      "{",
      '  "answer": "This should still fail to parse"',
      "}",
      "```",
    ].join("\n");

    await expect(parser.parse(input)).rejects.toThrow(OutputParserException);
  });
});

describe("ReasoningJsonOutputParser", () => {
  test("strips think tags and parses JSON output", async () => {
    const parser = new ReasoningJsonOutputParser<{
      answer: string;
      confidence: number;
    }>();

    const input = [
      "<think>",
      "I need to provide a JSON response with an answer and confidence level.",
      "</think>",
      "",
      "```json",
      "{",
      '  "answer": "The answer is correct",',
      '  "confidence": 0.95',
      "}",
      "```",
    ].join("\n");

    const result = await parser.parse(input);

    expect(result).toEqual({
      answer: "The answer is correct",
      confidence: 0.95,
    });
  });

  test("handles input without think tags", async () => {
    const parser = new ReasoningJsonOutputParser<{
      message: string;
    }>();

    const input = [
      "```json",
      "{",
      '  "message": "Direct message without thinking"',
      "}",
      "```",
    ].join("\n");

    const result = await parser.parse(input);

    expect(result).toEqual({
      message: "Direct message without thinking",
    });
  });

  test("handles complex nested JSON structures", async () => {
    const parser = new ReasoningJsonOutputParser<{
      result: {
        items: Array<{ id: number; name: string }>;
        total: number;
      };
    }>();

    const input = [
      "<think>",
      "I need to return a complex nested structure with an array of items.",
      "</think>",
      "",
      "```json",
      "{",
      '  "result": {',
      '    "items": [',
      '      {"id": 1, "name": "Item 1"},',
      '      {"id": 2, "name": "Item 2"}',
      "    ],",
      '    "total": 2',
      "  }",
      "}",
      "```",
    ].join("\n");

    const result = await parser.parse(input);

    expect(result).toEqual({
      result: {
        items: [
          { id: 1, name: "Item 1" },
          { id: 2, name: "Item 2" },
        ],
        total: 2,
      },
    });
  });

  test("handles think tags with special characters", async () => {
    const parser = new ReasoningJsonOutputParser<{
      answer: string;
    }>();

    const input = [
      "<think>",
      "I need to consider: \"quotes\", 'apostrophes', and special chars like & < > ",
      "</think>",
      "",
      "```json",
      "{",
      '  "answer": "Answer with special characters: & < > \\" \'"',
      "}",
      "```",
    ].join("\n");

    const result = await parser.parse(input);

    expect(result).toEqual({
      answer: "Answer with special characters: & < > \" '",
    });
  });

  test("throws error for invalid JSON after stripping think tags", async () => {
    const parser = new ReasoningJsonOutputParser<{
      answer: string;
    }>();

    const input = [
      "<think>",
      "Some thinking here",
      "</think>",
      "",
      "```json",
      "{",
      '  "answer": "Unclosed string',
      "}",
      "```",
    ].join("\n");

    await expect(parser.parse(input)).rejects.toThrow();
  });

  test("handles think tags at both beginning and end", async () => {
    const parser = new ReasoningJsonOutputParser<{
      answer: string;
    }>();

    const input = [
      "<think>Initial thinking</think>",
      "",
      "```json",
      "{",
      '  "answer": "Answer in the middle"',
      "}",
      "```",
      "",
      "<think>Final thoughts</think>",
    ].join("\n");

    const result = await parser.parse(input);

    expect(result).toEqual({
      answer: "Answer in the middle",
    });
  });
});
