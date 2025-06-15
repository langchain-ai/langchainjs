import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { AIMessage } from "@langchain/core/messages";
import { ChatXAI } from "../chat_models.js";

test("withStructuredOutput zod schema function calling", async () => {
  const model = new ChatXAI({
    temperature: 0,
    model: "grok-beta",
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
  const model = new ChatXAI({
    temperature: 0,
    model: "grok-beta",
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
  const model = new ChatXAI({
    temperature: 0,
    model: "grok-beta",
  });

  const calculatorSchema = z.object({
    operation: z.enum(["add", "subtract", "multiply", "divide"]),
    number1: z.number(),
    number2: z.number(),
  });
  const modelWithStructuredOutput = model.withStructuredOutput(
    zodToJsonSchema(calculatorSchema),
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
  const model = new ChatXAI({
    temperature: 0,
    model: "grok-beta",
  });

  const calculatorSchema = z.object({
    operation: z.enum(["add", "subtract", "multiply", "divide"]),
    number1: z.number(),
    number2: z.number(),
  });
  const modelWithStructuredOutput = model.withStructuredOutput({
    name: "calculator",
    parameters: zodToJsonSchema(calculatorSchema),
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
  const model = new ChatXAI({
    temperature: 0,
    model: "grok-beta",
  });

  const calculatorSchema = z.object({
    operation: z.enum(["add", "subtract", "multiply", "divide"]),
    number1: z.number(),
    number2: z.number(),
  });
  const modelWithStructuredOutput = model.withStructuredOutput(
    zodToJsonSchema(calculatorSchema),
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
  const model = new ChatXAI({
    temperature: 0,
    model: "grok-beta",
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
  const model = new ChatXAI({
    temperature: 0,
    model: "grok-beta",
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

  expect(raw.tool_calls?.[0].args).toBeDefined();
  if (!raw.tool_calls?.[0].args) {
    throw new Error("args not in tool call");
  }
  expect(raw.tool_calls?.length).toBeGreaterThan(0);
  expect(raw.tool_calls?.[0].name).toBe("calculator");
  expect("operation" in raw.tool_calls[0].args).toBe(true);
  expect("number1" in raw.tool_calls[0].args).toBe(true);
  expect("number2" in raw.tool_calls[0].args).toBe(true);
});
