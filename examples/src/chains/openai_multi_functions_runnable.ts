import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { createOpenAIFnRunnable } from "langchain/chains/openai_functions";
import { JsonOutputFunctionsParser } from "@langchain/core/output_parsers/openai_functions";

const personDetailsFunction = {
  name: "get_person_details",
  description: "Get details about a person",
  parameters: {
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
  },
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
        type: "number",
      },
    },
    required: ["state", "city"],
  },
};

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
});
const prompt = ChatPromptTemplate.fromMessages([
  ["human", "Question: {question}"],
]);
const outputParser = new JsonOutputFunctionsParser();

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
console.log(response);
/*
  { state: 'CA', city: 'Berkeley' }
*/
