import { FakeListLLM } from "langchain/llms/fake";

/**
 * The FakeListLLM can be used to simulate ordered predefined responses.
 */

const llm = new FakeListLLM({
  responses: ["I'll callback later.", "You 'console' them!"],
});

const firstResponse = await llm.invoke("You want to hear a JavasSript joke?");
const secondResponse = await llm.invoke(
  "How do you cheer up a JavaScript developer?"
);

console.log({ firstResponse });
console.log({ secondResponse });

/**
 * The FakeListLLM can also be used to simulate streamed responses.
 */

const stream = await llm.stream("You want to hear a JavasSript joke?");
const chunks = [];
for await (const chunk of stream) {
  chunks.push(chunk);
}

console.log(chunks.join(""));

/**
 * The FakeListLLM can also be used to simulate delays in either either synchronous or streamed responses.
 */

const slowLLM = new FakeListLLM({
  responses: ["Because Oct 31 equals Dec 25", "You 'console' them!"],
  sleep: 1000,
});

const slowResponse = await slowLLM.invoke(
  "Why do programmers always mix up Halloween and Christmas?"
);
console.log({ slowResponse });

const slowStream = await slowLLM.stream(
  "How do you cheer up a JavaScript developer?"
);
const slowChunks = [];
for await (const chunk of slowStream) {
  slowChunks.push(chunk);
}

console.log(slowChunks.join(""));
