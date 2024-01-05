import { ChatOpenAI } from "@langchain/openai";

// To make the caching really obvious, lets use a slower model.
const model = new ChatOpenAI({
  modelName: "gpt-4",
  cache: true,
});

console.time();

// The first time, it is not yet in cache, so it should take longer
const res = await model.invoke("Tell me a joke!");
console.log(res);

console.timeEnd();

console.time();

// The second time it is, so it goes faster
const res2 = await model.invoke("Tell me a joke!");
console.log(res2);

console.timeEnd();
