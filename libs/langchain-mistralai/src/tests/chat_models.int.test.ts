import { test } from "@jest/globals";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
import { AgentExecutor, createOpenAIToolsAgent } from "langchain/agents";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { DynamicStructuredTool, StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  HumanMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ChatMistralAI } from "../chat_models.js";

test("Test ChatMistralAI can invoke", async () => {
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
  console.log("response", response);
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
    console.log(item);
    itters += 1;
    fullMessage += item.content;
  }
  console.log("fullMessage", fullMessage);
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
  }).bind({
    tools: [new Calculator()],
  });

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "you are very bad at math and always must use a calculator"],
    [
      "human",
      "what is the sum of 223 + 228 divided by 718236 multiplied by 1234?",
    ],
  ]);

  const chain = prompt.pipe(model);
  const response = await chain.invoke({});
  expect("tool_calls" in response.additional_kwargs).toBe(true);
  console.log(response.additional_kwargs.tool_calls?.[0]);
  expect(response.additional_kwargs.tool_calls?.[0].function.name).toBe(
    "calculator"
  );
  expect(
    JSON.parse(
      response.additional_kwargs.tool_calls?.[0].function.arguments ?? "{}"
    ).calculator
  ).toBeDefined();
});

test("Can call tools", async () => {
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
  }).bind({
    tools,
  });

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "you are very bad at math and always must use a calculator"],
    [
      "human",
      "what is the sum of 223 + 228 divided by 718236 multiplied by 1234?",
    ],
  ]);
  const chain = prompt.pipe(model);
  const response = await chain.invoke({});
  console.log(response);
  expect(response.tool_calls?.length).toEqual(1);
  expect(response.tool_calls?.[0].args).toEqual(
    JSON.parse(
      response.additional_kwargs.tool_calls?.[0].function.arguments ?? "{}"
    )
  );
  expect("tool_calls" in response.additional_kwargs).toBe(true);
  expect(response.additional_kwargs.tool_calls?.[0].function.name).toBe(
    "calculator"
  );
  expect(
    JSON.parse(
      response.additional_kwargs.tool_calls?.[0].function.arguments ?? "{}"
    ).calculator
  ).toBeDefined();
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
  }).bind({
    tools: [new Calculator()],
  });

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "you are very bad at math and always must use a calculator"],
    [
      "human",
      "what is the sum of 223 + 228 divided by 718236 multiplied by 1234?",
    ],
  ]);

  const chain = prompt.pipe(model);
  const response = await chain.stream({});
  let finalRes: BaseMessage | null = null;
  for await (const chunk of response) {
    console.log(chunk);
    finalRes = chunk;
  }
  if (!finalRes) {
    throw new Error("No final response found");
  }

  expect("tool_calls" in finalRes.additional_kwargs).toBe(true);
  console.log(finalRes.additional_kwargs.tool_calls?.[0]);
  expect(finalRes.additional_kwargs.tool_calls?.[0].function.name).toBe(
    "calculator"
  );
  expect(
    JSON.parse(
      finalRes.additional_kwargs.tool_calls?.[0].function.arguments ?? "{}"
    ).calculator
  ).toBeDefined();
});

test("Can use json mode response format", async () => {
  const model = new ChatMistralAI({
    model: "mistral-large-latest",
  }).bind({
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

  console.log(response);
  const parsedRes = JSON.parse(response.content as string);
  expect(parsedRes.calculator).toBeDefined();
});

test("Can call .stream with json mode", async () => {
  const model = new ChatMistralAI({
    model: "mistral-large-latest",
  }).bind({
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
    console.log(chunk);
    finalRes += chunk.content;
  }

  console.log(finalRes);
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
  }).bind({
    tools: [new PersonTraits()],
  });

  const prompt = ChatPromptTemplate.fromMessages([
    "system",
    "You are a helpful assistant, who always logs the traits of a person and their friends because the user has a bad memory.",
    "human",
    "Hi!!! My name's John Doe, and I'm almost 4 years old!. I have 6 friends: Mary, age 24, May, age 22, and Jane, age 30, Joey, age 18, Sam, age 19 and MacFarland age 66. They're all super cool!",
  ]);

  const chain = prompt.pipe(model);
  const response = await chain.stream({});
  let finalRes: BaseMessage[] = [];
  for await (const chunk of response) {
    console.log(chunk);
    finalRes = finalRes.concat(chunk);
  }
  if (!finalRes) {
    throw new Error("No final response found");
  }

  expect(finalRes[0].additional_kwargs.tool_calls?.[0]).toBeDefined();
  const toolCall = finalRes[0].additional_kwargs.tool_calls?.[0];
  expect(toolCall?.function.name).toBe("person_traits");
  const args = JSON.parse(toolCall?.function.arguments ?? "{}");
  const { person } = args;
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
  }).bind({
    tools: [
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
    ],
  });
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
  console.log(res);
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
    console.log(result);
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
      zodToJsonSchema(calculatorSchema),
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
    console.log(result);
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
    console.log(result);
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
      zodToJsonSchema(calculatorSchema),
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
    console.log(result);
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
    console.log(result);

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
        JSON.parse(
          raw.additional_kwargs.tool_calls?.[0].function.arguments ?? ""
        )
    ).toBe(true);
    expect(
      "number1" in
        JSON.parse(
          raw.additional_kwargs.tool_calls?.[0].function.arguments ?? ""
        )
    ).toBe(true);
    expect(
      "number2" in
        JSON.parse(
          raw.additional_kwargs.tool_calls?.[0].function.arguments ?? ""
        )
    ).toBe(true);
  });

  test("Model is compatible with OpenAI tools agent and Agent Executor", async () => {
    const llm: BaseChatModel = new ChatMistralAI({
      temperature: 0,
      model: "mistral-large-latest",
    });

    const systemMessage = SystemMessagePromptTemplate.fromTemplate(
      "You are an agent capable of retrieving current weather information."
    );
    const humanMessage = HumanMessagePromptTemplate.fromTemplate("{input}");
    const agentScratchpad = new MessagesPlaceholder("agent_scratchpad");

    const prompt = ChatPromptTemplate.fromMessages([
      systemMessage,
      humanMessage,
      agentScratchpad,
    ]);

    const currentWeatherTool = new DynamicStructuredTool({
      name: "get_current_weather",
      description: "Get the current weather in a given location",
      schema: z.object({
        location: z
          .string()
          .describe("The city and state, e.g. San Francisco, CA"),
      }),
      func: async () => Promise.resolve("28 °C"),
    });

    const agent = await createOpenAIToolsAgent({
      llm,
      tools: [currentWeatherTool],
      prompt,
    });

    const agentExecutor = new AgentExecutor({
      agent,
      tools: [currentWeatherTool],
    });

    const input = "What's the weather like in Paris?";
    const { output } = await agentExecutor.invoke({ input });

    console.log(output);
    expect(output).toBeDefined();
    expect(output).toContain("The current temperature in Paris is 28 °C");
  });
});

describe("ChatMistralAI aborting", () => {
  test("ChatMistralAI can abort request via .stream", async () => {
    const controller = new AbortController();
    const model = new ChatMistralAI().bind({
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
        console.log(finalRes);
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
    const model = new ChatMistralAI().bind({
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
        console.log(finalRes);
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
    const model = new ChatMistralAI().bind({
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
    const model = new ChatMistralAI().bind({
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
    console.log("response", response);
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
      console.log(item);
      itters += 1;
      fullMessage += item.content;
    }
    console.log("fullMessage", fullMessage);
    expect(itters).toBeGreaterThan(1);
    expect(fullMessage.toLowerCase()).toContain("hello");
    expect(fullMessage.toLowerCase()).toContain("world");
  });

  test("Can call tools using structured tools codestral-latest", async () => {
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

    const model = new ChatMistralAI({
      model: "codestral-latest",
    }).bind({
      tools: [new CodeSandbox()],
      tool_choice: "any",
    });

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", "You are an excellent python engineer."],
      ["human", "{input}"],
    ]);

    const chain = prompt.pipe(model);
    const response = await chain.invoke({
      input:
        "Write a function that takes in a single argument and logs it to the console. Ensure the code is in Python.",
    });
    console.log(response);
    expect("tool_calls" in response.additional_kwargs).toBe(true);
    console.log(response.additional_kwargs.tool_calls?.[0]);
    if (!response.additional_kwargs.tool_calls?.[0]) {
      throw new Error("No tool call found");
    }
    const sandboxTool = response.additional_kwargs.tool_calls[0];
    expect(sandboxTool.function.name).toBe("code_sandbox");
    const parsedArgs = JSON.parse(sandboxTool.function.arguments);
    expect(parsedArgs.code).toBeDefined();
    console.log(parsedArgs.code);
  });
});

test("Stream token count usage_metadata", async () => {
  const model = new ChatMistralAI({
    model: "codestral-latest",
    temperature: 0,
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
  console.log(res);
  expect(res?.usage_metadata).toBeDefined();
  if (!res?.usage_metadata) {
    return;
  }
  expect(res.usage_metadata.input_tokens).toBe(13);
  expect(res.usage_metadata.output_tokens).toBeGreaterThan(10);
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
  console.log(res);
  expect(res?.usage_metadata).not.toBeDefined();
});

test("Invoke token count usage_metadata", async () => {
  const model = new ChatMistralAI({
    model: "codestral-latest",
    temperature: 0,
  });
  const res = await model.invoke("Why is the sky blue? Be concise.");
  console.log(res);
  expect(res?.usage_metadata).toBeDefined();
  if (!res?.usage_metadata) {
    return;
  }
  expect(res.usage_metadata.input_tokens).toBe(13);
  expect(res.usage_metadata.output_tokens).toBeGreaterThan(10);
  expect(res.usage_metadata.total_tokens).toBe(
    res.usage_metadata.input_tokens + res.usage_metadata.output_tokens
  );
});
