import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { AIMessage, AIMessageChunk } from "@langchain/core/messages";
import { test, expect, describe, it } from "@jest/globals";
import { concat } from "@langchain/core/utils/stream";
import { ChatOpenAI } from "../chat_models.js";

test("withStructuredOutput zod schema function calling", async () => {
  const model = new ChatOpenAI({
    temperature: 0,
    modelName: "gpt-4o-mini",
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

test("withStructuredOutput with o1", async () => {
  const model = new ChatOpenAI({
    model: "o1",
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
    ["developer", "You are VERY bad at math and must always use a calculator."],
    ["human", "Please help me!! What is 2 + 2?"],
  ]);
  const chain = prompt.pipe(modelWithStructuredOutput);
  const result = await chain.invoke({});
  // console.log(result);
  expect("operation" in result).toBe(true);
  expect("number1" in result).toBe(true);
  expect("number2" in result).toBe(true);
});

test("withStructuredOutput zod schema streaming", async () => {
  const model = new ChatOpenAI({
    temperature: 0,
    modelName: "gpt-4o-mini",
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
  const stream = await chain.stream({});
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  expect(chunks.length).toBeGreaterThan(1);
  const result = chunks.at(-1) ?? {};
  expect("operation" in result).toBe(true);
  expect("number1" in result).toBe(true);
  expect("number2" in result).toBe(true);
});

test("withStructuredOutput zod schema JSON mode", async () => {
  const model = new ChatOpenAI({
    temperature: 0,
    modelName: "gpt-4o-mini",
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
  const model = new ChatOpenAI({
    temperature: 0,
    modelName: "gpt-4o-mini",
  });

  const calculatorSchema = z.object({
    operation: z.enum(["add", "subtract", "multiply", "divide"]),
    number1: z.number(),
    number2: z.number(),
  });
  const modelWithStructuredOutput = model.withStructuredOutput({
    schema: zodToJsonSchema(calculatorSchema),
    name: "calculator",
  });

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
  const model = new ChatOpenAI({
    temperature: 0,
    modelName: "gpt-4o-mini",
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

test("withStructuredOutput JSON schema JSON mode", async () => {
  const model = new ChatOpenAI({
    temperature: 0,
    modelName: "gpt-4o-mini",
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
  const model = new ChatOpenAI({
    temperature: 0,
    modelName: "gpt-4o-mini",
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
  const model = new ChatOpenAI({
    temperature: 0,
    modelName: "gpt-4o-mini",
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

test("parallelToolCalls param", async () => {
  const calculatorSchema = z
    .object({
      operation: z.enum(["add", "subtract", "multiply", "divide"]),
      number1: z.number(),
      number2: z.number(),
    })
    .describe("A tool to perform basic arithmetic operations");
  const weatherSchema = z
    .object({
      city: z.enum(["add", "subtract", "multiply", "divide"]),
    })
    .describe("A tool to get the weather in a city");

  const model = new ChatOpenAI({
    model: "gpt-4o",
    temperature: 0,
  }).bindTools([
    {
      type: "function",
      function: {
        name: "calculator",
        description: calculatorSchema.description,
        parameters: zodToJsonSchema(calculatorSchema),
      },
    },
    {
      type: "function",
      function: {
        name: "weather",
        description: weatherSchema.description,
        parameters: zodToJsonSchema(weatherSchema),
      },
    },
  ]);

  const response = await model.invoke(
    ["What is the weather in san francisco and what is 23716 times 27342?"],
    {
      parallel_tool_calls: false,
    }
  );
  // console.log(response.tool_calls);
  expect(response.tool_calls?.length).toBe(1);
});

test("Passing strict true forces the model to conform to the schema", async () => {
  const model = new ChatOpenAI({
    model: "gpt-4o",
    temperature: 0,
    maxRetries: 0,
  });

  const weatherTool = {
    type: "function" as const,
    function: {
      name: "get_current_weather",
      description: "Get the current weather in a location",
      parameters: zodToJsonSchema(
        z.object({
          location: z.string().describe("The location to get the weather for"),
        })
      ),
    },
  };
  const modelWithTools = model.bindTools([weatherTool], {
    strict: true,
    tool_choice: "get_current_weather",
  });

  const result = await modelWithTools.invoke(
    "Whats the result of 173827 times 287326 divided by 2?"
  );
  // Expect at least one tool call, allow multiple
  expect(result.tool_calls?.length).toBeGreaterThanOrEqual(1);
  expect(result.tool_calls?.[0].name).toBe("get_current_weather");
  expect(result.tool_calls?.[0].args).toHaveProperty("location");
  console.log(result.tool_calls?.[0].args);
});

describe("response_format: json_schema", () => {
  const weatherSchema = z.object({
    city: z.string().describe("The city to get the weather for"),
    state: z.string().describe("The state to get the weather for"),
    zipCode: z.string().describe("The zip code to get the weather for"),
    unit: z
      .enum(["fahrenheit", "celsius"])
      .describe("The unit to get the weather in"),
  });

  it("can invoke", async () => {
    const model = new ChatOpenAI({
      model: "gpt-4o-2024-08-06",
    }).bind({
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "get_current_weather",
          description: "Get the current weather in a location",
          schema: zodToJsonSchema(weatherSchema),
          strict: true,
        },
      },
    });

    const response = await model.invoke(
      "What is the weather in San Francisco, 91626 CA?"
    );
    const parsed = JSON.parse(response.content as string);
    expect(parsed).toHaveProperty("city");
    expect(parsed).toHaveProperty("state");
    expect(parsed).toHaveProperty("zipCode");
    expect(parsed).toHaveProperty("unit");
  });

  it("can stream", async () => {
    const model = new ChatOpenAI({
      model: "gpt-4o-2024-08-06",
    }).bind({
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "get_current_weather",
          description: "Get the current weather in a location",
          schema: zodToJsonSchema(weatherSchema),
          strict: true,
        },
      },
    });

    const stream = await model.stream(
      "What is the weather in San Francisco, 91626 CA?"
    );
    let full: AIMessageChunk | undefined;
    for await (const chunk of stream) {
      full = !full ? chunk : concat(full, chunk);
    }
    expect(full).toBeDefined();
    if (!full) return;

    const parsed = JSON.parse(full.content as string);
    expect(parsed).toHaveProperty("city");
    expect(parsed).toHaveProperty("state");
    expect(parsed).toHaveProperty("zipCode");
    expect(parsed).toHaveProperty("unit");
  });

  it("can invoke with a zod schema passed in", async () => {
    const model = new ChatOpenAI({
      model: "gpt-4o-2024-08-06",
    }).bind({
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "get_current_weather",
          description: "Get the current weather in a location",
          schema: weatherSchema,
          strict: true,
        },
      },
    });

    const response = await model.invoke(
      "What is the weather in San Francisco, 91626 CA?"
    );
    const parsed = JSON.parse(response.content as string);
    expect(parsed).toHaveProperty("city");
    expect(parsed).toHaveProperty("state");
    expect(parsed).toHaveProperty("zipCode");
    expect(parsed).toHaveProperty("unit");
  });

  it("can stream with a zod schema passed in", async () => {
    const model = new ChatOpenAI({
      model: "gpt-4o-2024-08-06",
    }).bind({
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "get_current_weather",
          description: "Get the current weather in a location",
          schema: weatherSchema,
          strict: true,
        },
      },
    });

    const stream = await model.stream(
      "What is the weather in San Francisco, 91626 CA?"
    );
    let full: AIMessageChunk | undefined;
    for await (const chunk of stream) {
      full = !full ? chunk : concat(full, chunk);
    }
    expect(full).toBeDefined();
    if (!full) return;

    const parsed = JSON.parse(full.content as string);
    expect(parsed).toHaveProperty("city");
    expect(parsed).toHaveProperty("state");
    expect(parsed).toHaveProperty("zipCode");
    expect(parsed).toHaveProperty("unit");
  });

  it("can be invoked with WSO", async () => {
    const model = new ChatOpenAI({
      model: "gpt-4o-2024-08-06",
    }).withStructuredOutput(weatherSchema, {
      name: "get_current_weather",
      method: "jsonSchema",
      strict: true,
    });

    const response = await model.invoke(
      "What is the weather in San Francisco, 91626 CA?"
    );
    expect(response).toHaveProperty("city");
    expect(response).toHaveProperty("state");
    expect(response).toHaveProperty("zipCode");
    expect(response).toHaveProperty("unit");
  });

  // Flaky test
  it.skip("can be streamed with WSO", async () => {
    const model = new ChatOpenAI({
      model: "gpt-4o-2024-08-06",
    }).withStructuredOutput(weatherSchema, {
      name: "get_current_weather",
      method: "jsonSchema",
      strict: true,
    });

    const stream = await model.stream(
      "What is the weather in San Francisco, 91626 CA?"
    );
    // It should yield a single chunk
    let full: z.infer<typeof weatherSchema> | undefined;
    for await (const chunk of stream) {
      full = chunk;
    }
    expect(full).toBeDefined();
    if (!full) return;

    expect(full).toHaveProperty("city");
    expect(full).toHaveProperty("state");
    expect(full).toHaveProperty("zipCode");
    expect(full).toHaveProperty("unit");
  });
});
