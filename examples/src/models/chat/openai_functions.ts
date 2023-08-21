import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanMessage } from "langchain/schema";

const extractionFunctionSchema = {
  name: "extractor",
  description: "Extracts fields from the input.",
  parameters: {
    type: "object",
    properties: {
      tone: {
        type: "string",
        enum: ["positive", "negative"],
        description: "The overall tone of the input",
      },
      word_count: {
        type: "number",
        description: "The number of words in the input",
      },
      chat_response: {
        type: "string",
        description: "A response to the human's input",
      },
    },
    required: ["tone", "word_count", "chat_response"],
  },
};

// Bind function arguments to the model.
// All subsequent invoke calls will use the bound parameters.
// "functions.parameters" must be formatted as JSON Schema
// Omit "function_call" if you want the model to choose a function to call.
const model = new ChatOpenAI({
  modelName: "gpt-4",
}).bind({
  functions: [extractionFunctionSchema],
  function_call: { name: "extractor", arguments: "" },
});

const result = await model.invoke([new HumanMessage("What a beautiful day!")]);

console.log(result);

/*
  AIMessage {
    content: '',
    name: undefined,
    additional_kwargs: {
      function_call: {
        name: 'extractor',
        arguments: '{\n' +
          '  "tone": "positive",\n' +
          '  "word_count": 4,\n' +
          '  "chat_response": "It certainly is a beautiful day!"\n' +
          '}'
      }
    }
  }
*/

// Alternatively, you can pass function call arguments as an additional argument as a one-off:
/*
const model = new ChatOpenAI({
  modelName: "gpt-4",
});

const result = await model.call([
  new HumanMessage("What a beautiful day!")
], {
  functions: [extractionFunctionSchema],
  function_call: {name: "extractor"}
});
*/
