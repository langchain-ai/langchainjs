import { describe, expect, test } from "@jest/globals";
import { z } from "zod";
import { OutputParserException } from "@langchain/core/output_parsers";
import {
  ReasoningStructuredOutputParser,
  ReasoningJsonOutputParser,
} from "../output_parsers.js";

describe("ReasoningStructuredOutputParser", () => {
  test("should strip think tags and parse structured output correctly", async () => {
    const schema = z.object({
      answer: z.string().describe("The answer to the question"),
      reasoning: z.string().describe("The reasoning process"),
    });

    const parser = new ReasoningStructuredOutputParser(schema);

    const inputWithThinkTags = [
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

    const result = await parser.parse(inputWithThinkTags);

    expect(result).toEqual({
      answer: "The answer is 42",
      reasoning: "I calculated this based on the given parameters",
    });
  });

  test("should handle input without think tags", async () => {
    const schema = z.object({
      answer: z.string().describe("The answer to the question"),
    });

    const parser = new ReasoningStructuredOutputParser(schema);

    const inputWithoutThinkTags = [
      "```json",
      "{",
      '  "answer": "Simple answer without thinking"',
      "}",
      "```",
    ].join("\n");

    const result = await parser.parse(inputWithoutThinkTags);

    expect(result).toEqual({
      answer: "Simple answer without thinking",
    });
  });

  test("should handle multiple think tags and strip them all", async () => {
    const schema = z.object({
      answer: z.string().describe("The final answer"),
    });

    const parser = new ReasoningStructuredOutputParser(schema);

    const inputWithMultipleThinkTags = [
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

    const result = await parser.parse(inputWithMultipleThinkTags);

    expect(result).toEqual({
      answer: "Final answer after multiple thoughts",
    });
  });

  test("should throw error for invalid JSON after stripping think tags", async () => {
    const schema = z.object({
      answer: z.string().describe("The answer"),
    });

    const parser = new ReasoningStructuredOutputParser(schema);

    const invalidInput = [
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

    await expect(parser.parse(invalidInput)).rejects.toThrow(
      OutputParserException
    );
  });

  test("should handle empty think tags", async () => {
    const schema = z.object({
      answer: z.string().describe("The answer"),
    });

    const parser = new ReasoningStructuredOutputParser(schema);

    const inputWithEmptyThinkTags = [
      "<think></think>",
      "",
      "```json",
      "{",
      '  "answer": "Answer after empty thinking"',
      "}",
      "```",
    ].join("\n");

    const result = await parser.parse(inputWithEmptyThinkTags);

    expect(result).toEqual({
      answer: "Answer after empty thinking",
    });
  });

  test("should handle think tags with newlines and whitespace", async () => {
    const schema = z.object({
      answer: z.string().describe("The answer"),
    });

    const parser = new ReasoningStructuredOutputParser(schema);

    const inputWithWhitespace = [
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

    const result = await parser.parse(inputWithWhitespace);

    expect(result).toEqual({
      answer: "Answer after whitespace",
    });
  });
});

describe("ReasoningJsonOutputParser", () => {
  test("should strip think tags and parse JSON output correctly", async () => {
    const parser = new ReasoningJsonOutputParser<{
      answer: string;
      confidence: number;
    }>();

    const inputWithThinkTags = [
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

    const result = await parser.parse(inputWithThinkTags);

    expect(result).toEqual({
      answer: "The answer is correct",
      confidence: 0.95,
    });
  });

  test("should handle input without think tags", async () => {
    const parser = new ReasoningJsonOutputParser<{
      message: string;
    }>();

    const inputWithoutThinkTags = [
      "```json",
      "{",
      '  "message": "Direct message without thinking"',
      "}",
      "```",
    ].join("\n");

    const result = await parser.parse(inputWithoutThinkTags);

    expect(result).toEqual({
      message: "Direct message without thinking",
    });
  });

  test("should handle complex nested JSON structures", async () => {
    const parser = new ReasoningJsonOutputParser<{
      result: {
        items: Array<{ id: number; name: string }>;
        total: number;
      };
    }>();

    const inputWithComplexJson = [
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

    const result = await parser.parse(inputWithComplexJson);

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

  test("should handle think tags with special characters", async () => {
    const parser = new ReasoningJsonOutputParser<{
      answer: string;
    }>();

    const inputWithSpecialChars = [
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

    const result = await parser.parse(inputWithSpecialChars);

    expect(result).toEqual({
      answer: "Answer with special characters: & < > \" '",
    });
  });

  test("should throw error for invalid JSON after stripping think tags", async () => {
    const parser = new ReasoningJsonOutputParser<{
      answer: string;
    }>();

    const invalidInput = [
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

    await expect(parser.parse(invalidInput)).rejects.toThrow();
  });

  test("should handle think tags at the beginning and end", async () => {
    const parser = new ReasoningJsonOutputParser<{
      answer: string;
    }>();

    const inputWithThinkTagsAtEnds = [
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

    const result = await parser.parse(inputWithThinkTagsAtEnds);

    expect(result).toEqual({
      answer: "Answer in the middle",
    });
  });
});
