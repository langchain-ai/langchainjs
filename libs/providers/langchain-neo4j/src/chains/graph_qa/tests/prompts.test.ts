import { test, expect, describe } from "vitest";
import { CYPHER_GENERATION_PROMPT, CYPHER_QA_PROMPT } from "../prompts.js";

describe("CYPHER_GENERATION_PROMPT", () => {
  test("should be defined", () => {
    expect(CYPHER_GENERATION_PROMPT).toBeDefined();
  });

  test("should have schema and question input variables", () => {
    expect(CYPHER_GENERATION_PROMPT.inputVariables).toContain("schema");
    expect(CYPHER_GENERATION_PROMPT.inputVariables).toContain("question");
    expect(CYPHER_GENERATION_PROMPT.inputVariables).toHaveLength(2);
  });

  test("should format with provided variables", async () => {
    const result = await CYPHER_GENERATION_PROMPT.format({
      schema: "Person {name: STRING}",
      question: "Who is Alice?",
    });

    expect(result).toContain("Person {name: STRING}");
    expect(result).toContain("Who is Alice?");
    expect(result).toContain("Generate Cypher statement");
  });

  test("should contain usage instructions", async () => {
    const result = await CYPHER_GENERATION_PROMPT.format({
      schema: "",
      question: "",
    });

    expect(result).toContain(
      "Use only the provided relationship types and properties"
    );
    expect(result).toContain(
      "Do not include any text except the generated Cypher statement"
    );
  });
});

describe("CYPHER_QA_PROMPT", () => {
  test("should be defined", () => {
    expect(CYPHER_QA_PROMPT).toBeDefined();
  });

  test("should have context and question input variables", () => {
    expect(CYPHER_QA_PROMPT.inputVariables).toContain("context");
    expect(CYPHER_QA_PROMPT.inputVariables).toContain("question");
    expect(CYPHER_QA_PROMPT.inputVariables).toHaveLength(2);
  });

  test("should format with provided variables", async () => {
    const result = await CYPHER_QA_PROMPT.format({
      context: "[{name: Alice}]",
      question: "Who are the users?",
    });

    expect(result).toContain("[{name: Alice}]");
    expect(result).toContain("Who are the users?");
  });

  test("should contain QA instructions", async () => {
    const result = await CYPHER_QA_PROMPT.format({
      context: "",
      question: "",
    });

    expect(result).toContain("human understandable answers");
    expect(result).toContain("provided information is authoritative");
  });

  test("should include Neo4j example", async () => {
    const result = await CYPHER_QA_PROMPT.format({
      context: "",
      question: "",
    });

    expect(result).toContain("Neo4j stocks");
  });
});
