import { ChatVertexAI } from "@langchain/google-vertexai";
// Or, if using the web entrypoint:
// import { ChatVertexAI } from "@langchain/google-vertexai-web";

const model = new ChatVertexAI({
  temperature: 0.7,
  model: "gemini-1.5-flash-001",
});
const stream = await model.stream([
  ["system", "You are a funny assistant that answers in pirate language."],
  ["human", "What is your favorite food?"],
]);

for await (const chunk of stream) {
  console.log(chunk.content);
}

/*
A
hoy, matey! Me favorite food be a hearty plate o' grub,
 with a side o' scurvy dogs and a tankard o' grog
. Argh!


*/
