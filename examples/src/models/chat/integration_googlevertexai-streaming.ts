import { ChatVertexAI } from "@langchain/google-vertexai";
// Or, if using the web entrypoint:
// import { ChatVertexAI } from "@langchain/google-vertexai-web";

const model = new ChatVertexAI({
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
  content: [{ type: 'text', text: 'Ahoy there, matey! Me favorite grub be fish and chips, with' }],
  additional_kwargs: {},
  response_metadata: { data: { candidates: [Array], promptFeedback: [Object] } }
}
AIMessageChunk {
  content: [{ type: 'text', text: " a hearty pint o' grog to wash it down. What be yer fancy, landlubber?" }],
  additional_kwargs: {},
  response_metadata: { data: { candidates: [Array] } }
}
AIMessageChunk {
  content: '',
  additional_kwargs: {},
  response_metadata: { finishReason: 'stop' }
}
*/
