import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";

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

const model = new ChatOpenAI({
  model: "gpt-4",
})
  .bindTools([
    {
      name: "extractor",
      description: "Extracts fields from the input.",
      schema: extractionFunctionSchema,
    },
  ])
  .withConfig({
    function_call: { name: "extractor" },
  });

const result = await model.invoke([new HumanMessage("What a beautiful day!")]);

console.log(result);
/*
AIMessage {
  lc_serializable: true,
  lc_kwargs: { content: '', additional_kwargs: { function_call: [Object] } },
  lc_namespace: [ 'langchain', 'schema' ],
  content: '',
  name: undefined,
  additional_kwargs: {
    function_call: {
      name: 'extractor',
      arguments: '{\n' +
        '  "tone": "positive",\n' +
        '  "word_count": 4,\n' +
        `  "chat_response": "I'm glad you're enjoying the day! What makes it so beautiful for you?"\n` +
        '}'
    }
  }
}
*/
