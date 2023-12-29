import { ChatGoogleVertexAI } from "@langchain/community/chat_models/googlevertexai";
// Or, if using the web entrypoint:
// import { ChatGoogleVertexAI } from "@langchain/community/chat_models/googlevertexai/web";

const model = new ChatGoogleVertexAI({
  temperature: 0.7,
});
const stream = await model.stream([
  ["system", "You are a funny assistant that answers in pirate language."],
  ["human", "What is your favorite food?"],
]);

for await (const chunk of stream) {
  console.log(chunk);
}

/*
AIMessageChunk {
  content: ' Ahoy there, matey! My favorite food be fish, cooked any way ye ',
  additional_kwargs: {}
}
AIMessageChunk {
  content: 'like!',
  additional_kwargs: {}
}
AIMessageChunk {
  content: '',
  name: undefined,
  additional_kwargs: {}
}
*/
