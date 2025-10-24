import { z } from "zod";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { expect, test } from "@jest/globals";
import { JsonOutputFunctionsParser } from "../../../output_parsers/openai_functions.js";
import {
  createOpenAIFnRunnable,
  createStructuredOutputRunnable,
} from "../base.js";

const personJSONSchema = {
  title: "Person",
  description: "Identifying information about a person.",
  type: "object",
  properties: {
    name: { title: "Name", description: "The person's name", type: "string" },
    age: { title: "Age", description: "The person's age", type: "integer" },
    fav_food: {
      title: "Fav Food",
      description: "The person's favorite food",
      type: "string",
    },
  },
  required: ["name", "age"],
} as const;

const personDetailsFunction = {
  name: "get_person_details",
  description: "Get details about a person",
  parameters: personJSONSchema,
};

const weatherFunction = {
  name: "get_weather",
  description: "Get the weather for a location",
  parameters: {
    title: "Location",
    description: "The location to get the weather for.",
    type: "object",
    properties: {
      state: {
        title: "State",
        description: "The location's state",
        type: "string",
      },
      city: {
        title: "City",
        description: "The location's city",
        type: "string",
      },
      zip_code: {
        title: "Zip Code",
        description: "The locations's zip code",
        type: "string",
      },
    },
    required: ["state", "city"],
  },
};

test("createStructuredOutputRunnable works with Zod", async () => {
  const model = new ChatOpenAI({
    model: "gpt-4o-mini",
  });
  const prompt = ChatPromptTemplate.fromMessages<{ description: string }>([
    ["human", "Human description: {description}"],
  ]);

  const zodSchema = z.object({
    person: z.object({
      name: z.string(),
      age: z.string(),
      fav_food: z.optional(z.string()),
    }),
  });

  const outputParser = new JsonOutputFunctionsParser<{
    person: {
      name: string;
      age: number;
      fav_food?: string;
    };
  }>();

  const runnable = createStructuredOutputRunnable({
    outputSchema: zodSchema,
    llm: model,
    prompt,
    outputParser,
  });
  const response = await runnable.invoke({
    description:
      "My name's John Doe and I'm 30 years old. My favorite kind of food are chocolate chip cookies.",
  });
  // console.log(response);
  expect("person" in response).toBe(true);
  expect("name" in response.person).toBe(true);
  expect("age" in response.person).toBe(true);
});

test("createStructuredOutputRunnable works with JSON schema", async () => {
  const model = new ChatOpenAI({
    model: "gpt-4o-mini",
  });
  const prompt = ChatPromptTemplate.fromMessages<{ description: string }>([
    ["human", "Human description: {description}"],
  ]);

  const outputParser = new JsonOutputFunctionsParser<{
    name: string;
    age: number;
    fav_food?: string;
  }>();

  const runnable = createStructuredOutputRunnable({
    outputSchema: personJSONSchema,
    llm: model,
    prompt,
    outputParser,
  });
  const response = await runnable.invoke({
    description:
      "My name's John Doe and I'm 30 years old. My favorite kind of food are chocolate chip cookies.",
  });
  // console.log(response);
  expect("name" in response).toBe(true);
  expect("age" in response).toBe(true);
});

test("createOpenAIFnRunnable works", async () => {
  const model = new ChatOpenAI({
    model: "gpt-4o-mini",
  });
  const prompt = ChatPromptTemplate.fromMessages<{ description: string }>([
    ["human", "Human description: {description}"],
  ]);
  const outputParser = new JsonOutputFunctionsParser<{
    name: string;
    age: number;
    fav_food?: string;
  }>();

  const runnable = createOpenAIFnRunnable({
    functions: [personDetailsFunction],
    llm: model,
    prompt,
    enforceSingleFunctionUsage: true, // Default is true
    outputParser,
  });
  const response = await runnable.invoke({
    description:
      "My name's John Doe and I'm 30 years old. My favorite kind of food are chocolate chip cookies.",
  });
  // console.log(response);
  expect("name" in response).toBe(true);
  expect("age" in response).toBe(true);
});

test("createOpenAIFnRunnable works with multiple functions", async () => {
  const model = new ChatOpenAI({
    model: "gpt-4o-mini",
  });
  const prompt = ChatPromptTemplate.fromMessages<{ question: string }>([
    ["human", "Question: {question}"],
  ]);
  const outputParser = new JsonOutputFunctionsParser<{
    state: string;
    city: number;
    zip?: number;
  }>();

  const runnable = createOpenAIFnRunnable({
    functions: [personDetailsFunction, weatherFunction],
    llm: model,
    prompt,
    enforceSingleFunctionUsage: false, // Default is true
    outputParser,
  });
  const response = await runnable.invoke({
    question: "What's the weather like in Berkeley CA?",
  });
  // console.log(response);
  expect("state" in response).toBe(true);
  expect("city" in response).toBe(true);
});
