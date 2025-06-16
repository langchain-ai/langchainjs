import { test } from "@jest/globals";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { ContentChunk as MistralAIContentChunk } from "@mistralai/mistralai/models/components/contentchunk.js";
import { HTTPClient } from "@mistralai/mistralai/lib/http.js";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import { ChatMistralAI } from "../chat_models.js";
import { _mistralContentChunkToMessageContentComplex } from "../utils.js";

test("Test ChatMistralAI can invoke hello", async () => {
  const model = new ChatMistralAI({
    model: "mistral-tiny",
  });
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a helpful assistant"],
    ["human", "{input}"],
  ]);
  const response = await prompt.pipe(model).invoke({
    input: "Hello",
  });
  // console.log("response", response);
  expect(response.content.length).toBeGreaterThan(1);
});

test("Test ChatMistralAI can stream", async () => {
  const model = new ChatMistralAI();
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a helpful assistant"],
    ["human", "{input}"],
  ]);
  const response = await prompt.pipe(model).stream({
    input: "Hello",
  });
  let itters = 0;
  let fullMessage = "";
  for await (const item of response) {
    // console.log(item);
    itters += 1;
    fullMessage += item.content;
  }
  // console.log("fullMessage", fullMessage);
  expect(itters).toBeGreaterThan(1);
});

test("Can call tools using structured tools", async () => {
  class Calculator extends StructuredTool {
    name = "calculator";

    description = "Calculate the answer to a math equation";

    schema = z.object({
      calculator: z
        .string()
        .describe("The math equation to calculate the answer for."),
    });

    async _call(_input: { input: string }) {
      return "the answer!";
    }
  }

  const model = new ChatMistralAI({
    model: "mistral-large-latest",
  }).bindTools([new Calculator()]);

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "you are very bad at math and always must use a calculator"],
    [
      "human",
      "what is the sum of 223 + 228 divided by 718236 multiplied by 1234?",
    ],
  ]);

  const chain = prompt.pipe(model);
  const response = await chain.invoke({});
  expect("tool_calls" in response).toBe(true);
  // console.log(response.additional_kwargs.tool_calls?.[0]);
  expect(response.tool_calls?.[0].name).toBe("calculator");
  expect(response.tool_calls?.[0].args?.calculator).toBeDefined();
});

test("Can handle Tools with non-Zod JSON schema", async () => {
  // Mock DynamicStructuredTool with plain JSON schema (not Zod)
  const mockDynamicTool = {
    lc_serializable: false,
    lc_runnable: true,
    name: "add_numbers",
    description: "Add two numbers together",
    schema: {
      type: "object",
      properties: {
        a: { type: "number", description: "First number" },
        b: { type: "number", description: "Second number" },
      },
      required: ["a", "b"],
    },
    func: async (args: { a: number; b: number }) =>
      `The sum is ${args.a + args.b}`,
  };

  const model = new ChatMistralAI({
    model: "mistral-large-latest",
  }).bindTools([mockDynamicTool]);

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      "You are a helpful assistant that uses tools to perform calculations",
    ],
    ["human", "What is 15 + 27?"],
  ]);

  const chain = prompt.pipe(model);
  const response = await chain.invoke({});

  // Verify the tool call was made correctly
  expect(response.tool_calls?.length).toEqual(1);
  expect(response.tool_calls?.[0].name).toBe("add_numbers");
  expect(response.tool_calls?.[0].args?.a).toBeDefined();
  expect(response.tool_calls?.[0].args?.b).toBeDefined();
});

test("Can call tools using raw tools", async () => {
  const tools = [
    {
      type: "function",
      function: {
        name: "calculator",
        description: "Calculate the answer to a math equation",
        parameters: {
          type: "object",
          properties: {
            calculator: {
              type: "string",
              description: "The math equation to calculate the answer for.",
            },
          },
          required: ["calculator"],
        },
      },
    },
  ];

  const model = new ChatMistralAI({
    model: "mistral-large-latest",
  }).bindTools(tools);

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "you are very bad at math and always must use a calculator"],
    [
      "human",
      "what is the sum of 223 + 228 divided by 718236 multiplied by 1234?",
    ],
  ]);
  const chain = prompt.pipe(model);
  const response = await chain.invoke({});
  // console.log(response);
  expect(response.tool_calls?.length).toEqual(1);
  expect(response.tool_calls?.[0].name).toBe("calculator");
  expect(response.tool_calls?.[0].args?.calculator).toBeDefined();
});

test("Can call .stream with tool calling", async () => {
  class Calculator extends StructuredTool {
    name = "calculator";

    description = "Calculate the answer to a math equation";

    schema = z.object({
      calculator: z
        .string()
        .describe("The math equation to calculate the answer for."),
    });

    async _call(_input: { input: string }) {
      return "the answer!";
    }
  }

  const model = new ChatMistralAI({
    model: "mistral-large-latest",
  }).bindTools([new Calculator()]);

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "you are very bad at math and always must use a calculator"],
    [
      "human",
      "what is the sum of 223 + 228 divided by 718236 multiplied by 1234?",
    ],
  ]);

  const chain = prompt.pipe(model);
  const response = await chain.stream({});
  let finalRes: AIMessageChunk | null = null;
  for await (const chunk of response) {
    // console.log(chunk);
    finalRes = chunk;
  }
  if (!finalRes) {
    throw new Error("No final response found");
  }

  expect("tool_calls" in finalRes).toBe(true);
  // console.log(finalRes.additional_kwargs.tool_calls?.[0]);
  expect(finalRes.tool_calls?.[0].name).toBe("calculator");
  expect(finalRes.tool_calls?.[0].args.calculator).toBeDefined();
});

test("Can use json mode response format", async () => {
  const model = new ChatMistralAI({
    model: "mistral-large-latest",
  }).withConfig({
    response_format: {
      type: "json_object",
    },
  });

  const prompt = ChatPromptTemplate.fromMessages([
    "system",
    `you are very bad at math and always must use a calculator.
To use a calculator respond with valid JSON containing a single key: 'calculator' which should contain the math equation to calculate the answer for.`,
    [
      "human",
      "what is the sum of 223 + 228 divided by 718236 multiplied by 1234?",
    ],
  ]);

  const chain = prompt.pipe(model);
  const response = await chain.invoke({});

  // console.log(response);
  const parsedRes = JSON.parse(response.content as string);
  expect(parsedRes.calculator).toBeDefined();
});

test("Can call .stream with json mode", async () => {
  const model = new ChatMistralAI({
    model: "mistral-large-latest",
  }).withConfig({
    response_format: {
      type: "json_object",
    },
  });

  const prompt = ChatPromptTemplate.fromMessages([
    "system",
    `you are very bad at math and always must use a calculator.
To use a calculator respond with valid JSON containing a single key: 'calculator' which should contain the math equation to calculate the answer for.`,
    [
      "human",
      "what is the sum of 223 + 228 divided by 718236 multiplied by 1234?",
    ],
  ]);

  const chain = prompt.pipe(model);
  const response = await chain.stream({});
  let finalRes = "";
  for await (const chunk of response) {
    // console.log(chunk);
    finalRes += chunk.content;
  }

  // console.log(finalRes);
  const parsedRes = JSON.parse(finalRes);
  expect(parsedRes.calculator).toBeDefined();
});

test("Can stream and concat responses for a complex tool", async () => {
  class PersonTraits extends StructuredTool {
    name = "person_traits";

    description = "Log the traits of a person";

    schema = z.object({
      person: z.object({
        name: z.string().describe("Name of the person"),
        age: z.number().describe("Age of the person"),
        friends: z.array(
          z.object({
            name: z.string().describe("Name of the friend"),
            age: z.number().describe("Age of the friend"),
          })
        ),
        friendsCount: z.number().describe("Number of friends"),
        areFriendsCool: z
          .boolean()
          .describe("Whether or not the user thinks the friends are cool"),
      }),
    });

    async _call(_input: { input: string }) {
      return "the answer!";
    }
  }

  const model = new ChatMistralAI({
    model: "mistral-large-latest",
  }).bindTools([new PersonTraits()]);

  const prompt = ChatPromptTemplate.fromMessages([
    "system",
    "You are a helpful assistant, who always logs the traits of a person and their friends because the user has a bad memory.",
    "human",
    "Hi!!! My name's John Doe, and I'm almost 4 years old!. I have 6 friends: Mary, age 24, May, age 22, and Jane, age 30, Joey, age 18, Sam, age 19 and MacFarland age 66. They're all super cool!",
  ]);

  const chain = prompt.pipe(model);
  const response = await chain.stream({});
  let finalRes: AIMessageChunk[] = [];
  for await (const chunk of response) {
    // console.log(chunk);
    finalRes = finalRes.concat(chunk);
  }
  if (!finalRes) {
    throw new Error("No final response found");
  }

  expect(finalRes[0].tool_calls?.[0]).toBeDefined();
  const toolCall = finalRes[0].tool_calls?.[0];
  expect(toolCall?.name).toBe("person_traits");
  const person = toolCall?.args?.person;
  expect(person).toBeDefined();
  expect(person.name).toBeDefined();
  expect(person.age).toBeDefined();
  expect(person.friends.length).toBeGreaterThan(0);
  expect(person.friendsCount).toBeDefined();
  expect(person.areFriendsCool).toBeDefined();
});

test("Few shotting with tool calls", async () => {
  const chat = new ChatMistralAI({
    model: "mistral-large-latest",
    temperature: 0,
  }).bindTools([
    {
      type: "function",
      function: {
        name: "get_current_weather",
        description: "Get the current weather in a given location",
        parameters: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "The city and state, e.g. San Francisco, CA",
            },
            unit: { type: "string", enum: ["celsius", "fahrenheit"] },
          },
          required: ["location"],
        },
      },
    },
  ]);
  const res = await chat.invoke([
    new HumanMessage("What is the weather in SF?"),
    new AIMessage({
      content: "",
      tool_calls: [
        {
          id: "12345",
          name: "get_current_weather",
          args: {
            location: "SF",
          },
        },
      ],
    }),
    new ToolMessage({
      tool_call_id: "12345",
      content: "It is currently 24 degrees with hail in SF.",
    }),
    new AIMessage("It is currently 24 degrees in SF with hail in SF."),
    new HumanMessage("What did you say the weather was?"),
  ]);
  // console.log(res);
  expect(res.content).toContain("24");
});

describe("withStructuredOutput", () => {
  test("withStructuredOutput zod schema function calling", async () => {
    const model = new ChatMistralAI({
      temperature: 0,
      model: "mistral-large-latest",
    });

    const calculatorSchema = z
      .object({
        operation: z
          .enum(["add", "subtract", "multiply", "divide"])
          .describe("The type of operation to execute."),
        number1: z.number().describe("The first number to operate on."),
        number2: z.number().describe("The second number to operate on."),
      })
      .describe("A calculator schema");
    const modelWithStructuredOutput = model.withStructuredOutput(
      calculatorSchema,
      {
        name: "calculator",
      }
    );

    const prompt = ChatPromptTemplate.fromMessages([
      "system",
      "You are VERY bad at math and must always use a calculator.",
      "human",
      "Please help me!! What is 2 + 2?",
    ]);
    const chain = prompt.pipe(modelWithStructuredOutput);
    const result = await chain.invoke({});
    console.log(result);
    expect("operation" in result).toBe(true);
    expect("number1" in result).toBe(true);
    expect("number2" in result).toBe(true);
  });

  test("withStructuredOutput zod schema JSON mode", async () => {
    const model = new ChatMistralAI({
      temperature: 0,
      model: "mistral-large-latest",
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
      "system",
      `You are VERY bad at math and must always use a calculator.
  Respond with a JSON object containing three keys:
  'operation': the type of operation to execute, either 'add', 'subtract', 'multiply' or 'divide',
  'number1': the first number to operate on,
  'number2': the second number to operate on.
  `,
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

  test("withStructuredOutput JSON schema function calling", async () => {
    const model = new ChatMistralAI({
      temperature: 0,
      model: "mistral-large-latest",
    });

    const calculatorSchema = z
      .object({
        operation: z
          .enum(["add", "subtract", "multiply", "divide"])
          .describe("The type of operation to execute."),
        number1: z.number().describe("The first number to operate on."),
        number2: z.number().describe("The second number to operate on."),
      })
      .describe("A calculator schema");

    const modelWithStructuredOutput = model.withStructuredOutput(
      toJsonSchema(calculatorSchema),
      {
        name: "calculator",
      }
    );

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

  test("withStructuredOutput OpenAI function definition function calling", async () => {
    const model = new ChatMistralAI({
      temperature: 0,
      model: "mistral-large-latest",
    });

    const calculatorSchema = z
      .object({
        operation: z
          .enum(["add", "subtract", "multiply", "divide"])
          .describe("The type of operation to execute."),
        number1: z.number().describe("The first number to operate on."),
        number2: z.number().describe("The second number to operate on."),
      })
      .describe("A calculator schema");

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
    const model = new ChatMistralAI({
      temperature: 0,
      model: "mistral-large-latest",
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
      "system",
      `You are VERY bad at math and must always use a calculator.
  Respond with a JSON object containing three keys:
  'operation': the type of operation to execute, either 'add', 'subtract', 'multiply' or 'divide',
  'number1': the first number to operate on,
  'number2': the second number to operate on.
  `,
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

  test("withStructuredOutput includeRaw true", async () => {
    const model = new ChatMistralAI({
      temperature: 0,
      model: "mistral-large-latest",
    });

    const calculatorSchema = z
      .object({
        operation: z
          .enum(["add", "subtract", "multiply", "divide"])
          .describe("The type of operation to execute."),
        number1: z.number().describe("The first number to operate on."),
        number2: z.number().describe("The second number to operate on."),
      })
      .describe("A calculator schema");
    const modelWithStructuredOutput = model.withStructuredOutput(
      calculatorSchema,
      {
        name: "calculator",
        includeRaw: true,
      }
    );

    const prompt = ChatPromptTemplate.fromMessages([
      "system",
      "You are VERY bad at math and must always use a calculator.",
      "human",
      "Please help me!! What is 2 + 2?",
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
    expect(raw.tool_calls?.length).toBeGreaterThan(0);
    expect(raw.tool_calls?.[0].name).toBe("calculator");
    expect("operation" in (raw.tool_calls?.[0]?.args ?? {})).toBe(true);
    expect("number1" in (raw.tool_calls?.[0]?.args ?? {})).toBe(true);
    expect("number2" in (raw.tool_calls?.[0]?.args ?? {})).toBe(true);
  });
});

describe("ChatMistralAI aborting", () => {
  test("ChatMistralAI can abort request via .stream", async () => {
    const controller = new AbortController();
    const model = new ChatMistralAI().withConfig({
      signal: controller.signal,
    });
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", "You're super good at counting!"],
      [
        "human",
        "Count from 0-100, remember to say 'woof' after every even number!",
      ],
    ]);

    const stream = await prompt.pipe(model).stream({});

    let finalRes = "";
    let iters = 0;

    try {
      for await (const item of stream) {
        finalRes += item.content;
        // console.log(finalRes);
        iters += 1;
        controller.abort();
      }
      // If the loop completes without error, fail the test
      fail(
        "Expected for-await loop to throw an error due to abort, but it did not."
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      // Check if the error is due to the abort action
      expect(error.message).toBe("AbortError");
    }
    expect(iters).toBe(1);
  });

  test("ChatMistralAI can timeout requests via .stream", async () => {
    const model = new ChatMistralAI().withConfig({
      timeout: 1000,
    });
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", "You're super good at counting!"],
      [
        "human",
        "Count from 0-100, remember to say 'woof' after every even number!",
      ],
    ]);
    let didError = false;
    let finalRes = "";

    try {
      // Stream is inside the for-await loop because sometimes
      // the abort will occur before the first stream event is emitted
      const stream = await prompt.pipe(model).stream({});

      for await (const item of stream) {
        finalRes += item.content;
        // console.log(finalRes);
      }
      // If the loop completes without error, fail the test
      fail(
        "Expected for-await loop to throw an error due to abort, but it did not."
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      didError = true;
      // Check if the error is due to the abort action
      expect(error.message).toBe("AbortError");
    }
    expect(didError).toBeTruthy();
  });

  test("ChatMistralAI can abort request via .invoke", async () => {
    const controller = new AbortController();
    const model = new ChatMistralAI().withConfig({
      signal: controller.signal,
    });
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", "You're super good at counting!"],
      [
        "human",
        "Count from 0-100, remember to say 'woof' after every even number!",
      ],
    ]);

    let didError = false;

    setTimeout(() => controller.abort(), 1000); // Abort after 1 second

    try {
      await prompt.pipe(model).invoke({});

      // If the loop completes without error, fail the test
      fail(
        "Expected for-await loop to throw an error due to abort, but it did not."
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      didError = true;
      // Check if the error is due to the abort action
      expect(error.message).toBe("AbortError");
    }
    expect(didError).toBeTruthy();
  });

  test("ChatMistralAI can timeout requests via .invoke", async () => {
    const model = new ChatMistralAI().withConfig({
      timeout: 1000,
    });
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", "You're super good at counting!"],
      [
        "human",
        "Count from 0-100, remember to say 'woof' after every even number!",
      ],
    ]);
    let didError = false;

    try {
      await prompt.pipe(model).invoke({});
      // If the loop completes without error, fail the test
      fail(
        "Expected for-await loop to throw an error due to abort, but it did not."
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      didError = true;
      // Check if the error is due to the abort action
      expect(error.message).toBe("AbortError");
    }
    expect(didError).toBeTruthy();
  });
});

describe("codestral-latest", () => {
  test("Test ChatMistralAI can invoke codestral-latest", async () => {
    const model = new ChatMistralAI({
      model: "codestral-latest",
    });
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", "You are a helpful assistant"],
      ["human", "{input}"],
    ]);
    const response = await prompt.pipe(model).invoke({
      input: "How can I log 'Hello, World!' in Python?",
    });
    // console.log("response", response);
    expect(response.content.length).toBeGreaterThan(1);
    expect((response.content as string).toLowerCase()).toContain("hello");
    expect((response.content as string).toLowerCase()).toContain("world");
  });

  test("Test ChatMistralAI can stream codestral-latest", async () => {
    const model = new ChatMistralAI({
      model: "codestral-latest",
    });
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", "You are a helpful assistant"],
      ["human", "{input}"],
    ]);
    const response = await prompt.pipe(model).stream({
      input: "How can I log 'Hello, World!' in Python?",
    });
    let itters = 0;
    let fullMessage = "";
    for await (const item of response) {
      // console.log(item);
      itters += 1;
      fullMessage += item.content;
    }
    // console.log("fullMessage", fullMessage);
    expect(itters).toBeGreaterThan(1);
    expect(fullMessage.toLowerCase()).toContain("hello");
    expect(fullMessage.toLowerCase()).toContain("world");
  });

  test("Can call tools using codestral-latest structured tools", async () => {
    class CodeSandbox extends StructuredTool {
      name = "code_sandbox";

      description =
        "A tool which can run Python code in an isolated environment";

      schema = z.object({
        code: z
          .string()
          .describe(
            "The Python code to execute. Must only contain valid Python code."
          ),
      });

      async _call(input: z.infer<typeof this.schema>) {
        return JSON.stringify(input, null, 2);
      }
    }

    const model = new ChatMistralAI({ model: "codestral-latest" }).bindTools(
      [new CodeSandbox()],
      { tool_choice: "any" }
    );

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", "You are an excellent python engineer."],
      ["human", "{input}"],
    ]);

    const chain = prompt.pipe(model);
    const response = await chain.invoke({
      input:
        "Write a function that takes in a single argument and logs it to the console. Ensure the code is in Python.",
    });
    // console.log(response);
    expect("tool_calls" in response).toBe(true);
    // console.log(response.tool_calls?.[0]);
    if (!response.tool_calls?.[0]) {
      throw new Error("No tool call found");
    }
    const sandboxTool = response.tool_calls[0];
    expect(sandboxTool.name).toBe("code_sandbox");
    expect(sandboxTool.args?.code).toBeDefined();
    // console.log(sandboxTool.args?.code);
  });
});

test("Stream token count usage_metadata", async () => {
  const model = new ChatMistralAI({
    model: "codestral-latest",
    temperature: 0,
    maxTokens: 10,
  });
  let res: AIMessageChunk | null = null;
  for await (const chunk of await model.stream(
    "Why is the sky blue? Be concise."
  )) {
    if (!res) {
      res = chunk;
    } else {
      res = res.concat(chunk);
    }
  }
  // console.log(res);
  expect(res?.usage_metadata).toBeDefined();
  if (!res?.usage_metadata) {
    return;
  }
  expect(res.usage_metadata.input_tokens).toBeGreaterThan(1);
  expect(res.usage_metadata.output_tokens).toBeGreaterThan(1);
  expect(res.usage_metadata.total_tokens).toBe(
    res.usage_metadata.input_tokens + res.usage_metadata.output_tokens
  );
});

test("streamUsage excludes token usage", async () => {
  const model = new ChatMistralAI({
    model: "codestral-latest",
    temperature: 0,
    streamUsage: false,
  });
  let res: AIMessageChunk | null = null;
  for await (const chunk of await model.stream(
    "Why is the sky blue? Be concise."
  )) {
    if (!res) {
      res = chunk;
    } else {
      res = res.concat(chunk);
    }
  }
  // console.log(res);
  expect(res?.usage_metadata).not.toBeDefined();
});

test("Invoke token count usage_metadata", async () => {
  const model = new ChatMistralAI({
    model: "codestral-latest",
    temperature: 0,
    maxTokens: 10,
  });
  const res = await model.invoke("Why is the sky blue? Be concise.");
  // console.log(res);
  expect(res?.usage_metadata).toBeDefined();
  if (!res?.usage_metadata) {
    return;
  }
  expect(res.usage_metadata.input_tokens).toBeGreaterThan(1);
  expect(res.usage_metadata.output_tokens).toBeGreaterThan(1);
  expect(res.usage_metadata.total_tokens).toBe(
    res.usage_metadata.input_tokens + res.usage_metadata.output_tokens
  );
});

test("withStructuredOutput will always force tool usage", async () => {
  const model = new ChatMistralAI({
    temperature: 0,
    model: "mistral-large-latest",
  });

  const weatherTool = z
    .object({
      location: z.string().describe("The name of city to get the weather for."),
    })
    .describe(
      "Get the weather of a specific location and return the temperature in Celsius."
    );
  const modelWithTools = model.withStructuredOutput(weatherTool, {
    name: "get_weather",
    includeRaw: true,
  });
  const response = await modelWithTools.invoke(
    "What is the sum of 271623 and 281623? It is VERY important you use a calculator tool to give me the answer."
  );

  if (!("tool_calls" in response.raw)) {
    throw new Error("Tool call not found in response");
  }
  const castMessage = response.raw as AIMessage;
  expect(castMessage.tool_calls).toHaveLength(1);
});

test("Test ChatMistralAI can invoke with MessageContent input types", async () => {
  const model = new ChatMistralAI({
    model: "pixtral-12b-2409",
  });
  const messagesListContent = [
    new SystemMessage({
      content: "List the top 5 countries in Europe with the highest GDP",
    }),
    new HumanMessage({
      content: [
        {
          type: "text",
          text: "Here is an infographic with European GPDs",
        },
        {
          type: "image_url",
          image_url: "https://mistral.ai/images/news/pixtral-12b/gdp.png",
        },
      ],
    }),
  ];
  const response = await model.invoke(messagesListContent);
  console.log("response", response);
  expect(response.content.length).toBeGreaterThan(1);
});

test("Mistral ContentChunk to MessageContentComplex conversion", () => {
  const mistralMessages = [
    {
      type: "text",
      text: "Test message",
    },
    {
      type: "image_url",
      imageUrl: "https://mistral.ai/images/news/pixtral-12b/gdp.png",
    },
    {
      type: "image_url",
      imageUrl: {
        url: "https://mistral.ai/images/news/pixtral-12b/gdp.png",
        detail: "high",
      },
    },
    {
      type: "image_url",
      imageUrl: {
        url: "https://mistral.ai/images/news/pixtral-12b/gdp.png",
        detail: "medium",
      },
    },
    {
      type: "image_url",
      imageUrl: {
        url: "https://mistral.ai/images/news/pixtral-12b/gdp.png",
      },
    },
  ] as MistralAIContentChunk[];

  expect(_mistralContentChunkToMessageContentComplex(mistralMessages)).toEqual([
    {
      type: "text",
      text: "Test message",
    },
    {
      type: "image_url",
      image_url: "https://mistral.ai/images/news/pixtral-12b/gdp.png",
    },
    {
      type: "image_url",
      image_url: {
        url: "https://mistral.ai/images/news/pixtral-12b/gdp.png",
        detail: "high",
      },
    },
    {
      type: "image_url",
      image_url: {
        url: "https://mistral.ai/images/news/pixtral-12b/gdp.png",
      },
    },
    {
      type: "image_url",
      image_url: {
        url: "https://mistral.ai/images/news/pixtral-12b/gdp.png",
      },
    },
  ]);
});

test("Test ChatMistralAI can register BeforeRequestHook function", async () => {
  const model = new ChatMistralAI({
    model: "mistral-tiny",
  });
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a helpful assistant"],
    ["human", "{input}"],
  ]);

  let count = 0;
  const addCount = () => {
    count += 1;
  };

  const beforeRequestHook = (): void => {
    addCount();
  };
  model.beforeRequestHooks = [beforeRequestHook];
  model.addAllHooksToHttpClient();

  await prompt.pipe(model).invoke({
    input: "Hello",
  });
  // console.log(count);
  expect(count).toEqual(1);
});

test("Test ChatMistralAI can register RequestErrorHook function", async () => {
  const fetcher = (): Promise<Response> =>
    Promise.reject(new Error("Intended fetcher error"));
  const customHttpClient = new HTTPClient({ fetcher });

  const model = new ChatMistralAI({
    model: "mistral-tiny",
    httpClient: customHttpClient,
    maxRetries: 0,
  });
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a helpful assistant"],
    ["human", "{input}"],
  ]);

  let count = 0;
  const addCount = () => {
    count += 1;
  };

  const RequestErrorHook = (): void => {
    addCount();
    console.log("In request error hook");
  };
  model.requestErrorHooks = [RequestErrorHook];
  model.addAllHooksToHttpClient();

  try {
    await prompt.pipe(model).invoke({
      input: "Hello",
    });
  } catch (e: unknown) {
    // Intended error, do not rethrow
  }

  // console.log(count);
  expect(count).toEqual(1);
});

test("Test ChatMistralAI can register ResponseHook function", async () => {
  const model = new ChatMistralAI({
    model: "mistral-tiny",
  });
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a helpful assistant"],
    ["human", "{input}"],
  ]);

  let count = 0;
  const addCount = () => {
    count += 1;
  };

  const ResponseHook = (): void => {
    addCount();
  };
  model.responseHooks = [ResponseHook];
  model.addAllHooksToHttpClient();

  await prompt.pipe(model).invoke({
    input: "Hello",
  });
  // console.log(count);
  expect(count).toEqual(1);
});

test("Test ChatMistralAI can register multiple hook functions with success", async () => {
  const model = new ChatMistralAI({
    model: "mistral-tiny",
  });
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a helpful assistant"],
    ["human", "{input}"],
  ]);

  let count = 0;
  const addCount = () => {
    count += 1;
  };

  const beforeRequestHook = (): void => {
    addCount();
  };
  const ResponseHook = (): void => {
    addCount();
  };
  model.beforeRequestHooks = [beforeRequestHook];
  model.responseHooks = [ResponseHook];
  model.addAllHooksToHttpClient();

  await prompt.pipe(model).invoke({
    input: "Hello",
  });
  // console.log(count);
  expect(count).toEqual(2);
});

test("Test ChatMistralAI can register multiple hook functions with error", async () => {
  const fetcher = (): Promise<Response> =>
    Promise.reject(new Error("Intended fetcher error"));
  const customHttpClient = new HTTPClient({ fetcher });

  const model = new ChatMistralAI({
    model: "mistral-tiny",
    httpClient: customHttpClient,
    maxRetries: 0,
  });

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a helpful assistant"],
    ["human", "{input}"],
  ]);

  let count = 0;
  const addCount = () => {
    count += 1;
  };

  const beforeRequestHook = (): void => {
    addCount();
  };
  const RequestErrorHook = (): void => {
    addCount();
  };
  model.beforeRequestHooks = [beforeRequestHook];
  model.requestErrorHooks = [RequestErrorHook];
  model.addAllHooksToHttpClient();

  try {
    await prompt.pipe(model).invoke({
      input: "Hello",
    });
  } catch (e: unknown) {
    // Intended error, do not rethrow
  }
  // console.log(count);
  expect(count).toEqual(2);
});

test("Test ChatMistralAI can remove hook", async () => {
  const model = new ChatMistralAI({
    model: "mistral-tiny",
  });
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a helpful assistant"],
    ["human", "{input}"],
  ]);

  let count = 0;
  const addCount = () => {
    count += 1;
  };

  const beforeRequestHook = (): void => {
    addCount();
  };
  model.beforeRequestHooks = [beforeRequestHook];
  model.addAllHooksToHttpClient();

  await prompt.pipe(model).invoke({
    input: "Hello",
  });
  // console.log(count);
  expect(count).toEqual(1);

  model.removeHookFromHttpClient(beforeRequestHook);

  await prompt.pipe(model).invoke({
    input: "Hello",
  });
  // console.log(count);
  expect(count).toEqual(1);
});

test("Test ChatMistralAI can remove all hooks", async () => {
  const model = new ChatMistralAI({
    model: "mistral-tiny",
  });
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a helpful assistant"],
    ["human", "{input}"],
  ]);

  let count = 0;
  const addCount = () => {
    count += 1;
  };

  const beforeRequestHook = (): void => {
    addCount();
  };
  const ResponseHook = (): void => {
    addCount();
  };
  model.beforeRequestHooks = [beforeRequestHook];
  model.responseHooks = [ResponseHook];
  model.addAllHooksToHttpClient();

  await prompt.pipe(model).invoke({
    input: "Hello",
  });
  // console.log(count);
  expect(count).toEqual(2);

  model.removeAllHooksFromHttpClient();

  await prompt.pipe(model).invoke({
    input: "Hello",
  });
  // console.log(count);
  expect(count).toEqual(2);
});
