import { test, expect, describe } from "vitest";
import { z } from "zod/v3";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { AIMessage } from "@langchain/core/messages";
import { ChatGroq } from "../chat_models.js";
import {
  getGroqStructuredOutputMethod,
  groqStrictifySchema,
} from "../utils/groq-schema.js";

test("withStructuredOutput zod schema function calling", async () => {
  const model = new ChatGroq({
    temperature: 0,
    model: "llama-3.3-70b-versatile",
  });

  const calculatorSchema = z.object({
    operation: z.enum(["add", "subtract", "multiply", "divide"]),
    number1: z.number(),
    number2: z.number(),
  });
  const modelWithStructuredOutput = model.withStructuredOutput(
    calculatorSchema,
    {
      name: "calculator",
    }
  );

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are VERY bad at math and must always use a calculator."],
    ["human", "Please help me!! What is 2 + 2?"],
  ]);
  const chain = prompt.pipe(modelWithStructuredOutput);
  const result = await chain.invoke({});
  // console.log(result);
  expect("operation" in result).toBe(true);
  expect("number1" in result).toBe(true);
  expect("number2" in result).toBe(true);
});

test("withStructuredOutput zod schema JSON mode", async () => {
  const model = new ChatGroq({
    temperature: 0,
    model: "llama-3.3-70b-versatile",
  });

  const calculatorSchema = z.object({
    operation: z.enum(["add", "subtract", "multiply", "divide"]),
    number1: z.number(),
    number2: z.number(),
  });
  const modelWithStructuredOutput = model.withStructuredOutput(
    calculatorSchema,
    {
      name: "calculator",
      method: "jsonMode",
    }
  );

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `You are VERY bad at math and must always use a calculator.
Respond with a JSON object containing three keys:
'operation': the type of operation to execute, either 'add', 'subtract', 'multiply' or 'divide',
'number1': the first number to operate on,
'number2': the second number to operate on.
`,
    ],
    ["human", "Please help me!! What is 2 + 2?"],
  ]);
  const chain = prompt.pipe(modelWithStructuredOutput);
  const result = await chain.invoke({});
  // console.log(result);
  expect("operation" in result).toBe(true);
  expect("number1" in result).toBe(true);
  expect("number2" in result).toBe(true);
});

test("withStructuredOutput JSON schema function calling", async () => {
  const model = new ChatGroq({
    temperature: 0,
    model: "llama-3.3-70b-versatile",
  });

  const calculatorSchema = z.object({
    operation: z.enum(["add", "subtract", "multiply", "divide"]),
    number1: z.number(),
    number2: z.number(),
  });
  const modelWithStructuredOutput = model.withStructuredOutput(
    toJsonSchema(calculatorSchema),
    {
      name: "calculator",
    }
  );

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", `You are VERY bad at math and must always use a calculator.`],
    ["human", "Please help me!! What is 2 + 2?"],
  ]);
  const chain = prompt.pipe(modelWithStructuredOutput);
  const result = await chain.invoke({});
  // console.log(result);
  expect("operation" in result).toBe(true);
  expect("number1" in result).toBe(true);
  expect("number2" in result).toBe(true);
});

test("withStructuredOutput OpenAI function definition function calling", async () => {
  const model = new ChatGroq({
    temperature: 0,
    model: "llama-3.3-70b-versatile",
  });

  const calculatorSchema = z.object({
    operation: z.enum(["add", "subtract", "multiply", "divide"]),
    number1: z.number(),
    number2: z.number(),
  });
  const modelWithStructuredOutput = model.withStructuredOutput({
    name: "calculator",
    parameters: toJsonSchema(calculatorSchema),
  });

  const prompt = ChatPromptTemplate.fromMessages([
    "system",
    `You are VERY bad at math and must always use a calculator.`,
    "human",
    "Please help me!! What is 2 + 2?",
  ]);
  const chain = prompt.pipe(modelWithStructuredOutput);
  const result = await chain.invoke({});
  // console.log(result);
  expect("operation" in result).toBe(true);
  expect("number1" in result).toBe(true);
  expect("number2" in result).toBe(true);
});

test("withStructuredOutput JSON schema JSON mode", async () => {
  const model = new ChatGroq({
    temperature: 0,
    model: "llama-3.3-70b-versatile",
  });

  const calculatorSchema = z.object({
    operation: z.enum(["add", "subtract", "multiply", "divide"]),
    number1: z.number(),
    number2: z.number(),
  });
  const modelWithStructuredOutput = model.withStructuredOutput(
    toJsonSchema(calculatorSchema),
    {
      name: "calculator",
      method: "jsonMode",
    }
  );

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `You are VERY bad at math and must always use a calculator.
Respond with a JSON object containing three keys:
'operation': the type of operation to execute, either 'add', 'subtract', 'multiply' or 'divide',
'number1': the first number to operate on,
'number2': the second number to operate on.
`,
    ],
    ["human", "Please help me!! What is 2 + 2?"],
  ]);
  const chain = prompt.pipe(modelWithStructuredOutput);
  const result = await chain.invoke({});
  // console.log(result);
  expect("operation" in result).toBe(true);
  expect("number1" in result).toBe(true);
  expect("number2" in result).toBe(true);
});

test("withStructuredOutput JSON schema", async () => {
  const model = new ChatGroq({
    temperature: 0,
    model: "llama-3.3-70b-versatile",
  });

  const jsonSchema = {
    title: "calculator",
    description: "A simple calculator",
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["add", "subtract", "multiply", "divide"],
      },
      number1: { type: "number" },
      number2: { type: "number" },
    },
  };
  const modelWithStructuredOutput = model.withStructuredOutput(jsonSchema);

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `You are VERY bad at math and must always use a calculator.
Respond with a JSON object containing three keys:
'operation': the type of operation to execute, either 'add', 'subtract', 'multiply' or 'divide',
'number1': the first number to operate on,
'number2': the second number to operate on.
`,
    ],
    ["human", "Please help me!! What is 2 + 2?"],
  ]);
  const chain = prompt.pipe(modelWithStructuredOutput);
  const result = await chain.invoke({});
  // console.log(result);
  expect("operation" in result).toBe(true);
  expect("number1" in result).toBe(true);
  expect("number2" in result).toBe(true);
});

test("withStructuredOutput includeRaw true", async () => {
  const model = new ChatGroq({
    temperature: 0,
    model: "llama-3.3-70b-versatile",
  });

  const calculatorSchema = z.object({
    operation: z.enum(["add", "subtract", "multiply", "divide"]),
    number1: z.number(),
    number2: z.number(),
  });
  const modelWithStructuredOutput = model.withStructuredOutput(
    calculatorSchema,
    {
      name: "calculator",
      includeRaw: true,
    }
  );

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are VERY bad at math and must always use a calculator."],
    ["human", "Please help me!! What is 2 + 2?"],
  ]);
  const chain = prompt.pipe(modelWithStructuredOutput);
  const result = await chain.invoke({});
  // console.log(result);

  expect("parsed" in result).toBe(true);
  // Need to make TS happy :)
  if (!("parsed" in result)) {
    throw new Error("parsed not in result");
  }
  const { parsed } = result;
  expect("operation" in parsed).toBe(true);
  expect("number1" in parsed).toBe(true);
  expect("number2" in parsed).toBe(true);

  expect("raw" in result).toBe(true);
  // Need to make TS happy :)
  if (!("raw" in result)) {
    throw new Error("raw not in result");
  }
  const { raw } = result as { raw: AIMessage };
  expect(raw.additional_kwargs.tool_calls?.length).toBeGreaterThan(0);
  expect(raw.additional_kwargs.tool_calls?.[0].function.name).toBe(
    "calculator"
  );
  expect(
    "operation" in
      JSON.parse(raw.additional_kwargs.tool_calls?.[0].function.arguments ?? "")
  ).toBe(true);
  expect(
    "number1" in
      JSON.parse(raw.additional_kwargs.tool_calls?.[0].function.arguments ?? "")
  ).toBe(true);
  expect(
    "number2" in
      JSON.parse(raw.additional_kwargs.tool_calls?.[0].function.arguments ?? "")
  ).toBe(true);
});

// Tests for native JSON Schema structured output (gpt-oss models)
describe("Native JSON Schema Structured Output (gpt-oss models)", () => {
  test("withStructuredOutput uses jsonSchema by default for gpt-oss models", async () => {
    const model = new ChatGroq({
      temperature: 0,
      model: "openai/gpt-oss-120b",
    });

    const calculatorSchema = z.object({
      operation: z.enum(["add", "subtract", "multiply", "divide"]),
      number1: z.number(),
      number2: z.number(),
    });

    // Should automatically use jsonSchema method for gpt-oss models
    const modelWithStructuredOutput = model.withStructuredOutput(
      calculatorSchema,
      { name: "calculator" }
    );

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", "You are VERY bad at math and must always use a calculator."],
      ["human", "Please help me!! What is 2 + 2?"],
    ]);
    const chain = prompt.pipe(modelWithStructuredOutput);
    const result = await chain.invoke({});

    expect("operation" in result).toBe(true);
    expect("number1" in result).toBe(true);
    expect("number2" in result).toBe(true);
  });

  test("withStructuredOutput explicit jsonSchema method", async () => {
    const model = new ChatGroq({
      temperature: 0,
      model: "openai/gpt-oss-120b",
    });

    const personSchema = z.object({
      name: z.string().describe("The person's name"),
      age: z.number().describe("The person's age"),
      city: z.string().optional().describe("The person's city"),
    });

    const modelWithStructuredOutput = model.withStructuredOutput(personSchema, {
      name: "person",
      method: "jsonSchema",
    });

    const result = await modelWithStructuredOutput.invoke(
      "Extract info: John is 30 years old and lives in New York"
    );

    expect("name" in result).toBe(true);
    expect("age" in result).toBe(true);
    expect(result.name).toBe("John");
    expect(result.age).toBe(30);
  });

  test("withStructuredOutput jsonSchema with optional fields", async () => {
    const model = new ChatGroq({
      temperature: 0,
      model: "openai/gpt-oss-120b",
    });

    const movieSchema = z.object({
      title: z.string(),
      year: z.number(),
      director: z.string().optional(),
      rating: z.number().optional(),
    });

    const modelWithStructuredOutput = model.withStructuredOutput(movieSchema, {
      method: "jsonSchema",
    });

    const result = await modelWithStructuredOutput.invoke(
      "Tell me about the movie Inception from 2010"
    );

    expect("title" in result).toBe(true);
    expect("year" in result).toBe(true);
    expect(result.title.toLowerCase()).toContain("inception");
    expect(result.year).toBe(2010);
  });

  test("withStructuredOutput jsonSchema with nested objects", async () => {
    const model = new ChatGroq({
      temperature: 0,
      model: "openai/gpt-oss-120b",
    });

    const addressSchema = z.object({
      person: z.object({
        name: z.string(),
        email: z.string().optional(),
      }),
      location: z.object({
        city: z.string(),
        country: z.string(),
      }),
    });

    const modelWithStructuredOutput = model.withStructuredOutput(
      addressSchema,
      {
        method: "jsonSchema",
      }
    );

    const result = await modelWithStructuredOutput.invoke(
      "Extract: Maria lives in São Paulo, Brazil. Her email is maria@example.com"
    );

    expect("person" in result).toBe(true);
    expect("location" in result).toBe(true);
    expect(result.person.name).toBe("Maria");
    expect(result.location.city).toContain("Paulo");
    expect(result.location.country).toContain("Brazil");
  });

  test("jsonSchema method throws for unsupported models", () => {
    expect(() => {
      getGroqStructuredOutputMethod("llama-3.3-70b-versatile", "jsonSchema");
    }).toThrow(/not supported/);
  });

  test("groqStrictifySchema transforms schema correctly", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
        city: { type: "string" }, // optional (not in required)
      },
      required: ["name", "age"],
    };

    const strict = groqStrictifySchema(schema);

    // All properties should be required in strict mode
    expect(strict.required).toContain("name");
    expect(strict.required).toContain("age");
    expect(strict.required).toContain("city");

    // Optional property should be nullable
    expect(strict.properties.city.type).toContain("null");

    // Should have additionalProperties: false
    expect(strict.additionalProperties).toBe(false);
  });
});
