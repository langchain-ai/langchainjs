import { OpenAI } from "@langchain/openai";

// To make the caching really obvious, lets use a slower model.
const model = new OpenAI({
  modelName: "gpt-3.5-turbo-instruct",
  cache: true,
});

console.time();

// The first time, it is not yet in cache, so it should take longer
const res = await model.invoke("Tell me a long joke!");
console.log(res);

console.timeEnd();

console.time();

// The second time it is, so it goes faster
const res2 = await model.invoke("Tell me a long joke!");
console.log(res2);

console.timeEnd();
