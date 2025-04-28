import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { HumanMessage } from "@langchain/core/messages";

const extractionFunctionSchema = {
  name: "extractor",
  description: "Extracts fields from the input.",
  parameters: zodToJsonSchema(
    z.object({
      tone: z
        .enum(["positive", "negative"])
        .describe("The overall tone of the input"),
      entity: z.string().describe("The entity mentioned in the input"),
      word_count: z.number().describe("The number of words in the input"),
      chat_response: z.string().describe("A response to the human's input"),
      final_punctuation: z
        .optional(z.string())
        .describe("The final punctuation mark in the input, if any."),
    })
  ),
};

const model = new ChatOpenAI({
  model: "gpt-4",
}).bind({
  functions: [extractionFunctionSchema],
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
        '"tone": "positive",\n' +
        '"entity": "day",\n' +
        '"word_count": 4,\n' +
        `"chat_response": "I'm glad you're enjoying the day!",\n` +
        '"final_punctuation": "!"\n' +
        '}'
    }
  }
}
*/
