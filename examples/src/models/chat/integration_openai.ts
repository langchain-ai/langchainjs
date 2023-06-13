import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage } from "langchain/schema";
import { SerpAPI } from "langchain/tools";

const model = new ChatOpenAI({
  temperature: 0.9,
  openAIApiKey: "YOUR-API-KEY", // In Node.js defaults to process.env.OPENAI_API_KEY
});

// You can also pass functions to the model, learn more here
// https://platform.openai.com/docs/guides/gpt/function-calling

const modelForFunctionCalling = new ChatOpenAI({
  modelName: "gpt-4-0613",
  temperature: 0,
});

const result = await modelForFunctionCalling.predictMessages(
  [new HumanChatMessage("What is the weather in New York?")],
  { tools: [new SerpAPI()] }
);

console.log(result);
/*
AIChatMessage {
  text: '',
  name: undefined,
  additional_kwargs: {
    function_call: {
      name: 'search',
      arguments: '{\n  "input": "current weather in New York"\n}'
    }
  }
}
*/
