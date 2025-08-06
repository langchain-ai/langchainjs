import { ChatTogetherAI } from "@langchain/community/chat_models/togetherai";
import { ChatPromptTemplate } from "@langchain/core/prompts";

// Define a JSON schema for the response
const responseSchema = {
  type: "object",
  properties: {
    orderedArray: {
      type: "array",
      items: {
        type: "number",
      },
    },
  },
  required: ["orderedArray"],
};
const modelWithJsonSchema = new ChatTogetherAI({
  temperature: 0,
  apiKey: process.env.TOGETHER_AI_API_KEY,
  model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
}).withConfig({
  response_format: {
    type: "json_object", // Define the response format as a JSON object
    schema: responseSchema, // Pass in the schema for the model's response
  },
});

const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful assistant who responds in JSON."],
  ["human", "Please list this output in order of DESC {unorderedList}."],
]);

// Use LCEL to chain the prompt to the model.
const response = await prompt.pipe(modelWithJsonSchema).invoke({
  unorderedList: "[1, 4, 2, 8]",
});

console.log(JSON.parse(response.content as string));
/**
{ orderedArray: [ 8, 4, 2, 1 ] }
 */
