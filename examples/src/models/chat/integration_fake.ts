import { FakeListChatModel } from "@langchain/core/utils/testing";
import { HumanMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";

/**
 * The FakeListChatModel can be used to simulate ordered predefined responses.
 */

const chat = new FakeListChatModel({
  responses: ["I'll callback later.", "You 'console' them!"],
});

const firstMessage = new HumanMessage("You want to hear a JavasSript joke?");
const secondMessage = new HumanMessage(
  "How do you cheer up a JavaScript developer?"
);
const firstResponse = await chat.invoke([firstMessage]);
const secondResponse = await chat.invoke([secondMessage]);

console.log({ firstResponse });
console.log({ secondResponse });

/**
 * The FakeListChatModel can also be used to simulate streamed responses.
 */

const stream = await chat
  .pipe(new StringOutputParser())
  .stream(`You want to hear a JavasSript joke?`);
const chunks = [];
for await (const chunk of stream) {
  chunks.push(chunk);
}

console.log(chunks.join(""));

/**
 * The FakeListChatModel can also be used to simulate delays in either either synchronous or streamed responses.
 */

const slowChat = new FakeListChatModel({
  responses: ["Because Oct 31 equals Dec 25", "You 'console' them!"],
  sleep: 1000,
});

const thirdMessage = new HumanMessage(
  "Why do programmers always mix up Halloween and Christmas?"
);
const slowResponse = await slowChat.invoke([thirdMessage]);
console.log({ slowResponse });

const slowStream = await slowChat
  .pipe(new StringOutputParser())
  .stream("How do you cheer up a JavaScript developer?");
const slowChunks = [];
for await (const chunk of slowStream) {
  slowChunks.push(chunk);
}

console.log(slowChunks.join(""));
