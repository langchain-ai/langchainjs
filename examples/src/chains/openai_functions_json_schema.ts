import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { JsonOutputFunctionsParser } from "@langchain/core/output_parsers/openai_functions";

const jsonSchema = {
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
};

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
});
const prompt = ChatPromptTemplate.fromMessages([
  ["human", "Human description: {description}"],
]);
const outputParser = new JsonOutputFunctionsParser();

const runnable = prompt
  .pipe(model.withStructuredOutput(jsonSchema))
  .pipe(outputParser);

const response = await runnable.invoke({
  description:
    "My name's John Doe and I'm 30 years old. My favorite kind of food are chocolate chip cookies.",
});
console.log(response);
/*
  { name: 'John Doe', age: 30, fav_food: 'chocolate chip cookies' }
*/
