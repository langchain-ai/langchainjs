/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "@jest/globals";
import { z } from "zod";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import { BaseMessageChunk, HumanMessage } from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatAnthropicTools } from "../tool_calling.js";

test.skip("Test ChatAnthropicTools", async () => {
  const chat = new ChatAnthropicTools({
    modelName: "claude-3-sonnet-20240229",
    maxRetries: 0,
  });
  const message = new HumanMessage("Hello!");
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await chat.invoke([message]);
  // console.log(JSON.stringify(res));
});

test.skip("Test ChatAnthropicTools streaming", async () => {
  const chat = new ChatAnthropicTools({
    modelName: "claude-3-sonnet-20240229",
    maxRetries: 0,
  });
  const message = new HumanMessage("Hello!");
  const stream = await chat.stream([message]);
  const chunks: BaseMessageChunk[] = [];
  for await (const chunk of stream) {
    // console.log(chunk);
    chunks.push(chunk);
  }
  expect(chunks.length).toBeGreaterThan(1);
});

test.skip("Test ChatAnthropicTools with tools", async () => {
  const chat = new ChatAnthropicTools({
    modelName: "claude-3-sonnet-20240229",
    temperature: 0.1,
    maxRetries: 0,
  }).withConfig({
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
              unit: {
                type: "string",
                enum: ["celsius", "fahrenheit"],
              },
            },
            required: ["location"],
          },
        },
      },
    ],
  });
  const message = new HumanMessage("What is the weather in San Francisco?");
  const res = await chat.invoke([message]);
  // console.log(JSON.stringify(res));
  expect(res.additional_kwargs.tool_calls).toBeDefined();
  expect(res.additional_kwargs.tool_calls?.[0].function.name).toEqual(
    "get_current_weather"
  );
});

test.skip("Test ChatAnthropicTools with a forced function call", async () => {
  const chat = new ChatAnthropicTools({
    modelName: "claude-3-sonnet-20240229",
    temperature: 0.1,
    maxRetries: 0,
  }).withConfig({
    tools: [
      {
        type: "function",
        function: {
          name: "extract_data",
          description: "Return information about the input",
          parameters: {
            type: "object",
            properties: {
              sentiment: {
                type: "string",
                description: "The city and state, e.g. San Francisco, CA",
              },
              aggressiveness: {
                type: "integer",
                description: "How aggressive the input is from 1 to 10",
              },
              language: {
                type: "string",
                description: "The language the input is in",
              },
            },
            required: ["sentiment", "aggressiveness"],
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "extract_data" } },
  });
  const message = new HumanMessage(
    "Extract the desired information from the following passage:\n\nthis is really cool"
  );
  const res = await chat.invoke([message]);
  // console.log(JSON.stringify(res));
  expect(res.additional_kwargs.tool_calls).toBeDefined();
  expect(res.additional_kwargs.tool_calls?.[0]?.function.name).toEqual(
    "extract_data"
  );
});

test.skip("ChatAnthropicTools with Zod schema", async () => {
  const schema = z.object({
    people: z.array(
      z.object({
        name: z.string().describe("The name of a person"),
        height: z.number().describe("The person's height"),
        hairColor: z.optional(z.string()).describe("The person's hair color"),
      })
    ),
  });
  const chat = new ChatAnthropicTools({
    modelName: "claude-3-sonnet-20240229",
    temperature: 0.1,
    maxRetries: 0,
  }).withConfig({
    tools: [
      {
        type: "function",
        function: {
          name: "information_extraction",
          description: "Extracts the relevant information from the passage.",
          parameters: toJsonSchema(schema),
        },
      },
    ],
    tool_choice: {
      type: "function",
      function: {
        name: "information_extraction",
      },
    },
  });
  const message = new HumanMessage(
    "Alex is 5 feet tall. Claudia is 1 foot taller than Alex and jumps higher than him. Claudia is a brunette and Alex is blonde."
  );
  const res = await chat.invoke([message]);
  // console.log(JSON.stringify(res));
  expect(res.additional_kwargs.tool_calls).toBeDefined();
  expect(res.additional_kwargs.tool_calls?.[0]?.function.name).toEqual(
    "information_extraction"
  );
  expect(
    JSON.parse(res.additional_kwargs.tool_calls?.[0]?.function.arguments ?? "")
  ).toEqual({
    people: expect.arrayContaining([
      { name: "Alex", height: 5, hairColor: "blonde" },
      { name: "Claudia", height: 6, hairColor: "brunette" },
    ]),
  });
});

test.skip("ChatAnthropicTools with parallel tool calling", async () => {
  const schema = z.object({
    name: z.string().describe("The name of a person"),
    height: z.number().describe("The person's height"),
    hairColor: z.optional(z.string()).describe("The person's hair color"),
  });
  const chat = new ChatAnthropicTools({
    modelName: "claude-3-sonnet-20240229",
    temperature: 0.1,
    maxRetries: 0,
  }).withConfig({
    tools: [
      {
        type: "function",
        function: {
          name: "person",
          description: "A person mentioned in the passage.",
          parameters: toJsonSchema(schema),
        },
      },
    ],
    tool_choice: {
      type: "function",
      function: {
        name: "person",
      },
    },
  });
  // console.log(toJsonSchema(schema));
  const message = new HumanMessage(
    "Alex is 5 feet tall. Claudia is 1 foot taller than Alex and jumps higher than him. Claudia is a brunette and Alex is blonde."
  );
  const res = await chat.invoke([message]);
  // console.log(JSON.stringify(res));
  expect(res.additional_kwargs.tool_calls).toBeDefined();
  expect(
    res.additional_kwargs.tool_calls?.map((toolCall) =>
      JSON.parse(toolCall.function.arguments ?? "")
    )
  ).toEqual(
    expect.arrayContaining([
      { name: "Alex", height: 5, hairColor: "blonde" },
      { name: "Claudia", height: 6, hairColor: "brunette" },
    ])
  );
});

test.skip("Test ChatAnthropic withStructuredOutput", async () => {
  const runnable = new ChatAnthropicTools({
    modelName: "claude-3-sonnet-20240229",
    maxRetries: 0,
  }).withStructuredOutput(
    z.object({
      name: z.string().describe("The name of a person"),
      height: z.number().describe("The person's height"),
      hairColor: z.optional(z.string()).describe("The person's hair color"),
    }),
    {
      name: "person",
    }
  );
  const message = new HumanMessage("Alex is 5 feet tall. Alex is blonde.");
  const res = await runnable.invoke([message]);
  // console.log(JSON.stringify(res, null, 2));
  expect(res).toEqual({ name: "Alex", height: 5, hairColor: "blonde" });
});

test.skip("Test ChatAnthropic withStructuredOutput on a single array item", async () => {
  const runnable = new ChatAnthropicTools({
    modelName: "claude-3-sonnet-20240229",
    maxRetries: 0,
  }).withStructuredOutput(
    z.object({
      people: z.array(
        z.object({
          name: z.string().describe("The name of a person"),
          height: z.number().describe("The person's height"),
          hairColor: z.optional(z.string()).describe("The person's hair color"),
        })
      ),
    })
  );
  const message = new HumanMessage("Alex is 5 feet tall. Alex is blonde.");
  const res = await runnable.invoke([message]);
  // console.log(JSON.stringify(res, null, 2));
  expect(res).toEqual({
    people: [{ hairColor: "blonde", height: 5, name: "Alex" }],
  });
});

test.skip("Test ChatAnthropic withStructuredOutput on a single array item", async () => {
  const runnable = new ChatAnthropicTools({
    modelName: "claude-3-sonnet-20240229",
    maxRetries: 0,
  }).withStructuredOutput(
    z.object({
      sender: z
        .optional(z.string())
        .describe("The sender's name, if available"),
      sender_phone_number: z
        .optional(z.string())
        .describe("The sender's phone number, if available"),
      sender_address: z
        .optional(z.string())
        .describe("The sender's address, if available"),
      action_items: z
        .array(z.string())
        .describe("A list of action items requested by the email"),
      topic: z
        .string()
        .describe("High level description of what the email is about"),
      tone: z.enum(["positive", "negative"]).describe("The tone of the email."),
    }),
    {
      name: "Email",
    }
  );
  const prompt = ChatPromptTemplate.fromMessages([
    [
      "human",
      "What can you tell me about the following email? Make sure to answer in the correct format: {email}",
    ],
  ]);
  const extractionChain = prompt.pipe(runnable);
  const response = await extractionChain.invoke({
    email:
      "From: Erick. The email is about the new project. The tone is positive. The action items are to send the report and to schedule a meeting.",
  });
  // console.log(JSON.stringify(response, null, 2));
  expect(response).toEqual({
    sender: "Erick",
    action_items: [expect.any(String), expect.any(String)],
    topic: expect.any(String),
    tone: "positive",
  });
});

test.skip("Test ChatAnthropicTools", async () => {
  const chat = new ChatAnthropicTools({
    modelName: "claude-3-sonnet-20240229",
    maxRetries: 0,
  });
  const structured = chat.withStructuredOutput(
    z.object({
      nested: z.array(z.number()),
    }),
    { force: false }
  );
  const res = await structured.invoke(
    "What are the first five natural numbers?"
  );
  // console.log(res);
  expect(res).toEqual({
    nested: [1, 2, 3, 4, 5],
  });
});
