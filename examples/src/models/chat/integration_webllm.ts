// Must be run in a web environment, e.g. a web worker

import { ChatWebLLM } from "@langchain/community/chat_models/webllm";
import { HumanMessage } from "@langchain/core/messages";

// Initialize the ChatWebLLM model with the model record and chat options.
// Note that if the appConfig field is set, the list of model records
// must include the selected model record for the engine.

// You can import a list of models available by default here:
// https://github.com/mlc-ai/web-llm/blob/main/src/config.ts
//
// Or by importing it via:
// import { prebuiltAppConfig } from "@mlc-ai/web-llm";
const model = new ChatWebLLM({
  model: "Phi-3-mini-4k-instruct-q4f16_1-MLC",
  chatOptions: {
    temperature: 0.5,
  },
});

// Call the model with a message and await the response.
const response = await model.invoke([
  new HumanMessage({ content: "What is 1 + 1?" }),
]);

console.log(response);

/*
AIMessage {
  content: ' 2\n',
}
*/
